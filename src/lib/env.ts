/**
 * Typed environment-variable wrapper for the drust backend.
 * Vite injects values prefixed with VITE_* at build time.
 */
export const ENV = {
  DRUST_BASE: import.meta.env.VITE_DRUST_BASE as string,
  DRUST_ANON_TOKEN: import.meta.env.VITE_DRUST_ANON_TOKEN as string,
};

if (!ENV.DRUST_BASE || !ENV.DRUST_ANON_TOKEN) {
  console.warn('[env] missing VITE_DRUST_BASE or VITE_DRUST_ANON_TOKEN');
}
