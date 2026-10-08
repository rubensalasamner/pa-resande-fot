export interface RetryPolicy {
  maxAttempts: number;
  delaySeconds(attempt: number): number;
}

export function exponentialBackoff(
  maxAttempts: number,
  baseSeconds: number,
  maxSeconds = 300
): RetryPolicy {
  return {
    maxAttempts,
    delaySeconds: (attempt) =>
      Math.min(maxSeconds, baseSeconds * 2 ** Math.max(attempt - 1, 0)),
  };
}
