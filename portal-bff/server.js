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
const DIST_ROOT = path.join(__dirname, '../dist');

// Endpoint: /api/content/:path*
// Example: /api/content/infrastructure/cloud/S3/v1/intro -> reads dist/infrastructure/cloud/S3/v1/intro.html
app.get('/api/content/*', (req, res) => {
    // Extract the full relative path from the wildcard
    const contentPath = req.params[0];
    if (!contentPath) {
        return res.status(400).json({ error: 'Missing content path' });
    }

    // Security: Prevent directory traversal
    const safePath = path.normalize(contentPath).replace(/^(\.\.[\/\\])+/, '');

    // Construct full file path
    // We map the URL path directly to the filesystem path under dist/
    let filePath = path.join(DIST_ROOT, safePath);

    // Append .html if missing
    if (!path.extname(filePath)) {
        filePath += '.html';
    }

    console.log(`Fetching content: ${safePath} -> ${filePath}`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('File not found:', filePath);
            return res.status(404).json({ error: 'Content not found' });
        }
        res.send(data);
    });
});

// API: Navigation/Metadata
// Endpoint: /api/metadata/:path*
// Example: /api/metadata/infrastructure/cloud/S3/v1 -> reads dist/infrastructure/cloud/S3/v1/docs.yaml
app.get('/api/metadata/*', (req, res) => {
    const metaPath = req.params[0];
    if (!metaPath) {
        return res.status(400).json({ error: 'Missing metadata path' });
    }

    const safePath = path.normalize(metaPath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(DIST_ROOT, safePath, 'docs.yaml');

    console.log(`Fetching metadata: ${safePath} -> ${fullPath}`);

    const yaml = require('js-yaml');
    fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Metadata not found:', fullPath);
            return res.status(404).json({ error: 'Metadata not found' });
        }
        try {
            const doc = yaml.load(data);
            res.json(doc);
        } catch (e) {
            console.error('Error parsing YAML:', e);
            res.status(500).json({ error: 'Invalid metadata format' });
        }
    });
});

// API: Catalog
// Scans dist/infrastructure to find all docs.yaml files
app.get('/api/catalog', async (req, res) => {
    try {
        const catalog = {};
        // Scan Mock S3 Root
        // Structure: dist/{domain}/{system}/{product}/{version}/docs.yaml
        // We need to walk the tree.

        async function scanDir(dir, depth) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await scanDir(fullPath, depth + 1);
                } else if (entry.name === 'docs.yaml') {
                    // Found a product!
                    try {
                        const yaml = require('js-yaml');
                        const doc = yaml.load(await fs.promises.readFile(fullPath, 'utf8'));

                        const { domain, system, product } = doc.hierarchy;

                        if (!catalog[domain]) catalog[domain] = {};
                        if (!catalog[domain][system]) catalog[domain][system] = [];

                        catalog[domain][system].push({
                            id: doc.id,
                            title: doc.title,
                            description: doc.description || `Documentation for ${doc.title}`, // Add fallback description
                            path: `${domain}/${system}/${product}/v1` // simplistic versioning
                        });
                    } catch (e) {
                        console.error('Error parsing docs.yaml:', fullPath, e);
                    }
                }
            }
        }

        /* 
           NOTE: Our MOCK_S3_ROOT points to dist/infrastructure/cloud/S3/v1
           But our new build script outputs to dist/{domain}/{system}...
           So we need to scan upstream from MOCK_S3_ROOT to find "dist"
           Let's redefine ROOT for catalog scanning.
        */
        const DIST_ROOT = path.resolve(__dirname, '../dist');
        if (fs.existsSync(DIST_ROOT)) {
            await scanDir(DIST_ROOT, 0);
        }

        res.json(catalog);
    } catch (e) {
        console.error('Catalog Error:', e);
        res.status(500).json({ error: 'Failed to load catalog' });
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
