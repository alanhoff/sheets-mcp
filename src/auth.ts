import readline from "node:readline/promises";
import { generateAuthUrl, refreshToken } from "#google.ts";

const url = await generateAuthUrl();
console.log("Please visit the following URL to authorize the application:");
console.log(url);

if (process.stdin.isTTY !== true) {
  console.error("Error: Auth flow requires interactive stdin. Re-run this command in a terminal.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const redirectUrl = await rl.question("Paste the redirect URL: ");
rl.close();

await refreshToken(redirectUrl);
console.log("Done");
