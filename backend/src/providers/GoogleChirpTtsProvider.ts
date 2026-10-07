import {
  getGoogleAccessToken,
  parseServiceAccountJson,
  type ServiceAccount,
} from "./googleJwt";
import type { TtsProvider } from "./types";

export class GoogleChirpTtsProvider implements TtsProvider {
  private readonly sa: ServiceAccount;

  constructor(serviceAccountJson: string) {
    this.sa = parseServiceAccountJson(serviceAccountJson);
  }

  async synthesize(text: string, voiceId: string): Promise<ArrayBuffer> {
    const accessToken = await getGoogleAccessToken(this.sa);
    const languageCode = voiceId.split("-").slice(0, 2).join("-") || "sv-SE";

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
          voice: {
            languageCode,
            name: voiceId,
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google TTS failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) {
      throw new Error("Google TTS returned no audioContent");
    }

    const binary = atob(data.audioContent);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
