// Module-level singleton for optimistic image display.
// After a successful upload, store the local blob/file URIs here so newly
// created PubCards can display the image instantly (no Vercel proxy round-trip).
// Expires automatically after 30 seconds.

let _pending = null;

export function setPendingUpload(mode, localUris) {
  _pending = { mode, localUris, at: Date.now() };
}

export function getPendingLocalUri(post) {
  if (!_pending) return null;
  if (Date.now() - _pending.at > 30000) { _pending = null; return null; }
  if (post.mode !== _pending.mode) return null;
  const postAge = Date.now() - new Date(post.createdAt).getTime();
  if (postAge > 35000) return null;
  return _pending.localUris?.[0] ?? null;
}
