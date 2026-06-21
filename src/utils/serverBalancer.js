/**
 * serverBalancer.js — Basculement automatique entre serveurs
 *
 * Stratégie : Failover intelligent + Patch global fetch
 *  - patchFetchWithFailover() intercepte TOUS les appels fetch vers nos serveurs
 *  - Si S1 échoue → essai automatique S2 → S3 sans modifier les screens
 *  - Le serveur qui répond devient actif jusqu'à sa prochaine panne
 *  - Reset automatique vers S1 après 60s
 */

// Sauvegarder le fetch natif AVANT tout patch (évite la récursion infinie)
const _nativeFetch = global.fetch;

// ── Liste des serveurs (ordre de priorité) ────────────────────────────────────
export const SERVERS = [
  'https://backend-1-pqrz.onrender.com/api',   // S1 — bymap-server-1
  //'https://107.22.30.30.nip.io/api',    // S2 — bymap-server-2
  //'https://3.81.200.151.nip.io/api',    // S3 — bymap-server-3
];

const TIMEOUT_MS     = 8000;   // Timeout par tentative
const RESET_DELAY_MS = 60000;  // Retenter S1 après 60s

let activeIndex = 0;
let resetTimer  = null;

// ── Fetch avec timeout (utilise le fetch natif non patché) ────────────────────

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await _nativeFetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Basculement automatique ───────────────────────────────────────────────────

/**
 * Envoie une requête en essayant chaque serveur jusqu'au succès.
 * @param {string} path   - Chemin relatif ex: '/auth/login'
 * @param {object} options - Options fetch standard
 */
export async function fetchWithFailover(path, options = {}) {
  let lastError;

  for (let i = 0; i < SERVERS.length; i++) {
    const idx = (activeIndex + i) % SERVERS.length;
    const url = `${SERVERS[idx]}${path}`;

    try {
      const res = await fetchWithTimeout(url, options, TIMEOUT_MS);

      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);

      if (i > 0) {
        console.log(`[BALANCER] S${activeIndex + 1} ✗ → S${idx + 1} ✓ (${SERVERS[idx]})`);
        activeIndex = idx;
        scheduleReset();
      }

      return res;

    } catch (err) {
      lastError = err;
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`[BALANCER] S${idx + 1} indisponible (${reason})`);
    }
  }

  throw lastError || new Error('Tous les serveurs sont indisponibles');
}

// ── Reset vers serveur principal ──────────────────────────────────────────────

function scheduleReset() {
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    if (activeIndex !== 0) {
      console.log('[BALANCER] Reset → S1 (serveur principal)');
      activeIndex = 0;
    }
    resetTimer = null;
  }, RESET_DELAY_MS);
}

// ── Patch global fetch ────────────────────────────────────────────────────────

/**
 * Intercepte tous les appels fetch() vers nos serveurs et applique le failover.
 * À appeler UNE SEULE FOIS au démarrage de l'app (dans App.js).
 *
 * Après le patch, tous les screens continuent à utiliser :
 *   fetch(`${API_URL}/publications`, options)
 * ...et bénéficient automatiquement du basculement entre les 3 serveurs.
 */
export function patchFetchWithFailover() {
  global.fetch = async function interceptedFetch(url, options) {
    if (typeof url === 'string') {
      for (const server of SERVERS) {
        if (url.startsWith(server)) {
          // Extraire le chemin relatif ex: '/publications/zone-dots'
          const path = url.slice(server.length) || '/';
          return fetchWithFailover(path, options);
        }
      }
    }
    // Requête vers une URL externe → fetch natif normal
    return _nativeFetch(url, options);
  };

  console.log('[BALANCER] Patch fetch actif — 3 serveurs en failover');
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

export function getActiveServerUrl()   { return SERVERS[activeIndex]; }
export function getActiveServerIndex() { return activeIndex + 1; }

export function setActiveServer(num) {
  const idx = num - 1;
  if (idx >= 0 && idx < SERVERS.length) {
    activeIndex = idx;
    console.log(`[BALANCER] Serveur forcé → S${num}`);
  }
}
