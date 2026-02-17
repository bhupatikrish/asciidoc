const asciidoctor = require('asciidoctor')();
const kroki = require('asciidoctor-kroki');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Register Extensions
kroki.register(asciidoctor.Extensions);

// Parse Arguments
const argv = yargs(hideBin(process.argv))
    .option('product', {
        alias: 'p',
        type: 'string',
        description: 'Path to the product directory (relative to root)',
        demandOption: true
    })
    .argv;

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCT_DIR = path.resolve(PROJECT_ROOT, argv.product);
const SRC_DIR = path.join(PRODUCT_DIR, 'src');
const DOCS_YAML_PATH = path.join(PRODUCT_DIR, 'docs.yaml');

// Output Dir: dist/infrastructure/{domain}/{system}/{product}/{version}
// We need to read docs.yaml to know where to put it.

async function build() {
    try {
        console.log(`Building product: ${argv.product}`);

        // 1. Read Metadata
        if (!await fs.exists(DOCS_YAML_PATH)) {
            throw new Error(`docs.yaml not found at ${DOCS_YAML_PATH}`);
        }
        const docsMeta = yaml.load(await fs.readFile(DOCS_YAML_PATH, 'utf8'));

        // Construct S3 Path
        const { domain, system, product } = docsMeta.hierarchy;
        // Default version for now
        const version = 'v1';

        const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist', domain, system, product, version);
        console.log(`Output Directory: ${OUTPUT_DIR}`);

        // 2. Ensure destination exists
        await fs.ensureDir(OUTPUT_DIR);

        // 3. Process AsciiDoc files
        if (await fs.exists(SRC_DIR)) {
            const files = await fs.readdir(SRC_DIR);
            for (const file of files) {
                if (file.endsWith('.adoc')) {
                    const filePath = path.join(SRC_DIR, file);
                    const fileName = path.basename(file, '.adoc');

                    console.log(`Converting ${file}...`);

                    const html = asciidoctor.convertFile(filePath, {
                        to_file: false,
                        standalone: false,
                        attributes: {
                            showtitle: true,
                            role: 'doc-content'
                        }
                    });

                    const destPath = path.join(OUTPUT_DIR, `${fileName}.html`);
                    await fs.writeFile(destPath, html);
                    console.log(`  -> Wrote ${destPath}`);
                }
            }
        } else {
            console.warn('No src directory found.');
        }

        // 4. Copy Metadata
        await fs.copy(DOCS_YAML_PATH, path.join(OUTPUT_DIR, 'docs.yaml'));
        console.log('  -> Copied docs.yaml');

        console.log('Build Complete!');
    } catch (err) {
        console.error('Build Failed:', err);
        process.exit(1);
    }
}

build();
