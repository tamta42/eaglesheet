import { CLIENT_SCRIPT } from "./client-script";
import { FORMAT_SCRIPT } from "./format-script";
import { html, methodNotAllowed } from "./http";
import { LINT_SCRIPT } from "./lint-script";
import { NAMES_SCRIPT } from "./names-script";
import type { AppContext } from "./platform";

type NavKey =
  "hub" | "scaffold" | "lint" | "format" | "names" | "about" | "privacy";

const THEME_DEFAULT = "dark";

const THEME_BOOT = `
  <meta name="color-scheme" content="dark light" />
  <script>
    (function () {
      try {
        var t = localStorage.getItem("tt-theme");
        if (t !== "light" && t !== "dark") t = "${THEME_DEFAULT}";
        document.documentElement.setAttribute("data-theme", t);
      } catch (e) {
        document.documentElement.setAttribute("data-theme", "${THEME_DEFAULT}");
      }
    })();
  </script>
`;

const THEME_TOGGLE = `<button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch to light theme"><span class="theme-toggle-label" data-theme-label>Light</span></button>`;

const THEME_JS = `
(function () {
  var root = document.documentElement;
  var storageKey = "tt-theme";
  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function labelFor(theme) { return theme === "dark" ? "Light" : "Dark"; }
  function ariaFor(theme) {
    return theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(storageKey, theme); } catch (e) {}
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-label", ariaFor(theme));
      var label = btn.querySelector("[data-theme-label]");
      if (label) label.textContent = labelFor(theme);
    });
  }
  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      apply(currentTheme() === "dark" ? "light" : "dark");
    });
  });
  apply(currentTheme());
})();
`;

const BRAND_HEAD = `
  ${THEME_BOOT}
  <link rel="stylesheet" href="https://congtam.net/assets/tamta-tokens.css">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="icon" href="https://congtam.net/assets/mark-tile.svg">
`;

