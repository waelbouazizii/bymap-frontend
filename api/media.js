// Vercel serverless proxy for backend upload files.
// The backend stores media at http://18.219.204.29:5000/uploads/ (HTTP, raw IP).
// Browsers block this from HTTPS pages (mixed content) and NGINX on the backend
// doesn't serve /uploads/ on port 443. This proxy fetches server-to-server and
// returns the file to the browser as a same-origin HTTPS response.
export default async function handler(req, res) {
  const { path } = req.query;
  if (!path || typeof path !== 'string') { res.status(400).end(); return; }

  // Sanitize: allow only safe filename characters (no path traversal)
  const safePath = path.replace(/[^a-zA-Z0-9._\-]/g, '');
  if (!safePath) { res.status(400).end(); return; }

  const url = `http://18.219.204.29:5000/uploads/${safePath}`;
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
