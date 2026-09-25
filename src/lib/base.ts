/** Prefixes a public/ asset path with the deployment base ("/driftline/" on Pages). */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${p}`;
}

export const BASE = import.meta.env.BASE_URL || '/';
