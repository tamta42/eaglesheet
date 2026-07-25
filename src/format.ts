/**
 * Pragmatic SQL formatter for warehouse SQL.
 * Preserves strings/comments, uppercases keywords, breaks major clauses
 * onto their own lines, and indents by parenthesis depth.
 */

const KEYWORDS = new Set(
  [
    "SELECT",
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "NOT",
    "IN",
    "IS",
    "NULL",
    "AS",
    "ON",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "FULL",
    "CROSS",
    "NATURAL",
    "USING",
    "GROUP",
    "BY",
    "ORDER",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "QUALIFY",
    "UNION",
    "ALL",
    "INTERSECT",
    "EXCEPT",
    "WITH",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "MERGE",
    "WHEN",
    "MATCHED",
    "THEN",
    "ELSE",
    "END",
    "CASE",
    "CREATE",
    "REPLACE",
    "TABLE",
    "VIEW",
    "FILE",
    "FORMAT",
    "COPY",
    "TYPE",
    "TRUE",
    "FALSE",
    "DISTINCT",
    "BETWEEN",
    "LIKE",
    "ILIKE",
    "EXISTS",
    "OVER",
    "PARTITION",
    "ROWS",
    "RANGE",
    "UNBOUNDED",
    "PRECEDING",
    "FOLLOWING",
    "CURRENT",
    "ROW",
    "ASC",
    "DESC",
    "NULLS",
    "FIRST",
    "LAST",
  ].map((word) => word.toUpperCase()),
);

const CLAUSE_START = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "ORDER",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "QUALIFY",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "WITH",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "SET",
  "VALUES",
  "CREATE",
  "COPY",
  "WHEN",
]);

type Token =
  | { kind: "word"; value: string }
  | { kind: "space"; value: string }
  | { kind: "punct"; value: string }
  | { kind: "string"; value: string }
  | { kind: "comment"; value: string };

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql.charAt(i);
    const next = sql.charAt(i + 1);

    if (ch === "-" && next === "-") {
      let value = "--";
      i += 2;
      while (i < sql.length && sql.charAt(i) !== "\n") {
        value += sql.charAt(i);
        i += 1;
      }
      tokens.push({ kind: "comment", value });
      continue;
    }

    if (ch === "/" && next === "*") {
      let value = "/*";
      i += 2;
      while (i < sql.length) {
        value += sql.charAt(i);
        if (sql.charAt(i) === "*" && sql.charAt(i + 1) === "/") {
          value += "/";
          i += 2;
          break;
        }
        i += 1;
      }
      tokens.push({ kind: "comment", value });
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = quote;
      i += 1;
      while (i < sql.length) {
        value += sql.charAt(i);
        if (sql.charAt(i) === quote && sql.charAt(i + 1) === quote) {
          value += quote;
          i += 2;
          continue;
        }
        if (sql.charAt(i) === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      tokens.push({ kind: "string", value });
      continue;
    }

    if (/\s/.test(ch)) {
      let value = "";
      while (i < sql.length && /\s/.test(sql.charAt(i))) {
        value += sql.charAt(i);
        i += 1;
      }
      tokens.push({ kind: "space", value });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let value = "";
      while (i < sql.length && /[A-Za-z0-9_$]/.test(sql.charAt(i))) {
        value += sql.charAt(i);
        i += 1;
      }
      tokens.push({ kind: "word", value });
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let value = "";
      while (i < sql.length && /[0-9.]/.test(sql.charAt(i))) {
        value += sql.charAt(i);
        i += 1;
      }
      tokens.push({ kind: "word", value });
      continue;
    }

    tokens.push({ kind: "punct", value: ch });
    i += 1;
  }
  return tokens;
}

function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toUpperCase());
}

function peekWord(tokens: Token[], from: number): Token | undefined {
  let j = from;
  while (j < tokens.length && tokens[j]?.kind === "space") j += 1;
  return tokens[j];
}

export interface FormatOptions {
  /** Uppercase SQL keywords (default true). */
  uppercaseKeywords?: boolean;
  indent?: string;
}

