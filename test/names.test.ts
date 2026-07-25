import {
  formatSelectList,
  mapNames,
  normaliseNames,
  parseNameInput,
  quoteSnowflakeIdent,
} from "../src/names";
import { describe, expect, it } from "vitest";

describe("parseNameInput", () => {
  it("treats a single comma-separated line as CSV in auto mode", () => {
    expect(parseNameInput("Order Id,Customer Name,Total $")).toEqual([
      "Order Id",
      "Customer Name",
      "Total $",
    ]);
  });

  it("treats newline lists as one name per line", () => {
    expect(parseNameInput("Order Id\nCustomer Name\nTotal $")).toEqual([
      "Order Id",
      "Customer Name",
      "Total $",
    ]);
  });

  it("respects csv mode using only the first line", () => {
    expect(parseNameInput("a,b,c\n1,2,3", "csv")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted CSV fields", () => {
    expect(parseNameInput('"Order, Id",Name', "csv")).toEqual([
      "Order, Id",
      "Name",
    ]);
  });
});

describe("mapNames", () => {
  it("produces Snowflake-safe SNAKE_CASE with reserved and digit rules", () => {
    const mapped = mapNames(["order", "2024 sales", "Customer Name"]);
    expect(mapped.map((row) => row.name)).toEqual([
      "ORDER_COL",
      "C_2024_SALES",
      "CUSTOMER_NAME",
    ]);
  });

  it("dedupes collisions", () => {
    const mapped = mapNames(["order id", "order-id"]);
    expect(mapped.map((row) => row.name)).toEqual(["ORDER_ID", "ORDER_ID_2"]);
  });
});

describe("outputs", () => {
  it("quotes originals that change in the SELECT list", () => {
    const mapped = mapNames(["Customer Name", "ORDER_ID"]);
    expect(formatSelectList(mapped)).toBe(
      [
        '  "Customer Name" AS CUSTOMER_NAME,',
        "  ORDER_ID AS ORDER_ID",
        "",
      ].join("\n"),
    );
  });

  it("escapes double quotes in originals", () => {
    expect(quoteSnowflakeIdent('say "hi"')).toBe('"say ""hi"""');
  });

  it("normaliseNames returns all three blocks", () => {
    const result = normaliseNames("Order Id,Total $");
    expect(result.error).toBeNull();
    expect(result.identifiers).toBe("ORDER_ID\nTOTAL\n");
    expect(result.renameMap).toContain("Order Id → ORDER_ID");
    expect(result.renameMap).toContain("Total $ → TOTAL");
    expect(result.selectList).toContain('"Order Id" AS ORDER_ID');
  });
});
