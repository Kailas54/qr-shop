import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns the result when the first attempt succeeds', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(operation, { attempts: 3, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff and then succeeds', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error(`fail-${calls}`);
        }
        return 'recovered';
      },
      {
        attempts: 3,
        baseDelayMs: 25,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );

    expect(result).toBe('recovered');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([25, 50]);
  });

  it('throws the last error after the attempt budget is spent', async () => {
    const onError = vi.fn();
    await expect(
      withRetry(
        async () => {
          throw new Error('still down');
        },
        {
          attempts: 3,
          baseDelayMs: 1,
          sleep: async () => undefined,
          onError,
        },
      ),
    ).rejects.toThrow('still down');
    expect(onError).toHaveBeenCalledTimes(3);
  });
});
