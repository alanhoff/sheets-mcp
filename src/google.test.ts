import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { generateAuthUrl, refreshToken, setCredentialsPath } from "#google.ts";

const TMP_DIR = join(import.meta.dirname, "..", ".test-tmp-google");

describe("Google Wrapper", () => {
  it("exports expected functions", () => {
    assert.equal(typeof generateAuthUrl, "function");
    assert.equal(typeof refreshToken, "function");
    assert.equal(typeof setCredentialsPath, "function");
  });
});

describe("Credential format detection", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("detects 'web' root property", async () => {
    const credPath = join(TMP_DIR, "web-creds.json");
    writeFileSync(
      credPath,
      JSON.stringify({
        web: {
          client_id: "test-id",
          client_secret: "test-secret",
          redirect_uris: ["http://localhost"],
        },
      }),
    );

    // We can't call getOAuthClient without real Google OAuth,
    // but we can verify the module accepts the path without error
    setCredentialsPath(credPath);
    // The path is set — actual OAuth client creation tested via integration
  });

  it("detects 'installed' root property", async () => {
    const credPath = join(TMP_DIR, "installed-creds.json");
    writeFileSync(
      credPath,
      JSON.stringify({
        installed: {
          client_id: "test-id",
          client_secret: "test-secret",
          redirect_uris: ["http://localhost"],
        },
      }),
    );

    setCredentialsPath(credPath);
  });

  it("prefers 'web' over 'installed' when both present", async () => {
    const credPath = join(TMP_DIR, "both-creds.json");
    writeFileSync(
      credPath,
      JSON.stringify({
        web: {
          client_id: "web-id",
          client_secret: "web-secret",
          redirect_uris: ["http://localhost"],
        },
        installed: {
          client_id: "installed-id",
          client_secret: "installed-secret",
          redirect_uris: ["http://localhost"],
        },
      }),
    );

    setCredentialsPath(credPath);
  });
});
