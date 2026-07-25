export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_error",
  ) {
    super(message);
  }
}

/** CSP for branded HTML pages that load tokens, fonts, and an inline client script. */
export const PAGE_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https://congtam.net",
  "object-src 'none'",
  "style-src 'self' 'unsafe-inline' https://congtam.net https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
].join("; ");

const BASE_CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "style-src 'self' 'unsafe-inline'",
].join("; ");

export function securityHeaders(
  requestId: string,
  csp = `${BASE_CSP}; script-src 'none'`,
): Headers {
  return new Headers({
    "Content-Security-Policy": csp,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
  });
}

export function json(
  value: unknown,
  requestId: string,
  init: ResponseInit = {},
): Response {
  const headers = securityHeaders(requestId);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  new Headers(init.headers).forEach((item, key) => {
    headers.set(key, item);
  });
  return Response.json(value, { ...init, headers });
}

export function html(
  body: string,
  requestId: string,
  options: { csp?: string; status?: number } = {},
): Response {
  const headers = securityHeaders(requestId, options.csp ?? PAGE_CSP);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { status: options.status ?? 200, headers });
}

export async function readJson<T>(
  request: Request,
  maximumBytes: number,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      415,
      "Expected application/json.",
      "unsupported_media_type",
    );
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new HttpError(413, "Request body is too large.", "payload_too_large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new HttpError(413, "Request body is too large.", "payload_too_large");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Malformed JSON.", "invalid_json");
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function methodNotAllowed(
  requestId: string,
  methods: string[],
): Response {
  return json(
    { error: { code: "method_not_allowed", message: "Method not allowed." } },
    requestId,
    { status: 405, headers: { Allow: methods.join(", ") } },
  );
}
