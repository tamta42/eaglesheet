import { formatSql } from "../src/format";
import { describe, expect, it } from "vitest";

describe("formatSql", () => {
  it("returns empty for blank input", () => {
    expect(formatSql("")).toBe("");
    expect(formatSql("   \n  ")).toBe("");
  });

  it("uppercases keywords and breaks major clauses", () => {
    const formatted = formatSql(
      "select a, b from orders o where o.status = 'open' and o.total > 10 order by a limit 5",
    );
    expect(formatted).toContain("SELECT");
    expect(formatted).toContain("\nFROM");
    expect(formatted).toContain("\nWHERE");
    expect(formatted).toContain("\nORDER BY");
    expect(formatted).toContain("\nLIMIT");
    expect(formatted).toMatch(/AND/);
  });

  it("puts select list items on separate lines", () => {
    const formatted = formatSql("select order_id, customer_name, total from t");
    expect(formatted).toBe(
      [
        "SELECT",
        "  order_id,",
        "  customer_name,",
        "  total",
        "FROM t",
        "",
      ].join("\n"),
    );
  });

  it("preserves string literals and comments", () => {
    const formatted = formatSql(
      "select 'keep Case' as label -- trailing note\nfrom dual",
    );
    expect(formatted).toContain("'keep Case'");
    expect(formatted).toContain("-- trailing note");
    expect(formatted).toContain("FROM");
  });

  it("formats join keywords on one line", () => {
    const formatted = formatSql(
      "select * from a left outer join b on a.id = b.id",
    );
    expect(formatted).toContain("LEFT OUTER JOIN");
    expect(formatted).toContain("ON");
  });

  it("can leave keywords in original case", () => {
    const formatted = formatSql("select a from t", {
      uppercaseKeywords: false,
    });
    expect(formatted).toContain("select");
    expect(formatted).not.toContain("SELECT");
  });
});
