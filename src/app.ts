import { CLIENT_SCRIPT } from "./client-script";
import { html, methodNotAllowed } from "./http";
import type { AppContext } from "./platform";

const BRAND_HEAD = `
  <link rel="stylesheet" href="https://congtam.net/assets/tamta-tokens.css">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="icon" href="https://congtam.net/assets/mark-tile.svg">
`;

const SHARED_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; min-height: 100%;
    background: var(--tt-paper); color: var(--tt-ink);
    font-family: var(--tt-font-display);
  }
  a { color: var(--tt-blue); text-decoration: none; }
  a:hover { color: var(--tt-clay); }
  .shell { min-height: 100vh; display: flex; flex-direction: column; }
  .top-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.85rem 1.35rem; border-bottom: 1px solid var(--tt-line);
  }
  .brand {
    display: inline-flex; align-items: center; gap: 0.55rem;
    color: var(--tt-blue); text-decoration: none;
  }
  .brand img { width: 28px; height: 28px; border-radius: var(--tt-radius); }
  .brand-name { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; }
  .brand-tag {
    display: block; font-size: 0.72rem; font-weight: 500; color: var(--tt-muted);
  }
  .nav { display: flex; align-items: center; gap: 1rem; }
  .nav a { font-size: 0.9rem; color: var(--tt-muted); }
  .nav a:hover { color: var(--tt-blue); }
  .page { flex: 1; width: min(760px, 100%); margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  h1 {
    margin: 0 0 0.75rem; font-size: 1.85rem; font-weight: 700;
    letter-spacing: -0.03em; color: var(--tt-blue); line-height: 1.2;
  }
  h2 {
    margin: 0 0 0.65rem; font-size: 0.78rem; font-weight: 500;
    font-family: var(--tt-font-mono); text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--tt-muted);
  }
  p { margin: 0 0 1rem; line-height: 1.55; color: var(--tt-ink); }
  .lede { color: var(--tt-muted); font-size: 1.05rem; }
  .privacy-banner {
    margin: 0 0 1.5rem; padding: 0.75rem 0.9rem;
    border-left: 3px solid var(--tt-clay);
    background: color-mix(in srgb, var(--tt-sand) 35%, var(--tt-paper));
    color: var(--tt-ink); font-size: 0.95rem; line-height: 1.45;
  }
  .mono { font-family: var(--tt-font-mono); font-size: 0.9rem; }
  .field-label {
    display: block; margin: 0 0 0.4rem;
    font-size: 0.78rem; font-weight: 500; font-family: var(--tt-font-mono);
    text-transform: uppercase; letter-spacing: 0.08em; color: var(--tt-muted);
  }
  .format-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem;
    margin: 0 0 0.75rem;
  }
  .format-toggle {
    display: inline-flex; border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    overflow: hidden;
  }
  .format-toggle label {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.4rem 0.75rem; font-size: 0.85rem; cursor: pointer;
    color: var(--tt-muted); background: var(--tt-paper);
  }
  .format-toggle label:has(input:checked) {
    color: var(--tt-ink); background: color-mix(in srgb, var(--tt-sand) 45%, var(--tt-paper));
  }
  .format-toggle input { accent-color: var(--tt-blue); }
  #format-hint { font-size: 0.85rem; color: var(--tt-muted); margin: 0; }
  #sample {
    width: 100%; min-height: 12rem; resize: vertical;
    padding: 0.85rem 1rem; border: 1px solid var(--tt-line);
    border-radius: var(--tt-radius); background: #fff;
    color: var(--tt-ink); font-family: var(--tt-font-mono); font-size: 0.85rem;
    line-height: 1.45;
  }
  #sample:focus {
    outline: 2px solid var(--tt-blue); outline-offset: 1px;
  }
  .sample-actions {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem;
    margin: 0.55rem 0 0; font-size: 0.9rem; color: var(--tt-muted);
  }
  .file-upload {
    display: inline-flex; align-items: center; gap: 0.45rem;
  }
  .file-upload input[type="file"] {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }
  .file-upload-btn {
    appearance: none; border: 1px solid var(--tt-line);
    background: var(--tt-paper); color: var(--tt-ink);
    font-family: var(--tt-font-display); font-size: 0.85rem;
    padding: 0.35rem 0.7rem; border-radius: var(--tt-radius); cursor: pointer;
  }
  .file-upload-btn:hover { color: var(--tt-blue); border-color: var(--tt-blue); }
  .file-upload-btn:focus-visible { outline: 2px solid var(--tt-clay); outline-offset: 2px; }
  #file-name { font-family: var(--tt-font-mono); font-size: 0.78rem; color: var(--tt-muted); }
  .table-name-row { margin: 1rem 0 0; }
  #table-name {
    width: min(100%, 20rem); padding: 0.55rem 0.75rem;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    font-family: var(--tt-font-mono); font-size: 0.9rem; color: var(--tt-ink);
    background: #fff;
  }
  #table-name:focus { outline: 2px solid var(--tt-blue); outline-offset: 1px; }
  .error {
    margin: 0.75rem 0 0; padding: 0.65rem 0.8rem;
    border-left: 3px solid var(--tt-clay); color: var(--tt-ink);
    background: color-mix(in srgb, var(--tt-clay) 12%, var(--tt-paper));
    font-size: 0.92rem;
  }
  .mapping-note { font-size: 0.9rem; color: var(--tt-muted); }
  .column-list { display: flex; flex-direction: column; gap: 0.45rem; margin: 0.75rem 0 0; }
  .column-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem;
  }
  .col-name { min-width: 10rem; font-size: 0.85rem; }
  .column-row select {
    font-family: var(--tt-font-mono); font-size: 0.82rem;
    padding: 0.35rem 0.5rem; border: 1px solid var(--tt-line);
    border-radius: var(--tt-radius); background: #fff; color: var(--tt-ink);
  }
  .key-list {
    display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-top: 0.5rem;
  }
  .key-option {
    display: inline-flex; align-items: center; gap: 0.35rem;
    font-size: 0.9rem; color: var(--tt-ink); cursor: pointer;
  }
  .key-option input { accent-color: var(--tt-blue); }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }
  .outputs { margin-top: 2rem; }
  .output-block { margin-top: 1.25rem; }
  .output-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; margin-bottom: 0.5rem;
  }
  .output-head h2 { margin: 0; }
  .copy-btn {
    appearance: none; border: 1px solid var(--tt-line); background: #fff;
    color: var(--tt-muted); font-family: var(--tt-font-display); font-size: 0.8rem;
    padding: 0.3rem 0.65rem; border-radius: var(--tt-radius); cursor: pointer;
  }
  .copy-btn:hover { color: var(--tt-blue); border-color: var(--tt-blue); }
  .copy-btn:focus-visible { outline: 2px solid var(--tt-clay); outline-offset: 2px; }
  .output-block pre {
    margin: 0; padding: 0.9rem 1rem; overflow: auto;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    background: color-mix(in srgb, var(--tt-blue) 6%, #fff);
    font-family: var(--tt-font-mono); font-size: 0.82rem; line-height: 1.45;
    color: var(--tt-ink); white-space: pre; min-height: 3rem;
  }
  .empty-state {
    margin: 1.5rem 0 0; padding: 1rem 1.1rem;
    border: 1px dashed var(--tt-line); border-radius: var(--tt-radius);
    color: var(--tt-muted); font-size: 0.95rem;
  }
  .example-btn {
    appearance: none; border: none; background: transparent;
    color: var(--tt-blue); font-family: var(--tt-font-display); font-size: inherit;
    padding: 0; cursor: pointer; text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  .example-btn:hover { color: var(--tt-clay); }
  .example-btn:focus-visible { outline: 2px solid var(--tt-clay); outline-offset: 2px; }
  footer {
    margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid var(--tt-line);
    display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem;
  }
  footer img { width: 16px; height: 16px; border-radius: 4px; }
  footer a { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--tt-muted); }
  footer a:hover { color: var(--tt-blue); }
`;

function layout(options: {
  title: string;
  description: string;
  canonical?: string;
  body: string;
  script?: string;
}): string {
  const canonical = options.canonical
    ? `<link rel="canonical" href="${options.canonical}" />`
    : "";
  const script = options.script ? `<script>${options.script}</script>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.title}</title>
  <meta name="description" content="${options.description}" />
  ${canonical}
  ${BRAND_HEAD}
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="shell">
    <header class="top-bar">
      <a class="brand" href="/">
        <img src="https://congtam.net/assets/mark-tile.svg" alt="" width="28" height="28" />
        <span>
          <span class="brand-name">eaglesheet</span>
          <span class="brand-tag">Snowflake SQL scaffold</span>
        </span>
      </a>
      <nav class="nav" aria-label="Site">
        <a href="/about">About</a>
        <a href="/privacy">Privacy</a>
      </nav>
    </header>
    <main class="page">
      ${options.body}
      <footer>
        <a href="https://congtam.net">
          <img src="https://congtam.net/assets/mark-tile.svg" alt="" width="16" height="16" />
          congtam.net
        </a>
      </footer>
    </main>
  </div>
  ${script}
