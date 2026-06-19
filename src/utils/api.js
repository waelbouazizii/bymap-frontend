// src/utils/api.js — Service HTTP ByMap
// Tokens stockés dans SecureStore (Keychain iOS / Keystore Android) — plus AsyncStorage en clair
import {
  saveSession    as _saveSession,
  getAccessToken as _getAccessToken,
  getRefreshToken,
  getCurrentUser as _getCurrentUser,
  updateTokens,
  clearSession   as _clearSession,
} from '../security/secureStorage';
import { API_URL } from '../environments/environment';

// ─── Helpers stockage token + user ───────────────────────────────────────────

export const saveSession = (accessToken, refreshToken, user) =>
  _saveSession(accessToken, refreshToken, user);

export const getAccessToken  = () => _getAccessToken();
export const getCurrentUser  = () => _getCurrentUser();
export const clearSession    = () => _clearSession();

// Refreshes the access token silently; throws if refresh token is also expired.
async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('Session expirée');
  const res  = await fetch(`${API_URL}/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) { await clearSession(); throw new Error('Session expirée'); }
  // Mise à jour sécurisée des tokens dans SecureStore
  await updateTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// Authenticated fetch that retries once after refreshing on 401.
async function authFetch(url, options = {}) {
  let token = await getAccessToken();
  const makeHeaders = (t) => ({
    ...options.headers,
    Authorization: `Bearer ${t}`,
  });

  let res = await fetch(url, { ...options, headers: makeHeaders(token) });
  if (res.status === 401) {
    token = await refreshAccessToken();
    res   = await fetch(url, { ...options, headers: makeHeaders(token) });
  }
  return res;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export async function register({ nom, prenom, email, phone, password }) {
  const res  = await fetch(`${API_URL}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ nom, prenom, email, phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur inscription');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login({ email, phone, password }) {
  const res  = await fetch(`${API_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, phone, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur connexion');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/verify-login-otp ─────────────────────────────────────────
export async function verifyLoginOtp({ email, code }) {
  const res  = await fetch(`${API_URL}/auth/verify-login-otp`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Code invalide');
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── POST /api/auth/social ───────────────────────────────────────────────────
export async function socialLogin({ provider, token, name, email }) {
  const res  = await fetch(`${API_URL}/auth/social`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ provider, token, name, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Connexion ${provider} échouée`);
  await saveSession(data.accessToken, data.refreshToken, data.user);
  return data;
}

// ─── Favorites ────────────────────────────────────────────────────────────────
export async function getFavorites() {
  const res  = await authFetch(`${API_URL}/favorites`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur favoris');
  return data;
}

export async function checkFavorite(zoneName) {
  const res  = await authFetch(`${API_URL}/favorites/check?zoneName=${encodeURIComponent(zoneName)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur vérification favori');
  return data.favorited;
}

export async function toggleFavorite(zoneName, lat, lng) {
  const res  = await authFetch(`${API_URL}/favorites/toggle`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ zoneName, lat, lng }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur toggle favori');
  return data.favorited;
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export async function logout() {
  const token = await getAccessToken();
  await fetch(`${API_URL}/auth/logout`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  await clearSession();
}
