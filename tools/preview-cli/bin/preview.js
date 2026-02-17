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

    // 2. Start BrowserSync
    browserSync.init({
        server: {
            baseDir: PORTAL_PUBLIC, // Serve the App Shell
            middleware: [
                // API: Content Proxy (Local Adoc Converter)
                async (req, res, next) => {
                    if (req.url.startsWith('/api/content/')) {
                        const page = req.url.replace('/api/content/', '');
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
                        } else {
                            // Try to look in dist/s3 if not found locally? 
                            // Or just 404. For now 404 is fine.
                            console.log(`404: ${adocPath}`);
                        }
                    }

                    // API: Metadata
                    if (req.url === '/api/metadata') {
                        try {
                            // Merge local docs.yaml with some global nav?
                            // For now, just serve local docs.yaml so we can see OUR links
                            const doc = yaml.load(await fs.readFile(DOCS_YAML, 'utf8'));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(doc));
                            return;
                        } catch (e) {
                            res.statusCode = 500;
                            res.end('Error loading metadata');
                            return;
                        }
                    }

                    next();
                }
            ]
        },
        files: [
            // Watch local .adoc files -> Reload
            path.join(SRC_DIR, '**/*.adoc'),
            // Watch docs.yaml -> Reload
            DOCS_YAML,
            // Watch portal assets (optional, if hacking on portal)
            path.join(PORTAL_PUBLIC, '**/*')
        ],
        open: false, // Don't auto-open
        notify: false
    });
}

start();
