import React, { useEffect, useState, useRef } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { get } from "../services/api";

function toUnixSeconds(d) {
  return Math.floor(new Date(d).getTime() / 1000);
}

function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
    </svg>
  );
}

// Valores DEFAULT que se enviarán SIEMPRE
const DEFAULT_TZ_OFFSET = 8; // hours
const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 10;

export default function Logs() {
  // --- Filtros visibles ---
  const [shopId, setShopId] = useState(""); // obligatorio
  const shopIdRef = useRef(shopId);
  useEffect(() => { shopIdRef.current = shopId; }, [shopId]);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [startTime, setStartTime] = useState(yesterday.toISOString().slice(0, 19));
  const [endTime, setEndTime] = useState(now.toISOString().slice(0, 19));

  // --- Estado de lista ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // request-id para evitar pisadas en lista
  const listReqIdRef = useRef(0);

  // --- Detalle ---
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // request-id para evitar pisadas en detalle
  const detailReqIdRef = useRef(0);

  // --- Tiendas (para el select) ---
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setShopsLoading(true);
        setShopsErr(null);
        const data = await get("/data-open-platform-service/v1/api/shop", { limit: 100, offset: 0 });
        const list = data?.data?.list || data?.list || [];
        setShops(list);
        if (!shopId && list.length) {
          const firstId = String(list[0]?.shop_id ?? list[0]?.id ?? "");
          setShopId(firstId);
          shopIdRef.current = firstId;
        }
      } catch (e) {
        setShopsErr(e?.response?.data || e?.message || "Error cargando tiendas");
      } finally {
        setShopsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchList(shopIdOverride) {
    const sid = shopIdOverride ?? shopIdRef.current;
    if (!sid) {
      setError("Selecciona una tienda (shop_id) antes de consultar.");
      return;
    }
    const myReq = ++listReqIdRef.current;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const params = {
        start_time: toUnixSeconds(startTime),
        end_time: toUnixSeconds(endTime),
        shop_id: sid,
        offset: DEFAULT_OFFSET,
        limit: DEFAULT_LIMIT,
        timezone_offset: DEFAULT_TZ_OFFSET,
      };
      const res = await get("/data-board/v1/log/clean_task/query_list", params);
      if (myReq !== listReqIdRef.current) return; // evitar pisadas
      setResult(res);
    } catch (e) {
      if (myReq !== listReqIdRef.current) return;
      setError(e?.response?.data || e?.message || String(e));
    } finally {
      if (myReq === listReqIdRef.current) setLoading(false);
    }
  }

  async function fetchDetail(sn, report_id) {
    const myReq = ++detailReqIdRef.current;
    try {
      setSelectedDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      const params = {
        start_time: toUnixSeconds(startTime),
        end_time: toUnixSeconds(endTime),
        sn,
        report_id,
        timezone_offset: DEFAULT_TZ_OFFSET,
      };
      const res = await get("/data-board/v1/log/clean_task/query", params);
      if (myReq !== detailReqIdRef.current) return; // evitar pisadas
      setSelectedDetail(res);
    } catch (e) {
      if (myReq !== detailReqIdRef.current) return;
      setDetailError(e?.response?.data || e?.message || String(e));
    } finally {
      if (myReq === detailReqIdRef.current) setDetailLoading(false);
    }
  }

  // cambio de tienda: actualizar ref y refetch inmediato
  function handleShopChange(e) {
    const v = e.target.value;
    setShopId(v);
    shopIdRef.current = v;
    fetchList(v); // feedback instantáneo
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-12 isolate">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Reportes de Limpieza (Logs)
            {(loading || shopsLoading) && <Spinner />}
          </h2>
          <p className="text-sm text-foreground/60 mt-1">Consulta los reportes de limpieza.</p>

          {/* Filtros visibles */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            {/* shop_id: SELECT obligatorio */}
            <div className="min-w-0">
              <label className="block text-sm text-foreground/60">
                Tienda <span className="text-red-500">*</span>
              </label>
              <select
                className="input w-full min-w-0 max-w-full"
                value={shopId}
                onChange={handleShopChange}
              >
                {shopsLoading && <option value="">{shopId || "Cargando tiendas…"}</option>}
                {!shopsLoading && shops.length === 0 && <option value="">— sin tiendas —</option>}
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
              {shopsErr && <div className="text-xs text-red-600 mt-1">{String(shopsErr)}</div>}
            </div>

            {/* Fechas */}
            <div className="min-w-0">
              <label className="block text-sm text-foreground/60">Inicio</label>
              <input
                type="datetime-local"
                className="input w-full min-w-0 max-w-full"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-sm text-foreground/60">Final</label>
              <input
                type="datetime-local"
                className="input w-full min-w-0 max-w-full"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap items-center gap-3 min-w-0">
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button onClick={() => fetchList()} disabled={loading || !shopId}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Consultando…
                  </span>
                ) : (
                  "Consultar lista"
                )}
              </Button>
              <Button
                onClick={() => {
                  setSelectedDetail(null);
                  setError(null);
                  setResult(null);
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div className="mt-4" aria-live="polite">
            {error && (
              <div className="text-red-600 text-sm neu-lg p-3 rounded-lg">
                {typeof error === "string" ? error : JSON.stringify(error)}
              </div>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-12 isolate">
          <h3 className="text-lg font-semibold">Resultados</h3>
          <div className="mt-3 min-w-0">
            {result?.data ? (
              <div className="table-wrap overflow-x-auto rounded-xl border-border/50">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="text-foreground/60 sticky top-0 bg-card/80 backdrop-blur">
                    <tr className="text-left">
                      <th className="p-3">report_id</th>
                      <th>task_name</th>
                      <th>sn</th>
                      <th>start</th>
                      <th>end</th>
                      <th>area (m²)</th>
                      <th>status</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(result.data.list) &&
                      result.data.list.map((row, i) => (
                        <tr key={row.report_id || i} className="odd:bg-card/40 hover:bg-card/60">
                          <td className="p-3 font-mono text-xs break-words">
                            <span className="cell-header">report_id:</span> {row.report_id}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">task_name:</span> {row.task_name}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">sn:</span> {row.sn}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">start_time:</span>{" "}
                            {row.start_time ? new Date(row.start_time * 1000).toLocaleString() : "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">end_time:</span>{" "}
                            {row.end_time ? new Date(row.end_time * 1000).toLocaleString() : "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">clean_area:</span>{" "}
                            {row.clean_area ?? row.task_area ?? "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">status:</span> {row.status}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => fetchDetail(row.sn, row.report_id)}>
                                Detalle
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-foreground/60">No hay resultados. Ejecuta una consulta.</div>
            )}
          </div>
        </Card>
      </div>

      {/* FILA 2: Detalle */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <Card className="xl:col-span-12 isolate">
          <h3 className="text-lg font-semibold">Detalle seleccionado</h3>
          {detailError && <div className="text-red-600 neu-lg p-3 rounded-lg mt-2">{String(detailError)}</div>}
          {detailLoading && (
            <div className="text-sm text-foreground/60 mt-2 flex items-center gap-2">
              <Spinner /> Cargando detalle…
            </div>
          )}
          {!detailLoading && selectedDetail && (
            <div className="mt-3 overflow-auto">
              <JsonView className="card-response" data={selectedDetail} />
            </div>
          )}
          {!detailLoading && !selectedDetail && (
            <div className="text-sm text-foreground/60 mt-2">
              Selecciona "Detalle" en una fila para ver la información completa.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
