import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "voice-samples");

const MALE_VOICES = [
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Charon",
  "Enceladus",
  "Fenrir",
  "Iapetus",
  "Orus",
  "Puck",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Umbriel",
  "Zubenelgenubi",
];

const SAMPLE_TEXT =
  "Välkommen. Strax passerar du en historisk plats längs vägen. " +
  "Här kan du höra en kort berättelse medan du kör vidare.";

function loadDevVars() {
  const raw = readFileSync(join(root, ".dev.vars"), "utf8");
  const vars = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i === -1) continue;
    vars[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return vars;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = Buffer.from(b64, "base64");
  return binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  );
}

function base64UrlEncode(data) {
  const buf = Buffer.isBuffer(data)
    ? data
    : Buffer.from(typeof data === "string" ? data : new Uint8Array(data));
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
      ...(sa.private_key_id ? { kid: sa.private_key_id } : {}),
    })
  );
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`OAuth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const data = await tokenRes.json();
  return data.access_token;
}

async function synthesize(accessToken, voiceName, text) {
  const res = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "sv-SE", name: voiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`${voiceName}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return Buffer.from(data.audioContent, "base64");
}

const vars = loadDevVars();
const sa = JSON.parse(vars.GCP_SERVICE_ACCOUNT_JSON);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "sample-text.txt"), SAMPLE_TEXT, "utf8");

const token = await getAccessToken(sa);
console.log(`Generating ${MALE_VOICES.length} male Chirp samples → ${outDir}`);

for (const name of MALE_VOICES) {
  const voiceId = `sv-SE-Chirp3-HD-${name}`;
  process.stdout.write(`${voiceId} ... `);
  try {
    const mp3 = await synthesize(token, voiceId, SAMPLE_TEXT);
    const file = join(outDir, `${name}.mp3`);
    writeFileSync(file, mp3);
    console.log(`${mp3.length} bytes`);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
  }
}

console.log("Done. Open backend/voice-samples/ and play the MP3s.");
