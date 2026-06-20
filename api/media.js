// Vercel serverless proxy for backend upload files.
// The backend stores media on nip.io servers (cross-origin from the Vercel frontend).
// Browsers (especially Edge with tracking prevention) block cross-origin requests to
// nip.io domains. This proxy fetches server-to-server and returns the file as a
// same-origin HTTPS response, bypassing CORS and tracking prevention entirely.
export default async function handler(req, res) {
  const { path } = req.query;
  if (!path || typeof path !== 'string') { res.status(400).end(); return; }

  // Sanitize: prevent path traversal, allow alphanumeric + safe filename chars + forward slashes
  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '').replace(/[^a-zA-Z0-9._\-\/]/g, '');
  if (!safePath) { res.status(400).end(); return; }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://107.22.30.30.nip.io/api';
  const serverBase = apiUrl.replace('/api', '');
  const url = `${serverBase}/uploads/${safePath}`;

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) { res.status(upstream.status).end(); return; }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const buffer = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));
  } catch {
    res.status(502).end();
  }
}
