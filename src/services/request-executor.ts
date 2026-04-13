const DEFAULT_RETRYABLE_STATUS = [429, 500, 502, 503, 504] as const;

type ErrorCode = "AUTH_ERROR" | "RATE_LIMITED" | "NOT_FOUND" | "INVALID_INPUT" | "TRANSIENT_ERROR" | "UNKNOWN_ERROR";

interface RequestExecutionOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  operationName?: string;
  retryableStatusCodes?: readonly number[];
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

interface ErrorMetadata {
  status?: number;
  retryAfterSeconds?: number;
}

export class RequestExecutionError extends Error {
  readonly code: ErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly operationName?: string;
  readonly causeError: unknown;

  constructor(params: {
    code: ErrorCode;
    message: string;
    status?: number;
    retryable: boolean;
    operationName?: string;
    causeError: unknown;
  }) {
    super(params.message);
    this.name = "RequestExecutionError";
    this.code = params.code;
    this.status = params.status;
    this.retryable = params.retryable;
    this.operationName = params.operationName;
    this.causeError = params.causeError;
  }
}

const sleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

function normalizeErrorMetadata(error: unknown): ErrorMetadata {
  const maybeError = error as {
    code?: number;
    status?: number;
    response?: { status?: number; headers?: Record<string, string | string[] | undefined> };
  };

  const status = maybeError.status ?? maybeError.code ?? maybeError.response?.status;
  const headerValue = maybeError.response?.headers?.["retry-after"];
  const retryAfterHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "", 10);

  return {
    status: Number.isFinite(status) ? status : undefined,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  };
}

function mapErrorCode(status?: number): ErrorCode {
  if (status === 401 || status === 403) {
    return "AUTH_ERROR";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 400 || status === 422) {
    return "INVALID_INPUT";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (DEFAULT_RETRYABLE_STATUS.includes((status ?? -1) as (typeof DEFAULT_RETRYABLE_STATUS)[number])) {
    return "TRANSIENT_ERROR";
  }
  return "UNKNOWN_ERROR";
}

function isRetryableStatus(status: number | undefined, retryableStatusCodes: readonly number[]): boolean {
  if (status === undefined) {
    return false;
  }

  return retryableStatusCodes.includes(status);
}

function getExponentialBackoffMs(
  attempt: number,
  options: Required<Pick<RequestExecutionOptions, "baseDelayMs" | "maxDelayMs" | "jitterRatio" | "random">>,
) {
  const expDelay = Math.min(options.baseDelayMs * 2 ** (attempt - 1), options.maxDelayMs);
  const jitterWindow = expDelay * options.jitterRatio;
  const jitter = (options.random() * 2 - 1) * jitterWindow;

  return Math.max(0, Math.round(expDelay + jitter));
}

function buildErrorMessage(params: { operationName?: string; status?: number; sourceMessage?: string }): string {
  const operationPrefix = params.operationName ? `${params.operationName}: ` : "";
  const statusSuffix = params.status ? ` (status ${params.status})` : "";
  const message =
    params.sourceMessage && params.sourceMessage.trim().length > 0 ? params.sourceMessage : "Request failed";

  return `${operationPrefix}${message}${statusSuffix}`;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RequestExecutionOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS;
  const operationSleep = options.sleep ?? sleep;
  const random = options.random ?? Math.random;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const jitterRatio = options.jitterRatio ?? 0.2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const metadata = normalizeErrorMetadata(error);
      const retryable = isRetryableStatus(metadata.status, retryableStatusCodes);
      const isLastAttempt = attempt >= maxAttempts;

      if (!retryable || isLastAttempt) {
        const sourceMessage = error instanceof Error ? error.message : undefined;

        throw new RequestExecutionError({
          code: mapErrorCode(metadata.status),
          message: buildErrorMessage({
            operationName: options.operationName,
            status: metadata.status,
            sourceMessage,
          }),
          status: metadata.status,
          retryable,
          operationName: options.operationName,
          causeError: error,
        });
      }

      // Retry-After is expressed in seconds by the API.
      const retryAfterMs = metadata.retryAfterSeconds ? metadata.retryAfterSeconds * 1_000 : undefined;
      const delayMs =
        retryAfterMs ??
        getExponentialBackoffMs(attempt, {
          baseDelayMs,
          maxDelayMs,
          jitterRatio,
          random,
        });

      await operationSleep(delayMs);
    }
  }

  throw new RequestExecutionError({
    code: "UNKNOWN_ERROR",
    message: "Request failed after retry loop exhaustion",
    retryable: false,
    operationName: options.operationName,
    causeError: new Error("Retry loop exhaustion"),
  });
}