/** Format SQL for readability. Empty input stays empty. */
export function formatSql(sql: string, options: FormatOptions = {}): string {
  const uppercaseKeywords = options.uppercaseKeywords !== false;
  const indentUnit = options.indent ?? "  ";
  if (!sql.trim()) return "";

  const tokens = tokenize(sql);
  const parts: string[] = [];
  let depth = 0;
  let line = "";
  let prevWord: string | null = null;
  /** Indent select/set/values list items one step under the clause keyword. */
  let inListClause = false;

  const flush = (): void => {
    const trimmed = line.replace(/\s+$/u, "");
    if (trimmed.length > 0) {
      const listPad = inListClause ? indentUnit : "";
      parts.push(indentUnit.repeat(Math.max(depth, 0)) + listPad + trimmed);
    }
    line = "";
  };

  const pushWord = (text: string): void => {
    if (line.length === 0) line = text;
    else if (line.endsWith(".") || line.endsWith("(")) line += text;
    else line += ` ${text}`;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.kind === "space") continue;

    if (token.kind === "comment") {
      flush();
      parts.push(indentUnit.repeat(Math.max(depth, 0)) + token.value.trimEnd());
      prevWord = null;
      continue;
    }

    if (token.kind === "string") {
      pushWord(token.value);
      continue;
    }

    if (token.kind === "punct") {
      if (token.value === "(") {
        pushWord("(");
        flush();
        depth += 1;
        continue;
      }
      if (token.value === ")") {
        flush();
        depth = Math.max(depth - 1, 0);
        line = ")";
        continue;
      }
      if (token.value === ",") {
        line += ",";
        flush();
        continue;
      }
      if (token.value === ";") {
        line += ";";
        flush();
        prevWord = null;
        continue;
      }
      if (token.value === ".") {
        line += ".";
        continue;
      }
      pushWord(token.value);
      continue;
    }

    const raw = token.value;
    const upper = raw.toUpperCase();
    const keyword = isKeyword(raw);
    const display = keyword && uppercaseKeywords ? upper : raw;

    // GROUP/ORDER/PARTITION BY
    if (
      keyword &&
      (upper === "GROUP" || upper === "ORDER" || upper === "PARTITION")
    ) {
      const next = peekWord(tokens, i + 1);
      if (next?.kind === "word" && next.value.toUpperCase() === "BY") {
        flush();
        line = `${display} BY`;
        let j = i + 1;
        while (j < tokens.length && tokens[j]?.kind === "space") j += 1;
        i = j;
        prevWord = "BY";
        continue;
      }
    }

    // LEFT/RIGHT/INNER/FULL/CROSS/NATURAL [OUTER] JOIN
    if (
      keyword &&
      ["LEFT", "RIGHT", "INNER", "FULL", "CROSS", "NATURAL"].includes(upper)
    ) {
      const joinParts = [display];
      let j = i + 1;
      while (j < tokens.length) {
        const t = tokens[j];
        if (!t || t.kind === "space") {
          j += 1;
          continue;
        }
        if (
          t.kind === "word" &&
          ["OUTER", "JOIN"].includes(t.value.toUpperCase())
        ) {
          joinParts.push(uppercaseKeywords ? t.value.toUpperCase() : t.value);
          j += 1;
          if (t.value.toUpperCase() === "JOIN") break;
          continue;
        }
        break;
      }
      if (joinParts.some((part) => part.toUpperCase() === "JOIN")) {
        flush();
        line = joinParts.join(" ");
        i = j - 1;
        prevWord = "JOIN";
        continue;
      }
    }

    // CREATE OR REPLACE — keep on one line start
    if (keyword && upper === "CREATE") {
      flush();
      line = display;
      const next = peekWord(tokens, i + 1);
      if (next?.kind === "word" && next.value.toUpperCase() === "OR") {
        let j = i + 1;
        while (j < tokens.length && tokens[j]?.kind === "space") j += 1;
        // OR
        line += uppercaseKeywords ? " OR" : ` ${next.value}`;
        j += 1;
        while (j < tokens.length && tokens[j]?.kind === "space") j += 1;
        const replaceTok = tokens[j];
        if (
          replaceTok?.kind === "word" &&
          replaceTok.value.toUpperCase() === "REPLACE"
        ) {
          line += uppercaseKeywords ? " REPLACE" : ` ${replaceTok.value}`;
          i = j;
          prevWord = "REPLACE";
          continue;
        }
      }
      prevWord = upper;
      continue;
    }

    if (keyword && CLAUSE_START.has(upper)) {
      flush();
      inListClause = false;
      line = display;
      if (upper === "SELECT" || upper === "SET" || upper === "VALUES") {
        flush();
        inListClause = true;
      }
      prevWord = upper;
      continue;
    }

    if (keyword && (upper === "AND" || upper === "OR")) {
      flush();
      // Indent AND/OR one step relative to the current depth
      line = indentUnit + display;
      prevWord = upper;
      continue;
    }

    // UNION ALL
    if (keyword && upper === "ALL" && prevWord === "UNION") {
      pushWord(display);
      prevWord = upper;
      continue;
    }

    pushWord(display);
    prevWord = keyword ? upper : raw;
  }

  flush();
  return `${parts.join("\n").replace(/\n+$/u, "")}\n`;
}
