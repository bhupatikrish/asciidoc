#!/usr/bin/env node

const browserSync = require('browser-sync').create();
const asciidoctor = require('asciidoctor')();
const kroki = require('asciidoctor-kroki');
kroki.register(asciidoctor.Extensions);
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

// Paths (Assumptions for this POC)
// The CLI is running inside "tools/preview-cli/bin"
// We want to reach the root "asciidoc" folder.
// bin (1) -> preview-cli (2) -> tools (3) -> root
const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const PORTAL_PUBLIC = path.join(PROJECT_ROOT, 'portal-bff/public');
const PRODUCT_REPO_ROOT = process.cwd(); // Run this FROM the product repo
const SRC_DIR = path.join(PRODUCT_REPO_ROOT, 'src');
const DOCS_YAML = path.join(PRODUCT_REPO_ROOT, 'docs.yaml');

console.log('--- Docs Preview Tool ---');
console.log('Project Root:', PROJECT_ROOT);
console.log('Portal Shell:', PORTAL_PUBLIC);
console.log('Product Repo:', PRODUCT_REPO_ROOT);

async function start() {
    // 1. Verify we are in a product repo
    if (!await fs.exists(DOCS_YAML)) {
        console.error('Error: docs.yaml not found. Please run this command from the root of a documentation repository.');
        process.exit(1);
    }

    // 2. Load Local Metadata to determine Virtual Path
    let localMeta;
    try {
        localMeta = yaml.load(await fs.readFile(DOCS_YAML, 'utf8'));
    } catch (e) {
        console.error('Error parsing docs.yaml:', e);
        process.exit(1);
    }

    const { domain, system, product } = localMeta.hierarchy;
    const VIRTUAL_PATH = `${domain}/${system}/${product}/v1`; // e.g., infrastructure/cloud/S3/v1
    console.log(`Virtual Path: ${VIRTUAL_PATH}`);

    // 3. Start BrowserSync
    browserSync.init({
        server: {
            baseDir: PORTAL_PUBLIC, // Serve the App Shell
            middleware: [
                async (req, res, next) => {
                    const url = req.url;

                    // API: Catalog (Mock with single local product)
                    if (url === '/api/catalog') {
                        const catalog = {
                            [domain]: {
                                [system]: [{
                                    id: localMeta.id,
                                    title: localMeta.title,
                                    description: localMeta.description || `[Preview] ${localMeta.title}`,
                                    path: VIRTUAL_PATH
                                }]
                            }
                        };
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(catalog));
                        return;
                    }

                    // API: Metadata (Match virtual path)
                    // URL: /api/metadata/infrastructure/cloud/S3/v1
                    if (url.startsWith('/api/metadata/')) {
                        // In preview, we only serve OUR metadata. 
                        // Check if request matches our virtual path
                        const reqPath = url.replace('/api/metadata/', '');
                        if (reqPath === VIRTUAL_PATH) {
                            // Reload meta from disk to support live changes
                            const currentMeta = yaml.load(await fs.readFile(DOCS_YAML, 'utf8'));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(currentMeta));
                            return;
                        }
                    }

                    // API: Content (Convert local adoc)
                    // URL: /api/content/infrastructure/cloud/S3/v1/intro
                    if (url.startsWith('/api/content/')) {
                        const reqPath = url.replace('/api/content/', '');

                        if (reqPath.startsWith(VIRTUAL_PATH)) {
                            // Extract page name: intro
                            const page = reqPath.replace(`${VIRTUAL_PATH}/`, '');
                            const adocPath = path.join(SRC_DIR, `${page}.adoc`);

                            if (await fs.exists(adocPath)) {
                                try {
                                    const html = asciidoctor.convert(await fs.readFile(adocPath, 'utf8'), {
                                        standalone: false,
                                        attributes: { showtitle: true }
                                    });
                                    res.setHeader('Content-Type', 'text/html');
                                    res.end(html);
                                    return;
                                } catch (e) {
                                    console.error('Conversion Error:', e);
                                    res.statusCode = 500;
                                    res.end('Error converting asciidoc');
                                    return;
                                }
                            }
                        }
                    }

                    next();
                }
            ]
        },
        files: [
            // Watch local .adoc files -> Reload
            {
                match: [path.join(SRC_DIR, '**/*.adoc'), DOCS_YAML],
                fn: function (event, file) {
                    this.reload();
                }
            },
            // Watch portal assets (optional, if hacking on portal)
            path.join(PORTAL_PUBLIC, '**/*')
        ],
        open: false, // Don't auto-open
        notify: false,
        port: 3001, // Use different port to avoid conflict with BFF
        ui: false
    });
}

start();
