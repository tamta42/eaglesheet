import { HttpError } from "./http";

export interface Session {
  userId: string;
}

export interface AppContext {
  requestId: string;
  session: Session | null;
}

export function requestId(request: Request): string {
  return request.headers.get("cf-ray")?.split("-")[0] ?? crypto.randomUUID();
}

export async function stableHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function anonymousActor(request: Request): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  return `anonymous:${await stableHash(address)}`;
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, boolean | number | string | null>,
): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const output = JSON.stringify(record);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

/** Traffic datapoint only — never log pasted sample content. */
export function logTraffic(env: Env, request: Request, status: number): void {
  // Analytics Engine is not bound in the vitest workers pool.
  const traffic = (env as Partial<Env>).TRAFFIC;
  if (!traffic) return;
  const country =
    typeof request.cf?.country === "string" && request.cf.country
      ? request.cf.country
      : "XX";
  const pathname = new URL(request.url).pathname;
  traffic.writeDataPoint({
    blobs: [pathname, country, request.method],
    doubles: [status],
    indexes: ["eaglesheet"],
  });
}

export async function enforceLimit(
  binding: RateLimit,
  key: string,
): Promise<void> {
  const outcome = await binding.limit({ key });
  if (!outcome.success) {
    throw new HttpError(
      429,
      "Too many requests. Try again later.",
      "rate_limited",
    );
  }
}

export async function getSecret(binding: SecretsStoreSecret): Promise<string> {
  const value = await binding.get();
  if (!value) throw new Error("Required Secrets Store binding is empty.");
  return value;
}

export function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}
