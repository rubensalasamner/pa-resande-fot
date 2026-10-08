export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Rough upper bound for device TTS from character count (~12 chars/sec) + margin. */
export function speechTimeoutMs(text: string, maxMs = 90_000): number {
  const estimated = Math.ceil((text.length / 12) * 1000) + 5_000;
  return Math.min(Math.max(estimated, 8_000), maxMs);
}
