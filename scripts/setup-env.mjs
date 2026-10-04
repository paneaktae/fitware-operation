import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
try {
  await access(".env");
  console.log("Existing environment preserved.");
} catch {
  await writeFile(
    ".env",
    `DATABASE_URL=postgresql://fitware:fitware@127.0.0.1:55432/fitware\nAPP_URL=http://127.0.0.1:3000\nBETTER_AUTH_URL=http://127.0.0.1:3000\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nADMIN_EMAIL=owner@fitware.local\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nDEMO_MODE=true\nSTORAGE_PROVIDER=local\nCRON_SECRET=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Local demo environment created. Login details are stored in the ignored .env file.",
  );
}
