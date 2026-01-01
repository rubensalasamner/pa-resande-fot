import * as Speech from "expo-speech";

export class NarrationService {
  private isSpeaking: boolean = false;
  private queue: string[] = [];

  async speak(
    text: string,
    options?: { language?: string; pitch?: number; rate?: number }
  ) {
    if (this.isSpeaking) {
      // Queue it if already speaking
      this.queue.push(text);
      return;
    }

    this.isSpeaking = true;
    const language = options?.language || "sv"; // Default to Swedish

    return new Promise<void>((resolve) => {
      let hasError = false;

      Speech.speak(text, {
        language: language,
        pitch: options?.pitch || 1.0,
        rate: options?.rate || 0.9, // Slightly slower for clarity
        onDone: () => {
          this.isSpeaking = false;
          // Process next in queue
          if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            this.speak(next, { language: "sv" }); // Pass Swedish language to queued items
          }
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error) => {
          console.error("Speech error:", error);
          hasError = true;
          this.isSpeaking = false;

          // If Swedish failed and we haven't tried English yet, fallback to English
          if (language === "sv") {
            console.log("Swedish TTS failed, falling back to English...");
            // Try again with English
            Speech.speak(text, {
              language: "en",
              pitch: options?.pitch || 1.0,
              rate: options?.rate || 0.9,
              onDone: () => {
                this.isSpeaking = false;
                if (this.queue.length > 0) {
                  const next = this.queue.shift()!;
                  this.speak(next, { language: "en" }); // Use English for queue too
                }
                resolve();
              },
              onStopped: () => {
                this.isSpeaking = false;
                resolve();
              },
              onError: (fallbackError) => {
                console.error("English TTS also failed:", fallbackError);
                this.isSpeaking = false;
                resolve();
              },
            });
          } else {
            resolve();
          }
        },
      });
    });
  }

  stop() {
    Speech.stop();
    this.isSpeaking = false;
    this.queue = [];
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}
