// src/components/LogoutButton.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutAll } from "../services/auth";

function Spinner({ className = "" }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z"
      />
    </svg>
  );
}

export default function LogoutButton({
  className = "",
  redirectTo = "/login",
  label = "Salir",
}) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await logoutAll();
    } finally {
      setLoading(false);
      navigate(redirectTo, { replace: true });
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`btn-neu inline-flex items-center gap-2 ${className}`}
      aria-label="Cerrar sesión"
    >
      {loading ? (
        <>
          <Spinner /> <span>Saliendo…</span>
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 3H6a2 2 0 0 0-2 2v3h2V5h9v14H6v-3H4v3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-1 8H8v2h6v3l5-4-5-4v3Z"
              fill="currentColor"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
