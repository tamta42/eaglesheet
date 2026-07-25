/** Inline browser script for /lint — SQL never leaves the page. Mirrors src/lint.ts. */
export const LINT_SCRIPT = `
(function () {
  function positionAt(sql, index) {
    var line = 1, column = 1;
    var end = Math.min(Math.max(index, 0), sql.length);
    for (var i = 0; i < end; i++) {
      if (sql.charAt(i) === "\\n") { line += 1; column = 1; }
      else column += 1;
    }
    return { line: line, column: column };
  }

  function stripSqlNoise(sql) {
    var out = "";
    var i = 0;
    while (i < sql.length) {
      var ch = sql.charAt(i);
      var next = sql.charAt(i + 1);
      if (ch === "-" && next === "-") {
        out += "  "; i += 2;
        while (i < sql.length && sql.charAt(i) !== "\\n") { out += " "; i += 1; }
        continue;
      }
      if (ch === "/" && next === "*") {
        out += "  "; i += 2;
        while (i < sql.length) {
          if (sql.charAt(i) === "*" && sql.charAt(i + 1) === "/") { out += "  "; i += 2; break; }
          out += sql.charAt(i) === "\\n" ? "\\n" : " ";
          i += 1;
        }
        continue;
      }
      if (ch === "'") {
        out += " "; i += 1;
        while (i < sql.length) {
          if (sql.charAt(i) === "'" && sql.charAt(i + 1) === "'") { out += "  "; i += 2; continue; }
          if (sql.charAt(i) === "'") { out += " "; i += 1; break; }
          out += sql.charAt(i) === "\\n" ? "\\n" : " ";
          i += 1;
        }
        continue;
      }
      if (ch === '"') {
        out += " "; i += 1;
        while (i < sql.length) {
          if (sql.charAt(i) === '"' && sql.charAt(i + 1) === '"') { out += "  "; i += 2; continue; }
          if (sql.charAt(i) === '"') { out += " "; i += 1; break; }
          out += sql.charAt(i) === "\\n" ? "\\n" : " ";
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }

  function findUnbalancedQuotes(original, quote, rule, label) {
    var open = false, openIndex = -1, findings = [];
    for (var i = 0; i < original.length; i++) {
      if (original.charAt(i) !== quote) continue;
      if (original.charAt(i + 1) === quote) { i += 1; continue; }
      if (!open) { open = true; openIndex = i; }
      else { open = false; openIndex = -1; }
    }
    if (open && openIndex >= 0) {
      var pos = positionAt(original, openIndex);
      findings.push({
        severity: "error", rule: rule,
        message: "Unbalanced " + label + ": string or identifier never closed.",
        line: pos.line, column: pos.column
      });
    }
    return findings;
  }

  function findUnbalanced(sql, open, close, rule, label) {
    var findings = [], depth = 0, firstExtraClose = -1;
    for (var i = 0; i < sql.length; i++) {
      var ch = sql.charAt(i);
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth < 0 && firstExtraClose < 0) firstExtraClose = i;
      }
    }
    if (firstExtraClose >= 0) {
      var pos = positionAt(sql, firstExtraClose);
      findings.push({
        severity: "error", rule: rule,
        message: "Unbalanced " + label + ": extra closing " + close + ".",
        line: pos.line, column: pos.column
      });
    } else if (depth > 0) {
      findings.push({
        severity: "error", rule: rule,
        message: "Unbalanced " + label + ": missing " + depth + " closing " + close + "."
      });
    }
    return findings;
  }

  function pushMatches(findings, clean, pattern, finding) {
    pattern.lastIndex = 0;
    var match;
    while ((match = pattern.exec(clean)) !== null) {
      var pos = positionAt(clean, match.index);
      findings.push({
        severity: finding.severity,
        rule: finding.rule,
        message: finding.message,
        line: pos.line,
        column: pos.column
      });
      if (!pattern.global) break;
    }
  }

  function lintSql(sql) {
    if (!sql.trim()) return [];
    var findings = [];
    var clean = stripSqlNoise(sql);
    findings = findings.concat(findUnbalancedQuotes(sql, "'", "unbalanced-single-quote", "single quotes"));
    findings = findings.concat(findUnbalancedQuotes(sql, '"', "unbalanced-double-quote", "double quotes"));
    findings = findings.concat(findUnbalanced(clean, "(", ")", "unbalanced-parens", "parentheses"));

    pushMatches(findings, clean,
      /,\\s*(FROM|WHERE|GROUP\\s+BY|ORDER\\s+BY|HAVING|LIMIT|QUALIFY|JOIN|LEFT|RIGHT|INNER|FULL|OUTER|UNION|INTERSECT|EXCEPT|VALUES|SET|RETURNING)\\b/gi,
      { severity: "error", rule: "trailing-comma",
        message: "Trailing comma before a clause keyword. Remove the comma or add the missing column/expression." });

    pushMatches(findings, clean, /\\bSELECT\\s+\\*/gi, {
      severity: "warn", rule: "select-star",
      message: "SELECT * pulls every column. Prefer an explicit column list for stable contracts and cheaper scans."
    });

    var updateDelete = /\\b(UPDATE|DELETE)\\b([\\s\\S]*?)(?=\\b(?:UPDATE|DELETE|INSERT|MERGE|CREATE|WITH|SELECT)\\b|$)/gi;
    var ud;
    while ((ud = updateDelete.exec(clean)) !== null) {
      if (!/\\bWHERE\\b/i.test(ud[0])) {
        var udPos = positionAt(clean, ud.index);
        findings.push({
          severity: "error", rule: "missing-where",
          message: (ud[1] || "Statement").toUpperCase() + " without WHERE. This can rewrite or remove every row.",
          line: udPos.line, column: udPos.column
        });
      }
    }

    pushMatches(findings, clean, /\\bCROSS\\s+JOIN\\b/gi, {
      severity: "warn", rule: "cross-join",
      message: "CROSS JOIN produces a cartesian product. Confirm that is intentional and filtered later."
    });

    var joinRe = /\\b(?:INNER\\s+|LEFT\\s+(?:OUTER\\s+)?|RIGHT\\s+(?:OUTER\\s+)?|FULL\\s+(?:OUTER\\s+)?|LEFT\\s+|RIGHT\\s+|FULL\\s+)?JOIN\\b/gi;
    var jm;
    while ((jm = joinRe.exec(clean)) !== null) {
      if (/cross/i.test(jm[0])) continue;
      var rest = clean.slice(jm.index + jm[0].length);
      var restNext = rest.search(/\\b(?:INNER\\s+|LEFT\\s+|RIGHT\\s+|FULL\\s+|CROSS\\s+)?JOIN\\b|\\bWHERE\\b|\\bGROUP\\s+BY\\b|\\bORDER\\s+BY\\b|\\bHAVING\\b|\\bLIMIT\\b|\\bQUALIFY\\b|\\bUNION\\b|\\bINTERSECT\\b|\\bEXCEPT\\b|;/i);
      var fragment = restNext < 0 ? rest : rest.slice(0, restNext);
      if (!/\\bON\\b/i.test(fragment) && !/\\bUSING\\s*\\(/i.test(fragment)) {
        var jPos = positionAt(clean, jm.index);
        findings.push({
          severity: "warn", rule: "join-missing-on",
          message: "JOIN without ON or USING. This often becomes an accidental cartesian product.",
          line: jPos.line, column: jPos.column
        });
      }
    }

    var limitMatch = /\\bLIMIT\\b/gi.exec(clean);
    if (limitMatch) {
      var beforeLimit = clean.slice(0, limitMatch.index);
      if (!/\\bORDER\\s+BY\\b/i.test(beforeLimit)) {
        var lPos = positionAt(clean, limitMatch.index);
        findings.push({
          severity: "warn", rule: "limit-without-order",
          message: "LIMIT without ORDER BY is non-deterministic. Rows returned can change between runs.",
          line: lPos.line, column: lPos.column
        });
      }
    }

    pushMatches(findings, clean, /\\bORDER\\s+BY\\s+(?:RANDOM\\s*\\(|RAND\\s*\\(|UUID_STRING\\s*\\()/gi, {
      severity: "warn", rule: "order-by-random",
      message: "ORDER BY RANDOM()/RAND() is expensive and non-repeatable. Prefer a keyed sample if you need a subset."
    });

    var dq = /"([^"]|"")+"/g;
    var dqm;
    while ((dqm = dq.exec(sql)) !== null) {
      var dPos = positionAt(sql, dqm.index);
      findings.push({
        severity: "info", rule: "quoted-identifier",
        message: "Double-quoted identifier. Snowflake will preserve case and every later query must quote it the same way. Prefer unquoted UPPER_SNAKE names.",
        line: dPos.line, column: dPos.column
      });
    }

    var betweenRe = /\\bBETWEEN\\s+(-?\\d+(?:\\.\\d+)?)\\s+AND\\s+(-?\\d+(?:\\.\\d+)?)/gi;
    var bm;
    while ((bm = betweenRe.exec(clean)) !== null) {
      var low = Number(bm[1]), high = Number(bm[2]);
      if (isFinite(low) && isFinite(high) && low > high) {
        var bPos = positionAt(clean, bm.index);
        findings.push({
          severity: "warn", rule: "between-bounds",
          message: "BETWEEN " + low + " AND " + high + " looks reversed. BETWEEN requires low AND high.",
          line: bPos.line, column: bPos.column
        });
      }
    }

    var rank = { error: 0, warn: 1, info: 2 };
    findings.sort(function (a, b) {
      var la = a.line || 0, lb = b.line || 0;
      if (la !== lb) return la - lb;
      return rank[a.severity] - rank[b.severity];
    });
    return findings;
  }

  var EXAMPLE = [
    "SELECT *",
    "FROM orders o",
    "JOIN customers c",
    "WHERE o.status = 'open'",
    "LIMIT 50;",
    "",
    "UPDATE orders SET status = 'closed';",
    "",
    "SELECT id FROM events ORDER BY RANDOM();"
  ].join("\\n");

  var input = document.getElementById("sql-input");
  var findingsEl = document.getElementById("findings");
  var summaryEl = document.getElementById("lint-summary");
  var emptyEl = document.getElementById("lint-empty");
  var exampleBtn = document.getElementById("load-lint-example");
  var timer = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[ch];
    });
  }

  function render() {
    var findings = lintSql(input.value);
    if (!input.value.trim()) {
      findingsEl.innerHTML = "";
      summaryEl.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = "Paste SQL above to run checks.";
      return;
    }
    emptyEl.hidden = findings.length > 0;
    emptyEl.textContent = findings.length ? "" : "No issues found with the current rules.";
    var errors = findings.filter(function (f) { return f.severity === "error"; }).length;
    var warns = findings.filter(function (f) { return f.severity === "warn"; }).length;
    var infos = findings.filter(function (f) { return f.severity === "info"; }).length;
    summaryEl.hidden = false;
    summaryEl.textContent = findings.length
      ? (errors + " error" + (errors === 1 ? "" : "s") + ", " + warns + " warning" + (warns === 1 ? "" : "s") + ", " + infos + " info")
      : "Clean under current rules.";
    findingsEl.innerHTML = findings.map(function (f) {
      var loc = f.line ? (" · line " + f.line + (f.column ? ":" + f.column : "")) : "";
      return '<div class="finding ' + f.severity + '">' +
        '<p class="finding-meta">' + escapeHtml(f.severity) + " · " + escapeHtml(f.rule) + escapeHtml(loc) + "</p>" +
        '<p class="finding-msg">' + escapeHtml(f.message) + "</p></div>";
    }).join("");
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 160);
  }

  input.addEventListener("input", schedule);
  if (exampleBtn) {
    exampleBtn.addEventListener("click", function () {
      input.value = EXAMPLE;
      render();
    });
  }
  render();
})();
`;
