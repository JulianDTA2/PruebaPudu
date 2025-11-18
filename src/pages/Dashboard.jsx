import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import Stat from "../components/Stat";
import Button from "../components/Button";
import { usePolling } from "../hooks/usePolling";
import { Pudu, get } from "../services/api";

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

function formatLatency(ms) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const PRODUCT_IMAGES = {
  bellabot:
    "https://cdn.pudutech.com/website/images/pc/bellabot/parameter2.2.0.png",
  cc1: "https://cdn.pudutech.com/website/images/cc1/parameters_robot_en.png",
  "bellabot pro":
    "https://cdn.pudutech.com/official-website/bellabotpro/S13_1.png",
  flashbot:
    "https://cdn.pudutech.com/official-website/flashbot_new/s16-tuya.webp",
};

/** Normaliza el nombre/código del producto para matchear el mapeo */
function normalizeProductName(raw) {
  if (!raw) return null;
  const s = String(raw)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // matches directos
  if (s === "bellabot" || s === "bella bot" || s === "bella") return "bellabot";
  if (
    s === "bellabot pro" ||
    s === "bella bot pro" ||
    s === "bellapro" ||
    s === "bellabotpro"
  )
    return "bellabot pro";
  if (s === "cc1") return "cc1";
  if (s === "flashbot" || s === "flash bot") return "flashbot";

  // heurísticas por inclusión
  if (s.includes("bellabot pro") || (s.includes("bella") && s.includes("pro")))
    return "bellabot pro";
  if (s.includes("bellabot") || s.includes("bella bot") || s === "bella")
    return "bellabot";
  if (s.includes("flash")) return "flashbot";
  if (s.includes("cc1")) return "cc1";

  return null;
}

// Helper: identifica robots de delivery (BellaBot / BellaBot Pro)
const isDeliveryKey = (k) =>
  k === "bellabot" || k === "bellabot pro" || k === "flashbot";

