// src/pages/Apibella.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import NeumorphicModal from "../components/NeumorphicModal.jsx";
import { get, post } from "../services/api.js";

// ---------- Utilidades de tiempo para Analytics (segundos UNIX) ----------
const toUnixSec = (d) => Math.floor(new Date(d).getTime() / 1000);
const nowSec = () => Math.floor(Date.now() / 1000);
const daysAgoSec = (n) => nowSec() - n * 24 * 60 * 60;
// timezone_offset: minutos respecto a UTC (positivos al este)
const tzOffsetMinutes = -new Date().getTimezoneOffset();

function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" aria-hidden="true" role="img" focusable="false">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
    </svg>
  );
}

// ===================== Página principal =====================
export default function Apibella() {
  // -------- Explorer manual ----------
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/data-board/v1/analysis/task/delivery");
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("{}");
  const [manualRes, setManualRes] = useState(null);
  const [manualErr, setManualErr] = useState(null);

  // -------- Estado base: tiendas/robots --------
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);
  const [shopId, setShopId] = useState("");

  const [sn, setSn] = useState("");
  const [robots, setRobots] = useState([]);
  const [robotsLoading, setRobotsLoading] = useState(false);
  const [robotsErr, setRobotsErr] = useState(null);

  // -------- Mapas & puntos --------
  const [maps, setMaps] = useState([]);
  const [currentMap, setCurrentMap] = useState(null);
  const [selectedMapName, setSelectedMapName] = useState("");
  const [points, setPoints] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState("");

  // -------- Operaciones (custom_call / doors / recharge) --------
  const [callMode, setCallMode] = useState("CALL"); // IMG | VIDEO | QR | CONFIRM | CALL
  const [modeData, setModeData] = useState("");     // JSON o texto según modo
  const [callTaskId, setCallTaskId] = useState(""); // para cancel/complete
  const [callDeviceName, setCallDeviceName] = useState(""); // p. ej. "kiosk-1"
  const [nextCallTask, setNextCallTask] = useState(""); // encadenar

  // Doors
  const [doorState, setDoorState] = useState(null);
  const [doorRawPayload, setDoorRawPayload] = useState('[{"index":0,"open":true}]');

  // -------- Analytics (delivery) --------
  const [startDate, setStartDate] = useState(new Date(Date.now()-6*24*3600*1000).toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [timeUnit, setTimeUnit] = useState("day"); // day|week|month
  const [groupBy, setGroupBy] = useState("sn");    // sn | shop_id
  const [deliverySummary, setDeliverySummary] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // -------- Ads --------
  const [adsKind, setAdsKind] = useState(""); // opcional
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adSelectedId, setAdSelectedId] = useState("");
  const [adDetail, setAdDetail] = useState(null);
  const [adsBodyJson, setAdsBodyJson] = useState(`{
  "shop_id": "",
  "ad_list": [],
  "scenes": [],
  "start_time": ${Date.now()},
  "end_time": ${Date.now() + 7*24*3600*1000}
}`);

  // -------- UI estados comunes --------
  const [execLoading, setExecLoading] = useState(false);
  const [alertState, setAlertState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  // ---------- Helpers UI ----------
  function parseErr(e) {
    const d = e?.response?.data;
    if (typeof d === "string") return d;
    return d?.message ?? d?.code ?? e?.message ?? (typeof e === "string" ? e : JSON.stringify(e));
  }
  function showError(e, title = "Ocurrió un error") {
    const message = typeof e === "string" ? e : parseErr(e);
    setAlertState({ title, message, variant: "error" });
  }
  function showWarning(msg, title = "Aviso") {
    const message = typeof msg === "string" ? msg : String(msg ?? "");
    setAlertState({ title, message, variant: "warning" });
  }
  function showSuccess(msg, title = "Listo") {
    const message = typeof msg === "string" ? msg : String(msg ?? "");
    setAlertState({ title, message, variant: "success" });
  }

  // ===================== Data Open Platform: Tiendas & Robots =====================
  async function loadShops() {
    try {
      setShopsLoading(true); setShopsErr(null);
      const limit = 100; let offset = 0; let all = []; let loops = 0; const MAX_LOOPS = 20;
      while (loops < MAX_LOOPS) {
        const data = await get("/data-open-platform-service/v1/api/shop", { limit, offset });
        const list = data?.data?.list || [];
        all = all.concat(list);
        if (list.length < limit) break;
        offset += limit; loops++;
      }
      const seen = new Set();
      const uniq = all.filter(s => {
        const id = String(s?.shop_id ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id); return true;
      }).sort((a,b)=>String(a.shop_id).localeCompare(String(b.shop_id)));
      setShops(uniq);
      if (!shopId && uniq[0]?.shop_id) setShopId(String(uniq[0].shop_id));
    } catch (e) {
      setShopsErr(e?.response?.data || e?.message);
      showError(e, "Error al cargar tiendas");
    } finally { setShopsLoading(false); }
  }

  async function loadRobots(currentShopId) {
    if (!currentShopId) { setRobots([]); setSn(""); return; }
    try {
      setRobotsLoading(true); setRobotsErr(null);
      const limit = 100; let offset = 0; let all = []; let loops = 0; const MAX_LOOPS = 30;
      while (loops < MAX_LOOPS) {
        const data = await get("/data-open-platform-service/v1/api/robot", { limit, offset, shop_id: currentShopId });
        const list = data?.data?.list || [];
        all = all.concat(list);
        if (list.length < limit) break;
        offset += limit; loops++;
      }
      const seen = new Set();
      const uniq = all.filter(r => {
        const id = String(r?.sn ?? "");
        if (!id || seen.has(id)) return false;
        seen.add(id); return true;
      }).sort((a,b)=>String(a.sn).localeCompare(String(b.sn)));
      setRobots(uniq);
      if (!uniq.some(r=>String(r.sn)===String(sn))) setSn(uniq[0]?.sn || "");
    } catch (e) {
      setRobotsErr(e?.response?.data || e?.message);
      showError(e, "Error al cargar dispositivos");
    } finally { setRobotsLoading(false); }
  }

  useEffect(()=>{ loadShops(); },[]);
  useEffect(()=>{ if (shopId) loadRobots(shopId); },[shopId]);

  const shopLabel = (s) => `${s.shop_id} — ${s.shop_name || s.name || s.alias || s.nickname || "Tienda"}`;
  const robotLabel = (r) => `${r.sn}${r.nickname ? " — " + r.nickname : ""}${r.product_code ? " · " + r.product_code : ""}`;

  // ===================== Mapas & Puntos =====================
  async function loadMaps() {
    if (!sn) return showWarning("Selecciona un SN para cargar mapas.", "Recordatorio");
    try {
      const list = await get("/map-service/v1/open/list", { sn });
      const items = list?.data?.list || list?.data || [];
      setMaps(items);
    } catch (e) { showError(e, "Error al cargar mapas"); }
  }
  async function loadCurrentMap(needElement = false) {
    if (!sn) return showWarning("Selecciona un SN para cargar el mapa en uso.", "Recordatorio");
    try {
      const data = await get("/map-service/v1/open/current", { sn, need_element: needElement });
      setCurrentMap(data?.data || null);
      if (data?.data?.name) setSelectedMapName(data.data.name);
    } catch (e) { showError(e, "Error al cargar mapa actual"); }
  }
  async function loadPoints(limit = 200, offset = 0) {
    if (!sn) return showWarning("Selecciona un SN para cargar puntos de mapa.", "Recordatorio");
    try {
      const data = await get("/map-service/v1/open/point", { sn, limit, offset });
      const list = data?.data?.list || data?.data || [];
      setPoints(list);
      if (list[0]) setSelectedPoint(list[0].name || list[0].point || list[0].id || "");
    } catch (e) { showError(e, "Error al cargar puntos"); }
  }

  // ===================== Operaciones =====================
  async function callRobot() {
    if (!sn) return showWarning("Debes elegir un SN para hacer la llamada.", "Recordatorio");
    if (!selectedMapName) return showWarning("Selecciona map_name.", "Recordatorio");
    if (!selectedPoint) return showWarning("Selecciona un punto del mapa.", "Recordatorio");
    try {
      setExecLoading(true);
      const payload = {
        sn,
        shop_id: shopId || undefined,
        map_name: selectedMapName,
        point: selectedPoint,
        call_mode: callMode,
        mode_data: modeData ? (()=>{ try{return JSON.parse(modeData);}catch{ return modeData; } })() : undefined,
      };
      const res = await post("/open-platform-service/v1/custom_call", payload);
      setCallTaskId(res?.data?.task_id || res?.data?.id || callTaskId);
      showSuccess("Llamada enviada correctamente.");
    } catch (e) { showError(e, "Error al llamar al robot"); }
    finally { setExecLoading(false); }
  }

  async function cancelCall() {
    if (!callTaskId || !callDeviceName) return showWarning("Completa task_id y call_device_name.", "Faltan datos");
    try {
      setExecLoading(true);
      await post("/open-platform-service/v1/custom_call/cancel", { task_id: callTaskId, call_device_name: callDeviceName });
      showSuccess("Llamada cancelada.");
    } catch (e) { showError(e, "Error al cancelar llamada"); }
    finally { setExecLoading(false); }
  }

  async function completeCall() {
    if (!callTaskId || !callDeviceName) return showWarning("Completa task_id y call_device_name.", "Faltan datos");
    try {
      setExecLoading(true);
      const payload = { task_id: callTaskId, call_device_name: callDeviceName };
      if (nextCallTask) payload.next_call_task = nextCallTask;
      await post("/open-platform-service/v1/custom_call/complete", payload);
      showSuccess("Llamada completada.");
    } catch (e) { showError(e, "Error al completar llamada"); }
    finally { setExecLoading(false); }
  }

  async function rechargeOneClick() {
    if (!sn) return showWarning("Elige un SN para intentar recarga.", "Recordatorio");
    try {
      setExecLoading(true);
      await get("/open-platform-service/v1/recharge", { sn });
      showSuccess("Comando de recarga enviado.");
    } catch (e) { showError(e, "Error al enviar recarga"); }
    finally { setExecLoading(false); }
  }

  async function readDoorState() {
    if (!sn) return showWarning("Elige un SN para consultar cajones.", "Recordatorio");
    try {
      setExecLoading(true);
      const data = await get("/open-platform-service/v1/door_state", { sn });
      setDoorState(data?.data || data);
    } catch (e) { showError(e, "Error al consultar estado de cajones"); }
    finally { setExecLoading(false); }
  }

  async function controlDoors(raw = null) {
    if (!sn) return showWarning("Elige un SN para controlar cajones.", "Recordatorio");
    try {
      setExecLoading(true);
      const payload = { sn, payload: {} };
      let control_states = [];
      if (raw) {
        control_states = raw;
      } else {
        control_states = JSON.parse(doorRawPayload);
      }
      payload.payload.control_states = control_states;
      await post("/open-platform-service/v1/control_doors", payload);
      showSuccess("Comando enviado a cajones.");
    } catch (e) { showError(e, "Error al controlar cajones"); }
    finally { setExecLoading(false); }
  }

  // ===================== Analytics: delivery =====================
  async function loadDeliveryAnalytics() {
    if (!shopId) return showWarning("Selecciona una tienda para analytics.", "Recordatorio");
    try {
      setAnalyticsLoading(true);
      const params = {
        shop_id: shopId,
        start_time: toUnixSec(startDate + "T00:00:00"),
        end_time: toUnixSec(endDate + "T23:59:59"),
        time_unit: timeUnit,
        timezone_offset: tzOffsetMinutes,
        group_by: groupBy
      };
      const data = await get("/data-board/v1/analysis/task/delivery", params);
      setDeliverySummary(data?.data || data);
    } catch (e) { showError(e, "Error al cargar analytics de delivery"); }
    finally { setAnalyticsLoading(false); }
  }

  // ===================== Ads =====================
  async function listAds() {
    if (!shopId && !sn) return showWarning("Ingresa shop_id o SN para listar Ads.", "Recordatorio");
    try {
      setAdsLoading(true);
      const payload = { shop_id: shopId || undefined, sn: sn || undefined, kind: adsKind || undefined, limit: 50, offset: 0 };
      const data = await post("/biz-service/openPlatform/api/v1/gg/list", payload);
      const list = data?.data?.list || data?.data || [];
      setAds(list);
      setAdSelectedId(list[0]?.id || "");
    } catch (e) { showError(e, "Error al listar anuncios"); }
    finally { setAdsLoading(false); }
  }

  async function getAd() {
    if (!shopId || !adSelectedId) return showWarning("shop_id e id son obligatorios.", "Recordatorio");
    try {
      const data = await get("/biz-service/openPlatform/api/v1/gg/get", { shop_id: shopId, id: adSelectedId });
      setAdDetail(data?.data || data);
    } catch (e) { showError(e, "Error al obtener anuncio"); }
  }

  async function createOrUpdateAd(kind) {
    try {
      const payload = JSON.parse(adsBodyJson || "{}");
      if (!payload.shop_id) payload.shop_id = shopId;
      await post(`/biz-service/openPlatform/api/v1/gg/${kind}`, payload); // create | update
      showSuccess(`Anuncio ${kind === "create" ? "creado" : "actualizado"}.`);
    } catch (e) { showError(e, `Error al ${kind === "create" ? "crear" : "actualizar"} anuncio`); }
  }

  async function deleteAd() {
    if (!shopId || !adSelectedId) return showWarning("shop_id e id requeridos para eliminar.", "Recordatorio");
    try {
      await post("/biz-service/openPlatform/api/v1/gg/delete", { shop_id: shopId, id: adSelectedId });
      showSuccess("Anuncio eliminado.");
    } catch (e) { showError(e, "Error al eliminar anuncio"); }
  }

  // ===================== Explorer manual =====================
  async function runManual() {
    try {
      setManualErr(null);
      const params = Object.fromEntries(new URLSearchParams(query));
      const data = method === "GET" ? await get(path, params) : await post(path, JSON.parse(body || "{}"));
      setManualRes(data);
    } catch (e) { setManualErr(e?.response?.data || e?.message || String(e)); showError(e, "Error en consulta manual"); }
  }

  // ===================== Render =====================
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <Card className="lg:col-span-12">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2>Panel de servicio / delivery</h2>
            {execLoading && <Spinner />}
          </div>

          {/* Selección básica */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-500">Tienda</label>
              <select className="input w-full" value={shopId} onChange={(e)=>setShopId(e.target.value)}>
                {shopsLoading && <option>Cargando…</option>}
                {shopsErr && <option>Error cargando</option>}
                {!shopsLoading && !shopsErr && shops.length===0 && <option value="">— sin tiendas —</option>}
                {!shopsLoading && !shopsErr && shops.map(s=>(
                  <option key={s.shop_id} value={String(s.shop_id)}>{shopLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-500">Robot SN</label>
              <select className="input w-full" value={sn} onChange={(e)=>setSn(e.target.value)}>
                {robotsLoading && <option>Cargando…</option>}
                {robotsErr && <option>Error cargando</option>}
                {!robotsLoading && !robotsErr && robots.length===0 && <option value="">— sin dispositivos —</option>}
                {!robotsLoading && !robotsErr && robots.map(r=>(
                  <option key={r.sn} value={r.sn}>{robotLabel(r)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadMaps} disabled={!sn}>Cargar mapas</Button>
              <Button onClick={()=>loadCurrentMap(false)} disabled={!sn}>Mapa actual</Button>
              <Button onClick={()=>loadPoints(200,0)} disabled={!sn}>Cargar puntos</Button>
            </div>
          </div>

          {/* Mapas / Puntos */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-500">map_name</label>
              <select className="input w-full" value={selectedMapName} onChange={(e)=>setSelectedMapName(e.target.value)}>
                {!maps?.length && <option value={currentMap?.name || ""}>{currentMap?.name || "—"}</option>}
                {maps?.map(m => (
                  <option key={m.name || m.map_name} value={m.name || m.map_name}>
                    {m.name || m.map_name}
                  </option>
                ))}
              </select>
              {currentMap?.name && (
                <div className="text-xs text-slate-500 mt-1">En uso: <b>{currentMap.name}</b></div>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-500">Punto</label>
              <select className="input w-full" value={selectedPoint} onChange={(e)=>setSelectedPoint(e.target.value)}>
                {!points.length && <option value="">— sin puntos —</option>}
                {points.map((p,idx)=>(
                  <option key={p.id || p.name || idx} value={p.name || p.point || p.id}>
                    {(p.type ? `${p.type} · ` : "") + (p.name || p.point || p.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-sm text-slate-500">call_mode</label>
                <select className="input w-full" value={callMode} onChange={(e)=>setCallMode(e.target.value)}>
                  <option value="CALL">CALL</option>
                  <option value="CONFIRM">CONFIRM</option>
                  <option value="IMG">IMG</option>
                  <option value="VIDEO">VIDEO</option>
                  <option value="QR">QR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500">mode_data (opcional)</label>
                <input className="input w-full" placeholder='JSON o texto (según modo)' value={modeData} onChange={(e)=>setModeData(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={callRobot} disabled={!sn || !selectedMapName || !selectedPoint || execLoading}>Llamar al punto</Button>
            <Button onClick={rechargeOneClick} disabled={!sn || execLoading}>Recarga 1-click</Button>
            <Button onClick={readDoorState} disabled={!sn || execLoading}>Estado cajones</Button>
          </div>

          {/* Cancel/Complete de llamada */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-500">task_id</label>
              <input className="input w-full" value={callTaskId} onChange={(e)=>setCallTaskId(e.target.value)} placeholder="task_id de la llamada" />
            </div>
            <div>
              <label className="block text-sm text-slate-500">call_device_name</label>
              <input className="input w-full" value={callDeviceName} onChange={(e)=>setCallDeviceName(e.target.value)} placeholder="Origen (p.ej. kiosk-1)" />
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-sm text-slate-500">next_call_task (opcional)</label>
                <input className="input w-full" value={nextCallTask} onChange={(e)=>setNextCallTask(e.target.value)} placeholder="task para encadenar" />
              </div>
              <div className="flex gap-2 items-end">
                <Button onClick={completeCall} disabled={!callTaskId || !callDeviceName || execLoading}>Completar</Button>
                <Button onClick={cancelCall} disabled={!callTaskId || !callDeviceName || execLoading}>Cancelar</Button>
              </div>
            </div>
          </div>

          {/* Cajones: control rápido + raw */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-medium">Control de cajones</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={()=>controlDoors([{index:0,open:true},{index:1,open:true},{index:2,open:true}])} disabled={!sn || execLoading}>Abrir todos</Button>
                <Button onClick={()=>controlDoors([{index:0,open:false},{index:1,open:false},{index:2,open:false}])} disabled={!sn || execLoading}>Cerrar todos</Button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-500">payload.control_states (JSON)</label>
              <textarea className="input w-full h-24" value={doorRawPayload} onChange={(e)=>setDoorRawPayload(e.target.value)} />
              <div className="mt-2">
                <Button onClick={()=>controlDoors()} disabled={!sn || execLoading}>Enviar payload</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Analytics: Delivery */}
        <Card className="lg:col-span-8">
          <h2>Analytics · Delivery</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm text-slate-500">Inicio</label>
              <input type="date" className="input w-full" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-500">Fin</label>
              <input type="date" className="input w-full" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-500">time_unit</label>
              <select className="input w-full" value={timeUnit} onChange={(e)=>setTimeUnit(e.target.value)}>
                <option value="day">day</option>
                <option value="week">week</option>
                <option value="month">month</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-500">group_by</label>
              <select className="input w-full" value={groupBy} onChange={(e)=>setGroupBy(e.target.value)}>
                <option value="sn">sn</option>
                <option value="shop_id">shop_id</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadDeliveryAnalytics} disabled={!shopId || analyticsLoading}>
                {analyticsLoading ? (<><Spinner /> Cargando…</>) : "Consultar"}
              </Button>
            </div>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto text-xs bg-black/5 p-3 rounded">{JSON.stringify(deliverySummary, null, 2) || "—"}</pre>
        </Card>

        {/* Ads */}
        <Card className="lg:col-span-4">
          <h2>Ads</h2>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm text-slate-500">kind (opcional)</label>
                <input className="input w-full" value={adsKind} onChange={(e)=>setAdsKind(e.target.value)} placeholder="p.ej. promo" />
              </div>
              <div className="flex items-end">
                <Button onClick={listAds} disabled={adsLoading}>{adsLoading ? "Cargando…" : "Listar"}</Button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-500">Anuncios</label>
              <select className="input w-full" value={adSelectedId} onChange={(e)=>setAdSelectedId(e.target.value)}>
                {!ads.length && <option value="">— sin anuncios —</option>}
                {ads.map(a=>(
                  <option key={a.id} value={a.id}>{a.id} · {a.name || a.title || "(sin título)"}</option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <Button onClick={getAd} disabled={!adSelectedId}>Ver detalle</Button>
                <Button onClick={deleteAd} disabled={!adSelectedId}>Eliminar</Button>
              </div>
              <pre className="mt-2 max-h-60 overflow-auto text-xs bg-black/5 p-2 rounded">{JSON.stringify(adDetail, null, 2) || "—"}</pre>
            </div>

            <div>
              <div className="font-medium mb-1">Crear / Actualizar</div>
              <textarea className="input w-full h-36" value={adsBodyJson} onChange={(e)=>setAdsBodyJson(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button onClick={()=>createOrUpdateAd("create")}>Crear</Button>
                <Button onClick={()=>createOrUpdateAd("update")}>Actualizar</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Explorer manual */}
        <Card className="lg:col-span-12">
          <h2>Explorer manual</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-sm text-slate-500">Método</label>
              <select className="input w-full" value={method} onChange={(e)=>setMethod(e.target.value)}>
                <option>GET</option>
                <option>POST</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-500">Endpoint</label>
              <input className="input w-full" value={path} onChange={(e)=>setPath(e.target.value)} placeholder="/data-board/v1/analysis/task/delivery" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-slate-500">Query (GET)</label>
              <input className="input w-full" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="shop_id=451170001&start_time=...&end_time=..." />
            </div>
          </div>
          {method === "POST" && (
            <div className="mt-3">
              <label className="block text-sm text-slate-500">Body (POST)</label>
              <textarea className="input w-full h-32" value={body} onChange={(e)=>setBody(e.target.value)} />
            </div>
          )}
          <div className="mt-3">
            <Button onClick={runManual}>{manualErr ? "Reintentar" : "Ejecutar"}</Button>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto text-xs bg-black/5 p-3 rounded">{manualErr ? String(manualErr) : JSON.stringify(manualRes, null, 2) || "—"}</pre>
        </Card>
      </div>

      {/* ===================== MODALES ===================== */}
      <NeumorphicModal
        open={!!confirmState}
        title={confirmState?.title}
        confirmText={confirmState?.confirmText || "Confirmar"}
        cancelText={confirmState?.cancelText || "Cancelar"}
        onCancel={() => { confirmState?.resolve?.(false); setConfirmState(null); }}
        onConfirm={() => { confirmState?.resolve?.(true); setConfirmState(null); }}
        solidBackdrop
      >
        {confirmState?.message}
      </NeumorphicModal>

      <NeumorphicModal
        open={!!alertState}
        title={alertState?.title}
        confirmText="Cerrar"
        hideCancel
        variant={alertState?.variant || "error"}  // usa success/warning/error
        onConfirm={() => setAlertState(null)}
        onCancel={() => setAlertState(null)}
        solidBackdrop
      >
        <div className="whitespace-pre-wrap break-words">{alertState?.message}</div>
      </NeumorphicModal>
    </div>
  );
}
