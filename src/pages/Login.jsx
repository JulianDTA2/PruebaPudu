import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

async function apiFetch(path, opts = {}) {
  const hasBody = opts && typeof opts.body !== "undefined";
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(opts?.headers || {}),
    },
    credentials: "include",
  });
  return res;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const next = search.get("next") || "/admin";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);

  const goNext = () => navigate(next, { replace: true });

  const checkAuth = async () => {
    try {
      const r = await apiFetch("/auth/me");
      if (r.ok) {
        const data = await r.json();
        const u = data?.user || null;
        setUser(u);
        if (u) goNext();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Por favor ingresa usuario y contraseña");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          user: username,
          password: password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`);
      }

      setSuccess("Inicio de sesión exitoso");
      goNext();
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      setUser(null);
      setUsername("");
      setPassword("");
      setSuccess("Sesión cerrada correctamente");
    } catch (err) {
      setError(err.message || "Error al cerrar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleLogin}>
          <button type="submit" disabled={loading}>
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
        {user && (
          <button onClick={handleLogout} disabled={loading}>
            {loading ? "Cerrando..." : "Cerrar sesión"}
          </button>
        )}
        {error && <div className="text-red-600">{error}</div>}
        {success && <div className="text-green-600">{success}</div>}
      </div>
    </div>
  );
}
