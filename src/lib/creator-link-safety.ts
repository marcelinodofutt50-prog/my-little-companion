const CREATOR_VIDEO_HOSTS = new Set([
  "youtube.com", "youtu.be", "tiktok.com", "vm.tiktok.com",
  "instagram.com", "kwai.com", "k.kwai.com", "facebook.com",
  "fb.watch", "t.me", "telegram.me", "x.com", "twitter.com",
]);

/** Treat stored links as untrusted, including historical and imported rows. */
export function safeCreatorVideoHref(value: string): string | null {
  if (value.length > 300 || /[\s\\<>"'\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    return CREATOR_VIDEO_HOSTS.has(host) ? url.href : null;
  } catch {
    return null;
  }
}