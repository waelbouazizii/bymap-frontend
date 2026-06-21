// Vercel serverless proxy for backend upload files.
// Bypasses browser CORS/tracking restrictions by fetching server-to-server.
// Backend is on Render.com — no nginx, so Express static middleware (/uploads/) is
// directly accessible over HTTPS. Tries two strategies in parallel:
//   1. /api/media?path=filename  (if backend has an Express media route)
//   2. /uploads/filename         (Express express.static('uploads') middleware)
export default async function handler(req, res) {
  const { path } = req.query;
  if (!path || typeof path !== 'string') { res.status(400).end(); return; }

  const safePath = path
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9._\-/]/g, '');
  if (!safePath) { res.status(400).end(); return; }

  const envBase = (process.env.EXPO_PUBLIC_API_URL || '').replace('/api', '').replace(/\/$/, '');
  const renderBase = 'https://backend-1-pqrz.onrender.com';
  const candidates = [envBase, renderBase]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Strategy 1: via /api/media Express route
  const tryApiRoute = (base, p) =>
    fetch(`${base}/api/media?path=${encodeURIComponent(p)}`, {
      signal: AbortSignal.timeout(10000),
    }).then(r => { if (!r.ok) throw new Error(`api:${base} ${r.status}`); return r; });

  // Strategy 2: direct /uploads/ (no nginx on Render — Express static serves this)
  const tryUploads = (base) =>
    fetch(`${base}/uploads/${encodeURIComponent(safePath)}`, {
      signal: AbortSignal.timeout(10000),
    }).then(r => { if (!r.ok) throw new Error(`uploads:${base} ${r.status}`); return r; });

  const pathVariants = [safePath, `uploads/${safePath}`];

  try {
    const upstream = await Promise.any([
      ...candidates.flatMap(base => pathVariants.map(p => tryApiRoute(base, p))),
      ...candidates.map(base => tryUploads(base)),
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
