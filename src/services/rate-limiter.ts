export type RateLimiterLane = "read" | "write";

interface RateLimiterLaneConfig {
  maxConcurrent: number;
  tokensPerInterval: number;
  intervalMs: number;
  burst: number;
}

interface CreateSheetsRateLimiterOptions {
  read?: Partial<RateLimiterLaneConfig>;
  write?: Partial<RateLimiterLaneConfig>;
  env?: NodeJS.ProcessEnv;
}

interface SheetsRateLimiter {
  schedule<T>(lane: RateLimiterLane, task: () => Promise<T>): Promise<T>;
}

interface QueuedTask {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

const DEFAULT_READ_LANE_CONFIG: RateLimiterLaneConfig = {
  maxConcurrent: 4,
  tokensPerInterval: 20,
  intervalMs: 1_000,
  burst: 20,
};

const DEFAULT_WRITE_LANE_CONFIG: RateLimiterLaneConfig = {
  maxConcurrent: 2,
  tokensPerInterval: 10,
  intervalMs: 1_000,
  burst: 10,
};

function parsePositiveNumber(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function parsePositiveEnvNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return parsePositiveNumber(parsed);
}

function pickConfigValue(options: { override?: number; envValue?: string; fallback: number }): number {
  return parsePositiveNumber(options.override) ?? parsePositiveEnvNumber(options.envValue) ?? options.fallback;
}

function resolveLaneConfig(options: {
  laneName: "READ" | "WRITE";
  defaults: RateLimiterLaneConfig;
  overrides?: Partial<RateLimiterLaneConfig>;
  env: NodeJS.ProcessEnv;
}): RateLimiterLaneConfig {
  const maxConcurrent = pickConfigValue({
    override: options.overrides?.maxConcurrent,
    envValue: options.env[`SHEETS_RATE_LIMIT_${options.laneName}_MAX_CONCURRENCY`],
    fallback: options.defaults.maxConcurrent,
  });

  const tokensPerInterval = pickConfigValue({
    override: options.overrides?.tokensPerInterval,
    envValue: options.env[`SHEETS_RATE_LIMIT_${options.laneName}_TOKENS_PER_INTERVAL`],
    fallback: options.defaults.tokensPerInterval,
  });

  const intervalMs = pickConfigValue({
    override: options.overrides?.intervalMs,
    envValue: options.env[`SHEETS_RATE_LIMIT_${options.laneName}_INTERVAL_MS`],
    fallback: options.defaults.intervalMs,
  });

  const burst = pickConfigValue({
    override: options.overrides?.burst,
    envValue: options.env[`SHEETS_RATE_LIMIT_${options.laneName}_BURST`],
    fallback: options.defaults.burst,
  });

  return { maxConcurrent, tokensPerInterval, intervalMs, burst };
}

class TokenBucketLaneLimiter {
  private readonly config: RateLimiterLaneConfig;
  private readonly queue: QueuedTask[] = [];
  private availableTokens: number;
  private inflightCount = 0;
  private lastRefillAtMs: number;
  private wakeUpTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(config: RateLimiterLaneConfig) {
    this.config = config;
    this.availableTokens = config.burst;
    this.lastRefillAtMs = Date.now();
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      this.drainQueue();
    });
  }

  private refillTokens() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillAtMs;

    if (elapsedMs <= 0) {
      return;
    }

    const replenished = (elapsedMs / this.config.intervalMs) * this.config.tokensPerInterval;
    this.availableTokens = Math.min(this.config.burst, this.availableTokens + replenished);
    this.lastRefillAtMs = now;
  }

  private clearWakeUpTimer() {
    if (this.wakeUpTimer !== undefined) {
      clearTimeout(this.wakeUpTimer);
      this.wakeUpTimer = undefined;
    }
  }

  private scheduleWakeUpIfNeeded() {
    if (this.queue.length === 0) {
      this.clearWakeUpTimer();
      return;
    }

    if (
      this.inflightCount >= this.config.maxConcurrent ||
      this.availableTokens >= 1 ||
      this.wakeUpTimer !== undefined
    ) {
      return;
    }

    const missingTokens = 1 - this.availableTokens;
    const wakeUpInMs = Math.max(1, Math.ceil((missingTokens * this.config.intervalMs) / this.config.tokensPerInterval));

    this.wakeUpTimer = setTimeout(() => {
      this.wakeUpTimer = undefined;
      this.drainQueue();
    }, wakeUpInMs);
  }

  private drainQueue() {
    this.clearWakeUpTimer();
    this.refillTokens();

    while (this.queue.length > 0 && this.inflightCount < this.config.maxConcurrent && this.availableTokens >= 1) {
      const queuedTask = this.queue.shift();
      if (!queuedTask) {
        break;
      }

      this.availableTokens -= 1;
      this.inflightCount += 1;

      void Promise.resolve()
        .then(() => queuedTask.task())
        .then((result) => queuedTask.resolve(result))
        .catch((error) => queuedTask.reject(error))
        .finally(() => {
          this.inflightCount -= 1;
          this.drainQueue();
        });
    }

    this.scheduleWakeUpIfNeeded();
  }
}

class SheetsRateLimiterImpl implements SheetsRateLimiter {
  private readonly laneLimiters: Record<RateLimiterLane, TokenBucketLaneLimiter>;

  constructor(config: { read: RateLimiterLaneConfig; write: RateLimiterLaneConfig }) {
    this.laneLimiters = {
      read: new TokenBucketLaneLimiter(config.read),
      write: new TokenBucketLaneLimiter(config.write),
    };
  }

  schedule<T>(lane: RateLimiterLane, task: () => Promise<T>) {
    return this.laneLimiters[lane].schedule(task);
  }
}

export function createSheetsRateLimiter(options: CreateSheetsRateLimiterOptions = {}): SheetsRateLimiter {
  const env = options.env ?? process.env;
  const read = resolveLaneConfig({
    laneName: "READ",
    defaults: DEFAULT_READ_LANE_CONFIG,
    overrides: options.read,
    env,
  });

  const write = resolveLaneConfig({
    laneName: "WRITE",
    defaults: DEFAULT_WRITE_LANE_CONFIG,
    overrides: options.write,
    env,
  });

  return new SheetsRateLimiterImpl({ read, write });
}

export const sheetsRateLimiter = createSheetsRateLimiter();
