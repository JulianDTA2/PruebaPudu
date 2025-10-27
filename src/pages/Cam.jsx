// src/pages/Cam.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { get } from "../services/api";

// === MQTT loader (dinámico) ===
async function loadMqttConnect() {
  const mod = await import(/* @vite-ignore */ "mqtt");
  const connectFn = mod?.connect || mod?.default?.connect;
  return connectFn;
}

// ===== Utilidades =====
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
const MQTT_REQUEST_FPS_DEFAULT = 12; // fps del modo pull enviando 'snap'

// ===== Grabación y almacenamiento =====
const RECORDING_MAX_MS = 25 * 60 * 60 * 1000; // 25 horas
const RECORDING_SLICE_MS = 10_000; // 10 s por segmento (menos carga en IndexedDB)
// Preferir VP8 por compatibilidad (Windows, reproductores comunes)
const VIDEO_MIME_PREFERRED = "video/webm;codecs=vp8";
const VIDEO_BPS = 1_200_000; // ~1.2 Mbps
const IDB_NAME = "CamMqttDB";
const IDB_VERSION = 1;
const IDB_STORE = "chunks";

/** IndexedDB helpers */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "ts" }); // ts = clave primaria
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbTx(db, mode = "readonly") {
  const tx = db.transaction(IDB_STORE, mode);
  return [tx, tx.objectStore(IDB_STORE)];
}
async function idbAddChunk(db, record) {
  return new Promise((resolve, reject) => {
    const [tx, store] = idbTx(db, "readwrite");
    const req = store.add(record);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const [tx, store] = idbTx(db, "readwrite");
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
async function idbIterAsc(db, onItem) {
  return new Promise((resolve, reject) => {
    const [tx, store] = idbTx(db, "readonly");
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        Promise.resolve(onItem(cursor.value, cursor))
          .then(() => {
            cursor.continue();
          })
          .catch(reject);
      } else {
        resolve(true);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
async function idbCountAndBytes(db) {
  let count = 0;
  let bytes = 0;
  await idbIterAsc(db, async (rec) => {
    count++;
    bytes += rec.sizeBytes || 0;
  });
  return { count, bytes };
}

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
      if (myReq !== listReqIdRef.current) return;
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
      if (myReq !== detailReqIdRef.current) return;
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

  // ===== Captura (última foto MQTT) =====
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
  const mqttQueueRef = useRef([]); // cola de frames
  const mqttPlayingRef = useRef(false);

  // ===== Grabación (siempre ON) =====
  const [isRecordingMqtt, setIsRecordingMqtt] = useState(false);
  const mqttMediaRecorderRef = useRef(null);

  // Sesiones y anillo
  const dbRef = useRef(null);
  const ringTotalMsRef = useRef(0); // duración acumulada
  const ringIndexRef = useRef([]); // { ts, durationMs, sizeBytes }
  const lastKeyRef = useRef(0); // clave monótonica
  const recSessionIdRef = useRef(""); // id de la sesión actual
  const recMimeRef = useRef(""); // mime de la sesión
  const recChunkIdxRef = useRef(0); // índice de chunk en la sesión

  const [storageInfo, setStorageInfo] = useState({
    count: 0,
    bytes: 0,
    persisted: false,
  });

  // Stream ON/OFF local (para estado)
  const [mqttStreamOn, setMqttStreamOn] = useState(false);

  // Modo pull (snap loop)
  const [mqttPullMode, setMqttPullMode] = useState(true);
  const [mqttRequestFps, setMqttRequestFps] = useState(
    MQTT_REQUEST_FPS_DEFAULT
  );
  const mqttSnapIntervalRef = useRef(null);

  // === Utiles de frames ===
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
    if (mqttQueueRef.current.length > 0) scheduleNextMqttFrame();
    else mqttPlayingRef.current = false;
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

  // === MQTT conexión (auto) ===
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
        connectTimeout: 6000,
        clientId,
        reconnectPeriod: 2000, // auto-reintento
      });
      mqttClientRef.current = c;
      setMqttState("conectando…");

      c.on("connect", () => {
        setMqttState("conectado");
        c.subscribe(topicAll, { qos: 0 }, (err) => {
          if (err) setMqttErr(String(err));
        });
        // Auto-stream:
        stopSnapLoop();
        if (mqttPullMode) startSnapLoop();
        else c.publish(topicCmd, "stream_on", { qos: 0 });
        setMqttStreamOn(true);
        // Asegurar grabación
        const mr = mqttMediaRecorderRef.current;
        const active = mr && mr.state !== "inactive";
        if (!active) startRecordingMqtt();
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
  function startMqttStream() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") {
      setMqttErr("Conéctate primero al broker.");
      return;
    }
    if (mqttPullMode) startSnapLoop();
    else c.publish(topicCmd, "stream_on", { qos: 0 });
    setMqttStreamOn(true);
  }
  function stopMqttStream() {
    const c = mqttClientRef.current;
    if (!c || mqttState !== "conectado") {
      setMqttErr("Conéctate primero al broker.");
      return;
    }
    if (mqttPullMode) stopSnapLoop();
    else c.publish(topicCmd, "stream_off", { qos: 0 });
    setMqttStreamOn(false);
  }

  // ===== Grabación SIEMPRE ENCENDIDA + anillo 25 h en IndexedDB =====
  async function ensurePersistentStorage() {
    try {
      const pers = await navigator.storage?.persist?.();
      return !!pers;
    } catch {
      return false;
    }
  }
  async function initRecordingDB() {
    if (!dbRef.current) {
      dbRef.current = await idbOpen();
      // reconstruir índice y duración acumulada
      ringIndexRef.current = [];
      ringTotalMsRef.current = 0;
      await idbIterAsc(dbRef.current, async (rec) => {
        ringIndexRef.current.push({
          ts: rec.ts,
          durationMs: rec.durationMs,
          sizeBytes: rec.sizeBytes || 0,
        });
        ringTotalMsRef.current += rec.durationMs || 0;
      });
      // clave monótonica
      lastKeyRef.current = ringIndexRef.current.length
        ? ringIndexRef.current[ringIndexRef.current.length - 1].ts
        : Date.now();

      const { count, bytes } = await idbCountAndBytes(dbRef.current);
      setStorageInfo((s) => ({ ...s, count, bytes }));
    }
  }

  async function addChunkAndRotate(blob) {
    if (!dbRef.current) return;

    // ts monótonico
    let ts = Date.now();
    if (ts <= lastKeyRef.current) ts = lastKeyRef.current + 1;
    lastKeyRef.current = ts;

    let rec = {
      ts,
      sessionId: recSessionIdRef.current,
      idx: recChunkIdxRef.current++,
      mime: recMimeRef.current || VIDEO_MIME_PREFERRED,
      durationMs: RECORDING_SLICE_MS,
      sizeBytes: blob.size,
      blob,
    };

    // add con reintento si colisión de clave
    try {
      await idbAddChunk(dbRef.current, rec);
    } catch (err) {
      const msg = String(err?.message || err);
      if (err?.name === "ConstraintError" || /Key already exists/i.test(msg)) {
        ts = lastKeyRef.current + 1;
        lastKeyRef.current = ts;
        rec = { ...rec, ts };
        await idbAddChunk(dbRef.current, rec);
      } else {
        throw err;
      }
    }

    ringIndexRef.current.push({
      ts: rec.ts,
      durationMs: rec.durationMs,
      sizeBytes: rec.sizeBytes,
    });
    ringTotalMsRef.current += rec.durationMs;

    // Rotación: borrar lo que exceda 25 h
    while (
      ringTotalMsRef.current > RECORDING_MAX_MS &&
      ringIndexRef.current.length > 0
    ) {
      const oldest = ringIndexRef.current.shift();
      try {
        await idbDelete(dbRef.current, oldest.ts);
      } catch {}
      ringTotalMsRef.current -= oldest.durationMs || 0;
    }

    if (Math.random() < 0.25) {
      const { count, bytes } = await idbCountAndBytes(dbRef.current);
      setStorageInfo((s) => ({ ...s, count, bytes }));
    }
  }

  function pickSupportedMime() {
    if (MediaRecorder.isTypeSupported(VIDEO_MIME_PREFERRED))
      return VIDEO_MIME_PREFERRED;
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9"))
      return "video/webm;codecs=vp9";
    if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
    return "";
  }

  function startRecordingMqtt() {
    // Evitar duplicados
    if (
      mqttMediaRecorderRef.current &&
      mqttMediaRecorderRef.current.state !== "inactive"
    )
      return;

    const canvas = mqttCanvasRef.current;
    if (!canvas) return;
    const stream =
      canvas.captureStream?.(MQTT_PLAYBACK_FPS) ||
      canvas.mozCaptureStream?.(MQTT_PLAYBACK_FPS);
    if (!stream) {
      setMqttErr("Tu navegador no soporta captureStream en canvas.");
      return;
    }

    const mime = pickSupportedMime();
    if (!mime) {
      setMqttErr("MediaRecorder no soportado para WebM en este navegador.");
      return;
    }

    try {
      // Nueva sesión
      recSessionIdRef.current = `rec-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      recMimeRef.current = mime;
      recChunkIdxRef.current = 0;

      const mr = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: VIDEO_BPS,
      });
      mr.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          try {
            await addChunkAndRotate(e.data);
          } catch (err) {
            setMqttErr(`Error guardando segmento: ${err?.message || err}`);
          }
        }
      };
      mr.onstop = () => {
        setIsRecordingMqtt(false);
      };
      mqttMediaRecorderRef.current = mr;
      mr.start(RECORDING_SLICE_MS); // segmentos de 10 s
      setIsRecordingMqtt(true);
    } catch (e) {
      setMqttErr(e?.message || String(e));
    }
  }

  function stopRecordingMqtt() {
    const mr = mqttMediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  function stopRecorderAndWait() {
    return new Promise((resolve) => {
      const mr = mqttMediaRecorderRef.current;
      if (!mr || mr.state === "inactive") {
        setIsRecordingMqtt(false);
        return resolve();
      }
      const onStop = () => {
        mr.removeEventListener("stop", onStop);
        resolve();
      };
      mr.addEventListener("stop", onStop);
      try {
        mr.stop();
      } catch {
        resolve();
      }
    });
  }

  async function exportCurrentSession() {
    try {
      if (!dbRef.current) {
        setMqttErr("Sin base de datos de grabación inicializada.");
        return;
      }

      // 1) Cierre limpio de la sesión actual (emite headers finales del WebM)
      await stopRecorderAndWait();

      const sessionId = recSessionIdRef.current;
      const mime = recMimeRef.current || VIDEO_MIME_PREFERRED;

      // 2) Recolectar SOLO chunks de la sesión cerrada
      const sessionBlobs = [];
      await idbIterAsc(dbRef.current, async (rec) => {
        if (rec.sessionId === sessionId) sessionBlobs.push(rec.blob);
      });

      if (!sessionBlobs.length) {
        setMqttErr("No hay datos de la sesión actual para exportar.");
        // Reanudar grabación
        startRecordingMqtt();
        return;
      }

      // 3) Crear el WebM exportable y descargar
      const big = new Blob(sessionBlobs, { type: mime });
      const fname = `cam-mqtt-${sessionId}.webm`;
      downloadBlob(big, fname);

      // 4) Reanudar grabación en NUEVA sesión
      startRecordingMqtt();
    } catch (e) {
      setMqttErr(e?.message || String(e));
    }
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

  // Limpieza general + auto-inicio
  useEffect(() => {
    (async () => {
      const persisted = await ensurePersistentStorage();
      setStorageInfo((s) => ({ ...s, persisted }));
      await initRecordingDB();
      await connectMqtt();

      // Asegurar que hay un canvas antes de iniciar grabación (sin duplicar)
      const tryStart = () => {
        const mr = mqttMediaRecorderRef.current;
        const active = mr && mr.state !== "inactive";
        if (!active) startRecordingMqtt();
      };
      const id = setInterval(tryStart, 1500);
      setTimeout(() => {
        clearInterval(id);
      }, 12_000);
    })();

    return () => {
      clearTimeout(mqttTimerRef.current);
      mqttQueueRef.current.forEach((f) => f?.close && f.close());
      mqttQueueRef.current = [];
      stopSnapLoop();
      disconnectMqtt();
      stopRecordingMqtt();

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
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Cámara por MQTT (WSS)</h3>
          </div>
          <p className="text-sm text-foreground/60 mt-1">
            Conexión automática + grabación continua con rotación de 25 horas
            (en IndexedDB). Exporta la <b>sesión actual</b> con cierre limpio
            para que el video sea reproducible.
          </p>

          {/* MQTT (WSS) */}
          <div className="mt-4 rounded-xl border border-border/50 p-3">
            <h4 className="font-medium mb-2">Conexión y control</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-end gap-2 flex-wrap">
                <Button
                  onClick={connectMqtt}
                  disabled={mqttState === "conectado"}
                >
                  Conectar
                </Button>
                <Button
                  onClick={disconnectMqtt}
                  disabled={
                    mqttState === "desconectado" || !mqttClientRef.current
                  }
                >
                  Desconectar
                </Button>
                <Button onClick={sendSnap} disabled={mqttState !== "conectado"}>
                  Pedir foto
                </Button>
                <Button
                  onClick={startMqttStream}
                  disabled={mqttState !== "conectado" || mqttStreamOn}
                >
                  Stream ON
                </Button>
                <Button
                  onClick={stopMqttStream}
                  disabled={mqttState !== "conectado" || !mqttStreamOn}
                >
                  Stream OFF
                </Button>
              </div>

              <div className="min-w-0">
                <div className="text-sm">
                  Estado: <span className="font-medium">{mqttState}</span>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <label className="text-xs sm:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mqttPullMode}
                      onChange={(e) => {
                        setMqttPullMode(e.target.checked);
                        if (mqttState === "conectado") {
                          stopSnapLoop();
                          if (e.target.checked) startSnapLoop();
                          else
                            mqttClientRef.current?.publish(
                              topicCmd,
                              "stream_on",
                              { qos: 0 }
                            );
                          setMqttStreamOn(true);
                        }
                      }}
                    />
                    <span>
                      Modo pull por <code>snap</code>
                    </span>
                  </label>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs">FPS:</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input w-20"
                      value={mqttRequestFps}
                      onChange={(e) =>
                        setMqttRequestFps(
                          Number(e.target.value) || MQTT_REQUEST_FPS_DEFAULT
                        )
                      }
                    />
                  </div>
                </div>

                <div className="mt-2 text-xs text-foreground/70">
                  Grabando:{" "}
                  <span className="font-medium">
                    {isRecordingMqtt ? "Sí" : "No"}
                  </span>{" "}
                  · Chunks:{" "}
                  <span className="font-medium ml-1">{storageInfo.count}</span>{" "}
                  · Tamaño aprox:{" "}
                  <span className="font-medium ml-1">
                    {(storageInfo.bytes / (1024 * 1024)).toFixed(1)} MB
                  </span>{" "}
                  · Persistente:{" "}
                  <span className="font-medium ml-1">
                    {storageInfo.persisted ? "Sí" : "No"}
                  </span>
                </div>

                {mqttErr && (
                  <div className="text-xs text-red-600 mt-2">
                    {String(mqttErr)}
                  </div>
                )}
                {lastMqttMsg && <div className="mt-2 overflow-auto"></div>}
              </div>
            </div>
          </div>

          {/* Vista MQTT */}
          <div className="mt-6">
            <h4 className="font-medium mb-2">Vista por MQTT (WSS)</h4>
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-black/40 flex items-center justify-center relative">
              <canvas
                ref={mqttCanvasRef}
                className="w-full h-full"
                style={{ display: "block" }}
              />
              {isRecordingMqtt && (
                <div className="absolute top-2 left-2 text-xs bg-red-600/80 text-white px-2 py-1 rounded-md">
                  ● Grabando (25h buffer)
                </div>
              )}
              {mqttState !== "conectado" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-foreground/60 p-4 text-center">
                  Conectando automáticamente… si no arranca, pulsa{" "}
                  <span className="font-medium mx-1">Conectar</span>.
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Exporta con cierre limpio de la sesión actual */}
              <Button onClick={exportCurrentSession}>
                Exportar sesión actual (cierre limpio)
              </Button>
              {/* Foto puntual */}
              <Button
                onClick={() => {
                  if (!snapshotBlobRef.current) {
                    setMqttErr("No hay una foto disponible todavía.");
                    return;
                  }
                  const fname = `snapshot-mqtt-${new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-")}.jpg`;
                  const url = URL.createObjectURL(snapshotBlobRef.current);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = fname;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1500);
                }}
              >
                Guardar foto
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
