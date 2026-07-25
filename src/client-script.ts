/** Inline browser script — sample never leaves the page. Mirrors src/engine.ts. */
export const CLIENT_SCRIPT = `
(function () {
  var RESERVED = {
    SELECT:1, FROM:1, WHERE:1, TABLE:1, ORDER:1, GROUP:1, BY:1, JOIN:1, LEFT:1,
    RIGHT:1, INNER:1, OUTER:1, ON:1, AS:1, AND:1, OR:1, NOT:1, NULL:1, TRUE:1,
    FALSE:1, CASE:1, WHEN:1, THEN:1, ELSE:1, END:1, CREATE:1, DROP:1, ALTER:1,
    INSERT:1, UPDATE:1, DELETE:1, MERGE:1, VALUES:1, INTO:1, WITH:1, UNION:1,
    ALL:1, DISTINCT:1, LIMIT:1
  };
  var MISSING = { "":1, "NULL":1, "null":1, "\\\\N":1 };
  var BASE_TYPES = [
    "NUMBER(38,0)","NUMBER(18,2)","NUMBER(12,2)","FLOAT","BOOLEAN","DATE","TIME",
    "TIMESTAMP_NTZ","TIMESTAMP_TZ","VARIANT","VARCHAR"
  ];

  function detectFormat(input) {
    var trimmed = input.trim();
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") return "json";
    return "csv";
  }

  function isMissing(value) { return Object.prototype.hasOwnProperty.call(MISSING, value); }

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
    return {
      names: names,
      renamed: headers.map(function (header, index) { return names[index] !== header; })
    };
  }

  function parseCsvLine(line) {
    var fields = [];
    var current = "";
    var inQuotes = false;
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

  function classify(value) {
    if (value === "Infinity" || value === "-Infinity" || value === "NaN") return "float";
    if (/^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)[eE][+-]?\\d+$/.test(value)) return "float";
    if (/^[+-]?\\d{1,38}$/.test(value)) return "int";
    if (/^[+-]?\\d+\\.\\d+$/.test(value)) return "dec";
    if (/^(true|false|t|f|yes|no)$/i.test(value)) return "bool";
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return "date";
    if (/^\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?$/.test(value)) return "time";
    if (/^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/.test(value)) return "ts_tz";
    if (/^\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?$/.test(value)) return "ts_ntz";
    return "varchar";
  }

  function decimalParts(value) {
    var raw = value.replace(/^[+-]/, "");
    var parts = raw.split(".");
    return { intDigits: parts[0].length, scale: (parts[1] || "").length };
  }

  function inferColumnType(values) {
    var present = values.filter(function (value) { return !isMissing(value); });
    if (!present.length) return "VARCHAR";
    var kinds = present.map(classify);
    function every(kind) { return kinds.every(function (k) { return k === kind; }); }
    if (every("bool")) return "BOOLEAN";
    if (every("date")) return "DATE";
    if (every("time")) return "TIME";
    if (every("ts_tz")) return "TIMESTAMP_TZ";
    if (every("ts_ntz")) return "TIMESTAMP_NTZ";
    if (kinds.every(function (k) { return k === "ts_ntz" || k === "ts_tz"; })) return "TIMESTAMP_TZ";
    if (kinds.every(function (k) { return k === "float" || k === "int" || k === "dec"; })) {
      if (kinds.some(function (k) { return k === "float"; })) return "FLOAT";
      if (kinds.every(function (k) { return k === "int"; })) return "NUMBER(38,0)";
      var maxInt = 0, maxScale = 0;
      present.forEach(function (value) {
        if (classify(value) === "int") {
          maxInt = Math.max(maxInt, value.replace(/^[+-]/, "").length);
        } else {
          var parts = decimalParts(value);
          maxInt = Math.max(maxInt, parts.intDigits);
          maxScale = Math.max(maxScale, parts.scale);
        }
      });
      return "NUMBER(" + Math.min(38, maxInt + maxScale) + "," + maxScale + ")";
    }
    return "VARCHAR";
  }

  function parseCsv(input) {
    var lines = input.replace(/^\\uFEFF/, "").split(/\\r\\n|\\n|\\r/).filter(function (line) { return line.length > 0; });
    if (!lines.length) return { columns: [], rows: [], error: null };
    var headerFields = parseCsvLine(lines[0]);
    if (!headerFields.length || headerFields.every(function (h) { return h === ""; })) {
      return { columns: [], rows: [], error: "Header row is empty." };
    }
    var normalised = normalizeHeaderNames(headerFields);
    var rows = [];
    for (var r = 1; r < lines.length; r++) {
      var fields = parseCsvLine(lines[r]);
      if (fields.length !== headerFields.length) {
        return {
          columns: [], rows: [],
          error: "Row " + (r + 1) + " has " + fields.length + " fields but the header has " + headerFields.length + "."
        };
      }
      rows.push(fields);
    }
    var columns = normalised.names.map(function (name, index) {
      var values = rows.map(function (row) { return row[index]; });
      var inferredType = inferColumnType(values);
      return {
        originalName: headerFields[index],
        name: name,
        inferredType: inferredType,
        type: inferredType,
        renamed: normalised.renamed[index]
      };
    });
    return { columns: columns, rows: rows, error: null };
  }

  function generateCreateTableSql(tableNameRaw, columns) {
    var tableName = normalizeHeaderNames([tableNameRaw || "MY_TABLE"]).names[0];
    var nameWidth = 1;
    columns.forEach(function (column) { nameWidth = Math.max(nameWidth, column.name.length); });
    var lines = columns.map(function (column) {
      return "  " + column.name + " ".repeat(nameWidth - column.name.length) + " " + column.type;
    });
    return "CREATE OR REPLACE TABLE " + tableName + " (\\n" + lines.join(",\\n") + "\\n);";
  }

  function generateCsvLoadSql(tableNameRaw) {
    var tableName = normalizeHeaderNames([tableNameRaw || "MY_TABLE"]).names[0];
    var formatName = tableName + "_CSV_FORMAT";
    var q = String.fromCharCode(34);
    var nullToken = "'" + "\\\\\\\\" + "N'";
    return [
      "CREATE OR REPLACE FILE FORMAT " + formatName,
      "  TYPE = CSV",
      "  FIELD_DELIMITER = ','",
      "  SKIP_HEADER = 1",
      "  FIELD_OPTIONALLY_ENCLOSED_BY = '" + q + "'",
      "  TRIM_SPACE = TRUE",
      "  NULL_IF = ('', 'NULL', 'null', " + nullToken + ")",
      "  EMPTY_FIELD_AS_NULL = TRUE;",
      "",
      "COPY INTO " + tableName,
      "FROM @MY_STAGE/path/",
      "FILE_FORMAT = (FORMAT_NAME = " + formatName + ")",
      "ON_ERROR = ABORT_STATEMENT;"
    ].join("\\n");
  }

  function defaultKeyColumnNames(columns) {
    for (var i = 0; i < columns.length; i++) {
      if (columns[i].name.slice(-3) === "_ID") return [columns[i].name];
    }
    return columns[0] ? [columns[0].name] : [];
  }

  function generateMergeSql(tableNameRaw, columns, keyNames) {
    var tableName = normalizeHeaderNames([tableNameRaw || "MY_TABLE"]).names[0];
    var staging = tableName + "_STAGING";
    var keys = columns.filter(function (column) { return keyNames.indexOf(column.name) !== -1; });
    var nonKeys = columns.filter(function (column) { return keyNames.indexOf(column.name) === -1; });
    if (!columns.length || !keys.length) return "";
    var onClause = keys.map(function (column) {
      return "t." + column.name + " = s." + column.name;
    }).join(" AND ");
    var lines = [
      "MERGE INTO " + tableName + " AS t",
      "USING " + staging + " AS s",
      "  ON " + onClause
    ];
    if (nonKeys.length) {
      var nameWidth = 0;
      nonKeys.forEach(function (column) { nameWidth = Math.max(nameWidth, column.name.length); });
      var updates = nonKeys.map(function (column) {
        return "  t." + column.name + " ".repeat(nameWidth - column.name.length) + " = s." + column.name;
      });
      lines.push("WHEN MATCHED THEN UPDATE SET");
      lines.push(updates.join(",\\n"));
    }
    lines.push("WHEN NOT MATCHED THEN INSERT (");
    lines.push("  " + columns.map(function (c) { return c.name; }).join(", "));
    lines.push(") VALUES (");
    lines.push("  " + columns.map(function (c) { return "s." + c.name; }).join(", "));
    lines.push(");");
    return lines.join("\\n");
  }

  var sample = document.getElementById("sample");
  var tableNameInput = document.getElementById("table-name");
  var formatInputs = document.querySelectorAll('input[name="format"]');
  var formatHint = document.getElementById("format-hint");
  var errorEl = document.getElementById("parse-error");
  var mappingEl = document.getElementById("column-mapping");
  var keysEl = document.getElementById("key-columns");
  var createSqlEl = document.getElementById("create-sql");
  var loadSqlEl = document.getElementById("load-sql");
  var mergeSqlEl = document.getElementById("merge-sql");
  var userPickedFormat = false;
  var columnState = [];
  var keyNames = [];
  var debounceTimer = null;

  function selectedFormat() {
    for (var i = 0; i < formatInputs.length; i++) {
      if (formatInputs[i].checked) return formatInputs[i].value;
    }
    return "csv";
  }

  function setFormat(format, fromAuto) {
    for (var i = 0; i < formatInputs.length; i++) {
      formatInputs[i].checked = formatInputs[i].value === format;
    }
    if (formatHint) {
      formatHint.textContent = fromAuto
        ? "Detected as " + format.toUpperCase() + "."
        : "Format set to " + format.toUpperCase() + ".";
    }
  }

  function typeOptions(inferred) {
    var seen = {};
    var options = [];
    [inferred].concat(BASE_TYPES).forEach(function (type) {
      if (!seen[type]) { seen[type] = 1; options.push(type); }
    });
    return options;
  }

  function renderMapping(columns) {
    if (!columns.length) {
      mappingEl.innerHTML = "";
      mappingEl.hidden = true;
      keysEl.innerHTML = "";
      keysEl.hidden = true;
      return;
    }
    mappingEl.hidden = false;
    var renamed = columns.filter(function (c) { return c.renamed; });
    var html = '<h2>Columns</h2>';
    if (renamed.length) {
      html += '<p class="mapping-note">Renamed for Snowflake identifiers: ' +
        renamed.map(function (c) {
          return '<span class="mono">' + escapeHtml(c.originalName) + '</span> → <span class="mono">' + escapeHtml(c.name) + '</span>';
        }).join("; ") + '.</p>';
    }
    html += '<div class="column-list">';
    columns.forEach(function (column, index) {
      html += '<div class="column-row">' +
        '<span class="mono col-name">' + escapeHtml(column.name) + '</span>' +
        '<label class="sr-only" for="type-' + index + '">Type for ' + escapeHtml(column.name) + '</label>' +
        '<select id="type-' + index + '" data-index="' + index + '">' +
        typeOptions(column.inferredType).map(function (type) {
          return '<option value="' + escapeHtml(type) + '"' + (type === column.type ? ' selected' : '') + '>' + escapeHtml(type) + '</option>';
        }).join("") +
        '</select></div>';
    });
    html += '</div>';
    mappingEl.innerHTML = html;
    mappingEl.querySelectorAll("select").forEach(function (select) {
      select.addEventListener("change", function () {
        var idx = Number(select.getAttribute("data-index"));
        columnState[idx].type = select.value;
        renderOutputs();
      });
    });

    keysEl.hidden = false;
    var keyHtml = '<h2>MERGE keys</h2><div class="key-list">';
    columns.forEach(function (column) {
      var checked = keyNames.indexOf(column.name) !== -1 ? " checked" : "";
      keyHtml += '<label class="key-option"><input type="checkbox" data-key="' +
        escapeHtml(column.name) + '"' + checked + ' /> <span class="mono">' +
        escapeHtml(column.name) + '</span></label>';
    });
    keyHtml += '</div>';
    keysEl.innerHTML = keyHtml;
    keysEl.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
      box.addEventListener("change", function () {
        keyNames = [];
        keysEl.querySelectorAll('input[type="checkbox"]').forEach(function (item) {
          if (item.checked) keyNames.push(item.getAttribute("data-key"));
        });
        if (!keyNames.length && columnState[0]) {
          keyNames = [columnState[0].name];
          renderMapping(columnState);
          return;
        }
        renderOutputs();
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[ch];
    });
  }

  function renderOutputs() {
    if (!columnState.length) {
      createSqlEl.textContent = "";
      loadSqlEl.textContent = "";
      mergeSqlEl.textContent = "";
      return;
    }
    createSqlEl.textContent = generateCreateTableSql(tableNameInput.value, columnState);
    loadSqlEl.textContent = generateCsvLoadSql(tableNameInput.value);
    mergeSqlEl.textContent = generateMergeSql(tableNameInput.value, columnState, keyNames);
  }

  function regenerate() {
    var format = selectedFormat();
    errorEl.hidden = true;
    errorEl.textContent = "";
    if (!sample.value.trim()) {
      columnState = [];
      keyNames = [];
      renderMapping([]);
      renderOutputs();
      return;
    }
    if (format !== "csv") {
      columnState = [];
      keyNames = [];
      renderMapping([]);
      createSqlEl.textContent = "";
      loadSqlEl.textContent = "";
      mergeSqlEl.textContent = "";
      errorEl.hidden = false;
      errorEl.textContent = "JSON support lands in a later commit. Switch to CSV for now.";
      return;
    }
    var parsed = parseCsv(sample.value);
    if (parsed.error) {
      columnState = [];
      keyNames = [];
      renderMapping([]);
      createSqlEl.textContent = "";
      loadSqlEl.textContent = "";
      mergeSqlEl.textContent = "";
      errorEl.hidden = false;
      errorEl.textContent = parsed.error;
      return;
    }
    var previousTypes = {};
    columnState.forEach(function (column) { previousTypes[column.name] = column.type; });
    var previousKeys = keyNames.slice();
    columnState = parsed.columns.map(function (column) {
      if (previousTypes[column.name] && previousTypes[column.name] !== column.inferredType) {
        column.type = previousTypes[column.name];
      }
      return column;
    });
    var available = {};
    columnState.forEach(function (column) { available[column.name] = 1; });
    keyNames = previousKeys.filter(function (name) { return available[name]; });
    if (!keyNames.length) keyNames = defaultKeyColumnNames(columnState);
    renderMapping(columnState);
    renderOutputs();
  }

  function scheduleRegenerate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(regenerate, 180);
  }

  function onSampleInput() {
    if (!userPickedFormat) setFormat(detectFormat(sample.value), true);
    scheduleRegenerate();
  }

  for (var i = 0; i < formatInputs.length; i++) {
    formatInputs[i].addEventListener("change", function () {
      userPickedFormat = true;
      setFormat(selectedFormat(), false);
      scheduleRegenerate();
    });
  }

  sample.addEventListener("input", onSampleInput);
  tableNameInput.addEventListener("input", scheduleRegenerate);
  setFormat(detectFormat(sample.value), true);
  regenerate();
})();
`;
