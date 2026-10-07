export async function scriptHash(
  script: string,
  voiceId: string
): Promise<string> {
  const data = new TextEncoder().encode(`${voiceId}\n${script}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
