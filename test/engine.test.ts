import {
  detectFormat,
  generateCreateTableSql,
  generateCsvLoadSql,
  inferColumnType,
  normalizeHeaderNames,
  normalizeIdentifier,
  parseCsv,
} from "../src/engine";
import { describe, expect, it } from "vitest";

describe("detectFormat", () => {
  it("treats objects and arrays as JSON", () => {
    expect(detectFormat('{"a":1}')).toBe("json");
    expect(detectFormat("\n  [1,2]\n")).toBe("json");
  });

  it("treats everything else as CSV", () => {
    expect(detectFormat("a,b\n1,2")).toBe("csv");
    expect(detectFormat("")).toBe("csv");
  });
});

describe("normalizeIdentifier", () => {
  it("uppercases and replaces runs of non-alphanumeric with underscore", () => {
    expect(normalizeIdentifier("customer name!", 0)).toBe("CUSTOMER_NAME");
    expect(normalizeIdentifier("  order__total  ", 0)).toBe("ORDER_TOTAL");
  });

  it("prefixes digit-leading names and handles empties", () => {
    expect(normalizeIdentifier("2024_orders", 0)).toBe("C_2024_ORDERS");
    expect(normalizeIdentifier("@@@", 3)).toBe("COL_3");
  });

  it("appends _COL for reserved words", () => {
    expect(normalizeIdentifier("order", 0)).toBe("ORDER_COL");
    expect(normalizeIdentifier("select", 0)).toBe("SELECT_COL");
  });

  it("de-duplicates collisions", () => {
    const { names, renamed } = normalizeHeaderNames([
      "order id",
      "order-id",
      "ORDER_ID",
    ]);
    expect(names).toEqual(["ORDER_ID", "ORDER_ID_2", "ORDER_ID_3"]);
    expect(renamed).toEqual([true, true, true]);
  });
});

describe("inferColumnType", () => {
  it("keeps mixed integers and decimals numeric with shared precision", () => {
    expect(inferColumnType(["10", "10.5", "100.25"])).toBe("NUMBER(5,2)");
  });

  it("treats empty and nullish tokens as missing", () => {
    expect(inferColumnType(["1", "", "NULL", "null", "\\N", "2"])).toBe(
      "NUMBER(38,0)",
    );
    expect(inferColumnType(["", "NULL", "\\N"])).toBe("VARCHAR");
  });

  it("keeps 0/1 as numbers, not booleans", () => {
    expect(inferColumnType(["0", "1", "0"])).toBe("NUMBER(38,0)");
  });

  it("covers date and timestamp forms", () => {
    expect(inferColumnType(["2024-01-15"])).toBe("DATE");
    expect(inferColumnType(["10:30:00", "14:22:01.5"])).toBe("TIME");
    expect(
      inferColumnType(["2024-01-15 10:30:00", "2024-01-16T14:22:01"]),
    ).toBe("TIMESTAMP_NTZ");
    expect(
      inferColumnType(["2024-01-15T10:30:00Z", "2024-01-16 14:22:01+10:00"]),
    ).toBe("TIMESTAMP_TZ");
  });

  it("infers booleans from word forms only", () => {
    expect(inferColumnType(["true", "FALSE", "yes", "no"])).toBe("BOOLEAN");
  });
});

describe("parseCsv and CREATE TABLE", () => {
  it("reports ragged rows clearly", () => {
    const result = parseCsv("a,b\n1,2,3");
    expect(result.error).toBe("Row 2 has 3 fields but the header has 2.");
  });

  it("matches the brief worked example shape", () => {
    const sample = [
      "order_id,customer_name,order_total,is_priority,ordered_at",
      "1001,Acme Corp,1234567890.12,true,2024-01-15 10:30:00",
      "1002,Beta Ltd,45.00,false,2024-01-16T14:22:01",
    ].join("\n");
    const parsed = parseCsv(sample);
    expect(parsed.error).toBeNull();
    expect(parsed.columns.map((c) => c.name)).toEqual([
      "ORDER_ID",
      "CUSTOMER_NAME",
      "ORDER_TOTAL",
      "IS_PRIORITY",
      "ORDERED_AT",
    ]);
    expect(parsed.columns.map((c) => c.type)).toEqual([
      "NUMBER(38,0)",
      "VARCHAR",
      "NUMBER(12,2)",
      "BOOLEAN",
      "TIMESTAMP_NTZ",
    ]);
    const sql = generateCreateTableSql("MY_TABLE", parsed.columns);
    expect(sql).toBe(
      [
        "CREATE OR REPLACE TABLE MY_TABLE (",
        "  ORDER_ID      NUMBER(38,0),",
        "  CUSTOMER_NAME VARCHAR,",
        "  ORDER_TOTAL   NUMBER(12,2),",
        "  IS_PRIORITY   BOOLEAN,",
        "  ORDERED_AT    TIMESTAMP_NTZ",
        ");",
      ].join("\n"),
    );
  });
});

describe("CSV load SQL", () => {
  it("matches the brief FILE FORMAT and COPY INTO shape", () => {
    expect(generateCsvLoadSql("MY_TABLE")).toBe(
      [
        "CREATE OR REPLACE FILE FORMAT MY_TABLE_CSV_FORMAT",
        "  TYPE = CSV",
        "  FIELD_DELIMITER = ','",
        "  SKIP_HEADER = 1",
        "  FIELD_OPTIONALLY_ENCLOSED_BY = '\"'",
        "  TRIM_SPACE = TRUE",
        "  NULL_IF = ('', 'NULL', 'null', '\\\\N')",
        "  EMPTY_FIELD_AS_NULL = TRUE;",
        "",
        "COPY INTO MY_TABLE",
        "FROM @MY_STAGE/path/",
        "FILE_FORMAT = (FORMAT_NAME = MY_TABLE_CSV_FORMAT)",
        "ON_ERROR = ABORT_STATEMENT;",
      ].join("\n"),
    );
  });
});
