export type SampleFormat = "csv" | "json";

export type SnowflakeType =
  | "NUMBER(38,0)"
  | `NUMBER(${number},${number})`
  | "FLOAT"
  | "BOOLEAN"
  | "DATE"
  | "TIME"
  | "TIMESTAMP_NTZ"
  | "TIMESTAMP_TZ"
  | "VARIANT"
  | "VARCHAR";

export interface ColumnSpec {
  originalName: string;
  name: string;
  inferredType: SnowflakeType;
  type: SnowflakeType;
  renamed: boolean;
}

export interface ParseResult {
  columns: ColumnSpec[];
  rows: string[][];
  error: string | null;
}

const RESERVED = new Set(
  [
    "SELECT",
    "FROM",
    "WHERE",
    "TABLE",
    "ORDER",
    "GROUP",
    "BY",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "ON",
    "AS",
    "AND",
    "OR",
    "NOT",
    "NULL",
    "TRUE",
    "FALSE",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "CREATE",
    "DROP",
    "ALTER",
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "VALUES",
    "INTO",
    "WITH",
    "UNION",
    "ALL",
    "DISTINCT",
    "LIMIT",
  ].map((word) => word.toUpperCase()),
);

const MISSING = new Set(["", "NULL", "null", "\\N"]);

/** Auto-detect: trimmed input starting with `{` or `[` is JSON, else CSV. */
export function detectFormat(input: string): SampleFormat {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "csv";
}

export function isMissing(value: string): boolean {
  return MISSING.has(value);
}

export function normalizeIdentifier(raw: string, index: number): string {
  let result = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!result) result = `COL_${String(index)}`;
  if (/^[0-9]/.test(result)) result = `C_${result}`;
  if (RESERVED.has(result)) result = `${result}_COL`;
  return result;
}

function dedupeNames(bases: string[]): string[] {
  const used = new Set<string>();
  return bases.map((base) => {
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let suffix = 2;
    while (used.has(`${base}_${String(suffix)}`)) suffix += 1;
    const name = `${base}_${String(suffix)}`;
    used.add(name);
    return name;
  });
}

export function normalizeHeaderNames(headers: string[]): {
  names: string[];
  renamed: boolean[];
} {
  const bases = headers.map((header, index) =>
    normalizeIdentifier(header, index),
  );
  const names = dedupeNames(bases);
  const renamed = headers.map((header, index) => names[index] !== header);
  return { names, renamed };
}

