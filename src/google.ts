import fs from "node:fs/promises";
import { auth, sheets_v4 } from "@googleapis/sheets";
import { memoize } from "micro-memoize";

interface OAuthCredentials {
  access_token?: string;
  refresh_token?: string;
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  project_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
}

const ACCEPTED_ROOT_KEYS = ["web", "installed"] as const;

function detectCredentialShape(parsed: Record<string, unknown>): { rootKey: string; credentials: OAuthCredentials } {
  for (const key of ACCEPTED_ROOT_KEYS) {
    if (parsed[key] && typeof parsed[key] === "object") {
      return { rootKey: key, credentials: parsed[key] as OAuthCredentials };
    }
  }

  throw new Error(
    `Unrecognized credential format. Expected one of these root properties: ${ACCEPTED_ROOT_KEYS.join(", ")}. Found: ${Object.keys(parsed).join(", ")}`,
  );
}

let credentialsPath: string | undefined;
let credentialsRaw: Record<string, unknown> | undefined;
let detectedRootKey: string | undefined;
let credentials: OAuthCredentials | undefined;

function getLoadedCredentialState(): {
  credentials: OAuthCredentials;
  credentialsPath: string;
  credentialsRaw: Record<string, unknown>;
  detectedRootKey: string;
} {
  if (!credentials || !credentialsPath || !credentialsRaw || !detectedRootKey) {
    throw new Error("Credentials state not loaded.");
  }

  return {
    credentials,
    credentialsPath,
    credentialsRaw,
    detectedRootKey,
  };
}

async function ensureCredentialsLoaded(): Promise<void> {
  if (credentials) return;

  const path = credentialsPath ?? (globalThis as Record<string, unknown>).__credentialsPath;
  if (typeof path !== "string") {
    throw new Error("Credentials path not set. Pass --credentials or set it via CLI.");
  }

  credentialsPath = path;
  const raw = JSON.parse(await fs.readFile(path, "utf-8")) as Record<string, unknown>;
  credentialsRaw = raw;
  const detected = detectCredentialShape(raw);
  detectedRootKey = detected.rootKey;
  credentials = detected.credentials;
}

export function setCredentialsPath(path: string): void {
  credentialsPath = path;
  credentialsRaw = undefined;
  detectedRootKey = undefined;
  credentials = undefined;
  pendingTokenWrite = Promise.resolve();
}

let pendingTokenWrite: Promise<void> = Promise.resolve();

export const getOAuthClient = memoize(
  async () => {
    await ensureCredentialsLoaded();
    const loaded = getLoadedCredentialState();
    const creds = loaded.credentials;

    const oauth = new auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uris[0]);

    oauth.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        credentials = {
          ...creds,
          access_token: tokens.access_token ?? undefined,
          refresh_token: tokens.refresh_token ?? undefined,
        };

        const writePath = loaded.credentialsPath;
        const updated = {
          ...loaded.credentialsRaw,
          [loaded.detectedRootKey]: {
            ...creds,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          },
        };

        pendingTokenWrite = pendingTokenWrite
          .then(() => fs.writeFile(writePath, JSON.stringify(updated, null, 2)))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Warning: Failed to persist updated tokens to ${writePath}: ${msg}`);
          });
      }
    });

    oauth.setCredentials({
      refresh_token: creds.refresh_token,
      access_token: creds.access_token,
    });

    return oauth;
  },
  {
    async: true,
  },
);

export async function refreshToken(
  url: string,
): Promise<{ access_token?: null | string; refresh_token?: null | string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid redirect URL: "${url}". Expected a URL containing a "code" query parameter.`);
  }
  const code = parsed.searchParams.get("code");
  if (!code) {
    throw new Error(
      `No authorization code found in redirect URL: "${url}". The URL must contain a "code" query parameter.`,
    );
  }
  const oauth = await getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);

  await oauth.getTokenInfo(tokens.access_token ?? "");
  await pendingTokenWrite;
  return tokens;
}

export async function generateAuthUrl() {
  const oauth = await getOAuthClient();

  return oauth.generateAuthUrl({
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
  });
}

export async function verifyToken() {
  const oauth = await getOAuthClient();
  const tokens = await oauth.refreshAccessToken();
  oauth.setCredentials(tokens.credentials);

  await oauth.getTokenInfo(oauth.credentials.access_token ?? "");
  await pendingTokenWrite;
}

export const getSheets = memoize(
  async () => {
    const oauth = await getOAuthClient();

    return new sheets_v4.Sheets({
      auth: oauth,
    });
  },
  { async: true },
);
