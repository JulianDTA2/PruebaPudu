// src/pages/Logs.jsx (MQTT only)
import React, { useEffect, useState, useRef, useMemo } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { get } from "../services/api";

// === MQTT loader (dinámico) ===
// Evita problemas de export en Vite al importar 'mqtt' (UMD/ESM)
async function loadMqttConnect() {
  const mod = await import(/* @vite-ignore */ "mqtt");
  const connectFn = mod?.connect || mod?.default?.connect;
  return connectFn;
}

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

// ===== MQTT video =====
const MQTT_PLAYBACK_FPS = 12; // fps de reproducción del canvas MQTT
const MQTT_REQUEST_FPS_DEFAULT = 6; // fps del modo pull enviando 'snap'

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

  // ===== Captura (para mostrar/guardar última foto que llegue por MQTT) =====
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const snapshotBlobRef = useRef(null);

  // ===== MQTT (WSS) =====
  const [mqttUrl, setMqttUrl] = useState("wss://test.mosquitto.org:8081/mqtt");
  const [deviceId, setDeviceId] = useState("A7C0E8FC"); // tu ID
  const baseTopic = useMemo(
    () => `pudurobotics/devices/${deviceId}`,
    [deviceId]
  );
  const topicCmd = `${baseTopic}/cmd`;
  const topicAll = `${baseTopic}/#`;

  const mqttClientRef = useRef(null);
  const [mqttState, setMqttState] = useState("desconectado");
  const [mqttErr, setMqttErr] = useState(null);
  const [lastMqttMsg, setLastMqttMsg] = useState(null);

  // Canvas / Playback (MQTT video)
  const mqttCanvasRef = useRef(null);
  const mqttTimerRef = useRef(null);
  const mqttQueueRef = useRef([]); // cola de ImageBitmap/HTMLImageElement
  const mqttPlayingRef = useRef(false);

  // Grabación (MQTT video)
  const [isRecordingMqtt, setIsRecordingMqtt] = useState(false);
  const mqttMediaRecorderRef = useRef(null);
  const mqttChunksRef = useRef([]);
  const mqttVideoBlobRef = useRef(null);

  const [mqttStreamOn, setMqttStreamOn] = useState(false); // UI local

  // Modo pull (envía 'snap' en bucle si el firmware no hace push de frames)
  const [mqttPullMode, setMqttPullMode] = useState(true);
  const [mqttRequestFps, setMqttRequestFps] = useState(
    MQTT_REQUEST_FPS_DEFAULT
  );
  const mqttSnapIntervalRef = useRef(null);

  function base64ToBlob(b64, mime = "image/jpeg") {
    try {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch {
      return null;
    }
  }

  function resizeCanvasBox(canvas) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function scheduleNextMqttFrame() {
    clearTimeout(mqttTimerRef.current);
    mqttTimerRef.current = setTimeout(
      drawNextMqttFrame,
      1000 / MQTT_PLAYBACK_FPS
    );
  }

  function drawNextMqttFrame() {
    const canvas = mqttCanvasRef.current;
    if (!canvas) {
      mqttPlayingRef.current = false;
      return;
    }
    const ctx = canvas.getContext("2d");
    const frame = mqttQueueRef.current.shift();
    if (!frame) {
      mqttPlayingRef.current = false;
      return;
    }
    resizeCanvasBox(canvas);
    try {
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    } catch {}
    if (frame.close) {
      try {
        frame.close();
      } catch {}
    }
    if (mqttQueueRef.current.length > 0) {
      scheduleNextMqttFrame();
    } else {
      mqttPlayingRef.current = false;
    }
  }

  async function enqueueMqttFrameFromB64(b64) {
    const blob = base64ToBlob(b64, "image/jpeg");
    if (!blob) return;

    let frameObj = null;
    try {
      frameObj = await createImageBitmap(blob);
    } catch {
      frameObj = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    }
    if (!frameObj) return;

    // limitar cola (drop oldest) para evitar lag
    if (mqttQueueRef.current.length > 6) {
      const old = mqttQueueRef.current.shift();
      if (old && old.close) {
        try {
          old.close();
        } catch {}
      }
    }
    mqttQueueRef.current.push(frameObj);

    if (!mqttPlayingRef.current) {
      mqttPlayingRef.current = true;
      drawNextMqttFrame();
    }
  }

  async function connectMqtt() {
    setMqttErr(null);
    try {
      const mqttConnect = await loadMqttConnect();
      if (!mqttConnect) {
        setMqttErr("No se encontró mqtt.connect. Instala 'npm i mqtt' (v5+).");
        return;
      }
      const clientId = `web-${Math.random().toString(16).slice(2)}`;
      const c = mqttConnect(mqttUrl, {
        clean: true,
        keepalive: 30,
        connectTimeout: 4000,
        clientId,
      });
      mqttClientRef.current = c;
      setMqttState("conectando…");

      c.on("connect", () => {
        setMqttState("conectado");
        c.subscribe(topicAll, { qos: 0 }, (err) => {
          if (err) setMqttErr(String(err));
        });
      });

      c.on("reconnect", () => setMqttState("reconectando…"));
      c.on("close", () => setMqttState("desconectado"));
      c.on("error", (e) => setMqttErr(e?.message || String(e)));

      c.on("message", async (topic, buf) => {
        let payload = buf.toString();
        try {
          payload = JSON.parse(payload);
        } catch {}
        setLastMqttMsg({ topic, payload, at: Date.now() });

        // 1) JSON con { img_b64 }
        if (typeof payload === "object" && payload?.img_b64) {
          const blob = base64ToBlob(payload.img_b64, "image/jpeg");
          if (blob) {
            snapshotBlobRef.current = blob;
            const url = URL.createObjectURL(blob);
            setSnapshotUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          }
          enqueueMqttFrameFromB64(payload.img_b64);
        }

        // 2) Frame directo como base64 (ej: topic .../frame o .../video)
        if (
          typeof payload === "string" &&
          (topic.endsWith("/frame") || topic.endsWith("/video"))
        ) {
          enqueueMqttFrameFromB64(payload);
        }
      });
    } catch (e) {
      setMqttErr(e?.message || String(e));
      setMqttState("desconectado");
    }
  }

  function disconnectMqtt() {
    setMqttErr(null);
    stopSnapLoop();
    const c = mqttClientRef.current;
    if (c) {
      try {
        c.end(true);
      } catch {}
      mqttClientRef.current = null;
    }
    setMqttState("desconectado");
    setMqttStreamOn(false);
  }

  function sendSnap() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") {
      setMqttErr("Conéctate primero al broker.");
      return;
    }
    c.publish(topicCmd, "snap", { qos: 0 });
  }

  // === Pull mode (snap loop) ===
  function startSnapLoop() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") return;
    stopSnapLoop();
    const intervalMs = Math.max(
      50,
      Math.floor(1000 / (mqttRequestFps || MQTT_REQUEST_FPS_DEFAULT))
    );
    mqttSnapIntervalRef.current = setInterval(() => {
      try {
        c.publish(topicCmd, "snap", { qos: 0 });
      } catch {}
    }, intervalMs);
  }
  function stopSnapLoop() {
    if (mqttSnapIntervalRef.current) {
      clearInterval(mqttSnapIntervalRef.current);
      mqttSnapIntervalRef.current = null;
    }
  }

  // Comandos de video: push (firmware) o pull (snap loop)
  function startMqttStream() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") {
      setMqttErr("Conéctate primero al broker.");
      return;
    }
    if (mqttPullMode) {
      startSnapLoop();
    } else {
      c.publish(topicCmd, "stream_on", { qos: 0 });
    }
    setMqttStreamOn(true);
  }
  function stopMqttStream() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") {
      setMqttErr("Conéctate primero al broker.");
      return;
    }
    if (mqttPullMode) {
      stopSnapLoop();
    } else {
      c.publish(topicCmd, "stream_off", { qos: 0 });
    }
    setMqttStreamOn(false);
  }

  // Grabación del canvas MQTT
  function startRecordingMqtt() {
    const canvas = mqttCanvasRef.current;
    if (!canvas) return;
    const stream =
      canvas.captureStream?.(MQTT_PLAYBACK_FPS) ||
      canvas.mozCaptureStream?.(MQTT_PLAYBACK_FPS);
    if (!stream) {
      setMqttErr("Tu navegador no soporta captureStream en canvas.");
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
      setMqttErr("MediaRecorder no soportado para WebM en este navegador.");
      return;
    }
    mqttChunksRef.current = [];
    mqttVideoBlobRef.current = null;
    try {
      const mr = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      });
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mqttChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        mqttVideoBlobRef.current = new Blob(mqttChunksRef.current, {
          type: mime,
        });
      };
      mqttMediaRecorderRef.current = mr;
      mr.start(250);
      setIsRecordingMqtt(true);
    } catch (e) {
      setMqttErr(e?.message || String(e));
    }
  }
  function stopRecordingMqtt() {
    const mr = mqttMediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecordingMqtt(false);
  }
  function saveMqttVideo() {
    if (!mqttVideoBlobRef.current) {
      setMqttErr("No hay un video grabado para guardar.");
      return;
    }
    const fname = `cam-mqtt-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.webm`;
    downloadBlob(mqttVideoBlobRef.current, fname);
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
  function saveMqttPhoto() {
    if (!snapshotBlobRef.current) {
      setMqttErr(
        "No hay una foto disponible (aún no recibimos frame por MQTT)."
      );
      return;
    }
    const fname = `snapshot-mqtt-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.jpg`;
    downloadBlob(snapshotBlobRef.current, fname);
  }

  // Limpieza general
  useEffect(() => {
    return () => {
      // MQTT
      clearTimeout(mqttTimerRef.current);
      mqttQueueRef.current.forEach((f) => f?.close && f.close());
      mqttQueueRef.current = [];
      stopRecordingMqtt();
      stopSnapLoop();
      disconnectMqtt();

      // liberar snapshot
      setSnapshotUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== UI =====
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
    </div>
  );
}
