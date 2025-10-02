const AUTH_BASE = (import.meta.env.VITE_AUTH_BASE || "").replace(/\/$/, "");

export async function authFetch(path, opts = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(opts || {}, "body");
  const url = `${AUTH_BASE}${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
    credentials: "include",
  });
}
