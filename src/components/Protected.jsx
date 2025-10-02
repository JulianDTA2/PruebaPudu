import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authFetch } from "../services/authClient";

export default function Protected({ children, requireRole }) {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState(null);
  const [tryRefresh, setTryRefresh] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let alive = true;

    async function checkAuth() {
      try {
        const r = await authFetch("/auth/me");
        const j = await r.json().catch(() => ({}));
        if (!alive) return;

        if (r.ok && j?.user) {
          setUser(j.user);
          return;
        }

        if (!tryRefresh && (r.status === 401 || r.status === 403)) {
          setTryRefresh(true);
          const rr = await authFetch("/auth/refresh", { method: "POST" });
          if (rr.ok) {
            const r2 = await authFetch("/auth/me");
            const j2 = await r2.json().catch(() => ({}));
            if (r2.ok && j2?.user) {
              setUser(j2.user);
              return;
            }
          }
        }
      } catch {}
      finally { if (alive) setBoot(false); }
    }

    checkAuth();
    return () => { alive = false; };
  }, [tryRefresh]);

  if (boot) {
    return (
      <div className="page center">
        <div className="card"><p>Verificando sesión…</p></div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (requireRole) {
    const rolesWanted = Array.isArray(requireRole) ? requireRole : [requireRole];
    const roleId = Number(user?.role_id);
    const roleStr = String(user?.role || "").toLowerCase();
    const okById = rolesWanted.some(r => Number(r) === roleId);
    const okByStr = rolesWanted.some(r => String(r).toLowerCase() === roleStr);
    if (!(okById || okByStr)) {
      return (
        <div className="page center">
          <div className="card">
            <h2>Acceso restringido</h2>
            <p>No tienes permisos para ver esta sección.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
