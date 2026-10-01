const RESTAURANT_CHANNEL = /^private-restaurant-([0-9a-f-]{36})$/i;
const SESSION_CHANNEL = /^private-session-([0-9a-f-]{36})$/i;

export function parseRestaurantChannel(channelName: string): string | null {
  const match = RESTAURANT_CHANNEL.exec(channelName);
  return match?.[1] ?? null;
}

export function parseSessionChannel(channelName: string): string | null {
  const match = SESSION_CHANNEL.exec(channelName);
  return match?.[1] ?? null;
}
