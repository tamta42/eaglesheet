/** Inline browser script — sample never leaves the page. */
export const CLIENT_SCRIPT = `
(function () {
  function detectFormat(input) {
    var trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    return "csv";
  }

  var sample = document.getElementById("sample");
  var formatInputs = document.querySelectorAll('input[name="format"]');
  var formatHint = document.getElementById("format-hint");
  var userPickedFormat = false;

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

  function onSampleInput() {
    if (!userPickedFormat) {
      setFormat(detectFormat(sample.value), true);
    }
  }

  for (var i = 0; i < formatInputs.length; i++) {
    formatInputs[i].addEventListener("change", function () {
      userPickedFormat = true;
      setFormat(selectedFormat(), false);
    });
  }

  sample.addEventListener("input", onSampleInput);
  setFormat(detectFormat(sample.value), true);
})();
`;
