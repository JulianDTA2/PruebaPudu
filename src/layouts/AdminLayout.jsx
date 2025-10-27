import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function NavItem({ to, children, end = false, onClick, className = "" }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `btn-neu shrink-0 ${
          isActive ? "ring-2 ring-brand-pudu" : ""
        } ${className}`
      }
      onClick={onClick}
    >
      <span>{children}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <header className="sticky top-0 z-[60] p-4 space-y-4">
        <div className="max-w-7xl mx-auto">
          <div className="card-neu isolate flex overflow-x-auto whitespace-nowrap snap-x snap-mandatory items-center gap-3">
            <img
              width={100}
              src="https://www.pudurobotics.com/_next/static/media/logo.851bf515.svg"
            />
            <div>|</div>
            <img
              width={100}
              src="https://roboticminds.com.ec/registro/wp-content/uploads/2024/12/Sin-titulo-5-scaled.png"
            />
            <nav className="hidden lg:flex items-center gap-2 ml-auto">
              <NavItem to="/admin" end>
                Dashboard
              </NavItem>
              <NavItem to="/admin/maps">Mapas</NavItem>
              <NavItem to="/admin/apicc">CC1</NavItem>
              <NavItem to="/admin/logs">Logs</NavItem>
              <NavItem to="/admin/explorer">API</NavItem>
              <NavItem to="/admin/apibella">BellaBot</NavItem>
              <NavItem to="/admin/cam">Camara</NavItem>
            </nav>
            <button
              type="button"
              className="btn-neu btn-sm ml-auto lg:hidden"
              aria-controls="admin-mobile-nav"
              aria-expanded={open}
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((o) => !o)}
            >
              {!open ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6h18M3 12h18M3 18h18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6l-12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Menú móvil */}
        <div
          id="admin-mobile-nav"
          className={`lg:hidden transition-all duration-300 ease-in-out ${
            open ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
          } overflow-hidden relative z-[70]`}
          aria-label="Navegación móvil"
        >
          <div className="max-w-7xl mx-auto">
            <div className="card-neu-lg isolate mt-2">
              <div className="flex flex-col gap-3">
                <NavItem to="/admin" end onClick={() => setOpen(false)}>
                  Dashboard
                </NavItem>
                <NavItem to="/admin/maps" onClick={() => setOpen(false)}>
                  Mapas
                </NavItem>
                <NavItem to="/admin/apicc" onClick={() => setOpen(false)}>
                  CC1
                </NavItem>
                <NavItem to="/admin/logs" onClick={() => setOpen(false)}>
                  Logs
                </NavItem>
                <NavItem to="/admin/explorer" onClick={() => setOpen(false)}>
                  API
                </NavItem>
                <NavItem to="/admin/bellabot" onClick={() => setOpen(false)}>
                  BellaBot
                </NavItem>
                <NavItem to="/admin/cam" onClick={() => setOpen(false)}>
                  Camara
                </NavItem>
              </div>
            </div>
          </div>
        </div>

        {/* Cerrar el menú con un overlay */}
        {open && (
          <button
            type="button"
            className="mobile-overlay lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
            aria-label="Cerrar menú"
          />
        )}
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
