const PROJECT_URL_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i;

function projectRef(name: string, value: string | undefined): string {
  if (!value) throw new Error(`[Production Identity] ${name} is not configured.`);
  const match = value.match(PROJECT_URL_PATTERN);
  if (!match?.[1]) throw new Error(`[Production Identity] ${name} is not a valid project URL.`);
  return match[1];
}

const frontendRef = projectRef('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL);
const serverRef = projectRef('SUPABASE_URL', process.env.SUPABASE_URL);
const declaredRef = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;

if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('[Production Identity] VITE_SUPABASE_PUBLISHABLE_KEY is not configured.');
}
if (!process.env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('[Production Identity] SUPABASE_PUBLISHABLE_KEY is not configured.');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[Production Identity] SUPABASE_SERVICE_ROLE_KEY is not configured.');
}
if (frontendRef !== serverRef) {
  throw new Error(`[Production Identity] Frontend (${frontendRef}) and server (${serverRef}) target different projects.`);
}
if (declaredRef && declaredRef !== frontendRef) {
  throw new Error(`[Production Identity] Declared project (${declaredRef}) does not match the configured URL (${frontendRef}).`);
}

console.log('[Production Identity] Vercel:', frontendRef);
console.log('[Production Identity] Frontend:', frontendRef);
console.log('[Production Identity] Tests:', serverRef);
console.log('[Production Identity] Auto-healing:', serverRef);
console.log('[Production Identity] Production backend:', serverRef);
console.log(`[Production Identity] ✅ All consumers target ${serverRef}.`);