const Countdown = memo(function Countdown({ enabled, pollMs, ts }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  const nextRefresh = useMemo(() => {
    if (!enabled || !ts) return null;
    const eta = pollMs - (Date.now() - ts);
    return eta > 0 ? Math.ceil(eta / 1000) : 0;
  }, [enabled, pollMs, ts, tick]);

  if (!enabled || nextRefresh == null) return null;
  return (
    <div className="text-xs text-foreground/60">
      Próx. actualización en: {nextRefresh}s
    </div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();

  // --- Controles ---
  const [shopId, setShopId] = useState("451170001");

  // Default: auto-refresh cada 5 minutos (pasivo al inicio)
  const [pollMs, setPollMs] = useState(300000); // 5 minutos
  const enabled = pollMs > 0;

  // Mantener shopId en un ref para NO recrear pollFn ni rearmar el polling
  const shopIdRef = useRef(shopId);
  useEffect(() => {
    shopIdRef.current = shopId;
  }, [shopId]);

  // --- Tiendas (selector) ---
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setShopsLoading(true);
        setShopsErr(null);
        const res = await get("/data-open-platform-service/v1/api/shop", {
          limit: 100,
          offset: 0,
        });
        const list = res?.data?.list || res?.list || [];
        setShops(list);
        if (!shopId && list.length) {
          const first = String(list[0]?.shop_id ?? list[0]?.id ?? "");
          setShopId(first);
          shopIdRef.current = first;
        }
      } catch (e) {
        setShopsErr(
          e?.response?.data || e?.message || "Error cargando tiendas"
        );
      } finally {
        setShopsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Polling: función estable que lee shopId desde el ref ---
  const pollFn = useCallback(async () => {
    const currentShop = shopIdRef.current;
    const t0 = performance.now();

    try {
      const res = await Pudu.getRobots({ shop_id: currentShop });

      // Lista robusta
      const list =
        res?.data?.list ??
        res?.list ??
        res?.data?.data?.list ??
        (Array.isArray(res) ? res : []);

      // Construimos objetos con info + imagen
      const robots = (Array.isArray(list) ? list : []).map((r) => {
        const productRaw =
          r?.product_code ??
          r?.product ??
          r?.productCode ??
          r?.productType ??
          r?.type ??
          "-";
        const sn =
          r?.sn ?? r?.device_sn ?? r?.robot_sn ?? r?.serial ?? r?.id ?? "-";
        const productKey = normalizeProductName(productRaw);
        const img = productKey ? PRODUCT_IMAGES[productKey] : null;
        const label = `${productRaw} - ${sn}`;
        return { productRaw, productKey, sn, label, img };
      });

      // deduplicar por productKey+sn (o label como fallback)
      const seen = new Set();
      const robotsUnique = robots.filter((it) => {
        const key = `${it.productKey || "x"}::${it.sn || it.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const count =
        res?.data?.count ??
        res?.data?.data?.count ??
        res?.count ??
        robotsUnique.length;

      const t1 = performance.now();
      return {
        online: true,
        count,
        robots: robotsUnique,
        errMsg: null,
        ts: Date.now(),
        latencyMs: Math.round(t1 - t0),
      };
    } catch (e) {
      const isNetworkError = !e?.response;
      return {
        online: !isNetworkError,
        count: 0,
        robots: [],
        errMsg: e?.response?.data || e?.message,
        ts: Date.now(),
        latencyMs: null,
      };
    }
  }, []); // ¡sin dependencias!

  const { data, loading, refetch } = usePolling(pollFn, {
    interval: pollMs, // 5 min por defecto (respetado)
    enabled, // polling activo si pollMs > 0
  });

  const online = data?.online ?? false;
  const robotsCount = data?.count ?? 0;
  const robots = data?.robots ?? [];
  const updatedAt = data?.ts ? new Date(data.ts) : null;
  const latencyMs = data?.latencyMs;

  // Cambio de tienda
  const handleShopChange = useCallback(
    (e) => {
      const v = e.target.value;
      setShopId(v);
      shopIdRef.current = v;
      refetch(); // consulta inmediata con la tienda nueva
    },
    [refetch]
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 min-h-screen">
      <Card className="isolate">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Estado API</h2>
            <p className="text-sm text-foreground/60">
              Tienda actual:{" "}
              <span className="font-medium break-all">{shopId}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {/* Frecuencia */}
            <select
              className="input w-full sm:w-auto min-w-0 max-w-full"
              value={String(pollMs)}
              onChange={(e) => setPollMs(Number(e.target.value))}
              title="Frecuencia de actualización"
            >
              <option value="300000">Cada 5 min (default)</option>
              <option value="60000">Cada 1 min</option>
              <option value="30000">Cada 30 s</option>
              <option value="15000">Cada 15 s</option>
              <option value="5000">Cada 5 s</option>
              <option value="0">Pausar auto-refresh</option>
            </select>

            {/* Selector de tiendas */}
            <select
              className="input w-full sm:w-auto min-w-0 max-w-full"
              value={shopId}
              onChange={handleShopChange}
              title="Selecciona tienda"
            >
              {shopsLoading && (
                <option value={shopId}>Cargando tiendas…</option>
              )}
              {!shopsLoading && shops.length === 0 && (
                <option value={shopId}>— sin tiendas —</option>
              )}
              {!shopsLoading &&
                shops.map((s) => {
                  const id = String(s.shop_id ?? s.id ?? "");
                  const name = s.shop_name || s.name || id;
                  return (
                    <option key={id} value={id}>
                      {name} · {id}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>

        {shopsErr && (
          <div className="text-red-600 text-sm mt-2">
            {typeof shopsErr === "string" ? shopsErr : JSON.stringify(shopsErr)}
          </div>
        )}

        {/* Stats + lista de robots */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-start mt-6">
          <div aria-live="polite" className="min-w-0">
            <Stat
              label="API"
              value={
                loading ? "Cargando…" : online ? "🟢 Online" : "🔴 Offline"
              }
            />
            {updatedAt && (
              <div className="text-xs text-foreground/60 mt-1">
                Última actualización: {updatedAt.toLocaleTimeString()}
              </div>
            )}
            <Countdown enabled={enabled} pollMs={pollMs} ts={data?.ts} />
          </div>

          <div className="min-w-0">
            <Stat label="Robots disponibles" value={robotsCount} />
          </div>

          <div className="min-w-0">
            <Stat label="Latencia" value={formatLatency(latencyMs)} />
          </div>

          <div className="min-w-0 flex sm:justify-end">
            <Button
              onClick={refetch}
              className="min-w-[140px]"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Actualizando…
                </span>
              ) : (
                "Actualizar"
              )}
            </Button>
          </div>

          {/* Lista de robots con imagen + label */}
          <div className="sm:col-span-2 lg:col-span-4 min-w-0">
            <h3 className="text-sm font-medium mb-2">Robots en la tienda</h3>

            {robots.length ? (
              <div className="card-response max-h-72 overflow-auto rounded-xl p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {robots.map((rb, i) => {
                    const isCC1 = rb.productKey === "cc1";
                    const isDelivery = isDeliveryKey(rb.productKey);

                    // destino de navegación
                    const navTarget = isCC1
                      ? "/admin/apicc"
                      : isDelivery
                      ? `/admin/apibella`
                      : null;

                    return (
                      <figure
                        key={`${rb.productKey || "x"}-${rb.sn || i}`}
                        className={`bg-card/60 rounded-xl p-2 flex flex-col items-center text-center ${
                          navTarget ? "cursor-pointer" : ""
                        }`}
                        title={rb.label}
                        onClick={() => {
                          if (navTarget) navigate(navTarget);
                        }}
                        tabIndex={navTarget ? 0 : -1}
                        role={navTarget ? "button" : undefined}
                        onKeyDown={(e) => {
                          if (
                            navTarget &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            navigate(navTarget);
                          }
                        }}
                      >
                        {rb.img ? (
                          <img
                            src={rb.img}
                            alt={
                              rb.productKey
                                ? `Imagen de ${rb.productKey}`
                                : `Imagen de ${rb.productRaw}`
                            }
                            className="w-full h-24 object-contain select-none"
                            loading="lazy"
                            onError={(ev) => {
                              ev.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center rounded-lg bg-muted/40 text-xs text-foreground/60 select-none">
                            sin imagen
                          </div>
                        )}
                        <figcaption className="mt-2 text-xs break-words">
                          <div className="font-medium">
                            {rb.productRaw || "—"}
                          </div>
                          <div className="text-foreground/60">
                            {rb.sn || "—"}
                          </div>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs text-foreground/60">
                No hay robots para esta tienda.
              </div>
            )}
          </div>

          {data?.errMsg && (
            <div className="card-response sm:col-span-2 lg:col-span-4">
              <strong>Detalle:</strong>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {typeof data.errMsg === "string"
                  ? data.errMsg
                  : JSON.stringify(data.errMsg, null, 2)}
              </pre>
            </div>
          )}
        </section>
      </Card>
    </div>
  );
}
