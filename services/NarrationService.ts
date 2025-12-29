import * as Speech from 'expo-speech';

export class NarrationService {
  private isSpeaking: boolean = false;
  private queue: string[] = [];

  async speak(text: string, options?: { language?: string; pitch?: number; rate?: number }) {
    if (this.isSpeaking) {
      // Queue it if already speaking
      this.queue.push(text);
      return;
    }

    this.isSpeaking = true;

    return new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: options?.language || 'en',
        pitch: options?.pitch || 1.0,
        rate: options?.rate || 0.9, // Slightly slower for clarity
        onDone: () => {
          this.isSpeaking = false;
          // Process next in queue
          if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            this.speak(next);
          }
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error) => {
          console.error('Speech error:', error);
          this.isSpeaking = false;
          resolve();
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

