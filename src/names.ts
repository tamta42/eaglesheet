/**
 * Normalise messy column headers into Snowflake-safe SNAKE_CASE identifiers.
 * Reuses engine normaliser rules (reserved words, digit leading, dedupe).
 */

import { normalizeHeaderNames, parseCsvLine } from "./engine";

export type NameInputMode = "auto" | "csv" | "lines";

export interface NameMapping {
  original: string;
  name: string;
  changed: boolean;
}

/** Quote an identifier for Snowflake (double quotes, escape ""). */
export function quoteSnowflakeIdent(raw: string): string {
  return `"${raw.replace(/"/g, '""')}"`;
}

/**
 * Split pasted headers into raw names.
 * - csv: first non-empty line as a CSV header row
 * - lines: one name per non-empty line
 * - auto: single line with a comma → csv; otherwise lines
 */
export function parseNameInput(
  input: string,
  mode: NameInputMode = "auto",
): string[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\s+$/u, "");
  if (!text.trim()) return [];

  const lines = text
    .split(/\r\n|\n|\r/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const resolved: NameInputMode =
    mode === "auto"
      ? lines.length === 1 && (lines[0]?.includes(",") ?? false)
        ? "csv"
        : "lines"
      : mode;

  if (resolved === "csv") {
    const header = lines[0] ?? "";
    return parseCsvLine(header).map((field) => field.trim());
  }

  return lines;
}

export function mapNames(rawNames: string[]): NameMapping[] {
  const { names } = normalizeHeaderNames(rawNames);
  return rawNames.map((original, index) => {
    const name = names[index] ?? `COL_${String(index)}`;
    return {
      original,
      name,
      changed: original !== name,
    };
  });
}

/** One Snowflake identifier per line. */
export function formatIdentifierList(mappings: NameMapping[]): string {
  if (mappings.length === 0) return "";
  return `${mappings.map((row) => row.name).join("\n")}\n`;
}

/** old → NEW lines (all rows; unchanged still shown for a complete map). */
export function formatRenameMap(mappings: NameMapping[]): string {
  if (mappings.length === 0) return "";
  return `${mappings.map((row) => `${row.original} → ${row.name}`).join("\n")}\n`;
}

/**
 * SELECT projection fragment: "messy header" AS CLEAN_NAME
 * Unchanged bare identifiers stay unquoted on the left when already safe.
 */
export function formatSelectList(mappings: NameMapping[]): string {
  if (mappings.length === 0) return "";
  const lines = mappings.map((row, index) => {
    const left = row.changed ? quoteSnowflakeIdent(row.original) : row.original;
    const comma = index < mappings.length - 1 ? "," : "";
    return `  ${left} AS ${row.name}${comma}`;
  });
  return `${lines.join("\n")}\n`;
}

export function normaliseNames(
  input: string,
  mode: NameInputMode = "auto",
): {
  mappings: NameMapping[];
  identifiers: string;
  renameMap: string;
  selectList: string;
  error: string | null;
} {
  const raw = parseNameInput(input, mode);
  if (raw.length === 0) {
    return {
      mappings: [],
      identifiers: "",
      renameMap: "",
      selectList: "",
      error: null,
    };
  }
  if (raw.every((name) => name.length === 0)) {
    return {
      mappings: [],
      identifiers: "",
      renameMap: "",
      selectList: "",
      error: "No column names found.",
    };
  }
  const mappings = mapNames(raw);
  return {
    mappings,
    identifiers: formatIdentifierList(mappings),
    renameMap: formatRenameMap(mappings),
    selectList: formatSelectList(mappings),
    error: null,
  };
}
