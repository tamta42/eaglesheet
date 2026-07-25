import { handleApp } from "./app";

import { HttpError, json } from "./http";
import { logEvent, logTraffic, requestId as makeRequestId } from "./platform";

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = makeRequestId(request);
    const startedAt = Date.now();
    let status = 500;
    try {
      const session = null;
      const response = await Promise.resolve(
        handleApp(request, env, { requestId, session }),
      );
      status = response.status;
      logTraffic(env, request, status);
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status;
        const response = json(
          { error: { code: error.code, message: error.message }, requestId },
          requestId,
          {
            status,
            headers: status === 429 ? { "Retry-After": "60" } : undefined,
          },
        );
        logTraffic(env, request, status);
        return response;
      }
      logEvent("error", "request_failed", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      const response = json(
        {
          error: { code: "internal_error", message: "Internal server error." },
          requestId,
        },
        requestId,
        { status },
      );
      logTraffic(env, request, status);
      return response;
    } finally {
      logEvent("info", "request_completed", {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        durationMs: Date.now() - startedAt,
      });
    }
  },
} satisfies ExportedHandler<Env>;