</body>
</html>`;
}

function renderHome(): string {
  return layout({
    title: "eaglesheet — Snowflake SQL from a sample",
    description:
      "Paste a CSV or JSON sample and get CREATE TABLE, COPY INTO, and MERGE SQL for Snowflake. Everything runs in the browser.",
    canonical: "/",
    script: CLIENT_SCRIPT,
    body: `
      <h1>eaglesheet</h1>
      <p class="privacy-banner">Everything runs in your browser. The sample never leaves this page.</p>
      <p class="lede">Paste a few rows of real data and get production-ready Snowflake SQL — table DDL, load statements, and a Type 1 MERGE.</p>

      <label class="field-label" for="sample">Sample</label>
      <div class="format-row">
        <div class="format-toggle" role="group" aria-label="Sample format">
          <label><input type="radio" name="format" value="csv" checked /> CSV</label>
          <label><input type="radio" name="format" value="json" /> JSON</label>
        </div>
        <p id="format-hint"></p>
      </div>
      <textarea id="sample" name="sample" spellcheck="false" placeholder="Paste a CSV header plus a few rows, or a JSON object / array."></textarea>
      <div class="sample-actions">
        <label class="file-upload">
          <input id="sample-file" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" />
          <span class="file-upload-btn" id="sample-file-btn" tabindex="0" role="button">Upload file</span>
        </label>
        <span id="file-name" aria-live="polite"></span>
        <button type="button" class="example-btn" id="load-example">Load worked example</button>
      </div>

      <div class="table-name-row">
        <label class="field-label" for="table-name">Table name</label>
        <input id="table-name" name="table-name" type="text" value="MY_TABLE" spellcheck="false" autocomplete="off" />
      </div>

      <p id="parse-error" class="error" hidden></p>
      <div id="column-mapping" hidden></div>
      <div id="key-columns" hidden></div>

      <p id="empty-state" class="empty-state">Paste or upload a sample, or load the worked example, to generate Snowflake SQL.</p>

      <section class="outputs" id="outputs" hidden aria-live="polite">
        <div class="output-block">
          <div class="output-head">
            <h2>CREATE TABLE</h2>
            <button type="button" class="copy-btn" data-copy="create-sql">Copy</button>
          </div>
          <pre id="create-sql"></pre>
        </div>
        <div class="output-block">
          <div class="output-head">
            <h2>FILE FORMAT and COPY INTO</h2>
            <button type="button" class="copy-btn" data-copy="load-sql">Copy</button>
          </div>
          <pre id="load-sql"></pre>
        </div>
        <div class="output-block">
          <div class="output-head">
            <h2>MERGE</h2>
            <button type="button" class="copy-btn" data-copy="merge-sql">Copy</button>
          </div>
          <pre id="merge-sql"></pre>
        </div>
      </section>
    `,
  });
}

function renderAbout(): string {
  return layout({
    title: "About — eaglesheet",
    description:
      "About eaglesheet, a client-side Snowflake SQL scaffolding tool.",
    canonical: "/about",
    body: `
      <h1>About</h1>
      <p>eaglesheet turns a pasted CSV or JSON sample into Snowflake-ready <span class="mono">CREATE TABLE</span>, load, and <span class="mono">MERGE</span> SQL.</p>
      <p>It is for data engineers who already know Snowflake. The point is removing twenty minutes of tedious typing, especially the upsert.</p>
      <p>Part of the <a href="https://congtam.net">congtam.net</a> portfolio. No accounts, no saved state, no server-side processing of your sample. See <a href="/privacy">Privacy</a>.</p>
    `,
  });
}

function renderPrivacy(): string {
  return layout({
    title: "Privacy — eaglesheet",
    description: "Privacy for eaglesheet: samples stay in the browser.",
    canonical: "/privacy",
    body: `
      <h1>Privacy</h1>
      <p>Parsing, type inference, and SQL generation run entirely in your browser. The pasted sample is never posted, logged, or stored.</p>
      <p>The Worker serves HTML and records a traffic datapoint (path, country, method, status). It does not see sample content.</p>
      <p>No accounts, cookies for tracking, or third-party analytics. See also the portfolio notes on <a href="https://congtam.net">congtam.net</a>.</p>
    `,
  });
}

function renderNotFound(): string {
  return layout({
    title: "Not found — eaglesheet",
    description: "Page not found.",
    body: `
      <h1>Not found</h1>
      <p>No page at this URL. <a href="/">Back to eaglesheet</a>.</p>
    `,
  });
}

export function handleApp(
  request: Request,
  _env: Env,
  context: AppContext,
): Response {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed(context.requestId, ["GET", "HEAD"]);
  }

  if (path === "/" || path === "/index.html") {
    return html(renderHome(), context.requestId);
  }
  if (path === "/about") {
    return html(renderAbout(), context.requestId);
  }
  if (path === "/privacy") {
    return html(renderPrivacy(), context.requestId);
  }

  return html(renderNotFound(), context.requestId, { status: 404 });
}
