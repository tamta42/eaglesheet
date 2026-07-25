/** Inline browser script for /names — headers never leave the page. Mirrors src/names.ts + engine normaliser. */
export const NAMES_SCRIPT = `
(function () {
  var RESERVED = {
    SELECT:1, FROM:1, WHERE:1, TABLE:1, ORDER:1, GROUP:1, BY:1, JOIN:1, LEFT:1,
    RIGHT:1, INNER:1, OUTER:1, ON:1, AS:1, AND:1, OR:1, NOT:1, NULL:1, TRUE:1,
    FALSE:1, CASE:1, WHEN:1, THEN:1, ELSE:1, END:1, CREATE:1, DROP:1, ALTER:1,
    INSERT:1, UPDATE:1, DELETE:1, MERGE:1, VALUES:1, INTO:1, WITH:1, UNION:1,
    ALL:1, DISTINCT:1, LIMIT:1
  };

  function normalizeIdentifier(raw, index) {
    var result = String(raw).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!result) result = "COL_" + index;
    if (/^[0-9]/.test(result)) result = "C_" + result;
    if (RESERVED[result]) result = result + "_COL";
    return result;
  }

  function dedupeNames(bases) {
    var used = {};
    return bases.map(function (base) {
      if (!used[base]) { used[base] = 1; return base; }
      var suffix = 2;
      while (used[base + "_" + suffix]) suffix += 1;
      var name = base + "_" + suffix;
      used[name] = 1;
      return name;
    });
  }

  function normalizeHeaderNames(headers) {
    var bases = headers.map(function (header, index) { return normalizeIdentifier(header, index); });
    var names = dedupeNames(bases);
    return { names: names };
  }

  function parseCsvLine(line) {
    var fields = [], current = "", inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (line.charAt(i + 1) === '"') { current += '"'; i += 1; }
          else inQuotes = false;
        } else current += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current); current = ""; }
      else current += ch;
    }
    fields.push(current);
    return fields;
  }

  function quoteSnowflakeIdent(raw) {
    return '"' + String(raw).replace(/"/g, '""') + '"';
  }

  function parseNameInput(input, mode) {
    var text = String(input).replace(/^\\uFEFF/, "").replace(/\\s+$/, "");
    if (!text.trim()) return [];
    var lines = text.split(/\\r\\n|\\n|\\r/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var resolved = mode;
    if (mode === "auto") {
      resolved = (lines.length === 1 && lines[0].indexOf(",") !== -1) ? "csv" : "lines";
    }
    if (resolved === "csv") {
      return parseCsvLine(lines[0]).map(function (field) { return field.trim(); });
    }
    return lines;
  }

  function mapNames(rawNames) {
    var names = normalizeHeaderNames(rawNames).names;
    return rawNames.map(function (original, index) {
      var name = names[index] || ("COL_" + index);
      return { original: original, name: name, changed: original !== name };
    });
  }

  function formatIdentifierList(mappings) {
    if (!mappings.length) return "";
    return mappings.map(function (row) { return row.name; }).join("\\n") + "\\n";
  }

  function formatRenameMap(mappings) {
    if (!mappings.length) return "";
    return mappings.map(function (row) { return row.original + " → " + row.name; }).join("\\n") + "\\n";
  }

  function formatSelectList(mappings) {
    if (!mappings.length) return "";
    return mappings.map(function (row, index) {
      var left = row.changed ? quoteSnowflakeIdent(row.original) : row.original;
      var comma = index < mappings.length - 1 ? "," : "";
      return "  " + left + " AS " + row.name + comma;
    }).join("\\n") + "\\n";
  }

  function normaliseNames(input, mode) {
    var raw = parseNameInput(input, mode);
    if (!raw.length) {
      return { mappings: [], identifiers: "", renameMap: "", selectList: "", error: null };
    }
    var mappings = mapNames(raw);
    return {
      mappings: mappings,
      identifiers: formatIdentifierList(mappings),
      renameMap: formatRenameMap(mappings),
      selectList: formatSelectList(mappings),
      error: null
    };
  }

  var EXAMPLE = "Order Id,Customer Name,Total $,order,2024 Sales,email address";

  var input = document.getElementById("names-input");
  var emptyEl = document.getElementById("names-empty");
  var outputs = document.getElementById("names-outputs");
  var idOut = document.getElementById("names-identifiers");
  var mapOut = document.getElementById("names-rename-map");
  var selectOut = document.getElementById("names-select-list");
  var summaryEl = document.getElementById("names-summary");
  var exampleBtn = document.getElementById("load-names-example");
  var timer = null;

  function selectedMode() {
    var checked = document.querySelector('input[name="names-mode"]:checked');
    return checked ? checked.value : "auto";
  }

  function render() {
    var result = normaliseNames(input.value, selectedMode());
    if (!input.value.trim()) {
      outputs.hidden = true;
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      idOut.textContent = "";
      mapOut.textContent = "";
      selectOut.textContent = "";
      return;
    }
    emptyEl.hidden = true;
    outputs.hidden = false;
    idOut.textContent = result.identifiers;
    mapOut.textContent = result.renameMap;
    selectOut.textContent = result.selectList;
    var changed = result.mappings.filter(function (row) { return row.changed; }).length;
    summaryEl.hidden = false;
    summaryEl.textContent = result.mappings.length + " name" + (result.mappings.length === 1 ? "" : "s")
      + " · " + changed + " renamed";
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 140);
  }

  input.addEventListener("input", schedule);
  document.querySelectorAll('input[name="names-mode"]').forEach(function (el) {
    el.addEventListener("change", render);
  });
  if (exampleBtn) {
    exampleBtn.addEventListener("click", function () {
      input.value = EXAMPLE;
      render();
    });
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-copy");
      var el = document.getElementById(id);
      var text = el ? (el.textContent || "") : "";
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1200);
      });
    });
  });
  render();
})();
`;
