// Vercel serverless proxy for backend upload files.
// Browsers block cross-origin requests to nip.io servers (tracking prevention + CORS).
// Tries two strategies in parallel:
//   1. Via nginx HTTPS: GET /api/media?path=... on each backend (requires backend Express route)
//   2. Direct to Express HTTP port 5000/3000: GET /uploads/filename (bypasses nginx, uses static middleware)
// Promise.any returns on first success across all 12 parallel attempts.
export default async function handler(req, res) {
  const { path } = req.query;
  if (!path || typeof path !== 'string') { res.status(400).end(); return; }

  const safePath = path
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9._\-/]/g, '');
  if (!safePath) { res.status(400).end(); return; }

  const envBase = (process.env.EXPO_PUBLIC_API_URL || '').replace('/api', '').replace(/\/$/, '');
  const candidates = [
    envBase,
    'https://13.217.50.109.nip.io',
    'https://107.22.30.30.nip.io',
    'https://3.81.200.151.nip.io',
  ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

  // Strategy 1: via nginx HTTPS — requires backend /api/media Express route
  const tryServer = (base, p) =>
    fetch(`${base}/api/media?path=${encodeURIComponent(p)}`, {
      signal: AbortSignal.timeout(8000),
    }).then(r => { if (!r.ok) throw new Error(`nginx:${base} ${r.status}`); return r; });

  const pathVariants = [safePath, `uploads/${safePath}`];

  // Strategy 2: direct to Express (bypasses nginx) — serves via express.static('uploads')
  const rawIPs = ['13.217.50.109', '107.22.30.30', '3.81.200.151'];
  const directPorts = [5000, 3000];
  const tryDirect = (ip, port) =>
    fetch(`http://${ip}:${port}/uploads/${encodeURIComponent(safePath)}`, {
      signal: AbortSignal.timeout(8000),
    }).then(r => { if (!r.ok) throw new Error(`direct:${ip}:${port} ${r.status}`); return r; });

  try {
    const upstream = await Promise.any([
      ...candidates.flatMap(base => pathVariants.map(p => tryServer(base, p))),
      ...rawIPs.flatMap(ip => directPorts.map(port => tryDirect(ip, port))),
    ]);
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buffer = await upstream.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch (e) {
    const reasons = e?.errors?.map(err => err.message) ?? [String(e)];
    console.error('[media-proxy] All attempts failed:', reasons.join(' | '));
    res.status(502).end();
  }
}
