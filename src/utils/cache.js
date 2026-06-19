/**
 * cache.js — Cache à deux niveaux : mémoire (session) + AsyncStorage (persistant)
 *
 * Niveau 1 : Map en mémoire   → accès instantané, perdu au redémarrage
 * Niveau 2 : AsyncStorage     → persiste entre sessions, survit aux redémarrages
 *
 * Utilisation :
 *   import { cachedGeocode, cachedZone, cachedSearch } from '../utils/cache';
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config TTL ───────────────────────────────────────────────────────────────
const TTL_GEOCODE = 7 * 24 * 60 * 60 * 1000;  // 7 jours  (coordonnées → ville)
const TTL_ZONE    = 7 * 24 * 60 * 60 * 1000;  // 7 jours  (coordonnées → gouvernorat)
const TTL_SEARCH  =      60 * 60 * 1000;       // 1 heure  (requête texte → lieux)

// ─── Cache mémoire session ────────────────────────────────────────────────────
const MEM = new Map();

// ─── Clé normalisée pour coordonnées (précision ~1 km) ───────────────────────
function coordKey(prefix, lat, lng) {
  return `${prefix}_${parseFloat(lat).toFixed(2)}_${parseFloat(lng).toFixed(2)}`;
}

// ─── Lecture (mémoire → AsyncStorage) ────────────────────────────────────────
async function cacheGet(key) {
  // 1. Mémoire (instantané)
  const mem = MEM.get(key);
  if (mem) {
    if (Date.now() < mem.expiry) return mem.value;
    MEM.delete(key);
  }

  // 2. AsyncStorage (persistant)
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() < entry.expiry) {
      MEM.set(key, entry); // réchauffer le cache mémoire
      return entry.value;
    }
    AsyncStorage.removeItem(key); // entrée expirée, nettoyer
  } catch {}
  return null;
}

// ─── Écriture (mémoire + AsyncStorage) ───────────────────────────────────────
async function cacheSet(key, value, ttl) {
  const entry = { value, expiry: Date.now() + ttl };
  MEM.set(key, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * cachedGeocode — Cache pour reverseGeocode (nom de ville)
 * @param {number} lat
 * @param {number} lng
 * @param {function} fetcher  async (lat, lng) => string|null
 * @returns {Promise<string|null>}
 */
export async function cachedGeocode(lat, lng, fetcher) {
  const key = coordKey('rg', lat, lng);
  const hit = await cacheGet(key);
  if (hit !== null) return hit;

  const result = await fetcher(lat, lng);
  if (result != null) await cacheSet(key, result, TTL_GEOCODE);
  return result;
}

/**
 * cachedZone — Cache pour detectZoneFromCoords (gouvernorat)
 * @param {number} lat
 * @param {number} lng
 * @param {function} fetcher  async (lat, lng) => string|null
 * @returns {Promise<string|null>}
 */
export async function cachedZone(lat, lng, fetcher) {
  const key = coordKey('zone', lat, lng);
  const hit = await cacheGet(key);
  if (hit !== null) return hit;

  const result = await fetcher(lat, lng);
  if (result != null) await cacheSet(key, result, TTL_ZONE);
  return result;
}

/**
 * cachedSearch — Cache pour les suggestions de recherche
 * @param {string} query
 * @param {function} fetcher  async (query) => Array|null
 * @returns {Promise<Array|null>}
 */
export async function cachedSearch(query, fetcher) {
  const key = `search_${query.trim().toLowerCase()}`;
  const hit = await cacheGet(key);
  if (hit !== null) return hit;

  const result = await fetcher(query);
  if (result != null) await cacheSet(key, result, TTL_SEARCH);
  return result;
}

/**
 * clearCache — Vide tout le cache (mémoire + AsyncStorage)
 * Utile pour debug ou déconnexion
 */
export async function clearCache() {
  MEM.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k =>
      k.startsWith('rg_') || k.startsWith('zone_') || k.startsWith('search_')
    );
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
