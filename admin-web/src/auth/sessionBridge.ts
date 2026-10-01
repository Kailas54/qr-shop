export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurantId: string;
};

export type AuthBridge = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  applyTokens: (accessToken: string, refreshToken: string, user: StaffUser) => void;
  clearSession: () => void;
};

let bridge: AuthBridge | null = null;

export function registerAuthBridge(next: AuthBridge | null) {
  bridge = next;
}

export function getAuthBridge(): AuthBridge | null {
  return bridge;
}
