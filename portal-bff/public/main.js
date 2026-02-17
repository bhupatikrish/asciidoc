const API_BASE = '/api';

// State
let catalog = {};
let currentProductMeta = null;
let currentContext = 'catalog'; // 'catalog' or 'product'

async function init() {
    console.log('App initializing...');
    await fetchCatalog();

    // Initial Route Handling
    // If we start deep in a doc, we need to load product meta immediately
    const path = window.location.pathname;
    if (path.startsWith('/docs/')) {
        const apiPath = path.replace('/docs/', '');
        // format: domain/system/product/version/page
        // We need the first 4 segments for product path
        const parts = apiPath.split('/');
        if (parts.length >= 4) {
            const productPath = parts.slice(0, 4).join('/');
            await loadProductMeta(productPath);
        }
    }

    setupNavigation();
    handleRouting();

    window.addEventListener('popstate', handleRouting);
}

async function fetchCatalog() {
    try {
        const res = await fetch(`${API_BASE}/catalog`);
        if (!res.ok) throw new Error('Failed to fetch catalog');
        catalog = await res.json();
    } catch (e) {
        console.error('Failed to load catalog', e);
    }
}

async function loadProductMeta(productPath) {
    // Avoid re-fetching if we are already in this product context
    if (currentProductMeta && currentProductMeta._path === productPath) return;

    try {
        const res = await fetch(`${API_BASE}/metadata/${productPath}`);
        if (res.ok) {
            currentProductMeta = await res.json();
            currentProductMeta._path = productPath; // Store path for check

            // Update Header Title
            const headerTitle = document.getElementById('header-title');
            if (headerTitle) headerTitle.textContent = currentProductMeta.title;
        }
    } catch (e) {
        console.error('Failed to load product metadata', e);
    }
}

function renderSidebar() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    let html = '';

    if (currentContext === 'product' && currentProductMeta) {
        // Product Context
        html += `<div class="nav-context-product">
            <a href="/" data-link>← Back to Catalog</a>
            <h2>${currentProductMeta.title}</h2>
        </div><ul>`;

        if (currentProductMeta.navigation) {
            currentProductMeta.navigation.forEach(item => {
                // Construct full link: /docs/{path}/{item.url}
                // item.url usually starts with /
                const link = `/docs/${currentProductMeta._path}${item.url}`;
                html += `<li><a href="${link}" data-link>${item.Label}</a></li>`;
            });
        }
        html += '</ul>';

    } else {
        // Catalog Context
        html += '<ul><li><a href="/" data-link>Home</a></li>';

        for (const [domain, systems] of Object.entries(catalog)) {
            html += `<li class="nav-header">${domain.toUpperCase()}</li>`;
            for (const [system, products] of Object.entries(systems)) {
                html += `<li><details open><summary>${system}</summary><ul>`;
                for (const p of products) {
                    html += `<li><a href="/docs/${p.path}/intro" data-link>${p.title}</a></li>`;
                }
                html += '</ul></details></li>';
            }
        }
        html += '</ul>';
    }

    nav.innerHTML = html;
}

async function handleRouting() {
    const path = window.location.pathname;
    const contentDiv = document.getElementById('content-area');
    if (!contentDiv) return;

    if (path === '/' || path === '/index.html') {
        currentContext = 'catalog';

        // Reset Header Title
        const headerTitle = document.getElementById('header-title');
        if (headerTitle) headerTitle.textContent = 'Enterprise Documentation';

        renderSidebar();
        renderLandingPage(contentDiv);
    } else if (path.startsWith('/docs/')) {
        currentContext = 'product';

        // format: /docs/{domain}/{system}/{product}/{version}/{page}
        const apiPath = path.replace('/docs/', '');
        const parts = apiPath.split('/');

        if (parts.length >= 4) {
            const productPath = parts.slice(0, 4).join('/');
            // Ensure we have the meta for this product
            await loadProductMeta(productPath);

            // Ensure title is set even if we didn't re-fetch (cached meta)
            if (currentProductMeta) {
                const headerTitle = document.getElementById('header-title');
                if (headerTitle) headerTitle.textContent = currentProductMeta.title;
            }
        }

        renderSidebar();
        await renderDocPage(contentDiv, apiPath);
    } else {
        contentDiv.innerHTML = '<h1>404 Not Found</h1>';
    }
}

function renderLandingPage(container) {
    let html = '<h1>Documentation Catalog</h1><div class="product-grid">';

    let hasProducts = false;
    for (const [domain, systems] of Object.entries(catalog)) {
        for (const [system, products] of Object.entries(systems)) {
            for (const p of products) {
                hasProducts = true;
                html += `
                <div class="product-card">
                    <h3>${p.title}</h3>
                    <p class="meta">${domain} / ${system}</p>
                    <p>${p.description}</p>
                    <a href="/docs/${p.path}/intro" data-link class="btn">View Docs</a>
                </div>`;
            }
        }
    }

    if (!hasProducts) {
        html += '<p>No products found in catalog.</p>';
    }

    html += '</div>';
    container.innerHTML = html;
}

async function renderDocPage(container, apiPath) {
    try {
        const res = await fetch(`${API_BASE}/content/${apiPath}`);
        if (!res.ok) throw new Error('Not found');
        const html = await res.text();
        container.innerHTML = html;

        // Post-process (e.g., syntax highlight) could go here
    } catch (e) {
        container.innerHTML = `<h1>Error</h1><p>${e.message}</p>`;
    }
}

function setupNavigation() {
    document.body.addEventListener('click', e => {
        if (e.target.matches('[data-link]')) {
            e.preventDefault();
            history.pushState(null, null, e.target.href);
            handleRouting();
        }
    });
}

// Start the app
init();

