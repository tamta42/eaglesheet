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
  .page { flex: 1; width: min(720px, 100%); margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  h1 {
    margin: 0 0 0.75rem; font-size: 1.85rem; font-weight: 700;
    letter-spacing: -0.03em; color: var(--tt-blue); line-height: 1.2;
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
}): string {
  const canonical = options.canonical
    ? `<link rel="canonical" href="${options.canonical}" />`
    : "";
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
</body>
</html>`;
}

function renderHome(): string {
  return layout({
    title: "eaglesheet — Snowflake SQL from a sample",
    description:
      "Paste a CSV or JSON sample and get CREATE TABLE, COPY INTO, and MERGE SQL for Snowflake. Everything runs in the browser.",
    canonical: "/",
    body: `
      <h1>eaglesheet</h1>
      <p class="privacy-banner">Everything runs in your browser. The sample never leaves this page.</p>
      <p class="lede">Paste a few rows of real data and get production-ready Snowflake SQL — table DDL, load statements, and a Type 1 MERGE.</p>
      <p class="mono">Input and generators land in the next commits.</p>
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
