import { describe, expect, it } from 'vitest';
import { sanitizeDbMessage } from './redact';

describe('sanitizeDbMessage', () => {
  it('strips credentials from a postgres URL embedded in an error', () => {
    const message = sanitizeDbMessage(
      'connect ECONNREFUSED postgresql://qr:super-secret@localhost:5432/qr_ordering?schema=public',
    );
    expect(message).not.toContain('super-secret');
    expect(message).toContain('postgresql://[redacted]');
  });
});
