import { describe, expect, it } from 'vitest';
import { parseRestaurantChannel, parseSessionChannel } from './pusherChannels';

describe('pusherChannels', () => {
  it('parses restaurant private channels', () => {
    const id = '9e0a6290-4f85-4458-96dc-12567ad968b0';
    expect(parseRestaurantChannel(`private-restaurant-${id}`)).toBe(id);
    expect(parseRestaurantChannel('private-restaurant-not-uuid')).toBeNull();
  });

  it('parses session private channels', () => {
    const id = '9e0a6290-4f85-4458-96dc-12567ad968b0';
    expect(parseSessionChannel(`private-session-${id}`)).toBe(id);
    expect(parseSessionChannel('presence-session-x')).toBeNull();
  });
});
