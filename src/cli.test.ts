import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { parseCliArgs } from "#cli.ts";

const TMP_DIR = join(import.meta.dirname, "..", ".test-tmp-cli");
const HOME_TMP_DIR = join(homedir(), ".test-tmp-cli-home");
const FAKE_CREDS = join(TMP_DIR, "fake-key.json");
const HOME_FAKE_CREDS = join(HOME_TMP_DIR, "fake-key.json");

describe("parseCliArgs", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
    mkdirSync(HOME_TMP_DIR, { recursive: true });
    writeFileSync(FAKE_CREDS, JSON.stringify({ web: { client_id: "test" } }));
    writeFileSync(HOME_FAKE_CREDS, JSON.stringify({ web: { client_id: "test" } }));
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    rmSync(HOME_TMP_DIR, { recursive: true, force: true });
  });

  it("parses --credentials flag and uses provided path", () => {
    const result = parseCliArgs(["node", "start", "--credentials", FAKE_CREDS]);
    assert.equal(result.credentialsPath, FAKE_CREDS);
    assert.equal(result.subcommand, null);
  });

  it("parses auth subcommand with --credentials", () => {
    const result = parseCliArgs(["node", "start", "--credentials", FAKE_CREDS, "auth"]);
    assert.equal(result.credentialsPath, FAKE_CREDS);
    assert.equal(result.subcommand, "auth");
  });

  it("parses auth subcommand before --credentials", () => {
    const result = parseCliArgs(["node", "start", "auth", "--credentials", FAKE_CREDS]);
    assert.equal(result.credentialsPath, FAKE_CREDS);
    assert.equal(result.subcommand, "auth");
  });

  it("exits with error for unknown subcommand", () => {
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start", "--credentials", FAKE_CREDS, "unknown"]);
    } catch {
      // expected
    }

    process.exit = originalExit;
    console.error = originalError;

    assert.equal(exitCode, 1);
    assert.ok(errorMsg.includes("Unknown subcommand"));
    assert.ok(errorMsg.includes("unknown"));
  });

  it("exits with error when credentials file does not exist", () => {
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start", "--credentials", "/nonexistent/path/key.json"]);
    } catch {
      // expected
    }

    process.exit = originalExit;
    console.error = originalError;

    assert.equal(exitCode, 1);
    assert.ok(errorMsg.includes("Credentials file not found"));
    assert.ok(errorMsg.includes("/nonexistent/path/key.json"));
  });

  it("computes platform-appropriate default path when --credentials omitted", () => {
    // Create file at default location to avoid exit
    const home = homedir();
    let defaultPath: string;
    switch (platform()) {
      case "darwin":
        defaultPath = join(home, "Library", "Application Support", "sheets-mcp", "key.json");
        break;
      case "win32":
        defaultPath = join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "sheets-mcp", "key.json");
        break;
      default:
        defaultPath = join(home, ".config", "sheets-mcp", "key.json");
    }

    // We can't easily test the default path case without creating the file there,
    // so instead verify the exit behavior documents the correct path
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start"]);
    } catch {
      // expected — default path likely doesn't exist in test env
    }

    process.exit = originalExit;
    console.error = originalError;

    // Verify it tried the correct default path
    if (exitCode === 1) {
      assert.ok(errorMsg.includes(defaultPath), `Expected error to mention ${defaultPath}, got: ${errorMsg}`);
    }
    // If exitCode is undefined, the default path exists — that's also valid
  });

  it("exits with error when --credentials has no value", () => {
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start", "--credentials"]);
    } catch {
      // expected
    }

    process.exit = originalExit;
    console.error = originalError;

    assert.equal(exitCode, 1);
    assert.ok(errorMsg.includes("--credentials requires a path argument"));
  });

  it("parses --credentials=<path> equals syntax", () => {
    const result = parseCliArgs(["node", "start", `--credentials=${FAKE_CREDS}`]);
    assert.equal(result.credentialsPath, FAKE_CREDS);
  });

  it("exits with error for --credentials= with empty value", () => {
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start", "--credentials="]);
    } catch {
      // expected
    }

    process.exit = originalExit;
    console.error = originalError;

    assert.equal(exitCode, 1);
    assert.ok(errorMsg.includes("--credentials requires a path argument"));
  });

  it("resolves relative credentials path against provided cwd", () => {
    const result = parseCliArgs(["node", "start", "--credentials", "fake-key.json"], TMP_DIR);
    assert.equal(result.credentialsPath, FAKE_CREDS);
  });

  it("does not alter absolute credentials path", () => {
    const result = parseCliArgs(["node", "start", "--credentials", FAKE_CREDS], "/some/other/dir");
    assert.equal(result.credentialsPath, FAKE_CREDS);
  });

  it("expands tilde-prefixed credentials path against the home directory", () => {
    const result = parseCliArgs(["node", "start", "--credentials", "~/.test-tmp-cli-home/fake-key.json"]);
    assert.equal(result.credentialsPath, HOME_FAKE_CREDS);
  });

  it("exits with error for unknown flags", () => {
    let exitCode: number | undefined;
    const originalExit = process.exit;
    const originalError = console.error;
    let errorMsg = "";

    process.exit = ((code: number) => {
      exitCode = code;
      throw new Error("exit");
    }) as never;
    console.error = (msg: string) => {
      errorMsg = msg;
    };

    try {
      parseCliArgs(["node", "start", "--verbose", "--credentials", FAKE_CREDS]);
    } catch {
      // expected
    }

    process.exit = originalExit;
    console.error = originalError;

    assert.equal(exitCode, 1);
    assert.ok(errorMsg.includes("Unknown flag"));
    assert.ok(errorMsg.includes("--verbose"));
    assert.ok(errorMsg.includes("--credentials"));
  });
});
