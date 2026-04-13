import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export interface CliArgs {
  credentialsPath: string;
  subcommand: string | null;
}

const KNOWN_FLAGS = ["--credentials"];

function getDefaultCredentialsPath(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "sheets-mcp", "key.json");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "sheets-mcp", "key.json");
    default:
      return join(home, ".config", "sheets-mcp", "key.json");
  }
}

export function parseCliArgs(argv: string[] = process.argv, cwd: string = process.cwd()): CliArgs {
  const args = argv.slice(2);
  let credentialsPath: string | null = null;
  let subcommand: string | null = null;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--credentials") {
      i++;
      if (i >= args.length) {
        console.error("Error: --credentials requires a path argument");
        process.exit(1);
      }
      credentialsPath = args[i];
    } else if (args[i].startsWith("--credentials=")) {
      const value = args[i].slice("--credentials=".length);
      if (!value) {
        console.error("Error: --credentials requires a path argument");
        process.exit(1);
      }
      credentialsPath = value;
    } else if (args[i].startsWith("--")) {
      console.error(`Error: Unknown flag '${args[i]}'. Valid flags: ${KNOWN_FLAGS.join(", ")}`);
      process.exit(1);
    } else {
      positionalArgs.push(args[i]);
    }
  }

  if (positionalArgs.length > 0) {
    const cmd = positionalArgs[0];
    if (cmd === "auth") {
      subcommand = "auth";
    } else {
      console.error(`Error: Unknown subcommand '${cmd}'. Available subcommands: auth`);
      process.exit(1);
    }
  }

  let resolvedPath = credentialsPath ?? getDefaultCredentialsPath();

  // Resolve relative paths against the caller's CWD, not package dir
  if (!isAbsolute(resolvedPath)) {
    resolvedPath = resolve(cwd, resolvedPath);
  }

  if (!existsSync(resolvedPath)) {
    console.error(`Error: Credentials file not found at '${resolvedPath}'`);
    process.exit(1);
  }

  return { credentialsPath: resolvedPath, subcommand };
}
