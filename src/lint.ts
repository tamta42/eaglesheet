export type LintSeverity = "error" | "warn" | "info";

export interface LintFinding {
  severity: LintSeverity;
  rule: string;
  message: string;
  line?: number;
  column?: number;
}

interface Position {
  line: number;
  column: number;
}

/** Map a character index in the original SQL to 1-based line/column. */
export function positionAt(sql: string, index: number): Position {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(index, 0), sql.length);
  for (let i = 0; i < end; i++) {
    if (sql.charAt(i) === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/**
 * Strip line/block comments and string literals so balance/keyword scans
 * ignore noise. Replaces removed spans with spaces (newlines kept).
 */
export function stripSqlNoise(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql.charAt(i);
    const next = sql.charAt(i + 1);

    if (ch === "-" && next === "-") {
      out += "  ";
      i += 2;
      while (i < sql.length && sql.charAt(i) !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < sql.length) {
        if (sql.charAt(i) === "*" && sql.charAt(i + 1) === "/") {
          out += "  ";
          i += 2;
          break;
        }
        out += sql.charAt(i) === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    if (ch === "'") {
      out += " ";
      i += 1;
      while (i < sql.length) {
        if (sql.charAt(i) === "'" && sql.charAt(i + 1) === "'") {
          out += "  ";
          i += 2;
          continue;
        }
        if (sql.charAt(i) === "'") {
          out += " ";
          i += 1;
          break;
        }
        out += sql.charAt(i) === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      out += " ";
      i += 1;
      while (i < sql.length) {
        if (sql.charAt(i) === '"' && sql.charAt(i + 1) === '"') {
          out += "  ";
          i += 2;
          continue;
        }
        if (sql.charAt(i) === '"') {
          out += " ";
          i += 1;
          break;
        }
        out += sql.charAt(i) === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }
  return out;
}

function findUnbalanced(
  sql: string,
  open: string,
  close: string,
  rule: string,
  label: string,
): LintFinding[] {
  const findings: LintFinding[] = [];
  let depth = 0;
  let firstExtraClose = -1;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql.charAt(i);
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth < 0 && firstExtraClose < 0) firstExtraClose = i;
    }
  }
  if (firstExtraClose >= 0) {
    const pos = positionAt(sql, firstExtraClose);
    findings.push({
      severity: "error",
      rule,
      message: `Unbalanced ${label}: extra closing ${close}.`,
      line: pos.line,
      column: pos.column,
    });
  } else if (depth > 0) {
    findings.push({
      severity: "error",
      rule,
      message: `Unbalanced ${label}: missing ${String(depth)} closing ${close}.`,
    });
  }
  return findings;
}

function findUnbalancedQuotes(
  original: string,
  quote: "'" | '"',
  rule: string,
  label: string,
): LintFinding[] {
  let open = false;
  let openIndex = -1;
  for (let i = 0; i < original.length; i++) {
    if (original.charAt(i) !== quote) continue;
    if (original.charAt(i + 1) === quote) {
      i += 1;
      continue;
    }
    if (!open) {
      open = true;
      openIndex = i;
    } else {
      open = false;
      openIndex = -1;
    }
  }
  if (open && openIndex >= 0) {
    const pos = positionAt(original, openIndex);
    return [
      {
        severity: "error",
        rule,
        message: `Unbalanced ${label}: string or identifier never closed.`,
        line: pos.line,
        column: pos.column,
      },
    ];
  }
  return [];
}

function keywordIndex(clean: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  const match = pattern.exec(clean);
  return match ? match.index : -1;
}

function pushMatchFindings(
  findings: LintFinding[],
  clean: string,
  pattern: RegExp,
  finding: Omit<LintFinding, "line" | "column"> & {
    line?: number;
    column?: number;
  },
): void {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(clean)) !== null) {
    const pos = positionAt(clean, match.index);
    findings.push({
      ...finding,
      line: pos.line,
      column: pos.column,
    });
    if (!pattern.global) break;
  }
}

/** Rule-based SQL linter aimed at Snowflake / data-engineering footguns. */
export function lintSql(sql: string): LintFinding[] {
  const trimmed = sql.trim();
  if (!trimmed) return [];

  const findings: LintFinding[] = [];
  const clean = stripSqlNoise(sql);

  findings.push(
    ...findUnbalancedQuotes(
      sql,
      "'",
      "unbalanced-single-quote",
      "single quotes",
    ),
  );
  findings.push(
    ...findUnbalancedQuotes(
      sql,
      '"',
      "unbalanced-double-quote",
      "double quotes",
    ),
  );
  findings.push(
    ...findUnbalanced(clean, "(", ")", "unbalanced-parens", "parentheses"),
  );

  // Trailing comma before a clause keyword: `, FROM` / `, WHERE` / etc.
  pushMatchFindings(
    findings,
    clean,
    /,\s*(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|QUALIFY|JOIN|LEFT|RIGHT|INNER|FULL|OUTER|UNION|INTERSECT|EXCEPT|VALUES|SET|RETURNING)\b/gi,
    {
      severity: "error",
      rule: "trailing-comma",
      message:
        "Trailing comma before a clause keyword. Remove the comma or add the missing column/expression.",
    },
  );

  pushMatchFindings(findings, clean, /\bSELECT\s+\*/gi, {
    severity: "warn",
    rule: "select-star",
    message:
      "SELECT * pulls every column. Prefer an explicit column list for stable contracts and cheaper scans.",
  });

  // UPDATE / DELETE without WHERE (and not followed by FROM for Snowflake DELETE … FROM patterns still need WHERE for safety)
  const updateDelete =
    /\b(UPDATE|DELETE)\b([\s\S]*?)(?=\b(?:UPDATE|DELETE|INSERT|MERGE|CREATE|WITH|SELECT)\b|$)/gi;
  let ud: RegExpExecArray | null;
  while ((ud = updateDelete.exec(clean)) !== null) {
    const chunk = ud[0];
    if (!/\bWHERE\b/i.test(chunk)) {
      const pos = positionAt(clean, ud.index);
      findings.push({
        severity: "error",
        rule: "missing-where",
        message: `${(ud[1] ?? "Statement").toUpperCase()} without WHERE. This can rewrite or remove every row.`,
        line: pos.line,
        column: pos.column,
      });
    }
  }

  pushMatchFindings(findings, clean, /\bCROSS\s+JOIN\b/gi, {
    severity: "warn",
    rule: "cross-join",
    message:
      "CROSS JOIN produces a cartesian product. Confirm that is intentional and filtered later.",
  });

  // JOIN without ON/USING on the same join fragment (heuristic)
  const joinRe =
    /\b(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|FULL\s+(?:OUTER\s+)?|LEFT\s+|RIGHT\s+|FULL\s+)?JOIN\b/gi;
  let jm: RegExpExecArray | null;
  while ((jm = joinRe.exec(clean)) !== null) {
    const start = jm.index;
    const after = clean.slice(start);
    const nextClause = after.search(
      /\b(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+)?JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|\bQUALIFY\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|;/i,
    );
    // Skip the JOIN keyword itself when finding the next clause — search after this match
    const rest = clean.slice(start + jm[0].length);
    const restNext = rest.search(
      /\b(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+)?JOIN\b|\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|\bQUALIFY\b|\bUNION\b|\bINTERSECT\b|\bEXCEPT\b|;/i,
    );
    const fragment = restNext < 0 ? rest : rest.slice(0, restNext);
    if (!/\bON\b/i.test(fragment) && !/\bUSING\s*\(/i.test(fragment)) {
      // CROSS JOIN already warned; skip NATURAL JOIN
      if (/^\s*CROSS\s+JOIN\b/i.test(jm[0]) || /\bNATURAL\b/i.test(jm[0])) {
        continue;
      }
      // FROM x JOIN y ON — if this matched CROSS somehow skip
      if (/cross/i.test(jm[0])) continue;
      const pos = positionAt(clean, start);
      findings.push({
        severity: "warn",
        rule: "join-missing-on",
        message:
          "JOIN without ON or USING. This often becomes an accidental cartesian product.",
        line: pos.line,
        column: pos.column,
      });
    }
    void nextClause;
  }

  const limitIdx = keywordIndex(clean, /\bLIMIT\b/gi);
  if (limitIdx >= 0) {
    const beforeLimit = clean.slice(0, limitIdx);
    if (!/\bORDER\s+BY\b/i.test(beforeLimit)) {
      const pos = positionAt(clean, limitIdx);
      findings.push({
        severity: "warn",
        rule: "limit-without-order",
        message:
          "LIMIT without ORDER BY is non-deterministic. Rows returned can change between runs.",
        line: pos.line,
        column: pos.column,
      });
    }
  }

  pushMatchFindings(
    findings,
    clean,
    /\bORDER\s+BY\s+(?:RANDOM\s*\(|RAND\s*\(|UUID_STRING\s*\()/gi,
    {
      severity: "warn",
      rule: "order-by-random",
      message:
        "ORDER BY RANDOM()/RAND() is expensive and non-repeatable. Prefer a keyed sample if you need a subset.",
    },
  );

  // Double-quoted identifiers (Snowflake case sensitivity)
  const dq = /"([^"]|"")+"/g;
  let dqm: RegExpExecArray | null;
  while ((dqm = dq.exec(sql)) !== null) {
    const pos = positionAt(sql, dqm.index);
    findings.push({
      severity: "info",
      rule: "quoted-identifier",
      message:
        "Double-quoted identifier. Snowflake will preserve case and every later query must quote it the same way. Prefer unquoted UPPER_SNAKE names.",
      line: pos.line,
      column: pos.column,
    });
  }

  const betweenRe = /\bBETWEEN\s+(-?\d+(?:\.\d+)?)\s+AND\s+(-?\d+(?:\.\d+)?)/gi;
  let bm: RegExpExecArray | null;
  while ((bm = betweenRe.exec(clean)) !== null) {
    const low = Number(bm[1]);
    const high = Number(bm[2]);
    if (Number.isFinite(low) && Number.isFinite(high) && low > high) {
      const pos = positionAt(clean, bm.index);
      findings.push({
        severity: "warn",
        rule: "between-bounds",
        message: `BETWEEN ${String(low)} AND ${String(high)} looks reversed. BETWEEN requires low AND high.`,
        line: pos.line,
        column: pos.column,
      });
    }
  }

  const severityRank: Record<LintSeverity, number> = {
    error: 0,
    warn: 1,
    info: 2,
  };
  findings.sort((a, b) => {
    const lineA = a.line ?? 0;
    const lineB = b.line ?? 0;
    if (lineA !== lineB) return lineA - lineB;
    return severityRank[a.severity] - severityRank[b.severity];
  });

  return findings;
}
