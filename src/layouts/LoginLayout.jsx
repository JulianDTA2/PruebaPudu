import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { authFetch } from "../services/authClient";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function LoginLayout() {
  const q = useQuery();
  const navigate = useNavigate();

  const [form, setForm] = useState({ user: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [boot, setBoot] = useState(true);
  const [capsOn, setCapsOn] = useState(false);

  const goNext = () => {
    const next = q.get("next") || "/admin";
    navigate(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await authFetch("/auth/me");
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok && j?.user) {
          goNext();
          return;
        }
      } catch {}
      finally { if (alive) setBoot(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const r = await authFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          user: form.user.trim(),   
          password: form.password,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          j?.message ||
          j?.error ||
          (r.status === 401 ? "Credenciales inválidas." : `Error ${r.status} al iniciar sesión.`);
        setError(msg);
        return;
      }

      goNext(); // cookies ya seteadas por el backend
    } catch {
      setError("No se pudo conectar con el servidor de autenticación.");
    } finally {
      setPending(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function onKeyUp(e) {
    setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));
  }

  if (boot) {
    return (
      <div className="auth-shell auth-center">
        <div className="auth-loader">
          <span className="auth-spinner" aria-hidden="true" />
          <p className="auth-loader-text">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      {/* Fondo decorativo responsive */}
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-gradient" />
        <div className="auth-grid" />
      </div>

      {/* Contenedor principal */}
      <main className="auth-main">
        {/* Panel izquierdo (branding) – se oculta en móviles */}
        <aside className="auth-aside">
          <div className="auth-aside-inner">
            <div className="auth-logo">
              <img width={150} src="https://www.pudurobotics.com/_next/static/media/logo.851bf515.svg"/>
              <div>|</div>
              <img width={150} src="https://roboticminds.com.ec/registro/wp-content/uploads/2024/12/Sin-titulo-5-scaled.png"/>
            </div>

            <ul className="auth-bullets">
              <li>Acceso seguro</li>
              <li>Protección por rol y rate limiting</li>
              <li>Proxy firmador PUDU</li>
            </ul>

            <footer className="auth-aside-footer">
              <small>© {new Date().getFullYear()} RoboticMinds</small>
            </footer>
          </div>
        </aside>

        {/* Panel derecho (formulario) */}
        <section className="auth-card-wrap">
          <div className="auth-card" role="dialog" aria-labelledby="loginTitle" aria-describedby="loginDesc">
            <header className="auth-card-head">
              <h2 id="loginTitle">Iniciar sesión</h2>
              <p id="loginDesc" className="auth-muted">Ingresa tus credenciales para continuar.</p>
            </header>

            {error ? (
              <div className="auth-alert" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 9v4m0 4h.01M10.29 3.86l-8 14A2 2 0 004.18 21h15.64a2 2 0 001.89-3.14l-8-14a2 2 0 00-3.42 0z" fill="currentColor"/>
                </svg>
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="auth-form" noValidate>
              {/* Usuario */}
              <label className="auth-label">
                Usuario o Email
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="user"
                    autoComplete="username"
                    className="auth-input"
                    placeholder="tu@correo.com"
                    value={form.user}
                    onChange={onChange}
                    onKeyUp={onKeyUp}
                    required
                    disabled={pending}
                    inputMode="email"
                  />
                </div>
              </label>

              {/* Password */}
              <label className="auth-label">
                Contraseña
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <circle cx="12" cy="16" r="1" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showPass ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={onChange}
                    onKeyUp={onKeyUp}
                    required
                    disabled={pending}
                    minLength={4}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    disabled={pending}
                    title={showPass ? "Ocultar" : "Mostrar"}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </label>

              {capsOn && (
                <div className="auth-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2l7 7h-4v7H9V9H5l7-7z" fill="currentColor" />
                  </svg>
                  Bloq Mayús activado
                </div>
              )}

              <button type="submit" className="auth-btn" disabled={pending}>
                {pending ? (
                  <span className="auth-btn-content">
                    <span className="auth-spinner small" aria-hidden="true" />
                    Ingresando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            <div className="auth-footer-links">
              <Link to="/" className="auth-link">Volver al inicio</Link>
              <button className="auth-link ghost" type="button" onClick={() => alert("Contacta soporte 😄")}>
                ¿Problemas para acceder?
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
