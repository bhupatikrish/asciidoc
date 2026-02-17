const asciidoctor = require('asciidoctor')();
const kroki = require('asciidoctor-kroki');
kroki.register(asciidoctor.Extensions);
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

// Configuration
const SRC_DIR = path.join(__dirname, '../src');
const DOCS_YAML_PATH = path.join(__dirname, '../docs.yaml');
// Destination: mimic S3 upload
// In a real pipeline, this would be an S3 upload command.
// Here we copy to the local mock S3 directory.
const MOCK_S3_ROOT = path.join(__dirname, '../../dist/infrastructure/cloud/S3/v1');

async function build() {
    try {
        // 1. Read Metadata
        const docsMeta = yaml.load(await fs.readFile(DOCS_YAML_PATH, 'utf8'));
        console.log(`Building docs for: ${docsMeta.id}`);

        // 2. Ensure destination exists
        await fs.ensureDir(MOCK_S3_ROOT);

        // 3. Process AsciiDoc files
        const files = await fs.readdir(SRC_DIR);
        for (const file of files) {
            if (file.endsWith('.adoc')) {
                const filePath = path.join(SRC_DIR, file);
                const fileName = path.basename(file, '.adoc');

                console.log(`Converting ${file}...`);

                // CONVERT TO FRAGMENT (No header/footer)
                const html = asciidoctor.convertFile(filePath, {
                    to_file: false,
                    standalone: false, // This is key: generates only the body content
                    attributes: {
                        showtitle: true,
                        role: 'doc-content'
                    }
                });

                // Write HTML fragment to S3
                const destPath = path.join(MOCK_S3_ROOT, `${fileName}.html`);
                await fs.writeFile(destPath, html);
                console.log(`  -> Wrote ${destPath}`);
            }
        }

        // 4. Copy Metadata (for the Portal/BFF to consume)
        await fs.copy(DOCS_YAML_PATH, path.join(MOCK_S3_ROOT, 'docs.yaml'));
        console.log('  -> Copied docs.yaml');

        console.log('Build Complete!');
    } catch (err) {
        console.error('Build Failed:', err);
        process.exit(1);
    }
}

build();
