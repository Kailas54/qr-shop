export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  onError?: (error: unknown, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Short exponential backoff for Neon cold starts.
 * Attempt 1 fails, wait baseDelay; attempt 2 fails, wait baseDelay * 2; then throw.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('withRetry attempts must be a positive integer');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      options.onError?.(error, attempt);
      if (attempt === attempts) {
        break;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}
