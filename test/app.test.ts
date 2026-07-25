import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("toolkit routes", () => {
  it("serves the tools hub at /", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Data toolkit");
    expect(body).toContain('href="/scaffold"');
    expect(body).toContain('href="/lint"');
    expect(body).toContain('href="/format"');
    expect(body).toContain("data-theme-toggle");
    expect(body).not.toContain('id="sample"');
  });

  it("serves the scaffold tool with sample controls", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/scaffold");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src https:",
    );
    const body = await response.text();
    expect(body).toContain('id="sample"');
    expect(body).toContain("detectFormat");
    expect(body).toContain("Upload file");
    expect(body).toContain("Try iris CSV");
    expect(body).toContain(
      "https://cdn.jsdelivr.net/gh/plotly/datasets@master/iris.csv",
    );
  });

  it("serves the lint tool", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/lint");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="sql-input"');
    expect(body).toContain("load-lint-example");
    expect(body).toContain("lintSql");
    expect(body).toContain("SQL is checked in your browser");
  });

  it("serves the format tool", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/format");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('id="format-input"');
    expect(body).toContain("load-format-example");
    expect(body).toContain("formatSql");
    expect(body).toContain("SQL is formatted in your browser");
    expect(body).toContain("uppercase-keywords");
  });

  it("privacy page explains client-side processing", async () => {
    const privacy = await SELF.fetch("https://eaglesheet.com/privacy");
    expect(privacy.status).toBe(200);
    const body = await privacy.text();
    expect(body).toContain("URL-loaded");
    expect(body).toContain("fetch the file directly");
    expect(body).toContain("never posted to eaglesheet, logged, or stored");
  });

  it("serves about and a branded 404", async () => {
    const about = await SELF.fetch("https://eaglesheet.com/about");
    expect(about.status).toBe(200);
    expect(await about.text()).toContain("pocket toolkit");

    const missing = await SELF.fetch("https://eaglesheet.com/missing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("Not found");
  });
});
