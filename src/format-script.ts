/** Inline browser script for /format — SQL never leaves the page. Mirrors src/format.ts. */
export const FORMAT_SCRIPT = `
(function () {
  var KEYWORDS = {
    SELECT:1, FROM:1, WHERE:1, AND:1, OR:1, NOT:1, IN:1, IS:1, NULL:1, AS:1, ON:1,
    JOIN:1, LEFT:1, RIGHT:1, INNER:1, OUTER:1, FULL:1, CROSS:1, NATURAL:1, USING:1,
    GROUP:1, BY:1, ORDER:1, HAVING:1, LIMIT:1, OFFSET:1, QUALIFY:1, UNION:1, ALL:1,
    INTERSECT:1, EXCEPT:1, WITH:1, INSERT:1, INTO:1, VALUES:1, UPDATE:1, SET:1,
    DELETE:1, MERGE:1, WHEN:1, MATCHED:1, THEN:1, ELSE:1, END:1, CASE:1, CREATE:1,
    REPLACE:1, TABLE:1, VIEW:1, FILE:1, FORMAT:1, COPY:1, TYPE:1, TRUE:1, FALSE:1,
    DISTINCT:1, BETWEEN:1, LIKE:1, ILIKE:1, EXISTS:1, OVER:1, PARTITION:1, ROWS:1,
    RANGE:1, UNBOUNDED:1, PRECEDING:1, FOLLOWING:1, CURRENT:1, ROW:1, ASC:1, DESC:1,
    NULLS:1, FIRST:1, LAST:1
  };
  var CLAUSE_START = {
    SELECT:1, FROM:1, WHERE:1, GROUP:1, ORDER:1, HAVING:1, LIMIT:1, OFFSET:1,
    QUALIFY:1, UNION:1, INTERSECT:1, EXCEPT:1, WITH:1, INSERT:1, UPDATE:1, DELETE:1,
    MERGE:1, SET:1, VALUES:1, CREATE:1, COPY:1, WHEN:1
  };

  function tokenize(sql) {
    var tokens = [], i = 0;
    while (i < sql.length) {
      var ch = sql.charAt(i), next = sql.charAt(i + 1);
      if (ch === "-" && next === "-") {
        var cmt = "--"; i += 2;
        while (i < sql.length && sql.charAt(i) !== "\\n") { cmt += sql.charAt(i); i += 1; }
        tokens.push({ kind: "comment", value: cmt }); continue;
      }
      if (ch === "/" && next === "*") {
        var blk = "/*"; i += 2;
        while (i < sql.length) {
          blk += sql.charAt(i);
          if (sql.charAt(i) === "*" && sql.charAt(i + 1) === "/") { blk += "/"; i += 2; break; }
          i += 1;
        }
        tokens.push({ kind: "comment", value: blk }); continue;
      }
      if (ch === "'" || ch === '"') {
        var q = ch, str = q; i += 1;
        while (i < sql.length) {
          str += sql.charAt(i);
          if (sql.charAt(i) === q && sql.charAt(i + 1) === q) { str += q; i += 2; continue; }
          if (sql.charAt(i) === q) { i += 1; break; }
          i += 1;
        }
        tokens.push({ kind: "string", value: str }); continue;
      }
      if (/\\s/.test(ch)) {
        while (i < sql.length && /\\s/.test(sql.charAt(i))) i += 1;
        tokens.push({ kind: "space", value: " " }); continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var w = "";
        while (i < sql.length && /[A-Za-z0-9_$]/.test(sql.charAt(i))) { w += sql.charAt(i); i += 1; }
        tokens.push({ kind: "word", value: w }); continue;
      }
      if (/[0-9]/.test(ch)) {
        var n = "";
        while (i < sql.length && /[0-9.]/.test(sql.charAt(i))) { n += sql.charAt(i); i += 1; }
        tokens.push({ kind: "word", value: n }); continue;
      }
      tokens.push({ kind: "punct", value: ch }); i += 1;
    }
    return tokens;
  }

  function peekWord(tokens, from) {
    var j = from;
    while (j < tokens.length && tokens[j].kind === "space") j += 1;
    return tokens[j];
  }

  function formatSql(sql, uppercaseKeywords) {
    if (!sql.trim()) return "";
    var indentUnit = "  ";
    var tokens = tokenize(sql);
    var parts = [], depth = 0, line = "", prevWord = null, inListClause = false;

    function flush() {
      var trimmed = line.replace(/\\s+$/, "");
      if (trimmed.length) {
        var listPad = inListClause ? indentUnit : "";
        parts.push(indentUnit.repeat(Math.max(depth, 0)) + listPad + trimmed);
      }
      line = "";
    }
    function pushWord(text) {
      if (!line.length) line = text;
      else if (line.charAt(line.length - 1) === "." || line.charAt(line.length - 1) === "(") line += text;
      else line += " " + text;
    }

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token || token.kind === "space") continue;
      if (token.kind === "comment") {
        flush();
        parts.push(indentUnit.repeat(Math.max(depth, 0)) + token.value.replace(/\\s+$/, ""));
        prevWord = null; continue;
      }
      if (token.kind === "string") { pushWord(token.value); continue; }
      if (token.kind === "punct") {
        if (token.value === "(") { pushWord("("); flush(); depth += 1; continue; }
        if (token.value === ")") { flush(); depth = Math.max(depth - 1, 0); line = ")"; continue; }
        if (token.value === ",") { line += ","; flush(); continue; }
        if (token.value === ";") { line += ";"; flush(); prevWord = null; continue; }
        if (token.value === ".") { line += "."; continue; }
        pushWord(token.value); continue;
      }
      var raw = token.value, upper = raw.toUpperCase();
      var keyword = !!KEYWORDS[upper];
      var display = keyword && uppercaseKeywords ? upper : raw;

      if (keyword && (upper === "GROUP" || upper === "ORDER" || upper === "PARTITION")) {
        var nextBy = peekWord(tokens, i + 1);
        if (nextBy && nextBy.kind === "word" && nextBy.value.toUpperCase() === "BY") {
          flush(); line = display + " BY";
          var j = i + 1; while (j < tokens.length && tokens[j].kind === "space") j += 1;
          i = j; prevWord = "BY"; continue;
        }
      }

      if (keyword && /^(LEFT|RIGHT|INNER|FULL|CROSS|NATURAL)$/.test(upper)) {
        var joinParts = [display], jj = i + 1;
        while (jj < tokens.length) {
          var t = tokens[jj];
          if (!t || t.kind === "space") { jj += 1; continue; }
          if (t.kind === "word" && /^(OUTER|JOIN)$/i.test(t.value)) {
            joinParts.push(uppercaseKeywords ? t.value.toUpperCase() : t.value);
            jj += 1;
            if (t.value.toUpperCase() === "JOIN") break;
            continue;
          }
          break;
        }
        if (joinParts.some(function (p) { return p.toUpperCase() === "JOIN"; })) {
          flush(); line = joinParts.join(" "); i = jj - 1; prevWord = "JOIN"; continue;
        }
      }

      if (keyword && upper === "CREATE") {
        flush(); line = display;
        var nextOr = peekWord(tokens, i + 1);
        if (nextOr && nextOr.kind === "word" && nextOr.value.toUpperCase() === "OR") {
          var k = i + 1; while (k < tokens.length && tokens[k].kind === "space") k += 1;
          line += uppercaseKeywords ? " OR" : (" " + nextOr.value); k += 1;
          while (k < tokens.length && tokens[k].kind === "space") k += 1;
          var rep = tokens[k];
          if (rep && rep.kind === "word" && rep.value.toUpperCase() === "REPLACE") {
            line += uppercaseKeywords ? " REPLACE" : (" " + rep.value);
            i = k; prevWord = "REPLACE"; continue;
          }
        }
        prevWord = upper; continue;
      }

      if (keyword && CLAUSE_START[upper]) {
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
        flush(); line = indentUnit + display; prevWord = upper; continue;
      }
      if (keyword && upper === "ALL" && prevWord === "UNION") { pushWord(display); prevWord = upper; continue; }
      pushWord(display);
      prevWord = keyword ? upper : raw;
    }
    flush();
    return parts.join("\\n").replace(/\\n+$/, "") + "\\n";
  }

  var EXAMPLE = "select o.order_id, c.customer_name, o.total from orders o left join customers c on o.customer_id = c.customer_id where o.status = 'open' and o.total > 100 order by o.total desc limit 25";

  var input = document.getElementById("format-input");
  var output = document.getElementById("format-output");
  var emptyEl = document.getElementById("format-empty");
  var uppercaseToggle = document.getElementById("uppercase-keywords");
  var exampleBtn = document.getElementById("load-format-example");
  var copyBtn = document.querySelector('[data-copy="format-output"]');
  var timer = null;

  function render() {
    var formatted = formatSql(input.value, !uppercaseToggle || uppercaseToggle.checked);
    if (!input.value.trim()) {
      output.textContent = "";
      emptyEl.hidden = false;
      emptyEl.textContent = "Paste SQL above to format it.";
      return;
    }
    emptyEl.hidden = true;
    output.textContent = formatted;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 140);
  }

  input.addEventListener("input", schedule);
  if (uppercaseToggle) uppercaseToggle.addEventListener("change", render);
  if (exampleBtn) {
    exampleBtn.addEventListener("click", function () {
      input.value = EXAMPLE;
      render();
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = output.textContent || "";
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1200);
      });
    });
  }
  render();
})();
`;
