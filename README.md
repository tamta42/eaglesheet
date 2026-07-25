# eaglesheet

Paste a CSV or JSON sample and get Snowflake `CREATE TABLE`, `COPY INTO`, and
`MERGE` SQL. Everything runs in the browser — the sample never leaves the page.

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