/** Parse one CSV line with optional double-quoted fields. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (line.charAt(i + 1) === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(input: string): ParseResult {
  const lines = input
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { columns: [], rows: [], error: null };
  }
  const headerFields = parseCsvLine(lines[0] ?? "");
  if (headerFields.length === 0 || headerFields.every((h) => h === "")) {
    return { columns: [], rows: [], error: "Header row is empty." };
  }
  const { names, renamed } = normalizeHeaderNames(headerFields);
  const rows: string[][] = [];
  for (let r = 1; r < lines.length; r++) {
    const fields = parseCsvLine(lines[r] ?? "");
    if (fields.length !== headerFields.length) {
      return {
        columns: [],
        rows: [],
        error: `Row ${String(r + 1)} has ${String(fields.length)} fields but the header has ${String(headerFields.length)}.`,
      };
    }
    rows.push(fields);
  }
  const columns: ColumnSpec[] = names.map((name, index) => {
    const values = rows.map((row) => row[index] ?? "");
    const inferredType = inferColumnType(values);
    return {
      originalName: headerFields[index] ?? "",
      name,
      inferredType,
      type: inferredType,
      renamed: renamed[index] ?? false,
    };
  });
  return { columns, rows, error: null };
}

const INT_RE = /^[+-]?\d{1,38}$/;
const DEC_RE = /^[+-]?\d+\.\d+$/;
const SCI_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/;
const BOOL_RE = /^(true|false|t|f|yes|no)$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const TS_NTZ_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const TS_TZ_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type Candidate =
  | "int"
  | "dec"
  | "float"
  | "bool"
  | "date"
  | "time"
  | "ts_ntz"
  | "ts_tz"
  | "varchar";

function classify(value: string): Candidate {
  if (value === "Infinity" || value === "-Infinity" || value === "NaN") {
    return "float";
  }
  if (SCI_RE.test(value)) return "float";
  if (INT_RE.test(value)) return "int";
  if (DEC_RE.test(value)) return "dec";
  if (BOOL_RE.test(value)) return "bool";
  if (DATE_RE.test(value)) return "date";
  if (TIME_RE.test(value)) return "time";
  if (TS_TZ_RE.test(value)) return "ts_tz";
  if (TS_NTZ_RE.test(value)) return "ts_ntz";
  return "varchar";
}

function decimalParts(value: string): { intDigits: number; scale: number } {
  const raw = value.replace(/^[+-]/, "");
  const pieces = raw.split(".");
  const intPart = pieces[0] ?? "";
  const fracPart = pieces[1] ?? "";
  return { intDigits: intPart.length, scale: fracPart.length };
}

export function inferColumnType(values: string[]): SnowflakeType {
  const present = values.filter((value) => !isMissing(value));
  if (present.length === 0) return "VARCHAR";

  const kinds = present.map(classify);
  if (kinds.every((k) => k === "bool")) return "BOOLEAN";
  if (kinds.every((k) => k === "date")) return "DATE";
  if (kinds.every((k) => k === "time")) return "TIME";
  if (kinds.every((k) => k === "ts_tz")) return "TIMESTAMP_TZ";
  if (kinds.every((k) => k === "ts_ntz")) return "TIMESTAMP_NTZ";
  if (kinds.every((k) => k === "ts_ntz" || k === "ts_tz")) {
    return "TIMESTAMP_TZ";
  }
  if (kinds.every((k) => k === "float" || k === "int" || k === "dec")) {
    if (kinds.some((k) => k === "float")) return "FLOAT";
    if (kinds.every((k) => k === "int")) return "NUMBER(38,0)";
    let maxInt = 0;
    let maxScale = 0;
    for (const value of present) {
      if (classify(value) === "int") {
        const digits = value.replace(/^[+-]/, "").length;
        maxInt = Math.max(maxInt, digits);
      } else {
        const parts = decimalParts(value);
        maxInt = Math.max(maxInt, parts.intDigits);
        maxScale = Math.max(maxScale, parts.scale);
      }
    }
    const precision = Math.min(38, maxInt + maxScale);
    return `NUMBER(${String(precision)},${String(maxScale)})` as SnowflakeType;
  }
  return "VARCHAR";
}

export const BASE_OVERRIDE_TYPES = [
  "NUMBER(38,0)",
  "NUMBER(18,2)",
  "NUMBER(12,2)",
  "FLOAT",
  "BOOLEAN",
  "DATE",
  "TIME",
  "TIMESTAMP_NTZ",
  "TIMESTAMP_TZ",
  "VARIANT",
  "VARCHAR",
] as const;

export function typeOptionsFor(inferred: string): string[] {
  const options = new Set<string>([inferred, ...BASE_OVERRIDE_TYPES]);
  return [...options];
}

export function alignCreateTable(
  tableName: string,
  columns: { name: string; type: string }[],
): string {
  const nameWidth = Math.max(...columns.map((column) => column.name.length), 1);
  const lines = columns.map((column) => {
    const padding = " ".repeat(nameWidth - column.name.length);
    return `  ${column.name}${padding} ${column.type}`;
  });
  return `CREATE OR REPLACE TABLE ${tableName} (\n${lines.join(",\n")}\n);`;
}

export function generateCreateTableSql(
  tableNameRaw: string,
  columns: ColumnSpec[],
): string {
  const tableName =
    normalizeHeaderNames([tableNameRaw || "MY_TABLE"]).names[0] ?? "MY_TABLE";
  return alignCreateTable(
    tableName,
    columns.map((column) => ({ name: column.name, type: column.type })),
  );
}

export function resolvedTableName(tableNameRaw: string): string {
  return (
    normalizeHeaderNames([tableNameRaw || "MY_TABLE"]).names[0] ?? "MY_TABLE"
  );
}

/** Block two: CSV FILE FORMAT + COPY INTO. */
export function generateCsvLoadSql(tableNameRaw: string): string {
  const tableName = resolvedTableName(tableNameRaw);
  const formatName = `${tableName}_CSV_FORMAT`;
  return [
    `CREATE OR REPLACE FILE FORMAT ${formatName}`,
    `  TYPE = CSV`,
    `  FIELD_DELIMITER = ','`,
    `  SKIP_HEADER = 1`,
    `  FIELD_OPTIONALLY_ENCLOSED_BY = '"'`,
    `  TRIM_SPACE = TRUE`,
    `  NULL_IF = ('', 'NULL', 'null', '\\\\N')`,
    `  EMPTY_FIELD_AS_NULL = TRUE;`,
    ``,
    `COPY INTO ${tableName}`,
    `FROM @MY_STAGE/path/`,
    `FILE_FORMAT = (FORMAT_NAME = ${formatName})`,
    `ON_ERROR = ABORT_STATEMENT;`,
  ].join("\n");
}
