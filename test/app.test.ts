import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("static profile", () => {
  it("serves the home page with brand shell and privacy banner", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(response.headers.get("x-request-id")).toBeTruthy();
    const body = await response.text();
    expect(body).toContain("eaglesheet");
    expect(body).toContain("Everything runs in your browser");
    expect(body).toContain("tamta-tokens.css");
    expect(body).toContain("mark-tile.svg");
    expect(body).toContain("congtam.net");
    expect(body).toContain('id="sample"');
    expect(body).toContain('name="format"');
    expect(body).toContain("detectFormat");
    expect(body).toContain("load-example");
    expect(body).toContain('id="sample-file"');
    expect(body).toContain("Upload file");
    expect(body).toContain("data-copy");
    expect(body).toContain("empty-state");
    expect(body).toContain('data-theme="dark"');
    expect(body).toContain("tt-theme");
    expect(body).toContain("data-theme-toggle");
  });

  it("serves about and privacy pages", async () => {
    const about = await SELF.fetch("https://eaglesheet.com/about");
    expect(about.status).toBe(200);
    expect(await about.text()).toContain("Snowflake-ready");

    const privacy = await SELF.fetch("https://eaglesheet.com/privacy");
    expect(privacy.status).toBe(200);
    expect(await privacy.text()).toContain("never posted, logged, or stored");
  });

  it("serves a branded 404", async () => {
    const response = await SELF.fetch("https://eaglesheet.com/missing");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Not found");
  });
});
