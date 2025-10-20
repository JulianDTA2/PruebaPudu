import React, { useEffect, useState, useRef, useMemo } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { get } from "../services/api";

function toUnixSeconds(d) {
  return Math.floor(new Date(d).getTime() / 1000);
}

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

// ===== Defaults Logs =====
const DEFAULT_TZ_OFFSET = 8; // hours
const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 10;

// ===== Defaults Cam =====
const DEFAULT_CAM_BASE = "http://192.168.68.169";
const STREAM_PORT = 81; // stream fijo del firmware
const STREAM_FPS = 15; // fps para dibujar/recordar

export default function Logs() {
  // --- Filtros visibles (Logs) ---
  const [shopId, setShopId] = useState(""); // obligatorio
  const shopIdRef = useRef(shopId);
  useEffect(() => {
    shopIdRef.current = shopId;
  }, [shopId]);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [startTime, setStartTime] = useState(
    yesterday.toISOString().slice(0, 19)
  );
  const [endTime, setEndTime] = useState(now.toISOString().slice(0, 19));

  // --- Estado de lista (Logs) ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const listReqIdRef = useRef(0);

  // --- Detalle (Logs) ---
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const detailReqIdRef = useRef(0);

  // --- Tiendas (Logs) ---
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setShopsLoading(true);
        setShopsErr(null);
        const data = await get("/data-open-platform-service/v1/api/shop", {
          limit: 100,
          offset: 0,
        });
        const list = data?.data?.list || data?.list || [];
        setShops(list);
        if (!shopId && list.length) {
          const firstId = String(list[0]?.shop_id ?? list[0]?.id ?? "");
          setShopId(firstId);
          shopIdRef.current = firstId;
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

  function handleShopChange(e) {
    const v = e.target.value;
    setShopId(v);
    shopIdRef.current = v;
    fetchList(v);
  }

  const [camBase, setCamBase] = useState(DEFAULT_CAM_BASE);

  const streamUrl = useMemo(() => {
    try {
      const u = new URL(camBase);
      return `${u.protocol}//${u.hostname}:${STREAM_PORT}/stream`;
    } catch {
      const base = camBase.replace(/\/$/, "");
      const host = base.replace(/^(\w+:\/\/)/, "").replace(/:\d+$/, "");
      const proto = base.startsWith("https://") ? "https://" : "http://";
      return `${proto}${host}:${STREAM_PORT}/stream`;
    }
  }, [camBase]);

  const camUrl = (p) => `${camBase.replace(/\/$/, "")}${p}`;

  const [camLoading, setCamLoading] = useState(false);
  const [camError, setCamError] = useState(null);
  const [camStatus, setCamStatus] = useState(null);

  const [streamOn, setStreamOn] = useState(false);

  const imgRef = useRef(null); // fuente MJPEG
  const canvasRef = useRef(null); // display y grabación
  const drawTimerRef = useRef(null);

  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const snapshotBlobRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const lastVideoBlobRef = useRef(null);

  const isMixedBlocked =
    typeof window !== "undefined" &&
    window.location?.protocol === "https:" &&
    camBase.startsWith("http:");

  function resizeCanvasToBox() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawFrame() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    resizeCanvasToBox();
    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch {
      // si aún no hay frame, ignorar
    }
  }

  function startDrawingLoop() {
    stopDrawingLoop();
    drawTimerRef.current = setInterval(drawFrame, 1000 / STREAM_FPS);
  }
  function stopDrawingLoop() {
    if (drawTimerRef.current) {
      clearInterval(drawTimerRef.current);
      drawTimerRef.current = null;
    }
  }

  function startStream() {
    setCamError(null);
    setStreamOn(true);
    const im = imgRef.current;
    if (im) {
      im.crossOrigin = "anonymous"; // para permitir dibujo en canvas
      im.src = streamUrl + `?t=${Date.now()}`; // cache-bust
      im.onload = () => drawFrame();
    }
    startDrawingLoop();
  }

  function stopStream() {
    setStreamOn(false);
    stopDrawingLoop();
    const im = imgRef.current;
    if (im) im.src = "";
  }

  async function fetchCamStatus() {
    try {
      setCamLoading(true);
      setCamError(null);
      setCamStatus(null);
      const res = await fetch(camUrl("/status"), { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCamStatus(json);
    } catch (e) {
      setCamError(e.message || String(e));
    } finally {
      setCamLoading(false);
    }
  }

  async function takeSnapshot() {
    setCamError(null);
    // si el stream está activo, captura desde el canvas
    if (streamOn && canvasRef.current) {
      await new Promise((r) => setTimeout(r, 50));
      const blob = await new Promise((resolve) => {
        // fallback para navegadores sin toBlob
        if (!canvasRef.current.toBlob) {
          try {
            const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);
            const b = atob(dataUrl.split(",")[1]);
            const arr = new Uint8Array(b.length);
            for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
            return resolve(new Blob([arr], { type: "image/jpeg" }));
          } catch {
            return resolve(null);
          }
        }
        canvasRef.current.toBlob((b) => resolve(b), "image/jpeg", 0.92);
      });
      if (blob) {
        snapshotBlobRef.current = blob;
        setSnapshotUrl(URL.createObjectURL(blob));
      } else {
        setCamError("No se pudo generar la captura desde el canvas.");
      }
      return;
    }
    // si no hay stream, usa /capture del firmware
    try {
      const u = camUrl(`/capture?t=${Date.now()}`);
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      snapshotBlobRef.current = blob;
      setSnapshotUrl(URL.createObjectURL(blob));
    } catch (e) {
      setCamError(e.message || String(e));
    }
  }

  async function camControl(varName, val) {
    try {
      setCamError(null);
      const url = camUrl(
        `/control?var=${encodeURIComponent(varName)}&val=${encodeURIComponent(
          val
        )}`
      );
      const r = await fetch(url, { method: "GET" });
      if (!r.ok)
        throw new Error(`Control ${varName}=${val} → HTTP ${r.status}`);
    } catch (e) {
      setCamError(e.message || String(e));
    }
  }

  function startRecording() {
    if (!canvasRef.current) return;
    setCamError(null);
    const stream =
      canvasRef.current.captureStream?.(STREAM_FPS) ||
      canvasRef.current.mozCaptureStream?.(STREAM_FPS);
    if (!stream) {
      setCamError("Tu navegador no soporta captureStream en canvas.");
      return;
    }
    let mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
    if (!mime) {
      setCamError("MediaRecorder no soportado para WebM en este navegador.");
      return;
    }
    recordedChunksRef.current = [];
    lastVideoBlobRef.current = null;
    try {
      const mr = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      });
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        lastVideoBlobRef.current = blob;
      };
      mediaRecorderRef.current = mr;
      mr.start(250); // timeslice
      setIsRecording(true);
    } catch (e) {
      setCamError(e.message || String(e));
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecording(false);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Nuevo: guardar SOLO video
  function saveVideo() {
    if (!lastVideoBlobRef.current) {
      setCamError("No hay un video grabado para guardar.");
      return;
    }
    const fname = `cam-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    downloadBlob(lastVideoBlobRef.current, fname);
  }
  async function savePhoto() {
    try {
      if (!snapshotBlobRef.current) {
        await takeSnapshot();
      }
      if (!snapshotBlobRef.current) {
        setCamError("No hay una foto disponible para guardar.");
        return;
      }
      const fname = `snapshot-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.jpg`;
      downloadBlob(snapshotBlobRef.current, fname);
    } catch (e) {
      setCamError(e.message || String(e));
    }
  }

  useEffect(() => {
    // limpieza al desmontar
    return () => {
      stopDrawingLoop();
      stopRecording();
      const im = imgRef.current;
      if (im) im.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-12 isolate">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Reportes de Limpieza (Logs)
            {(loading || shopsLoading) && <Spinner />}
          </h2>
          <p className="text-sm text-foreground/60 mt-1">
            Consulta los reportes de limpieza.
          </p>

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
                {shopsLoading && (
                  <option value="">{shopId || "Cargando tiendas…"}</option>
                )}
                {!shopsLoading && shops.length === 0 && (
                  <option value="">— sin tiendas —</option>
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
              {shopsErr && (
                <div className="text-xs text-red-600 mt-1">
                  {String(shopsErr)}
                </div>
              )}
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
                        <tr
                          key={row.report_id || i}
                          className="odd:bg-card/40 hover:bg-card/60"
                        >
                          <td className="p-3 font-mono text-xs break-words">
                            <span className="cell-header">report_id:</span>{" "}
                            {row.report_id}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">task_name:</span>{" "}
                            {row.task_name}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">sn:</span> {row.sn}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">start_time:</span>{" "}
                            {row.start_time
                              ? new Date(row.start_time * 1000).toLocaleString()
                              : "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">end_time:</span>{" "}
                            {row.end_time
                              ? new Date(row.end_time * 1000).toLocaleString()
                              : "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">clean_area:</span>{" "}
                            {row.clean_area ?? row.task_area ?? "-"}
                          </td>
                          <td className="p-3">
                            <span className="cell-header">status:</span>{" "}
                            {row.status}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  fetchDetail(row.sn, row.report_id)
                                }
                              >
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
              <div className="text-sm text-foreground/60">
                No hay resultados. Ejecuta una consulta.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* FILA 2: Detalle */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <Card className="xl:col-span-12 isolate">
          <h3 className="text-lg font-semibold">Detalle seleccionado</h3>
          {detailError && (
            <div className="text-red-600 neu-lg p-3 rounded-lg mt-2">
              {String(detailError)}
            </div>
          )}
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

      {/* FILA 3: CÁMARA */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        <Card className="xl:col-span-12 isolate">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Cámara</h3>
            {camLoading && <Spinner />}
          </div>
          <p className="text-sm text-foreground/60 mt-1">
            Stream en vivo, capturas y controles básicos desde módulo ESP32-CAM.
          </p>

          {/* Config rápida */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-foreground/60">
                Base URL
              </label>
              <input
                className="input w-full"
                value={camBase}
                onChange={(e) => setCamBase(e.target.value)}
                placeholder="http://192.168.68.169"
              />
              {isMixedBlocked && (
                <div className="text-xs text-amber-600 mt-1">
                  El navegador puede bloquear el stream por contenido mixto
                  (HTTPS→HTTP).
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 flex-wrap">
              <Button
                onClick={startStream}
                disabled={streamOn || isMixedBlocked}
              >
                Ver stream
              </Button>
              <Button onClick={stopStream} disabled={!streamOn}>
                Detener
              </Button>
              <Button onClick={takeSnapshot}>Foto</Button>
              <Button onClick={savePhoto}>Guardar foto</Button>
              <Button onClick={fetchCamStatus}>Estado</Button>
              <a
                className="btn inline-flex items-center justify-center px-3 py-2 rounded-lg neu"
                href={camUrl("/")}
                target="_blank"
                rel="noreferrer"
              >
                Abrir UI
              </a>
            </div>
          </div>

          {/* Vista */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Vista en vivo</h4>
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-black/40 flex items-center justify-center relative">
                {/* canvas visible */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ display: "block" }}
                />
                {/* img fuente MJPEG oculta */}
                <img
                  ref={imgRef}
                  alt="Stream MJPEG"
                  crossOrigin="anonymous"
                  style={{ display: "none" }}
                />
                {isRecording && (
                  <div className="absolute top-2 left-2 text-xs bg-red-600/80 text-white px-2 py-1 rounded-md">
                    ● Grabando
                  </div>
                )}
                {!streamOn && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-foreground/60 p-4 text-center">
                    Pulsa <span className="font-medium mx-1">Ver stream</span>{" "}
                    para iniciar.
                  </div>
                )}
              </div>
              {/* Controles de grabación */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  onClick={startRecording}
                  disabled={!streamOn || isRecording}
                >
                  Empezar a grabar
                </Button>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  disabled={!isRecording}
                >
                  Detener grabación
                </Button>
                <Button onClick={saveVideo}>Guardar video</Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Última captura</h4>
              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-black/40 flex items-center justify-center">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt="Snapshot"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-foreground/60 p-4 text-center">
                    Toma una foto con <span className="font-medium">Foto</span>{" "}
                    o usa <span className="font-medium">Guardar foto</span>.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controles básicos */}
          <div className="mt-6">
            <h4 className="font-medium">Controles</h4>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-foreground/60">
                  Brillo (−2 a 2)
                </label>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  defaultValue={0}
                  className="w-full"
                  onChange={(e) => camControl("brightness", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-foreground/60">
                  Contraste (−2 a 2)
                </label>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  defaultValue={0}
                  className="w-full"
                  onChange={(e) => camControl("contrast", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-foreground/60">
                  Saturación (−2 a 2)
                </label>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  defaultValue={0}
                  className="w-full"
                  onChange={(e) => camControl("saturation", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="hmirror"
                  type="checkbox"
                  onChange={(e) =>
                    camControl("hmirror", e.target.checked ? 1 : 0)
                  }
                />
                <label htmlFor="hmirror" className="text-sm text-foreground/80">
                  Flip horizontal
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="vflip"
                  type="checkbox"
                  onChange={(e) =>
                    camControl("vflip", e.target.checked ? 1 : 0)
                  }
                />
                <label htmlFor="vflip" className="text-sm text-foreground/80">
                  Flip vertical
                </label>
              </div>
              <div>
                <label className="block text-sm text-foreground/60">
                  LED intensidad (0–255)
                </label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  defaultValue={0}
                  className="w-full"
                  onChange={(e) => camControl("led_intensity", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Estado */}
          <div className="mt-6">
            {camError && (
              <div className="text-red-600 text-sm neu-lg p-3 rounded-lg">
                {String(camError)}
              </div>
            )}
            {camStatus && (
              <div className="mt-3 overflow-auto">
                <JsonView className="card-response" data={camStatus} />
              </div>
            )}
            {!camStatus && !camError && (
              <div className="text-sm text-foreground/60">
                Pulsa <span className="font-medium">Estado</span> para ver
                parámetros actuales.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
