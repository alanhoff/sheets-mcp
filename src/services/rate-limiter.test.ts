import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSheetsRateLimiter } from "#services/rate-limiter.ts";

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

describe("rate limiter", () => {
  it("enforces max concurrency per lane", async () => {
    const limiter = createSheetsRateLimiter({
      read: {
        maxConcurrent: 2,
        tokensPerInterval: 100,
        intervalMs: 1_000,
        burst: 100,
      },
      write: {
        maxConcurrent: 1,
        tokensPerInterval: 100,
        intervalMs: 1_000,
        burst: 100,
      },
    });

    let inflight = 0;
    let maxInflight = 0;

    const tasks = Array.from({ length: 5 }, async (_, index) =>
      limiter.schedule("read", async () => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        await sleep(25);
        inflight -= 1;
        return index;
      }),
    );

    const results = await Promise.all(tasks);
    assert.deepEqual(results, [0, 1, 2, 3, 4]);
    assert.equal(maxInflight, 2);
  });

  it("throttles when token budget is depleted", async () => {
    const limiter = createSheetsRateLimiter({
      read: {
        maxConcurrent: 1,
        tokensPerInterval: 1,
        intervalMs: 70,
        burst: 1,
      },
    });

    const startTimes: number[] = [];

    await Promise.all([
      limiter.schedule("read", async () => {
        startTimes.push(Date.now());
      }),
      limiter.schedule("read", async () => {
        startTimes.push(Date.now());
      }),
    ]);

    assert.equal(startTimes.length, 2);
    assert.ok(startTimes[1] - startTimes[0] >= 50);
  });

  it("runs read and write lanes independently", async () => {
    const limiter = createSheetsRateLimiter({
      read: {
        maxConcurrent: 1,
        tokensPerInterval: 1,
        intervalMs: 500,
        burst: 1,
      },
      write: {
        maxConcurrent: 1,
        tokensPerInterval: 1,
        intervalMs: 500,
        burst: 1,
      },
    });

    let releaseBarrier: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    let readStarted = false;
    let writeStarted = false;

    const readPromise = limiter.schedule("read", async () => {
      readStarted = true;
      await barrier;
      return "read";
    });

    const writePromise = limiter.schedule("write", async () => {
      writeStarted = true;
      await barrier;
      return "write";
    });

    await sleep(10);
    assert.equal(readStarted, true);
    assert.equal(writeStarted, true);

    releaseBarrier();

    const [readResult, writeResult] = await Promise.all([readPromise, writePromise]);
    assert.equal(readResult, "read");
    assert.equal(writeResult, "write");
  });
});
