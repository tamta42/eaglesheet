export type SampleFormat = "csv" | "json";

/** Auto-detect: trimmed input starting with `{` or `[` is JSON, else CSV. */
export function detectFormat(input: string): SampleFormat {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "csv";
}
