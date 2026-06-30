export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  // "premium" | "free" | "open" — we gate on === "premium".
  product: string;
  images?: SpotifyImage[];
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  /** Absolute epoch ms when the access token expires. */
  expires_at: number;
  scope: string;
  token_type: string;
}