const SHARED_CSS = `
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  [data-theme="dark"] {
    --tt-paper: #152538;
    --tt-ink: #FBFAF7;
    --tt-line: #2f4a6b;
    --tt-muted: #9aabbf;
    --tt-blue: #E8D9BC;
    --tt-slate: #9AABBF;
  }
  :root { --tt-surface: color-mix(in srgb, var(--tt-ink) 4%, var(--tt-paper)); }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0; min-height: 100%;
    background: var(--tt-paper); color: var(--tt-ink);
    font-family: var(--tt-font-display);
  }
  .theme-toggle {
    appearance: none; margin: 0; padding: 0.4rem 0.7rem;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    background: transparent; color: var(--tt-muted);
    font-family: var(--tt-font-mono); font-size: 0.7rem; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  }
  .theme-toggle:hover { color: var(--tt-blue); border-color: var(--tt-blue); }
  .theme-toggle:focus-visible { outline: 2px solid var(--tt-clay); outline-offset: 2px; }
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
  .nav { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; justify-content: flex-end; }
  .nav a { font-size: 0.9rem; color: var(--tt-muted); }
  .nav a:hover { color: var(--tt-blue); }
  .nav a.is-active { color: var(--tt-blue); font-weight: 600; }
  .page { flex: 1; width: min(760px, 100%); margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  .tool-list { list-style: none; padding: 0; margin: 1.5rem 0 0; display: flex; flex-direction: column; gap: 1.25rem; }
  .tool-list li { margin: 0; padding: 0; }
  .tool-list a.tool-name {
    display: inline-block; font-size: 1.15rem; font-weight: 600;
    color: var(--tt-blue); text-decoration: none; letter-spacing: -0.02em;
  }
  .tool-list a.tool-name:hover { color: var(--tt-clay); }
  .tool-list p { margin: 0.3rem 0 0; color: var(--tt-muted); font-size: 0.95rem; }
  .findings { margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.55rem; }
  .finding {
    padding: 0.65rem 0.8rem; border-left: 3px solid var(--tt-line);
    background: var(--tt-surface); font-size: 0.92rem; line-height: 1.45;
  }
  .finding.error { border-left-color: #c45c5c; }
  .finding.warn { border-left-color: var(--tt-clay); }
  .finding.info { border-left-color: var(--tt-slate); }
  .finding-meta {
    font-family: var(--tt-font-mono); font-size: 0.72rem; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--tt-muted); margin: 0 0 0.25rem;
  }
  .finding-msg { margin: 0; color: var(--tt-ink); }
  #sql-input, #format-input, #names-input {
    width: 100%; min-height: 14rem; resize: vertical;
    padding: 0.85rem 1rem; border: 1px solid var(--tt-line);
    border-radius: var(--tt-radius); background: var(--tt-surface);
    color: var(--tt-ink); font-family: var(--tt-font-mono); font-size: 0.85rem;
    line-height: 1.45;
  }
  #sql-input:focus, #format-input:focus, #names-input:focus {
    outline: 2px solid var(--tt-blue); outline-offset: 1px;
  }
  #format-output, #names-identifiers, #names-rename-map, #names-select-list {
    margin: 0; min-height: 6rem; padding: 0.85rem 1rem;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    background: var(--tt-surface); color: var(--tt-ink);
    font-family: var(--tt-font-mono); font-size: 0.85rem; line-height: 1.45;
    white-space: pre-wrap; overflow-x: auto;
  }
  .names-summary { margin: 1rem 0 0; font-family: var(--tt-font-mono); font-size: 0.82rem; color: var(--tt-muted); }

  .option-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem;
    margin: 0.75rem 0 0;
  }
  .option-row label {
    display: inline-flex; align-items: center; gap: 0.45rem;
    font-size: 0.9rem; color: var(--tt-muted); cursor: pointer;
  }
  .lint-summary { margin: 1rem 0 0; font-family: var(--tt-font-mono); font-size: 0.82rem; color: var(--tt-muted); }
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
    border-radius: var(--tt-radius); background: var(--tt-surface);
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
  .url-row { margin: 1rem 0 0; }
  .url-load-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem;
  }
  #sample-url {
    flex: 1 1 16rem; min-width: 0; padding: 0.55rem 0.75rem;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    font-family: var(--tt-font-mono); font-size: 0.85rem; color: var(--tt-ink);
    background: var(--tt-surface);
  }
  #sample-url:focus { outline: 2px solid var(--tt-blue); outline-offset: 1px; }
  .url-hint { margin: 0.45rem 0 0; font-size: 0.85rem; color: var(--tt-muted); }
  .table-name-row { margin: 1rem 0 0; }
  #table-name {
    width: min(100%, 20rem); padding: 0.55rem 0.75rem;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    font-family: var(--tt-font-mono); font-size: 0.9rem; color: var(--tt-ink);
    background: var(--tt-surface);
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
    border-radius: var(--tt-radius); background: var(--tt-surface); color: var(--tt-ink);
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
    appearance: none; border: 1px solid var(--tt-line); background: var(--tt-surface);
    color: var(--tt-muted); font-family: var(--tt-font-display); font-size: 0.8rem;
    padding: 0.3rem 0.65rem; border-radius: var(--tt-radius); cursor: pointer;
  }
  .copy-btn:hover { color: var(--tt-blue); border-color: var(--tt-blue); }
  .copy-btn:focus-visible { outline: 2px solid var(--tt-clay); outline-offset: 2px; }
  .output-block pre {
    margin: 0; padding: 0.9rem 1rem; overflow: auto;
    border: 1px solid var(--tt-line); border-radius: var(--tt-radius);
    background: color-mix(in srgb, var(--tt-blue) 8%, var(--tt-paper));
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

function navLink(
  href: string,
  label: string,
  key: NavKey,
  active?: NavKey,
): string {
  const current = active === key;
  return `<a href="${href}"${current ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`;
}

function layout(options: {
  title: string;
  description: string;
  canonical?: string;
  body: string;
  script?: string;
  active?: NavKey;
}): string {
  const canonical = options.canonical
    ? `<link rel="canonical" href="${options.canonical}" />`
    : "";
  const appScript = options.script ? `<script>${options.script}</script>` : "";
  const active = options.active;
  return `<!DOCTYPE html>
<html lang="en" data-theme="${THEME_DEFAULT}">
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
          <span class="brand-tag">Data toolkit</span>
        </span>
      </a>
      <nav class="nav" aria-label="Site">
        ${navLink("/", "Tools", "hub", active)}
        ${navLink("/scaffold", "Scaffold", "scaffold", active)}
        ${navLink("/lint", "Lint", "lint", active)}
        ${navLink("/format", "Format", "format", active)}
        ${navLink("/names", "Names", "names", active)}
        ${navLink("/about", "About", "about", active)}
        ${navLink("/privacy", "Privacy", "privacy", active)}
        ${THEME_TOGGLE}
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
  ${appScript}
  <script>${THEME_JS}</script>
</body>
</html>`;
}

function renderHub(): string {
  return layout({
    title: "eaglesheet — data toolkit",
    description:
      "Small in-browser tools for data work: Snowflake SQL scaffolding, linting, formatting, and identifier cleanup.",
    canonical: "/",
    active: "hub",
    body: `
      <h1>eaglesheet</h1>
      <p class="privacy-banner">Everything runs in your browser. Nothing you paste is uploaded to eaglesheet.</p>
      <p class="lede">A pocket toolkit for data engineers — scaffold, lint, format, and clean identifiers for Snowflake.</p>

      <h2>Tools</h2>
      <ul class="tool-list">
        <li>
          <a class="tool-name" href="/scaffold">Scaffold</a>
          <p>Paste CSV or JSON and get <span class="mono">CREATE TABLE</span>, load SQL, and a Type 1 <span class="mono">MERGE</span> for Snowflake.</p>
        </li>
        <li>
          <a class="tool-name" href="/lint">Lint</a>
          <p>Rule-based SQL checks for unbalanced syntax, missing WHERE, SELECT *, cartesian risk, and a few Snowflake nits.</p>
        </li>
        <li>
          <a class="tool-name" href="/format">Format</a>
          <p>Paste messy SQL and get readable warehouse-style formatting — clause breaks, keyword case, preserved strings.</p>
        </li>
        <li>
          <a class="tool-name" href="/names">Names</a>
          <p>Messy headers → Snowflake-safe <span class="mono">SNAKE_CASE</span>, a rename map, and a quoted <span class="mono">AS</span> select list.</p>
        </li>
      </ul>
    `,
  });
}

function renderScaffold(): string {
  return layout({
    title: "Scaffold — eaglesheet",
    description:
      "Paste a CSV or JSON sample and get CREATE TABLE, COPY INTO, and MERGE SQL for Snowflake. Everything runs in the browser.",
    canonical: "/scaffold",
    active: "scaffold",
    script: CLIENT_SCRIPT,
    body: `
      <h1>Scaffold</h1>
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

      <div class="url-row">
        <label class="field-label" for="sample-url">Sample URL</label>
        <div class="url-load-row">
          <input id="sample-url" name="sample-url" type="url" spellcheck="false" autocomplete="off" placeholder="https://example.com/data.csv" />
          <button type="button" class="file-upload-btn" id="load-url">Load URL</button>
        </div>
        <p class="url-hint">
          <button type="button" class="example-btn" id="seed-url">Try iris CSV</button>
          — small public Plotly dataset via jsDelivr (fetched in your browser).
        </p>
      </div>

      <div class="table-name-row">
        <label class="field-label" for="table-name">Table name</label>
        <input id="table-name" name="table-name" type="text" value="MY_TABLE" spellcheck="false" autocomplete="off" />
      </div>

      <p id="parse-error" class="error" hidden></p>
      <div id="column-mapping" hidden></div>
      <div id="key-columns" hidden></div>

      <p id="empty-state" class="empty-state">Paste, upload, or load a sample URL — or use the worked example — to generate Snowflake SQL.</p>

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

function renderLint(): string {
  return layout({
    title: "Lint — eaglesheet",
    description:
      "In-browser SQL linter for common data-engineering footguns, with Snowflake-oriented notes.",
    canonical: "/lint",
    active: "lint",
    script: LINT_SCRIPT,
    body: `
      <h1>Lint</h1>
      <p class="privacy-banner">SQL is checked in your browser. Nothing is sent to eaglesheet.</p>
      <p class="lede">Rule-based hygiene checks — not a full parser. Useful before you paste into a worksheet.</p>

      <label class="field-label" for="sql-input">SQL</label>
      <textarea id="sql-input" spellcheck="false" placeholder="Paste a query or DML statement."></textarea>
      <div class="sample-actions">
        <button type="button" class="example-btn" id="load-lint-example">Load example</button>
      </div>

      <p id="lint-summary" class="lint-summary" hidden></p>
      <div id="findings" class="findings" aria-live="polite"></div>
      <p id="lint-empty" class="empty-state">Paste SQL above to run checks.</p>
    `,
  });
}

function renderFormat(): string {
  return layout({
    title: "Format — eaglesheet",
    description:
      "In-browser SQL formatter for warehouse SQL. Paste messy queries, get readable layout.",
    canonical: "/format",
    active: "format",
    script: FORMAT_SCRIPT,
    body: `
      <h1>Format</h1>
      <p class="privacy-banner">SQL is formatted in your browser. Nothing is sent to eaglesheet.</p>
      <p class="lede">Quick readability pass — clause breaks, keyword casing, preserved strings and comments. Companion to <a href="/lint">Lint</a>.</p>

      <label class="field-label" for="format-input">SQL</label>
      <textarea id="format-input" spellcheck="false" placeholder="Paste a query or DML statement."></textarea>
      <div class="sample-actions option-row">
        <button type="button" class="example-btn" id="load-format-example">Load example</button>
        <label><input type="checkbox" id="uppercase-keywords" checked /> Uppercase keywords</label>
      </div>

      <section class="output-block" aria-live="polite">
        <div class="output-head">
          <h2>Formatted</h2>
          <button type="button" class="copy-btn" data-copy="format-output">Copy</button>
        </div>
        <pre id="format-output"></pre>
      </section>
      <p id="format-empty" class="empty-state">Paste SQL above to format it.</p>
    `,
  });
}

function renderNames(): string {
  return layout({
    title: "Names — eaglesheet",
    description:
      "Turn messy column headers into Snowflake-safe SNAKE_CASE identifiers, with a rename map and AS select list.",
    canonical: "/names",
    active: "names",
    script: NAMES_SCRIPT,
    body: `
      <h1>Names</h1>
      <p class="privacy-banner">Headers are normalised in your browser. Nothing is sent to eaglesheet.</p>
      <p class="lede">Paste a CSV header line or one name per line. Get warehouse-safe identifiers — same rules Scaffold uses — plus a rename map you can drop into a select list.</p>

      <label class="field-label" for="names-input">Headers</label>
      <div class="format-row">
        <div class="format-toggle" role="group" aria-label="Input shape">
          <label><input type="radio" name="names-mode" value="auto" checked /> Auto</label>
          <label><input type="radio" name="names-mode" value="csv" /> CSV header</label>
          <label><input type="radio" name="names-mode" value="lines" /> One per line</label>
        </div>
      </div>
      <textarea id="names-input" spellcheck="false" placeholder="Order Id,Customer Name,Total $&#10;or one name per line"></textarea>
      <div class="sample-actions">
        <button type="button" class="example-btn" id="load-names-example">Load example</button>
      </div>

      <p id="names-summary" class="names-summary" hidden></p>
      <p id="names-empty" class="empty-state">Paste headers above to normalise them.</p>

      <section class="outputs" id="names-outputs" hidden aria-live="polite">
        <div class="output-block">
          <div class="output-head">
            <h2>Identifiers</h2>
            <button type="button" class="copy-btn" data-copy="names-identifiers">Copy</button>
          </div>
          <pre id="names-identifiers"></pre>
        </div>
        <div class="output-block">
          <div class="output-head">
            <h2>Rename map</h2>
            <button type="button" class="copy-btn" data-copy="names-rename-map">Copy</button>
          </div>
          <pre id="names-rename-map"></pre>
        </div>
        <div class="output-block">
          <div class="output-head">
            <h2>SELECT list (AS)</h2>
            <button type="button" class="copy-btn" data-copy="names-select-list">Copy</button>
          </div>
          <pre id="names-select-list"></pre>
        </div>
      </section>
    `,
  });
}

function renderAbout(): string {
  return layout({
    title: "About — eaglesheet",
    description: "About eaglesheet, a small in-browser data toolkit.",
    canonical: "/about",
    active: "about",
    body: `
      <h1>About</h1>
      <p>eaglesheet is a pocket toolkit for data engineers: scaffold Snowflake SQL from a CSV or JSON sample, lint and format SQL, and normalise messy column names.</p>
      <p>It assumes you already know Snowflake. The point is removing tedious typing and catching obvious mistakes before a worksheet run.</p>
      <p>Part of the <a href="https://congtam.net">congtam.net</a> portfolio. No accounts, no saved state, no server-side processing of your inputs. See <a href="/privacy">Privacy</a>.</p>
    `,
  });
}

function renderPrivacy(): string {
  return layout({
    title: "Privacy — eaglesheet",
    description: "Privacy for eaglesheet: samples and SQL stay in the browser.",
    canonical: "/privacy",
    active: "privacy",
    body: `
      <h1>Privacy</h1>
      <p>Scaffolding, linting, formatting, and name normalisation run entirely in your browser. Pasted samples, headers, and SQL are never posted to eaglesheet, logged, or stored.</p>
      <p>Loading a public URL uses your browser to fetch the file directly. The Worker serves HTML and records a traffic datapoint (path, country, method, status). It does not see sample or SQL content.</p>
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
      <p>No page at this URL. <a href="/">Back to tools</a>.</p>
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
    return html(renderHub(), context.requestId);
  }
  if (path === "/scaffold") {
    return html(renderScaffold(), context.requestId);
  }
  if (path === "/lint") {
    return html(renderLint(), context.requestId);
  }
  if (path === "/format") {
    return html(renderFormat(), context.requestId);
  }
  if (path === "/names") {
    return html(renderNames(), context.requestId);
  }
  if (path === "/about") {
    return html(renderAbout(), context.requestId);
  }
  if (path === "/privacy") {
    return html(renderPrivacy(), context.requestId);
  }

  return html(renderNotFound(), context.requestId, { status: 404 });
}
