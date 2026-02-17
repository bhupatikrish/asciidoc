const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Configuration
const MOCK_S3_ROOT = path.join(__dirname, '../dist/infrastructure/cloud/S3/v1');

app.use(cors());
app.use(express.static('public')); // Serve the App Shell (SPA)

// API: Content Proxy
// Endpoint: /api/content/:page?
// Example: /api/content/intro -> reads MOCK_S3_ROOT/intro.html
app.get('/api/content/*', (req, res) => {
    // Extract the relative path from the wildcard
    const contentPath = req.params[0] || 'intro';

    // Security: Prevent directory traversal
    const safePath = path.normalize(contentPath).replace(/^(\.\.[\/\\])+/, '');

    // Construct full file path (assuming .html for fragments)
    // In a real app, this would map URL -> S3 Key
    let filePath = path.join(MOCK_S3_ROOT, safePath);

    // Append .html if missing (simple logic for POC)
    if (!path.extname(filePath)) {
        filePath += '.html';
    }

    console.log(`Fetching content: ${safePath} -> ${filePath}`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('File not found:', filePath);
            return res.status(404).json({ error: 'Content not found' });
        }

        // TODO: Add Sanitization here (DOMPurify)
        // const clean = DOMPurify.sanitize(data);

        res.send(data);
    });
});

// API: Navigation/Metadata
app.get('/api/metadata', (req, res) => {
    const metaPath = path.join(MOCK_S3_ROOT, 'docs.yaml');
    // In a real app, we'd probably convert YAML to JSON here or serve JSON directly
    // For this POC, we'll just send the file content (Frontend can parse or we parse here)
    // To keep it simple, let's try to send JSON if possible, but reading raw file for now.
    // Actually, let's use the yaml parser to be nice to the frontend.
    const yaml = require('js-yaml');
    try {
        const doc = yaml.load(fs.readFileSync(metaPath, 'utf8'));
        res.json(doc);
    } catch (e) {
        res.status(500).json({ error: 'Failed to load metadata' });
    }
});

// SPA Fallback: Return index.html for any unknown non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`BFF running/proxying at http://localhost:${PORT}`);
    console.log(`Serving content from: ${MOCK_S3_ROOT}`);
});
