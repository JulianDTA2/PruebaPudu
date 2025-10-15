// src/services/auth.js
export async function serverLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  } catch (_) {
    // No bloqueamos el logout local si falla el endpoint
  }
}

export function clearClientSession() {
  const KEYS = [
    "token",
    "auth_token",
    "access_token",
    "refresh_token",
    "user",
    "profile",
  ];
  KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
    try {
      sessionStorage.removeItem(k);
    } catch {}
  });

  // Intenta limpiar cookies conocidas (mejor si tu backend las setea con Max-Age/Expires)
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name) {
      try {
        document.cookie = `${name}=; Max-Age=0; path=/; samesite=lax`;
      } catch {}
    }
  });
}

export async function logoutAll() {
  await serverLogout();
  clearClientSession();
}
