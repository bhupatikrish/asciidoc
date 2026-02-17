const API_BASE = '/api';

/**
 * Main Application Logic
 */
async function init() {
    console.log('App initializing...');

    // 1. Load Metadata (Navigation)
    await loadMetadata();

    // 2. Handle Initial Load
    handleRouting();

    // 3. Intercept Link Clicks for SPA Routing
    document.body.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.href.startsWith(window.location.origin)) {
            e.preventDefault();
            const path = e.target.getAttribute('href');
            history.pushState(null, '', path);
            handleRouting();
        }
    });

    // 4. Handle Back/Forward Browser Buttons
    window.addEventListener('popstate', handleRouting);
}

/**
 * Loads the docs.yaml metadata to build the sidebar.
 */
async function loadMetadata() {
    try {
        const res = await fetch(`${API_BASE}/metadata`);
        const meta = await res.json();

        renderSidebar(meta);
    } catch (err) {
        console.error('Failed to load metadata:', err);
        document.getElementById('side-nav-list').innerHTML = '<li>Error loading nav</li>';
    }
}

/**
 * Renders the sidebar navigation based on metadata.
 */
function renderSidebar(meta) {
    const list = document.getElementById('side-nav-list');
    list.innerHTML = meta.navigation.map(item => `
        <li>
            <a href="${item.url}">${item.Label}</a>
        </li>
    `).join('');
}

/**
 * Handles the actual routing logic: URL -> fetch content -> Inject
 */
async function handleRouting() {
    const path = window.location.pathname;
    const contentDiv = document.getElementById('content');

    // Extract the "page" part of the URL (e.g., /intro -> intro)
    // For this POC, we assume the URL directly maps to the S3 file name (sans extension)
    // In a real app, we might need more complex mapping.
    let page = path.replace(/^\//, '');
    if (!page) page = 'intro'; // Default

    contentDiv.innerHTML = '<p>Loading...</p>';

    try {
        const res = await fetch(`${API_BASE}/content/${page}`);
        if (!res.ok) throw new Error('Not found');

        const html = await res.text();
        contentDiv.innerHTML = html;

        // Re-highlight or process content if needed
    } catch (err) {
        contentDiv.innerHTML = '<h1>404 - Not Found</h1><p>The requested documentation page does not exist.</p>';
    }
}

// Start
init();
