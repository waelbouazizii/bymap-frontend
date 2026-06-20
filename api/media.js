// Vercel serverless proxy for backend upload files.
// Browsers block cross-origin requests to nip.io servers (tracking prevention + CORS).
// This proxy fetches server-to-server via the backend's /api/media Express route
// (nginx proxies /api/* to Express; /uploads/* is NOT proxied by nginx → would 403).
// Tries all 3 backend servers so files uploaded to any one server are always found.
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

  // Race all backends in parallel — first successful response wins (handles files on different servers)
  const tryServer = (base) =>
    fetch(`${base}/api/media?path=${encodeURIComponent(safePath)}`, {
      signal: AbortSignal.timeout(8000),
    }).then(r => {
      if (!r.ok) throw new Error(`${r.status}`);
      return r;
    });

  try {
    const upstream = await Promise.any(candidates.map(tryServer));
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buffer = await upstream.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch {
    res.status(502).end();
  }
}
