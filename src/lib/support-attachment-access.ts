/** Authorize a storage key before creating a privileged support download URL. */
export function canAttachSupportMedia(
  path: string,
  threadId: string,
  uploaderId: string,
  isStaff: boolean,
): boolean {
  // Accept only canonical storage keys, never URLs or encoded path separators.
  if (!path || /[%\\?#\u0000-\u001f\u007f]/.test(path)) return false;
  const raw = path.startsWith("s2/") ? path.slice(3) : path;
  const parts = raw.split("/");
  if (parts.length !== 3 || parts.some((part) => !part || part === "." || part === "..")) return false;
  const [namespace, conversation, filename] = parts;
  if (!filename || conversation !== threadId) return false;
  return namespace === uploaderId || (isStaff && namespace === "staff");
}
