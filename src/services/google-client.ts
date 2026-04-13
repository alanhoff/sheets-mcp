import { getSheets } from "#google.ts";
import { type RateLimiterLane, sheetsRateLimiter } from "#services/rate-limiter.ts";
import { executeWithRetry, type RequestExecutionError } from "#services/request-executor.ts";

interface ExecuteSheetsRequestOptions {
  operationName: string;
  lane?: RateLimiterLane;
}

export async function getSheetsClient() {
  return getSheets();
}

export async function executeSheetsRequest<T>(
  operation: () => Promise<T>,
  options: ExecuteSheetsRequestOptions,
): Promise<T> {
  return sheetsRateLimiter.schedule(options.lane ?? "read", async () =>
    executeWithRetry(operation, {
      operationName: options.operationName,
    }),
  );
}

export type { RequestExecutionError };
