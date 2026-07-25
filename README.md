# eaglesheet

Small in-browser data tools for engineers: scaffold Snowflake SQL from a CSV or
JSON sample, and lint SQL for common footguns. Inputs never leave the page.

## Tools

- `/` — toolkit hub
- `/scaffold` — CSV/JSON → `CREATE TABLE`, load SQL, `MERGE`
- `/lint` — rule-based SQL hygiene checks

## Setup

```sh
npm install
npm run cf-typegen
npm run dev
```

## Deploy

```sh
npm run validate
npx wrangler deploy
```

Custom domain: `eaglesheet.com`. Traffic dataset: `eaglesheet_traffic`.
