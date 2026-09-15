// Default to localhost:5000 in dev. In production Docker builds, VITE_API_URL is empty so
// the UI calls same-origin /api and /temp via the nginx reverse proxy.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : '');
