// EXPO_PUBLIC_ variables are inlined at build time by Expo Metro.
// Set EXPO_PUBLIC_API_URL in your Vercel project settings to point to the
// active backend server. Falls back to S2 when not set.
const _apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://107.22.30.30.nip.io/api';

export const environment = {
  production: process.env.EXPO_PUBLIC_ENV === 'production',
  apiUrl: _apiUrl,
};

export const API_URL = _apiUrl;