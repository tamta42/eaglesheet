import { lintSql, stripSqlNoise } from "../src/lint";
import { describe, expect, it } from "vitest";

describe("stripSqlNoise", () => {
  it("ignores comments and string literals for scanning", () => {
    const cleaned = stripSqlNoise(
      "SELECT 1 -- )\nFROM t /* ( */ WHERE x = ')' AND y = \"z)\"",
    );
    expect(cleaned).not.toContain(")");
    expect(cleaned).toContain("SELECT");
    expect(cleaned).toContain("FROM");
  });
});

describe("lintSql", () => {
  it("returns nothing for empty input", () => {
    expect(lintSql("")).toEqual([]);
    expect(lintSql("   \n")).toEqual([]);
  });

  it("flags unbalanced parentheses and quotes", () => {
    const parens = lintSql("SELECT (1 + 2 FROM t");
    expect(parens.some((f) => f.rule === "unbalanced-parens")).toBe(true);

    const quotes = lintSql("SELECT 'oops FROM t");
    expect(quotes.some((f) => f.rule === "unbalanced-single-quote")).toBe(true);
  });

  it("flags trailing commas before FROM", () => {
    const findings = lintSql("SELECT a, b, FROM t");
    expect(findings.some((f) => f.rule === "trailing-comma")).toBe(true);
  });

  it("warns on SELECT *", () => {
    const findings = lintSql("SELECT * FROM orders");
    expect(findings.some((f) => f.rule === "select-star")).toBe(true);
  });

  it("errors on UPDATE/DELETE without WHERE", () => {
    expect(
      lintSql("UPDATE orders SET status = 'x'").some(
        (f) => f.rule === "missing-where",
      ),
    ).toBe(true);
    expect(
      lintSql("DELETE FROM orders").some((f) => f.rule === "missing-where"),
    ).toBe(true);
    expect(
      lintSql("DELETE FROM orders WHERE id = 1").some(
        (f) => f.rule === "missing-where",
      ),
    ).toBe(false);
  });

  it("warns on CROSS JOIN and JOIN without ON", () => {
    expect(
      lintSql("SELECT * FROM a CROSS JOIN b").some(
        (f) => f.rule === "cross-join",
      ),
    ).toBe(true);
    expect(
      lintSql("SELECT * FROM a JOIN b").some(
        (f) => f.rule === "join-missing-on",
      ),
    ).toBe(true);
    expect(
      lintSql("SELECT * FROM a JOIN b ON a.id = b.id").some(
        (f) => f.rule === "join-missing-on",
      ),
    ).toBe(false);
  });

  it("warns on LIMIT without ORDER BY and ORDER BY RANDOM", () => {
    expect(
      lintSql("SELECT id FROM t LIMIT 10").some(
        (f) => f.rule === "limit-without-order",
      ),
    ).toBe(true);
    expect(
      lintSql("SELECT id FROM t ORDER BY id LIMIT 10").some(
        (f) => f.rule === "limit-without-order",
      ),
    ).toBe(false);
    expect(
      lintSql("SELECT id FROM t ORDER BY RANDOM()").some(
        (f) => f.rule === "order-by-random",
      ),
    ).toBe(true);
  });

  it("notes double-quoted identifiers and reversed BETWEEN", () => {
    expect(
      lintSql('SELECT "OrderId" FROM t').some(
        (f) => f.rule === "quoted-identifier",
      ),
    ).toBe(true);
    expect(
      lintSql("SELECT * FROM t WHERE n BETWEEN 10 AND 1").some(
        (f) => f.rule === "between-bounds",
      ),
    ).toBe(true);
  });

  it("does not treat parentheses inside strings as balance errors", () => {
    const findings = lintSql("SELECT '(not a paren' FROM t");
    expect(findings.some((f) => f.rule === "unbalanced-parens")).toBe(false);
  });
});
