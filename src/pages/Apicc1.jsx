// src/pages/Apicc.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { get, post } from "../services/api.js";
import NeumorphicModal from "../components/NeumorphicModal.jsx";

const PRODUCT_OPTS = ["cleanbot", "mt1", "mt1Pro", "mt1Max"];
const MODE_OPTS = [
  { v: 1, label: "1 · Manual task" },
  { v: 2, label: "2 · Automatic task" },
  { v: 3, label: "3 · Inspection/Mixed" },
];

function statusLabel(n) {
  return (
    {
      0: "0 · Not started / Default",
      1: "1 · In mission",
      2: "2 · Paused",
      3: "3 · Interrupted",
      4: "4 · Ended",
      5: "5 · Abnormal",
      6: "6 · Canceled",
    }[n] ?? String(n ?? "-")
  );
}

function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" aria-hidden="true" role="img" focusable="false">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
    </svg>
  );
}

function TopProgressBar({ percent = 0 }) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1.5 bg-slate-200/70 backdrop-blur-sm">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        role="progressbar"
        aria-label="Progreso de limpieza"
      />
    </div>
  );
}

function MissionBadge({ status, label, percent }) {
  function colorClasses(s) {
    switch (s) {
      case 1: return { chip: "bg-emerald-600 text-white border-emerald-700", dot: "bg-emerald-300" };
      case 2: return { chip: "bg-amber-500 text-black border-amber-600", dot: "bg-amber-200" };
      case 3:
      case 5: return { chip: "bg-red-600 text-white border-red-700", dot: "bg-red-300" };
      default: return { chip: "bg-slate-600 text-white border-slate-700", dot: "bg-slate-300" };
    }
  }
  const cl = colorClasses(status);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`shadow-lg border rounded-2xl px-4 py-3 flex items-center gap-3 ${cl.chip}`} aria-live="polite" aria-atomic="true">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${cl.dot}`} />
        <div className="text-sm font-medium whitespace-nowrap">{label}</div>
        <div className="text-sm tabular-nums">{Math.round(percent)}%</div>
      </div>
    </div>
  );
}

/** Tarjeta intermedia con animación (modo húmedo/seco) */
function CleaningProcessCard({ mode = "dry" }) {
  const CSS_BASE = `
    .segment { stroke: rgba(0, 0, 0, 0); stroke-width: 10; stroke-linecap: round; }
    .joint { fill: rgba(122, 164, 186, 1); stroke-width: 5px; }
    #mir { scale: -0.25; }
    .arm { filter: url("#metaball"); scale: 0.25; transform-origin: 250px 250px; animation: rotate 31s ease-in-out infinite; }
    @keyframes rotate {
      0% { transform: rotate(-90deg); }
      25% { transform: rotate(360deg); }
      50% { transform: rotate(90deg); }
      75% { transform: rotate(-360deg); }
      100% { transform: rotate(-90deg); }
    }
    .arm1 { transform-origin: 300px 200px; animation: rotate 23s ease-in-out infinite; }
    .arm2 { transform-origin: 400px 200px; animation: rotate 17s ease-in-out infinite; }
    .arm3 { transform-origin: 490px 200px; animation: rotate 11s ease-in-out infinite; }
  `;
  const CSS_WET = `${CSS_BASE} .joint { fill: rgba(122,164,186,1); }`;
  const CSS_DRY = `${CSS_BASE} .joint { fill: rgba(155,129,81,1); }`;

  return (
    <Card className="lg:col-span-4 min-w-0">
      <h2 className="break-words">Proceso de limpieza ({mode === "wet" ? "Húmedo" : "Seco"})</h2>
      <div className="mt-3 w-full overflow-hidden">
        <style>{mode === "wet" ? CSS_WET : CSS_DRY}</style>
        <svg viewBox="0 0 500 500" aria-label={`Animación de proceso de limpieza modo ${mode}`}>
          <g className="arm">
            <line className="segment" x1="250" y1="250" x2="300" y2="250"></line>
            <circle className="joint" cx="250" cy="250" r="64"></circle>
            <g className="arm1">
              <line className="segment" x1="300" y1="250" x2="400" y2="250"></line>
              <circle className="joint" cx="300" cy="250" r="30"></circle>
              <g className="arm2">
                <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                <circle className="joint" cx="400" cy="250" r="24"></circle>
                <g className="arm3">
                  <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                  <circle className="joint" cx="490" cy="250" r="16"></circle>
                </g>
              </g>
              <g className="arm1">
                <line className="segment" x1="300" y1="250" x2="400" y2="250"></line>
                <circle className="joint" cx="300" cy="250" r="30"></circle>
                <g className="arm2">
                  <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                  <circle className="joint" cx="400" cy="250" r="8"></circle>
                  <g className="arm3">
                    <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                    <circle className="joint" cx="490" cy="250" r="8"></circle>
                  </g>
                  <g className="arm2">
                    <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                    <circle className="joint" cx="400" cy="250" r="8"></circle>
                    <g className="arm3">
                      <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                      <circle className="joint" cx="490" cy="250" r="8"></circle>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g id="mir" className="arm">
            <line className="segment" x1="250" y1="250" x2="300" y2="250"></line>
            <circle className="joint" cx="250" cy="250" r="64"></circle>
            <g className="arm1">
              <line className="segment" x1="300" y1="250" x2="400" y2="250"></line>
              <circle className="joint" cx="300" cy="250" r="30"></circle>
              <g className="arm2">
                <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                <circle className="joint" cx="400" cy="250" r="24"></circle>
                <g className="arm3">
                  <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                  <circle className="joint" cx="490" cy="250" r="16"></circle>
                </g>
              </g>
              <g className="arm1">
                <line className="segment" x1="300" y1="250" x2="400" y2="250"></line>
                <circle className="joint" cx="300" cy="250" r="30"></circle>
                <g className="arm2">
                  <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                  <circle className="joint" cx="400" cy="250" r="8"></circle>
                  <g className="arm3">
                    <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                    <circle className="joint" cx="490" cy="250" r="8"></circle>
                  </g>
                  <g className="arm2">
                    <line className="segment" x1="400" y1="250" x2="490" y2="250"></line>
                    <circle className="joint" cx="400" cy="250" r="8"></circle>
                    <g className="arm3">
                      <line className="segment" x1="490" y1="250" x2="550" y2="250"></line>
                      <circle className="joint" cx="490" cy="250" r="8"></circle>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
          <filter id="metaball">
            <feGaussianBlur in="SourceGraphic" stdDeviation="17" result="blur"></feGaussianBlur>
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 100 -7" result="fluid"></feColorMatrix>
            <feComposite in="SourceGraphic" in2="fluid" operator="atop"></feComposite>
          </filter>
        </svg>
      </div>
    </Card>
  );
}

export default function Apicc() {
  // Explorer (reservado)
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/cleanbot-service/v1/api/open/task/list");
  const [query, setQuery] = useState("shop_id=451170001");
  const [body, setBody] = useState("{}");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  async function run() {
    try {
      setErr(null);
      const params = Object.fromEntries(new URLSearchParams(query));
      const data = method === "GET" ? await get(path, params) : await post(path, JSON.parse(body || "{}"));
      setRes(data);
    } catch (e) {
      setErr(e?.response?.data || e?.message);
      showError(e, "Error al ejecutar consulta manual");
    }
  }

  // Estados
  const [shopId, setShopId] = useState("451170001");
  const [sn, setSn] = useState("");
  const [productFilter, setProductFilter] = useState([]);     
  const [modeFilter, setModeFilter] = useState([]);              
  const [collaborative, setCollaborative] = useState("");      
  const [taskItems, setTaskItems] = useState([]);
  const [crons, setCrons] = useState([]);
  const [robotDetail, setRobotDetail] = useState(null);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTaskVersion, setSelectedTaskVersion] = useState("");
  const [selectedMapName, setSelectedMapName] = useState("");
  const [selectedCronId, setSelectedCronId] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");

  const [supplyScale, setSupplyScale] = useState(150);
  const [loadingLists, setLoadingLists] = useState(false);
  const [execRes, setExecRes] = useState(null);
  const [execErr, setExecErr] = useState(null);
  const [execLoading, setExecLoading] = useState(false);

  // Auto refresh & polling unificado
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(5000);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);

  // Popups UX
  const processRef = useRef(null);
  const [startPopupOpen, setStartPopupOpen] = useState(false); 
  const [pausePopupOpen, setPausePopupOpen] = useState(false);

  const detailReqIdRef = useRef(0);

  const shopIdRef = useRef(shopId);
  useEffect(() => { shopIdRef.current = shopId; }, [shopId]);
  const skipNextRobotsEffectRef = useRef(false);

  const [processMode, setProcessMode] = useState(null); // 'wet' | 'dry' | null
  const [cleaningActive, setCleaningActive] = useState(false);

  function detectWetFromTask(task) {
    const isOpen = Boolean(task?.cleanagent_config?.isopen);
    const scale = Number(task?.cleanagent_config?.scale ?? 0);
    return isOpen || scale > 0;
  }
  function detectWetFromDetail(detail) {
    const cfg = detail?.cleanbot?.clean?.result?.cleanagent_config;
    const isOpen = Boolean(cfg?.isopen);
    const scale = Number(cfg?.scale ?? 0);
    return isOpen || scale > 0;
  }

  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);

  function shopLabel(s) {
    return `${s.shop_id} — ${s.shop_name || s.name || s.alias || s.nickname || "Tienda"}`;
  }

  async function loadShops() {
    try {
      setShopsLoading(true);
      setShopsErr(null);
      const limit = 100;
      let offset = 0;
      let all = [];
      let loops = 0;
      const MAX_LOOPS = 20;
      while (loops < MAX_LOOPS) {
        const data = await get("/data-open-platform-service/v1/api/shop", { limit, offset });
        const list = data?.data?.list || [];
        all = all.concat(list);
        if (list.length < limit) break;
        offset += limit;
        loops++;
      }
      const seen = new Set();
      const unique = all.filter((s) => {
        const id = String(s?.shop_id ?? "");
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      unique.sort((a, b) => String(a.shop_id).localeCompare(String(b.shop_id)));
      setShops(unique);
      if (unique.length && !unique.some((s) => String(s.shop_id) === String(shopId))) {
        const first = String(unique[0].shop_id);
        setShopId(first);
        shopIdRef.current = first; 
      }
    } catch (e) {
      setShopsErr(e?.response?.data || e?.message || "Error al cargar tiendas");
      showError(e, "Error al cargar tiendas");
    } finally {
      setShopsLoading(false);
    }
  }

  useEffect(() => { loadShops();}, []);

  const [robots, setRobots] = useState([]);
  const [robotsLoading, setRobotsLoading] = useState(false);
  const [robotsErr, setRobotsErr] = useState(null);
  const robotValidationCache = useRef(new Map());
  const robotsReqIdRef = useRef(0);

  function robotLabel(r) {
    const nick = r.nickname || r.name || r.alias || "";
    const prod = r.product_code || r.product || "";
    return `${r.sn}${nick ? " — " + nick : ""}${prod ? " · " + prod : ""}`;
  }

  async function validateRobotSN(sn) {
    if (robotValidationCache.current.has(sn)) return robotValidationCache.current.get(sn);
    try {
      const resp = await get("/cleanbot-service/v1/api/open/robot/detail", { sn });
      const code = resp?.code ?? resp?.data?.code;
      const msg = (resp?.message || resp?.data?.message || "").toString();
      const ok = typeof code === "number" ? code === 0 : /success/i.test(msg);
      const value = { ok };
      robotValidationCache.current.set(sn, value);
      return value;
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.code || e?.message || "";
      const reason = msg === "CLEANBOT_ROBOT_NO_EXISTS" ? "NO_EXISTS" : String(msg || "ERROR");
      const value = { ok: false, reason };
      robotValidationCache.current.set(sn, value);
      return value;
    }
  }

  async function mapWithConcurrency(items, mapper, concurrency = 6) {
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await mapper(items[i], i);
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  async function loadRobots(currentShopId) {
    const reqId = ++robotsReqIdRef.current;
    if (!currentShopId) { setRobots([]); setSn(""); return; }
    try {
      setRobotsLoading(true); setRobotsErr(null);
      const limit = 100; let offset = 0; let all = []; let loops = 0; const MAX_LOOPS = 30;
      while (loops < MAX_LOOPS) {
        const params = { limit, offset, shop_id: currentShopId };
        if (Array.isArray(productFilter) && productFilter.length) params.product_code = productFilter.join(",");
        const data = await get("/data-open-platform-service/v1/api/robot", params);
        const list = data?.data?.list || []; all = all.concat(list);
        if (list.length < limit) break; offset += limit; loops++;
      }
      const seen = new Set();
      const unique = all.filter((r) => { const id = String(r?.sn ?? ""); if (!id || seen.has(id)) return false; seen.add(id); return true; });
      const validations = await mapWithConcurrency(unique, async (r) => { const v = await validateRobotSN(String(r.sn)); return { robot: r, valid: v.ok }; }, 6);
      if (robotsReqIdRef.current !== reqId) return;
      const onlyValid = validations.filter((x) => x.valid).map((x) => x.robot);
      onlyValid.sort((a, b) => String(a.sn).localeCompare(String(b.sn)));
      setRobots(onlyValid);
      if (!onlyValid.some((r) => String(r.sn) === String(sn))) setSn(onlyValid[0]?.sn || "");
    } catch (e) {
      setRobotsErr(e?.response?.data || e?.message || "Error al cargar máquinas");
      showError(e, "Error al cargar máquinas");
    } finally { setRobotsLoading(false); }
  }

  const handleShopChange = (e) => {
    const v = e.target.value;
    setShopId(v);
    shopIdRef.current = v;
    skipNextRobotsEffectRef.current = true;
    loadRobots(v);
  };

  useEffect(() => {
    if (skipNextRobotsEffectRef.current) {
      skipNextRobotsEffectRef.current = false;
      return;
    }
    loadRobots(shopId);
  }, [shopId, JSON.stringify(productFilter)]);

  const mapOptions = useMemo(() => {
    const set = new Set();
    taskItems.forEach((t) => (t.floor_list || []).forEach((fl) => fl?.map?.name && set.add(fl.map.name)));
    return Array.from(set);
  }, [taskItems]);

  const pointOptions = useMemo(() => {
    const out = [];
    taskItems.forEach((t) => {
      if (t?.back_point?.point_id) out.push({ id: t.back_point.point_id, label: `BackPoint · ${t.back_point.point_name || t.back_point.point_id}` });
      if (t?.station_config?.id) out.push({ id: t.station_config.id, label: `Station · ${t.station_config.station_name || t.station_config.id}` });
    });
    const seen = new Set();
    return out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [taskItems]);

  const selectedTask = useMemo(() => taskItems.find((t) => t.task_id === selectedTaskId), [taskItems, selectedTaskId]);

  const [confirmState, setConfirmState] = useState(null);
  function askConfirm({ title, message, confirmText = "Confirmar", cancelText = "Cancelar" }) {
    return new Promise((resolve) => setConfirmState({ title, message, confirmText, cancelText, resolve }));
  }
  const [alertState, setAlertState] = useState(null);

  function parseErr(e) {
    const d = e?.response?.data;
    if (typeof d === "string") return d;
    return d?.message ?? d?.code ?? e?.message ?? (typeof e === "string" ? e : JSON.stringify(e));
  }

  // ⚠️ ahora marca el estado con variant="error"
  function showError(e, title = "Ocurrió un error") {
    const message = typeof e === "string" ? e : parseErr(e);
    setAlertState({ title, message, variant: "error" });
  }

  // ✅ nuevo helper para warnings
  function showWarning(msg, title = "Aviso") {
    const message = typeof msg === "string" ? msg : String(msg ?? "");
    setAlertState({ title, message, variant: "warning" });
  }

  async function loadTasks() {
    try {
      setLoadingLists(true); setExecErr(null); setExecRes(null);
      const params = sn ? { sn } : { shop_id: shopId };
      if (productFilter.length) params.product_code = productFilter;
      if (modeFilter.length) params.mode = modeFilter.map(Number);
      if (collaborative) params.collaborative = Number(collaborative);
      const data = await get("/cleanbot-service/v1/api/open/task/list", params);
      const items = data?.data?.item || []; setTaskItems(items);
      if (items.length) { setSelectedTaskId(items[0].task_id || ""); setSelectedTaskVersion(String(items[0].version || "")); }
      else { setSelectedTaskId(""); setSelectedTaskVersion(""); }
      const firstMap = items.flatMap((t) => t.floor_list || []).map((fl) => fl?.map?.name).find(Boolean); if (firstMap) setSelectedMapName(firstMap);
      const firstPoint = items.find((t) => t?.back_point?.point_id)?.back_point?.point_id || items.find((t) => t?.station_config?.id)?.station_config?.id || ""; if (firstPoint) setSelectedPointId(firstPoint);
    } catch (e) { setExecErr(e?.response?.data || e?.message); showError(e, "Error al cargar lista de tareas"); }
    finally { setLoadingLists(false); }
  }

  async function loadCrons() {
    if (!sn) { const msg = "Ingresa el SN para cargar cron/list."; setExecErr(msg); showError(msg, "Falta SN"); return; }
    try { setLoadingLists(true); setExecErr(null); setExecRes(null); const data = await get("/cleanbot-service/v1/api/open/cron/list", { sn }); const list = data?.data?.list || []; setCrons(list); setSelectedCronId(list[0]?.cron_id || ""); }
    catch (e) { setExecErr(e?.response?.data || e?.message); showError(e, "Error al cargar tareas programadas"); }
    finally { setLoadingLists(false); }
  }

  async function loadRobotDetail() {
    // 🔶 este bloque ahora dispara un WARNING (no error)
    if (!sn) {
      const msg = "Recuerda seleccionar un Robot SN y cargar las tareas.";
      setExecErr(msg);
      showWarning(msg, "Recordatorio");
      return;
    }
    const myReq = ++detailReqIdRef.current;
    try {
      setExecErr(null); setExecRes(null);
      const data = await get("/cleanbot-service/v1/api/open/robot/detail", { sn });
      if (myReq !== detailReqIdRef.current) return;
      const detail = data?.data || null; setRobotDetail(detail);
      setLastUpdated(new Date().toLocaleTimeString());
      const m = detail?.map?.name; if (m) setSelectedMapName((prev) => prev || m);
    }
    catch (e) { if (myReq !== detailReqIdRef.current) return; setExecErr(e?.response?.data || e?.message); showError(e, "Error al cargar detalles del robot"); }
  }

  function stopPolling() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }
  function startPolling(ms) {
    stopPolling();
    if (autoRefresh) loadRobotDetail();
    pollRef.current = setInterval(() => { if (autoRefresh) loadRobotDetail(); }, Math.max(500, Number(ms) || 1000));
  }
  useEffect(() => { return () => stopPolling(); }, []);
  useEffect(() => {
    stopPolling();
    if (!autoRefresh) return;
    const interval = cleaningActive ? 1000 : refreshMs;
    startPolling(interval);
  }, [autoRefresh, cleaningActive, refreshMs, sn]);

  function ensureTaskSelected() {
    if (!selectedTaskId || !selectedTaskVersion) { const msg = "Selecciona una tarea (task_id y version) antes de ejecutar."; setExecErr(msg); showError(msg, "Falta tarea"); return false; }
    return true;
  }
  async function handleExec(fn) { try { setExecLoading(true); await fn(); } finally { setExecLoading(false); } }
  async function refreshNow() { await loadRobotDetail(); }

  async function sendExec(type, status, extraClean = {}) {
    if (!sn) { const msg = "Debes especificar el SN del robot."; setExecErr(msg); showError(msg, "Falta SN"); return; }
    if (!ensureTaskSelected()) return;
    try {
      setExecErr(null); setExecRes(null);
      const payload = { sn, type, clean: { status, task_id: selectedTaskId, version: Number(selectedTaskVersion), ...extraClean } };
      const data = await post("/cleanbot-service/v1/api/open/task/exec", payload);
      setExecRes(data);

      // === UX extra según acción ===
      if (type === 3 && status === 1) {
        setStartPopupOpen(true);
        setTimeout(() => setStartPopupOpen(false), 2000);
        setTimeout(() => { processRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
      }
      if (type === 3 && status === 3) {
        setPausePopupOpen(true);
        setTimeout(() => setPausePopupOpen(false), 2000);
      }

      await refreshNow();
    } catch (e) { setExecErr(e?.response?.data || e?.message); showError(e, "Error al ejecutar comando"); }
  }

  // Acciones
  const startCharging = () => handleExec(() => sendExec(1, 1, selectedPointId ? { point_id: selectedPointId } : {}));
  const pauseCharging = () => handleExec(() => sendExec(1, 3));
  const cancelCharging = () => handleExec(async () => { const ok = await askConfirm({ title: "Cancelar carga", message: "¿Seguro que deseas cancelar la carga actual?", confirmText: "Sí, cancelar" }); if (!ok) return; await sendExec(1, 4); });

  const startCleaning = () => handleExec(async () => { await sendExec(3, 1); });
  const pauseCleaning = () => handleExec(async () => { await sendExec(3, 3); });
  const cancelCleaning = () => handleExec(async () => { const ok = await askConfirm({ title: "Cancelar limpieza", message: "Esto detendrá la misión de limpieza en curso.", confirmText: "Sí, cancelar" }); if (!ok) return; await sendExec(3, 4); });

  const startSupply = () => handleExec(() => sendExec(4, 1, { cleanagent_scale: Number(supplyScale), ...(selectedPointId ? { point_id: selectedPointId } : {}) }));
  const pauseSupply = () => handleExec(() => sendExec(4, 3));
  const cancelSupply = () => handleExec(async () => { const ok = await askConfirm({ title: "Cancelar suministro", message: "Se cancelará el suministro de detergente.", confirmText: "Sí, cancelar" }); if (!ok) return; await sendExec(4, 4); });

  const oneKeyReturn = () => handleExec(() => sendExec(5, 1));
  const goHomePoint = () => handleExec(() => sendExec(6, 1, selectedPointId ? { point_id: selectedPointId } : {}));
  const switchMap = () => { if (!selectedMapName) { const msg = "Selecciona un map_name para cambiar."; setExecErr(msg); showError(msg, "Falta mapa"); return; } return handleExec(() => sendExec(9, 1, { map_name: selectedMapName })); };
  const openCron = () => { if (!selectedCronId) { const msg = "Selecciona un cron_id."; setExecErr(msg); showError(msg, "Falta cron_id"); return; } return handleExec(() => sendExec(10, 1, { cron_id: selectedCronId })); };
  const closeCron = () => { if (!selectedCronId) { const msg = "Selecciona un cron_id."; setExecErr(msg); showError(msg, "Falta cron_id"); return; } return handleExec(() => sendExec(10, 3, { cron_id: selectedCronId })); };

  const mission = useMemo(() => {
    const status = robotDetail?.cleanbot?.clean?.result?.status ?? null;
    const percentage = Number(robotDetail?.cleanbot?.clean?.result?.percentage ?? 0);
    return { status, label: statusLabel(status), percentage };
  }, [robotDetail]);

  useEffect(() => {
    const isActive = mission.status === 1;
    setCleaningActive(Boolean(isActive));
    if (isActive) {
      const wet = detectWetFromDetail(robotDetail) || detectWetFromTask(selectedTask);
      setProcessMode(wet ? "wet" : "dry");
    } else {
      setProcessMode(null);
    }
  }, [mission.status, robotDetail, selectedTask]);

  function resetAdvancedFilters() {
    setProductFilter([]);
    setModeFilter([]);
    setCollaborative("");
  }

  // UI
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6 min-h-screen">
      {cleaningActive && <TopProgressBar percent={mission.percentage} />}
      {cleaningActive && <MissionBadge status={mission.status} label={mission.label} percent={mission.percentage} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <Card className="lg:col-span-12 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="break-words">Panel de control</h2>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="accent-emerald-600" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto-refresh (desmarcar para pausar)
              </label>
              {execLoading && <Spinner />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4 min-w-0">
            <Button onClick={loadTasks} disabled={loadingLists}>
              {loadingLists ? (<><Spinner /> Cargando…</>) : "Cargar Lista de Tareas"}
            </Button>
            <Button onClick={loadCrons} disabled={!sn || loadingLists}>Cargar Tareas Programadas</Button>
            <Button onClick={loadRobotDetail} disabled={!sn}>Cargar Detalles del Robot</Button>
            {robotDetail && (
              <span className="text-sm text-slate-600" aria-live="polite">
                Estado: {mission.label} · Progreso: {mission.percentage}%
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
           
            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Tienda</label>
              <select className="input w-full min-w-0" value={shopId} onChange={handleShopChange} aria-label="Seleccionar tienda">
                {shopsLoading && <option>Cargando tiendas…</option>}
                {shopsErr && <option value="">Error cargando tiendas</option>}
                {!shopsLoading && !shopsErr && shops.length === 0 && <option value="">-- sin tiendas --</option>}
                {!shopsLoading && !shopsErr && shops.map((s) => (<option key={s.shop_id} value={String(s.shop_id)}>{shopLabel(s)}</option>))}
              </select>

              <label className="block text-sm text-slate-500 mt-2">Robot SN</label>
              <select className="input w-full min-w-0" value={sn} onChange={(e) => setSn(e.target.value)} aria-label="Seleccionar robot SN">
                {robotsLoading && <option>Cargando máquinas…</option>}
                {robotsErr && <option value="">Error cargando máquinas</option>}
                {!robotsLoading && !robotsErr && robots.length === 0 && <option value="">-- sin máquinas válidas --</option>}
                {!robotsLoading && !robotsErr && robots.map((r) => (<option key={r.sn} value={r.sn}>{robotLabel(r)}</option>))}
              </select>
            </div>

            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Tarea</label>
              <select
                className="input max-w-full break-words"
                value={`${selectedTaskId}::${selectedTaskVersion}`}
                onChange={(e) => {
                  const [tid, ver] = e.target.value.split("::");
                  setSelectedTaskId(tid || "");
                  setSelectedTaskVersion(ver || "");
                }}
                aria-label="Seleccionar tarea"
              >
                {taskItems.length === 0 && <option value="">-- sin tareas --</option>}
                {taskItems.map((t) => (
                  <option key={t.task_id} value={`${t.task_id}::${t.version || ""}`}>
                    {(t.name || t.task_id) + " · v" + (t.version || "-")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Mapa</label>
              <select className="input max-w-full break-words" value={selectedMapName} onChange={(e) => setSelectedMapName(e.target.value)} aria-label="Seleccionar mapa">
                {mapOptions.length === 0 && <option value="">-- sin mapas --</option>}
                {mapOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>

              <label className="block text-sm text-slate-500 mt-2">Punto de Retorno</label>
              <select className="input max-w-full break-words" value={selectedPointId} onChange={(e) => setSelectedPointId(e.target.value)} aria-label="Seleccionar punto de retorno">
                {pointOptions.length === 0 && <option value="">-- sin puntos --</option>}
                {pointOptions.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
              </select>

              <label className="block text-sm text-slate-500 mt-2">Tarea Programada</label>
              <select className="input max-w-full break-words" value={selectedCronId} onChange={(e) => setSelectedCronId(e.target.value)} aria-label="Seleccionar cron">
                {crons.length === 0 && <option value="">-- sin cron --</option>}
                {crons.map((c) => (
                  <option key={c.cron_id} value={c.cron_id}>
                    {c.cron_id} — {String(c.hour).padStart(2, "0")}:{String(c.minute).padStart(2, "0")} — {(c.weeks || []).join(",")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3 min-w-0">
              <div className="font-medium">Carga</div>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button onClick={startCharging} disabled={!sn || execLoading}>Iniciar carga</Button>
                <Button onClick={pauseCharging} disabled={!sn || execLoading}>Pausar</Button>
                <Button onClick={cancelCharging} disabled={!sn || execLoading}>Cancelar</Button>
              </div>

              <hr className="my-3" />
              <div className="font-medium">Suministro</div>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button onClick={startSupply} disabled={!sn || execLoading}>Iniciar</Button>
                <Button onClick={pauseSupply} disabled={!sn || execLoading}>Pausar</Button>
                <Button onClick={cancelSupply} disabled={!sn || execLoading}>Cancelar</Button>
              </div>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="font-medium">Limpieza</div>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button onClick={startCleaning} disabled={!sn || execLoading}>Iniciar</Button>
                <Button onClick={pauseCleaning} disabled={!sn || execLoading}>Pausar</Button>
                <Button onClick={cancelCleaning} disabled={!sn || execLoading}>Cancelar</Button>
              </div>

              <hr className="my-3" />
              <div className="font-medium">Retorno / Mapas & Cron</div>
              <div className="flex flex-wrap gap-2 min-w-0">
                <Button className="max-w-full whitespace-normal break-words text-left" onClick={oneKeyReturn} disabled={!sn || execLoading}>
                  Retorno en un Click
                </Button>
                <Button className="max-w-full whitespace-normal break-words text-left" onClick={goHomePoint} disabled={!sn || execLoading}>
                  Ir a punto
                </Button>
                <Button className="max-w-full whitespace-normal break-words text-left" onClick={() => sendExec(9, 1, { map_name: selectedMapName })} disabled={!sn || !selectedMapName || execLoading}>
                  Cambiar mapa
                </Button>
                <Button className="max-w-full whitespace-normal break-words text-left" onClick={() => sendExec(10, 1, { cron_id: selectedCronId })} disabled={!sn || !selectedCronId || execLoading}>
                  Abrir Cron
                </Button>
                <Button className="max-w-full whitespace-normal break-words text-left" onClick={() => sendExec(10, 3, { cron_id: selectedCronId })} disabled={!sn || !selectedCronId || execLoading}>
                  Cerrar Cron
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Producto</label>
              <select
                className="input w-full min-w-0"
                value={productFilter[0] || ""}
                onChange={(e) => setProductFilter(e.target.value ? [e.target.value] : [])}
                aria-label="Filtrar por producto"
              >
                <option value="">— ninguno (default) —</option>
                {PRODUCT_OPTS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Modo</label>
              <select
                className="input w-full min-w-0"
                value={modeFilter[0] != null ? String(modeFilter[0]) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setModeFilter(v ? [Number(v)] : []);
                }}
                aria-label="Filtrar por modo"
              >
                <option value="">— ninguno (default) —</option>
                {MODE_OPTS.map((m) => (<option key={m.v} value={m.v}>{m.label}</option>))}
              </select>
            </div>

            <div className="space-y-3 min-w-0">
              <label className="block text-sm text-slate-500">Colaborativo</label>
              <select
                className="input w-full min-w-0"
                value={collaborative}
                onChange={(e) => setCollaborative(e.target.value)}
                aria-label="Modo colaborativo"
              >
                <option value="">— ninguno (default) —</option>
                <option value="1">1 · Scan first, wash later</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <Button className="btn-ghost" onClick={resetAdvancedFilters}>Restablecer filtros</Button>
          </div>
        </Card>
      </div>

      <div ref={processRef} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 mt-6">
        <Card className="lg:col-span-4 min-w-0">
          <h2 className="break-words">Detalles del Robot</h2>
          <div className="mt-3" aria-live="polite">
            {!robotDetail && <div className="text-sm text-slate-500">Sin datos. Pulsa “Cargar Detalles del Robot”.</div>}
            {robotDetail && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1 text-sm">
                  <div><b>Nickname:</b> {robotDetail.nickname}</div>
                  <div><b>SN:</b> {sn}</div>
                  <div><b>Online:</b> {String(robotDetail.online)}</div>
                  <div><b>Batería:</b> {robotDetail.battery}%</div>
                  <div><b>Mapa actual:</b> {robotDetail.map?.name} (lv {robotDetail.map?.lv ?? "-"})</div>
                  <div><b>Estado tarea:</b> {mission.label}</div>
                  <div><b>Progreso:</b> {mission.percentage + "%"}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {cleaningActive && processMode && <CleaningProcessCard mode={processMode} />}

        <Card className="lg:col-span-4 min-w-0">
          <h2 className="break-words">Detalle de la tarea seleccionada</h2>
          {!selectedTask ? (
            <div className="text-sm text-slate-500 mt-2">Selecciona una tarea de la lista.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mt-2">
              <div className="text-sm space-y-1">
                <div><b>Nombre:</b> {selectedTask.name}</div>
                <div><b>task_id:</b> {selectedTask.task_id}</div>
                <div><b>version:</b> {selectedTask.version}</div>
                <div><b>status:</b> {selectedTask.status}</div>
                <div><b>task_mode:</b> {selectedTask.task_mode ?? "-"}</div>
                <div><b>pre_clean_time:</b> {selectedTask.pre_clean_time ?? "-"}</div>
                <div><b>is_single_task:</b> {String(selectedTask.is_single_task)}</div>
                <div><b>is_area_connect:</b> {String(selectedTask.is_area_connect)}</div>
                <div><b>station:</b> {selectedTask.station_config?.station_name || "-"}</div>
                <div><b>cleanagent.isopen:</b> {String(selectedTask.cleanagent_config?.isopen)}</div>
                <div><b>cleanagent.scale:</b> {selectedTask.cleanagent_config?.scale ?? "-"}</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* MODALES */}
      <NeumorphicModal
        open={!!confirmState}
        title={confirmState?.title}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        onCancel={() => { confirmState?.resolve(false); setConfirmState(null); }}
        onConfirm={() => { confirmState?.resolve(true); setConfirmState(null); }}
        solidBackdrop
      >
        {confirmState?.message}
      </NeumorphicModal>

      <NeumorphicModal
        open={!!alertState}
        title={alertState?.title}
        confirmText="Cerrar"
        hideCancel
        variant={alertState?.variant || "error"}
        onConfirm={() => setAlertState(null)}
        onCancel={() => setAlertState(null)}
        solidBackdrop
      >
        <div className="whitespace-pre-wrap break-words">{alertState?.message}</div>
      </NeumorphicModal>

      <NeumorphicModal
        open={startPopupOpen}
        title="Limpieza iniciada"
        confirmText="Cerrar"
        hideCancel
        variant="success"
        onConfirm={() => setStartPopupOpen(false)}
        onCancel={() => setStartPopupOpen(false)}
        solidBackdrop
      >
        La limpieza ha comenzado correctamente.
      </NeumorphicModal>

      <NeumorphicModal
        open={pausePopupOpen}
        title="Limpieza pausada"
        confirmText="Cerrar"
        hideCancel
        variant="success"
        onConfirm={() => setPausePopupOpen(false)}
        onCancel={() => setPausePopupOpen(false)}
        solidBackdrop
      >
        La limpieza se ha pausado correctamente.
      </NeumorphicModal>
    </div>
  );
}
