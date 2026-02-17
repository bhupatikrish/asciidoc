# Decoupled Documentation Platform (DAC POC)

A flexible, decoupled documentation platform that separates content creation (AsciiDoc) from presentation (App Shell). This Proof of Concept (POC) demonstrates a "Push" model where product documentation is built independently and aggregated by a central portal.

## 🏗️ Architecture

The platform consists of several key components:

1.  **Content Sources (`product-*`)**: Independent repositories (simulated as folders) containing AsciiDoc source files and a `docs.yaml` metadata file. They have *no* build logic within them.
2.  **Universal Build System (`build-scripts`)**: A centralized Node.js build tool that converts AsciiDoc to "headless" HTML fragments and renders Mermaid diagrams (via Kroki).
3.  **Mock S3 Storage (`dist`)**: A local directory structure that simulates cloud object storage. The build system "pushes" artifacts here.
4.  **Central Portal (`portal-bff`)**: A Backend-for-Frontend (BFF) Express server that serves the App Shell (SPA) and proxies content/metadata requests to the Mock S3 storage.
5.  **Local Preview Tool (`tools/preview-cli`)**: A developer tool to verify documentation changes locally before pushing.

## 📂 Workspace Structure

```bash
.
├── build-scripts/       # Shared build logic (Asciidoctor, Kroki)
├── dist/                # Mock S3 Bucket (Generated Artifacts)
├── portal-bff/          # Central Portal (Express + Vanilla JS SPA)
├── product-s3/          # Product: Object Storage Service (Source)
├── product-sso/         # Product: Single Sign On (Source)
└── tools/
    └── preview-cli/     # Preview Tool Source
```

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm

### 1. Build Documentation

Use the shared build script to generate HTML artifacts for the products.

**Build S3 Documentation:**
```bash
node build-scripts/build.js --product product-s3
```

**Build SSO Documentation:**
```bash
node build-scripts/build.js --product product-sso
```

*Artifacts are output to `dist/` following the hierarchy defined in `docs.yaml`.*

### 2. Run the Portal

The Portal serves the aggregated documentation.

```bash
cd portal-bff
npm install # First time only
npm start
```

*   **URL**: `http://localhost:3000`
*   **Features**:
    *   **Catalog**: Browse all products.
    *   **Search/Nav**: Hierarchical navigation.
    *   **Dynamic Context**: Header and Sidebar change based on the product you are viewing.

### 3. Local Preview (For Writers)

Writers can preview their changes live without a full build.

```bash
# From a product directory (e.g., product-s3)
../tools/preview-cli/bin/preview.js
```

*   **URL**: `http://localhost:3001` (Check console output if port 3001 is busy).
*   **Note**: The preview tool attempts to use port 3001 to avoid conflicts with the main portal.

## 🛠️ Components Detail

### Universal Build Script (`build-scripts/build.js`)
*   **Input**: Product directory (e.g., `product-s3`).
*   **Process**:
    *   Reads `docs.yaml` to determine output path (Domain/System/Product).
    *   Converts `.adoc` files to HTML fragments (no `<html>` tags).
    *   Converts Mermaid blocks to images using Kroki.
*   **Output**: Pushes to `dist/{domain}/{system}/{product}/{version}/`.

### Portal BFF (`portal-bff/`)
*   **`server.js`**: Express server.
    *   `/api/catalog`: Scans `dist/` to discover all products.
    *   `/api/metadata/{path}`: Returns `docs.yaml` for a specific product.
    *   `/api/content/{path}`: Returns HTML fragments.
*   **`public/main.js`**: Client-side SPA router.
    *   Handles routing between Catalog and Docs.
    *   Fetches data from BFF.
    *   Manages "Context" (Header title, Sidebar links).

### Design System
*   **CSS**: `portal-bff/public/styles.css`
*   **Font**: System UI (San Francisco / Inter).
*   **Theme**: Clean, enterprise-ready look with distinct navigation contexts.
