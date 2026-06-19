export const environment = {
  production: false,

  // ── Serveur 1 : (bymap-server-1) ──────────────────────
  //apiUrl: 'https://13.217.50.109.nip.io/api',

  // ── Serveur 2 : (bymap-server-2) ──────────────────────
  apiUrl: 'https://107.22.30.30.nip.io/api',

  // ── Serveur 3 : (bymap-server-3) ──────────────────────
  //apiUrl: 'https://3.81.200.151.nip.io/api',

  // ── Render (backup cloud) ────────────────────────────────────────────────
  //apiUrl: 'https://backend-bymap.onrender.com/api',

  // ── Local dev ────────────────────────────────────────────────────────────
  //apiUrl: 'http://192.168.100.202:5000/api',
};

export const API_URL = environment.apiUrl;