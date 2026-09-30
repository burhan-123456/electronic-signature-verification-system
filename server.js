const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;


// Setup directories
const evidenceDir = path.join(__dirname, 'evidence');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(express.static('public'));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Helper function to calculate SHA-256
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Sign Document Route
app.post('/api/sign', upload.single('document'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded' });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;

        // 1. Calculate SHA-256 Hash
        const hash = calculateHash(filePath);

        // 2. Generate RSA Key Pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        // 3. Sign the hash
        const sign = crypto.createSign('SHA256');
        sign.update(hash);
        sign.end();
        const signature = sign.sign(privateKey, 'hex');

        // 4. Store Public Key and Signature as Evidence
        const evidenceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        const evidenceData = {
            evidenceId,
            originalName,
            hash,
            signature,
            publicKey,
            timestamp: new Date().toISOString()
        };

        const evidencePath = path.join(evidenceDir, `${evidenceId}.json`);
        fs.writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2));

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            evidenceId,
            hash,
            signature,
            publicKey,
            message: 'Document signed successfully and evidence stored.'
        });
    } catch (error) {
        console.error('Signing error:', error);
        res.status(500).json({ error: 'Error signing document' });
    }
});

// Verify Document Route
app.post('/api/verify', upload.single('document'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded' });
        }

        const evidenceId = req.body.evidenceId;
        if (!evidenceId) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Evidence ID is required for verification' });
        }

        const evidencePath = path.join(evidenceDir, `${evidenceId}.json`);
        if (!fs.existsSync(evidencePath)) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Evidence record not found. Cannot verify.' });
        }

        const filePath = req.file.path;
        const fileSize = req.file.size;
        const fileName = req.file.originalname;

        // Load evidence
        const evidenceData = JSON.parse(fs.readFileSync(evidencePath));

        // 1. Calculate new SHA-256 Hash
        const newHash = calculateHash(filePath);

        // 2. Compare Hashes
        const hashMatch = newHash === evidenceData.hash;

        // 3. Verify Signature using Public Key
        const verify = crypto.createVerify('SHA256');
        verify.update(newHash);
        verify.end();

        let signatureValid = false;
        try {
            signatureValid = verify.verify(evidenceData.publicKey, evidenceData.signature, 'hex');
        } catch (e) {
            signatureValid = false;
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Prepare Verification Result
        const result = {
            caseId: evidenceData.evidenceId,
            fileName: fileName,
            fileSize: fileSize + ' bytes',
            hash: newHash,
            originalHash: evidenceData.hash,
            hashMatch: hashMatch,
            signatureValid: signatureValid,
            integrityPreserved: hashMatch && signatureValid,
            overallResult: (hashMatch && signatureValid) ? 'AUTHENTIC' : 'TAMPERED',
            algorithm: 'RSA-SHA256',
            timestamp: new Date().toISOString()
        };

        res.json(result);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Error verifying document' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
