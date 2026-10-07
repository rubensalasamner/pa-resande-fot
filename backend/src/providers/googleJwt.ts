export interface ServiceAccount {
  client_email: string;
  private_key: string;
  private_key_id?: string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getGoogleAccessToken(
  sa: ServiceAccount,
  scope = "https://www.googleapis.com/auth/cloud-platform"
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) {
    return cachedToken.token;
  }

  const header = base64UrlEncode(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
      ...(sa.private_key_id ? { kid: sa.private_key_id } : {}),
    })
  );

  const iat = now;
  const exp = now + 3600;
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp,
    })
  );

  const unsigned = `${header}.${claimSet}`;
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
    throw new Error(
      `Google OAuth token failed: ${tokenRes.status} ${await tokenRes.text()}`
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    token: tokenData.access_token,
    exp: now + (tokenData.expires_in ?? 3600),
  };

  return cachedToken.token;
}

export function parseServiceAccountJson(json: string): ServiceAccount {
  const parsed = JSON.parse(json) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid GCP service account JSON");
  }
  return parsed;
}
