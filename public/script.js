document.addEventListener('DOMContentLoaded', () => {
    const signForm = document.getElementById('sign-form');
    const verifyForm = document.getElementById('verify-form');
    
    // Sign Document
    signForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('sign-file');
        if (!fileInput.files[0]) return alert('Please select a file to sign.');

        const formData = new FormData();
        formData.append('document', fileInput.files[0]);

        try {
            const btn = signForm.querySelector('button');
            btn.textContent = 'Signing...';
            btn.disabled = true;

            const response = await fetch('/api/sign', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                document.getElementById('evidence-id').textContent = data.evidenceId;
                document.getElementById('sign-hash').textContent = data.hash;
                document.getElementById('sign-result').classList.remove('hidden');
                
                // Pre-fill the verify section for convenience during demo
                document.getElementById('verify-evidence-id').value = data.evidenceId;
            } else {
                alert(data.error || 'Error signing document');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during signing.');
        } finally {
            const btn = signForm.querySelector('button');
            btn.textContent = 'Sign Document';
            btn.disabled = false;
        }
    });

    let currentVerificationResult = null;

    // Verify Document
    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const evidenceId = document.getElementById('verify-evidence-id').value.trim();
        const fileInput = document.getElementById('verify-file');
        
        if (!evidenceId) return alert('Please enter an Evidence ID.');
        if (!fileInput.files[0]) return alert('Please select a file to verify.');

        const formData = new FormData();
        formData.append('evidenceId', evidenceId);
        formData.append('document', fileInput.files[0]);

        try {
            const btn = verifyForm.querySelector('button');
            btn.textContent = 'Verifying...';
            btn.disabled = true;

            const response = await fetch('/api/verify', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                currentVerificationResult = data;
                displayVerificationResult(data);
            } else {
                alert(data.error || 'Error verifying document');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during verification.');
        } finally {
            const btn = verifyForm.querySelector('button');
            btn.textContent = 'Verify Document';
            btn.disabled = false;
        }
    });

    function setBadge(elementId, isSuccess, successText, failText) {
        const el = document.getElementById(elementId);
        el.textContent = isSuccess ? successText : failText;
        el.className = 'badge ' + (isSuccess ? 'badge-success' : 'badge-danger');
        if (elementId === 'res-overall') {
            el.classList.add('large');
        }
    }

    function displayVerificationResult(data) {
        document.getElementById('res-case-id').textContent = data.caseId;
        document.getElementById('res-file-name').textContent = data.fileName;
        document.getElementById('res-file-size').textContent = data.fileSize;
        document.getElementById('res-hash').textContent = data.hash;
        document.getElementById('res-algorithm').textContent = data.algorithm;
        document.getElementById('res-timestamp').textContent = new Date(data.timestamp).toLocaleString();

        setBadge('res-hash-match', data.hashMatch, 'MATCH', 'MISMATCH');
        setBadge('res-sig-valid', data.signatureValid, 'VALID', 'INVALID');
        setBadge('res-integrity', data.integrityPreserved, 'VERIFIED', 'FAILED');
        setBadge('res-overall', data.overallResult === 'AUTHENTIC', 'AUTHENTIC', 'TAMPERED');

        document.getElementById('verify-result').classList.remove('hidden');
    }

    // Generate Report
    document.getElementById('generate-report-btn').addEventListener('click', () => {
        if (!currentVerificationResult) return;
        
        const data = currentVerificationResult;
        const reportContent = `
            <p><strong>Case ID:</strong> ${data.caseId}</p>
            <p><strong>Date Generated:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            <h3>File Information</h3>
            <p><strong>File Name:</strong> ${data.fileName}</p>
            <p><strong>File Size:</strong> ${data.fileSize}</p>
            <p><strong>Algorithm:</strong> ${data.algorithm}</p>
            <p><strong>Calculated SHA-256 Hash:</strong><br><small style="font-family:monospace;">${data.hash}</small></p>
            <hr>
            <h3>Cryptographic Verification Details</h3>
            <p><strong>Hash Matching:</strong> ${data.hashMatch ? 'Passed (Hashes match)' : 'Failed (Hashes differ)'}</p>
            <p><strong>RSA Signature Validation:</strong> ${data.signatureValid ? 'Passed (Signature authentic)' : 'Failed (Signature invalid)'}</p>
            <hr>
            <h3>Conclusion</h3>
            <h2>Overall Result: ${data.overallResult}</h2>
            <p><strong>Integrity Status:</strong> ${data.integrityPreserved ? 'Document integrity has been preserved. It is mathematically proven to be identical to the signed original.' : 'Document integrity check failed. The document has been modified, tampered with, or corrupted since it was signed.'}</p>
            <br><br>
            <p><em>End of Report</em></p>
        `;
        
        document.getElementById('report-content').innerHTML = reportContent;
        window.print();
    });
});
