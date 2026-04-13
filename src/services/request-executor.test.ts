import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeWithRetry, RequestExecutionError } from "#services/request-executor.ts";

function createStatusError(status: number, message: string) {
  const error = new Error(message) as Error & {
    status: number;
    response?: { headers?: Record<string, string> };
  };

  error.status = status;
  return error;
}

describe("request executor", () => {
  it("retries retryable statuses and eventually succeeds", async () => {
    let attempt = 0;
    const delays: number[] = [];

    const result = await executeWithRetry(
      async () => {
        attempt++;
        if (attempt < 3) {
          throw createStatusError(503, "temporary failure");
        }
        return "ok";
      },
      {
        maxAttempts: 4,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterRatio: 0,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    );

    assert.equal(result, "ok");
    assert.equal(attempt, 3);
    assert.deepEqual(delays, [10, 20]);
  });

  it("uses Retry-After when provided", async () => {
    let attempt = 0;
    const delays: number[] = [];

    const result = await executeWithRetry(
      async () => {
        attempt++;
        if (attempt === 1) {
          const error = createStatusError(429, "rate limited");
          error.response = { headers: { "retry-after": "2" } };
          throw error;
        }
        return "ok";
      },
      {
        maxAttempts: 3,
        baseDelayMs: 10,
        jitterRatio: 0,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    );

    assert.equal(result, "ok");
    assert.deepEqual(delays, [2_000]);
  });

  it("maps non-retryable errors without retrying", async () => {
    let attempt = 0;

    await assert.rejects(
      () =>
        executeWithRetry(
          async () => {
            attempt++;
            throw createStatusError(404, "not found");
          },
          {
            operationName: "spreadsheets.get",
            maxAttempts: 4,
            sleep: async () => {},
          },
        ),
      (error: unknown) => {
        assert.equal(attempt, 1);
        assert.ok(error instanceof RequestExecutionError);
        assert.equal(error.code, "NOT_FOUND");
        assert.equal(error.status, 404);
        assert.equal(error.retryable, false);
        assert.match(error.message, /spreadsheets\.get/);
        return true;
      },
    );
  });

  it("throws mapped error after exhausting retry attempts", async () => {
    let attempt = 0;

    await assert.rejects(
      () =>
        executeWithRetry(
          async () => {
            attempt++;
            throw createStatusError(503, "temporary failure");
          },
          {
            maxAttempts: 2,
            baseDelayMs: 10,
            jitterRatio: 0,
            sleep: async () => {},
          },
        ),
      (error: unknown) => {
        assert.equal(attempt, 2);
        assert.ok(error instanceof RequestExecutionError);
        assert.equal(error.code, "TRANSIENT_ERROR");
        assert.equal(error.status, 503);
        assert.equal(error.retryable, true);
        return true;
      },
    );
  });
});
