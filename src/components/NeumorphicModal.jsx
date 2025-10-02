import React, { useEffect, useRef } from "react";

/**
 * NeumorphicModal
 * Props:
 * - open: boolean
 * - title: string | ReactNode
 * - children: ReactNode (contenido)
 * - confirmText?: string ("Aceptar")
 * - cancelText?: string ("Cancelar")
 * - hideCancel?: boolean
 * - variant?: "default" | "error" | "success" | "warning"   //agregado
 * - solidBackdrop?: boolean (bloquea click en overlay)
 * - onConfirm?: () => void
 * - onCancel?: () => void
 */
export default function NeumorphicModal({
  open,
  title,
  children,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  hideCancel = false,
  variant = "default",
  solidBackdrop = false,
  onConfirm,
  onCancel,
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (!solidBackdrop && onCancel) onCancel();
      }
      if (e.key === "Enter") {
        // Enter confirma si hay foco en un elemento dentro del modal
        if (document.activeElement && cardRef.current?.contains(document.activeElement)) {
          onConfirm?.();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    // foco al abrir
    const toFocus = cardRef.current?.querySelector(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    toFocus?.focus?.();

    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm, solidBackdrop]);

  if (!open) return null;

  // mapeo de estilos por variante
  const VARIANT_CLASS = {
    default: { card: "", title: "" },
    error:   { card: "error",   title: "text-[var(--accent-danger)]" },
    success: { card: "success", title: "text-[var(--accent-success)]" },
    warning: { card: "warning", title: "text-[var(--accent-warning)]" },
  };

  return (
    <>
      {/* Overlay con los mismos tokens del tema */}
      <div
        className="neu-modal-overlay"
        onClick={!solidBackdrop ? onCancel : undefined}
        aria-hidden="true"
      />
      <div className="neu-modal" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Modal"}>
        <div
          ref={cardRef}
          className={`neu-modal-card ${VARIANT_CLASS[variant]?.card || ""}`}  // clases por variante
        >
          {title ? (
            <header className="mb-2">
              {typeof title === "string" ? (
                <h3
                  className={`m-0 text-lg font-semibold ${VARIANT_CLASS[variant]?.title || ""}`} // color del título por variante
                >
                  {title}
                </h3>
              ) : (
                title
              )}
            </header>
          ) : null}

          <div className="mt-2">
            {children}
          </div>

          <footer className="mt-4 flex items-center gap-2 justify-end">
            {!hideCancel && (
              <button type="button" className="btn-neu" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            <button
              type="button"
              className="btn-neu btn-primary"  // el color se ajusta vía CSS por variante (abajo)
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
