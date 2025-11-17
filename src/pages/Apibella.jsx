import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import NeumorphicModal from "../components/NeumorphicModal.jsx";
import { Pudu, get, post } from "../services/api.js";
import JsonView from "../components/JsonView";

/* ==========================================================================================
 * CONSTANTES Y HELPERS
 * ========================================================================================== */

const PRODUCT_IMAGES = {
  bellabot:
    "https://cdn.pudutech.com/website/images/pc/bellabot/parameter2.2.0.png",
  cc1: "https://cdn.pudutech.com/website/images/cc1/parameters_robot_en.png",
  "bellabot pro":
    "https://cdn.pudutech.com/official-website/bellabotpro/S13_1.png",
  flashbot:
    "https://cdn.pudutech.com/official-website/flashbot_new/s16-tuya.webp",
};

function normalizeProductName(raw) {
  if (!raw) return null;
  const s = String(raw)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s === "bellabot" || s === "bella bot" || s === "bella") return "bellabot";
  if (s.includes("bellabot pro") || (s.includes("bella") && s.includes("pro")))
    return "bellabot pro";
  if (s.includes("bellabot") || s.includes("bella bot") || s === "bella")
    return "bellabot";
  if (s.includes("flash")) return "flashbot";
  if (s.includes("cc1")) return "cc1";
  return null;
}

const toUnixSec = (d) => Math.floor(new Date(d).getTime() / 1000);
const diffDays = (a, b) =>
  Math.max(0, Math.round((toUnixSec(b) - toUnixSec(a)) / 86400));
const getDefaultTzHours = () =>
  Math.round(-new Date().getTimezoneOffset() / 60);
const chooseUnit = (choice, startDate, endDate) =>
  choice === "auto"
    ? diffDays(startDate, endDate) > 1
      ? "day"
      : "hour"
    : choice;
const c = (key, label = key) => ({ key, label });

function Spinner({ className = "" }) {
  return <div className={`spinner ${className}`} aria-hidden="true"></div>;
}

const renderTable = (rows, columns) => (
  <div className="mt-3 table-wrap">
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key}>
                <span className="cell-header">{col.label}</span>
                <div>{col.render ? col.render(r) : r[col.key] ?? 0}</div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ==========================================================================================
 * COMPONENTE INTELIGENTE PARA RESULTADOS
 * ========================================================================================== */
const ResultViewer = ({ data }) => {
  if (!data) return null;

  let listData = null;
  if (Array.isArray(data)) listData = data;
  else if (data.list && Array.isArray(data.list)) listData = data.list;
  else if (data.data && Array.isArray(data.data.list))
    listData = data.data.list;

  if (listData && listData.length > 0) {
    const firstItem = listData[0];
    if (typeof firstItem === "object" && firstItem !== null) {
      const columns = Object.keys(firstItem).map((key) => ({
        key,
        label: key.replace(/_/g, " ").toUpperCase(),
        render: (row) => {
          const val = row[key];
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        },
      }));
      return (
        <div>
          <div className="text-xs text-gray-500 mb-2 font-bold uppercase">
            Vista de Lista ({listData.length} items)
          </div>
          {renderTable(listData, columns)}
        </div>
      );
    }
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data);
    const isFlat = entries.every(
      ([_, val]) => typeof val !== "object" || val === null
    );

    if (isFlat || entries.length < 15) {
      return (
        <div className="table-wrap mt-2">
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Campo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, val]) => (
                <tr key={key}>
                  <td className="font-bold text-xs uppercase text-gray-500">
                    {key.replace(/_/g, " ")}
                  </td>
                  <td
                    className="font-mono text-sm"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {typeof val === "boolean"
                      ? val
                        ? "TRUE"
                        : "FALSE"
                      : String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return <JsonView className="card-response" data={data} />;
};

/* ==========================================================================================
 * CONFIGURACIÓN DE MÓDULOS
 * ========================================================================================== */
const MODULES = {
  delivery: {
    key: "delivery",
    summaryTitle: "Resumen (Delivery)",
    listTitle: "Detalle (Delivery)",
    popupPrefix: "Delivery",
    pathSummary: "/data-board/v1/analysis/task/delivery",
    pathList: "/data-board/v1/analysis/task/delivery/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km", value: s.mileage ?? 0, prev: q.mileage },
        { label: "Horas", value: s.duration ?? 0, prev: q.duration },
        { label: "Mesas", value: s.table_count ?? 0, prev: q.table_count },
        { label: "Bandejas", value: s.tray_count ?? 0, prev: q.tray_count },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "km"),
      c("duration", "h"),
      c("table_count"),
      c("tray_count"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("table_count"),
      c("tray_count"),
      c("task_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("tray_count"),
        c("task_count"),
      ],
      shop: [
        c("task_time"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("tray_count"),
        c("task_count"),
      ],
    },
  },
  cruise: {
    key: "cruise",
    summaryTitle: "Cruise",
    listTitle: "Cruise List",
    pathSummary: "/data-board/v1/analysis/task/cruise",
    pathList: "/data-board/v1/analysis/task/cruise/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  greeter: {
    key: "greeter",
    summaryTitle: "Greeter",
    listTitle: "Greeter List",
    pathSummary: "/data-board/v1/analysis/task/greeter",
    pathList: "/data-board/v1/analysis/task/greeter/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  interactive: {
    key: "interactive",
    summaryTitle: "Interactive",
    listTitle: "Interactive List",
    pathSummary: "/data-board/v1/analysis/task/interactive",
    pathList: "/data-board/v1/analysis/task/interactive/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  solicit: {
    key: "solicit",
    summaryTitle: "Pick-up",
    listTitle: "Pick-up List",
    pathSummary: "/data-board/v1/analysis/task/solicit",
    pathList: "/data-board/v1/analysis/task/solicit/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  grid: {
    key: "grid",
    summaryTitle: "Grid",
    listTitle: "Grid List",
    pathSummary: "/data-board/v1/analysis/task/grid",
    pathList: "/data-board/v1/analysis/task/grid/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  ad: {
    key: "ad",
    summaryTitle: "Ad",
    listTitle: "Ad List",
    pathSummary: "/data-board/v1/analysis/task/ad",
    pathList: "/data-board/v1/analysis/task/ad/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  recovery: {
    key: "recovery",
    summaryTitle: "Recovery",
    listTitle: "Recovery List",
    pathSummary: "/data-board/v1/analysis/task/recovery",
    pathList: "/data-board/v1/analysis/task/recovery/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
  call: {
    key: "call",
    summaryTitle: "Call",
    listTitle: "Call List",
    pathSummary: "/data-board/v1/analysis/task/call",
    pathList: "/data-board/v1/analysis/task/call/paging",
    kpis: () => [],
    chartCols: [],
    qoqCols: [],
    listCols: { robot: [], shop: [] },
  },
};

/* ==========================================================================================
 * HOOKS BASE
 * ========================================================================================== */

function useModule({
  config,
  startDate,
  endDate,
  tzOffset,
  shopId,
  adId,
  getWithPopup,
  showError,
}) {
  const [timeUnit, setTimeUnit] = useState("auto");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryRes, setSummaryRes] = useState(null);
  const [listTimeUnit, setListTimeUnit] = useState("auto");
  const [groupBy, setGroupBy] = useState("robot");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listRes, setListRes] = useState(null);

  async function fetchSummary() {
    if (!config.pathSummary) return;
    try {
      setLoadingSummary(true);
      setSummaryRes(null);
      const start = toUnixSec(startDate + "T00:00:00");
      const end = toUnixSec(endDate + "T23:59:59");
      const params = {
        start_time: start,
        end_time: end,
        timezone_offset: Number(tzOffset),
        time_unit: chooseUnit(timeUnit, startDate, endDate),
      };
      if (shopId) params.shop_id = shopId;
      if (config.includeAdId && adId) params.ad_id = Number(adId);
      const data = await getWithPopup(
        `${config.popupPrefix} · resumen`,
        config.pathSummary,
        params
      );
      setSummaryRes(data?.data || data);
    } catch (e) {
      showError(e, `Error análisis (${config.key})`);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function fetchList(customOffset = null) {
    if (!config.pathList) return;
    try {
      setLoadingList(true);
      const start = toUnixSec(startDate + "T00:00:00");
      const end = toUnixSec(endDate + "T23:59:59");
      const params = {
        start_time: start,
        end_time: end,
        timezone_offset: Number(tzOffset),
        time_unit: chooseUnit(listTimeUnit, startDate, endDate),
        group_by: listTimeUnit === "all" ? "shop" : groupBy,
        offset: customOffset ?? offset,
        limit: Number(limit),
      };
      if (shopId) params.shop_id = shopId;
      if (config.includeAdId && adId) params.ad_id = Number(adId);
      const data = await getWithPopup(
        `${config.popupPrefix} · lista`,
        config.pathList,
        params
      );
      setListRes(data?.data || data);
      if (customOffset != null) setOffset(customOffset);
    } catch (e) {
      showError(e, `Error lista (${config.key})`);
    } finally {
      setLoadingList(false);
    }
  }

  return {
    timeUnit,
    setTimeUnit,
    loadingSummary,
    summaryRes,
    fetchSummary,
    clearSummary: () => setSummaryRes(null),
    listTimeUnit,
    setListTimeUnit,
    groupBy,
    setGroupBy,
    limit,
    setLimit,
    offset,
    setOffset,
    loadingList,
    listRes,
    fetchList,
    clearList: () => {
      setListRes(null);
      setOffset(0);
    },
  };
}

function SummarySection({ title, module, state }) {
  const {
    timeUnit,
    setTimeUnit,
    loadingSummary,
    summaryRes,
    fetchSummary,
    clearSummary,
  } = state;
  const chart = summaryRes?.chart || [];
  const kpis = useMemo(() => module.kpis(summaryRes), [summaryRes, module]);
  return (
    <Card>
      <h2>{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
        <div className="min-w-0">
          <label className="block text-sm mb-1">Unit</label>
          <select
            className="select-neu"
            value={timeUnit}
            onChange={(e) => setTimeUnit(e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="day">Day</option>
            <option value="hour">Hour</option>
          </select>
        </div>
        <div className="md:col-span-4 grid grid-cols-2 gap-2 items-end">
          <Button
            onClick={fetchSummary}
            disabled={loadingSummary}
            className="w-full btn-neu"
          >
            {loadingSummary ? <Spinner /> : "Consultar"}
          </Button>
          <Button onClick={clearSummary} className="w-full btn-neu">
            Limpiar
          </Button>
        </div>
      </div>
      {summaryRes && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="stat-card">
              <div className="stat-label">{k.label}</div>
              <div className="stat-value">{k.value}</div>
              {k.prev != null && (
                <div className="stat-hint">Prev: {k.prev}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {chart.length > 0 && renderTable(chart, module.chartCols)}
    </Card>
  );
}

function ListSection({ title, module, state }) {
  const {
    listTimeUnit,
    setListTimeUnit,
    groupBy,
    setGroupBy,
    limit,
    setLimit,
    offset,
    setOffset,
    loadingList,
    listRes,
    fetchList,
    clearList,
  } = state;
  const { total, from, to, list } = (() => {
    const t = listRes?.total ?? 0;
    return {
      total: t,
      from: t ? offset + 1 : 0,
      to: Math.min(offset + Number(limit), t),
      list: listRes?.list || [],
    };
  })();
  return (
    <Card>
      <h2>{title}</h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <div>
          <label className="block text-sm mb-1">Group</label>
          <select
            className="select-neu"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="robot">Robot</option>
            <option value="shop">Shop</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Unit</label>
          <select
            className="select-neu"
            value={listTimeUnit}
            onChange={(e) => setListTimeUnit(e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="day">Day</option>
            <option value="hour">Hour</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Limit</label>
          <input
            className="input-neu"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Offset</label>
          <input
            className="input-neu"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </div>
        <div className="lg:col-span-3 flex gap-2 items-end">
          <Button
            onClick={() => fetchList(0)}
            disabled={loadingList}
            className="flex-1 btn-neu"
          >
            Consultar
          </Button>
          <Button onClick={clearList} className="flex-1 btn-neu">
            Limpiar
          </Button>
        </div>
      </div>
      {list.length > 0 && renderTable(list, module.listCols[groupBy])}
      {total > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-responsive">
          <Button
            onClick={() => fetchList(Math.max(0, offset - limit))}
            disabled={loadingList || offset === 0}
            className="btn-sm"
          >
            ← Prev
          </Button>
          <span>
            {from}-{to} de {total}
          </span>
          <Button
            onClick={() => fetchList(offset + limit)}
            disabled={loadingList || offset + limit >= total}
            className="btn-sm"
          >
            Next →
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ==========================================================================================
 * COMPONENTES OPERACIONES
 * ========================================================================================== */

const RobotHeader = ({ state }) => {
  const {
    sn,
    setSn,
    robots,
    robotsLoading,
    manualSnMode,
    setManualSnMode,
    setResult,
  } = state;
  const selectedRobot = robots.find((r) => r.sn === sn);
  const statusColor = sn ? "var(--accent-secondary)" : "var(--neu-text-muted)";

  return (
    <div className="card-neu mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div style={{ width: "60px", height: "60px" }}>
          {selectedRobot?.img ? (
            <img
              src={selectedRobot.img}
              alt="bot"
              className="w-full h-full object-contain"
            />
          ) : (
            <div
              style={{
                width: "45px",
                height: "45px",
                borderRadius: "50%",
                backgroundColor: statusColor,
                boxShadow: `0 0 10px ${statusColor}`,
              }}
            ></div>
          )}
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="stat-label block">Robot Objetivo (SN)</label>
          <div className="relative">
            {!manualSnMode ? (
              <select
                className="select-neu"
                value={sn}
                onChange={(e) => {
                  e.target.value === "__manual__"
                    ? setManualSnMode(true)
                    : setSn(e.target.value);
                }}
              >
                <option value="">— Seleccionar Robot —</option>
                {robots.map((r) => (
                  <option key={r.sn} value={r.sn}>
                    {r.label}
                  </option>
                ))}
                <option value="__manual__">+ Manual Input</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input-neu"
                  placeholder="SN..."
                  value={sn}
                  onChange={(e) => setSn(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => setManualSnMode(false)}
                  className="btn-ghost text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <Button
          onClick={state.loadRobots}
          disabled={robotsLoading}
          className="btn-neu"
        >
          {robotsLoading ? "..." : "↻ Lista"}
        </Button>
        <Button onClick={() => setResult(null)} className="btn-neu">
          Limpiar
        </Button>
      </div>
    </div>
  );
};

const CollapsibleJson = ({ label, value, onChange, height = "h-40" }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-neu-sm mb-4 p-0 overflow-hidden">
      <button
        className="w-full flex justify-between items-center p-3 bg-transparent cursor-pointer text-xs font-bold uppercase transition hover:opacity-80"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="badge">JSON</span>
          <span>{label}</span>
        </div>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <textarea
          className={`textarea-neu w-full font-mono text-xs ${height}`}
          style={{
            borderRadius: 0,
            border: "none",
            boxShadow: "var(--shadow-inset-sm)",
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
};

function useOperations({ getWithPopup, postWithPopup, showError, shopId }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [sn, setSn] = useState("");
  const [robots, setRobots] = useState([]);
  const [robotsLoading, setRobotsLoading] = useState(false);
  const [manualSnMode, setManualSnMode] = useState(false);
  const run = async (fn) => {
    try {
      setBusy(true);
      const d = await fn();
      setResult(d?.data || d);
      return d;
    } finally {
      setBusy(false);
    }
  };
  const parseJSON = (t) => {
    try {
      return t ? JSON.parse(t) : {};
    } catch (e) {
      showError(e, "JSON Error");
      throw e;
    }
  };

  const loadRobots = async () => {
    try {
      setRobotsLoading(true);
      setRobots([]);
      const res = await Pudu.getRobots({ shop_id: shopId || undefined });
      const list = Array.isArray(res?.data?.list || res?.list)
        ? res.data?.list || res.list
        : [];
      const mapped = list.map((r) => ({
        sn: r.sn || r.device_sn,
        label: `${r.product_code || r.product || "-"} - ${r.sn || r.device_sn}`,
        img: PRODUCT_IMAGES[normalizeProductName(r.product_code || r.product)],
      }));
      const unique = [
        ...new Map(mapped.map((item) => [item.sn, item])).values(),
      ];
      setRobots(unique);
      if (unique.length === 1) {
        setManualSnMode(false);
        setSn(unique[0].sn);
      }
    } catch (e) {
    } finally {
      setRobotsLoading(false);
    }
  };
  useEffect(() => {
    loadRobots();
  }, [shopId]);

  const [mapName, setMapName] = useState("");
  const [mapsList, setMapsList] = useState([]);
  const [currentMap, setCurrentMap] = useState(null);
  const [pointsList, setPointsList] = useState([]);
  const [needElements, setNeedElements] = useState(true);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [groupMapName, setGroupMapName] = useState("");
  const [callDeviceName, setCallDeviceName] = useState("Llamada custom");
  const [callMapName, setCallMapName] = useState("");
  const [callPoint, setCallPoint] = useState("");
  const [callPointType, setCallPointType] = useState("");
  const [callMode, setCallMode] = useState("");
  const [taskId, setTaskId] = useState("");
  const [modeData, setModeData] = useState(
    JSON.stringify({ urls: [], switch_time: 2, play_count: 1 }, null, 2)
  );
  const [nextCallTask, setNextCallTask] = useState("{}");
  const [activeTaskIds, setActiveTaskIds] = useState(() => {
    try {
      const stored = localStorage.getItem("pudu_task_history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("pudu_task_history", JSON.stringify(activeTaskIds));
  }, [activeTaskIds]);

  const [selectedDoors, setSelectedDoors] = useState([]);
  const toggleDoor = (door) => {
    setSelectedDoors((prev) => {
      if (prev.includes(door)) return prev.filter((d) => d !== door);
      return [...prev, door];
    });
  };

  const [doorOp, setDoorOp] = useState(true);
  const [screenContent, setScreenContent] = useState("");
  const [screenShow, setScreenShow] = useState(true);
  const [posInterval, setPosInterval] = useState(3);
  const [posTimes, setPosTimes] = useState(1);
  const [deliveryPayload, setDeliveryPayload] = useState(
    JSON.stringify(
      {
        type: "NEW",
        delivery_sort: "AUTO",
        trays: [{ destinations: [{ points: "A1" }] }],
      },
      null,
      2
    )
  );
  const [deliveryAction, setDeliveryAction] = useState("START");
  const [transportPayload, setTransportPayload] = useState(
    JSON.stringify({ type: "NEW", trays: [] }, null, 2)
  );
  const [transportAction, setTransportAction] = useState("START");
  const [cancelPayload, setCancelPayload] = useState(
    JSON.stringify({ tasks: [{ name: "A1", type: "DIRECT" }] }, null, 2)
  );
  const [groupId, setGroupId] = useState("");
  const [device, setDevice] = useState("");
  const [robotsGroupId, setRobotsGroupId] = useState("");
  const [doorCapturePid, setDoorCapturePid] = useState("");
  const [trayOrderPayload, setTrayOrderPayload] = useState(
    JSON.stringify(
      { orders: [{ table_no: "2", name: "Tea", amount: 1 }] },
      null,
      2
    )
  );
  const [errandPayload, setErrandPayload] = useState(
    JSON.stringify({ auth: "0000", tasks: [] }, null, 2)
  );
  const [errandActionSession, setErrandActionSession] = useState("");
  const [errandActionType, setErrandActionType] = useState("CANCEL");
  const [errandActionAuth, setErrandActionAuth] = useState("");

  const addTaskToHistory = (id, label = "") => {
    if (!id) return;
    const newTaskObj = { id, label, timestamp: Date.now() };
    setActiveTaskIds((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      return [newTaskObj, ...filtered].slice(0, 15);
    });
    setTaskId(id);
  };
  const handleRefreshTaskIds = () => {
    run(() =>
      getWithPopup(
        "Estado Tarea",
        "/open-platform-service/v1/robot/task/state/get",
        { sn }
      ).then((r) => {
        const data = r?.data || r;
        if (data && data.task_id) {
          addTaskToHistory(
            data.task_id,
            `[ACTIVA] ${new Date().toLocaleTimeString()}`
          );
        } else {
          console.log("Robot Idle, no active task found.");
        }
        return r;
      })
    );
  };
  const performCall = () => {
    return run(() =>
      postWithPopup("Llamar", "/open-platform-service/v1/custom_call", {
        sn,
        map_name: callMapName,
        point: callPoint,
        point_type: callPointType || undefined,
        call_device_name: callDeviceName,
        call_mode: callMode || undefined,
        mode_data: parseJSON(modeData),
      }).then((r) => {
        const data = r?.data || r;
        if (data && data.task_id) {
          addTaskToHistory(
            data.task_id,
            `[NUEVA] ${new Date().toLocaleTimeString()}`
          );
        }
        return r;
      })
    );
  };
  const handlePointsWithMap = () => {
    const queryParams = { sn, limit, offset };
    if (callMapName) queryParams.map_name = callMapName;
    run(() =>
      getWithPopup("Puntos", "/map-service/v1/open/point", queryParams).then(
        (r) => {
          const rawList = r?.data?.list || r?.list || [];
          const normalizedList = rawList.map((p) => ({
            ...p,
            map_name:
              p.map_name ||
              p.mapName ||
              (callMapName ? callMapName : "unknown"),
          }));
          setPointsList(normalizedList);
          return r;
        }
      )
    );
  };
  const handleControlDoors = (explicitOp) => {
    const op = typeof explicitOp === "boolean" ? explicitOp : doorOp;
    if (selectedDoors.length === 0) {
      showError({ message: "Selecciona al menos una puerta" }, "Error");
      return;
    }
    const control_states = selectedDoors.map((door) => ({
      door_number: door,
      operation: !!op,
    }));
    return run(() =>
      postWithPopup(
        "Control Puerta",
        "/open-platform-service/v1/control_doors",
        { sn, payload: { control_states } }
      )
    );
  };

  return {
    busy,
    result,
    setResult,
    sn,
    setSn,
    robots,
    robotsLoading,
    manualSnMode,
    setManualSnMode,
    loadRobots,
    mapName,
    setMapName,
    mapsList,
    currentMap,
    pointsList,
    needElements,
    setNeedElements,
    limit,
    setLimit,
    offset,
    setOffset,
    callDeviceName,
    setCallDeviceName,
    callMapName,
    setCallMapName,
    callPoint,
    setCallPoint,
    callPointType,
    setCallPointType,
    callMode,
    setCallMode,
    taskId,
    setTaskId,
    modeData,
    setModeData,
    nextCallTask,
    setNextCallTask,
    activeTaskIds,
    handleRefreshTaskIds,
    selectedDoors,
    toggleDoor,
    doorOp,
    setDoorOp,
    screenContent,
    setScreenContent,
    screenShow,
    setScreenShow,
    posInterval,
    setPosInterval,
    posTimes,
    setPosTimes,
    deliveryPayload,
    setDeliveryPayload,
    deliveryAction,
    setDeliveryAction,
    transportPayload,
    setTransportPayload,
    transportAction,
    setTransportAction,
    cancelPayload,
    setCancelPayload,
    groupId,
    setGroupId,
    device,
    setDevice,
    robotsGroupId,
    setRobotsGroupId,
    doorCapturePid,
    setDoorCapturePid,
    trayOrderPayload,
    setTrayOrderPayload,
    errandPayload,
    setErrandPayload,
    errandActionSession,
    setErrandActionSession,
    errandActionType,
    setErrandActionType,
    errandActionAuth,
    setErrandActionAuth,
    groupMapName,
    setGroupMapName,
    handleListMaps: () =>
      run(() =>
        getWithPopup("Mapas", "/map-service/v1/open/list", { sn }).then((r) => {
          setMapsList(r?.data?.list || r?.list || []);
          return r;
        })
      ),
    handleCurrentMap: () =>
      run(() =>
        getWithPopup("Mapa Actual", "/map-service/v1/open/current", {
          sn,
          need_element: needElements,
        }).then((r) => {
          setCurrentMap(r?.data || r);
          return r;
        })
      ),
    handlePoints: handlePointsWithMap,
    handleSwitchInElevator: () =>
      run(() =>
        postWithPopup(
          "Elevator Switch",
          "/open-platform-service/v1/robot/map/switch_in_elevator",
          {
            sn,
            payload: {
              map: { name: mapName, floor: String(currentMap?.floor || "") },
            },
          }
        )
      ),
    handleCall: performCall,
    handleCancelCall: () =>
      run(() =>
        postWithPopup(
          "Cancelar Llamada",
          "/open-platform-service/v1/custom_call/cancel",
          { task_id: taskId, call_device_name: callDeviceName }
        )
      ),
    handleCompleteCall: () =>
      run(() =>
        postWithPopup(
          "Completar Llamada",
          "/open-platform-service/v1/custom_call/complete",
          {
            task_id: taskId,
            call_device_name: callDeviceName,
            next_call_task: parseJSON(nextCallTask),
          }
        )
      ),
    handleRechargeV1: () =>
      run(() =>
        getWithPopup("Recarga V1", "/open-platform-service/v1/recharge", { sn })
      ),
    handleRechargeV2: () =>
      run(() =>
        getWithPopup("Recarga V2", "/open-platform-service/v2/recharge", { sn })
      ),
    handleDoorState: () =>
      run(() =>
        getWithPopup("Estado Puerta", "/open-platform-service/v1/door_state", {
          sn,
        })
      ),
    handleControlDoors,
    handleScreenSet: () =>
      run(() =>
        postWithPopup(
          "Pantalla",
          "/open-platform-service/v1/robot/screen/set",
          {
            sn,
            payload: { info: { content: screenContent, show: !!screenShow } },
          }
        )
      ),
    handlePositionCmd: () =>
      run(() =>
        postWithPopup(
          "Posición",
          "/open-platform-service/v1/position_command",
          {
            sn,
            payload: {
              interval: Number(posInterval),
              times: Number(posTimes),
              source: "openAPI",
            },
          }
        )
      ),
    handleDeliveryTask: () =>
      run(() =>
        postWithPopup(
          "Delivery Task",
          "/open-platform-service/v1/delivery_task",
          { sn, payload: parseJSON(deliveryPayload) }
        )
      ),
    handleDeliveryAction: () =>
      run(() =>
        postWithPopup(
          "Delivery Action",
          "/open-platform-service/v1/delivery_action",
          { sn, payload: { action: deliveryAction } }
        )
      ),
    handleTransportTask: () =>
      run(() =>
        postWithPopup(
          "Transport Task",
          "/open-platform-service/v1/transport_task",
          { sn, payload: parseJSON(transportPayload) }
        )
      ),
    handleTransportAction: () =>
      run(() =>
        postWithPopup(
          "Transport Action",
          "/open-platform-service/v1/transport_action",
          { sn, payload: { action: transportAction } }
        )
      ),
    handleCancelTask: () =>
      run(() =>
        postWithPopup(
          "Cancelar Tareas",
          "/open-platform-service/v1/cancel_task",
          { sn, payload: parseJSON(cancelPayload) }
        )
      ),
    handleStatusBySn: () =>
      run(() =>
        getWithPopup(
          "Status SN",
          "/open-platform-service/v1/status/get_by_sn",
          { sn }
        )
      ),
    handleStatusByGroup: () =>
      run(() =>
        getWithPopup(
          "Status Group",
          "/open-platform-service/v1/status/get_by_group_id",
          { group_id: groupId }
        )
      ),
    handleGroupList: () =>
      run(() =>
        getWithPopup(
          "List Groups",
          "/open-platform-service/v1/robot/group/list",
          { device: device || undefined, shop_id: shopId || undefined }
        )
      ),
    handleRobotsByGroup: () =>
      run(() =>
        getWithPopup(
          "Robots Group",
          "/open-platform-service/v1/robot/list_by_device_and_group",
          { group_id: robotsGroupId }
        )
      ),
    handleRobotTaskState: () =>
      run(() =>
        getWithPopup(
          "Estado Tarea",
          "/open-platform-service/v1/robot/task/state/get",
          { sn }
        )
      ),
    handleTrayOrder: () =>
      run(() =>
        postWithPopup("Tray Order", "/open-platform-service/v1/tray_order", {
          sn,
          payload: parseJSON(trayOrderPayload),
        })
      ),
    handlePointGrouping: () =>
      run(() =>
        postWithPopup("Agrupar Puntos", "/map-service/v1/open/group", {
          sn,
          map_name: groupMapName,
        })
      ),
    handleDoorCapture: () =>
      run(() =>
        getWithPopup(
          "Door Capture",
          "/open-platform-service/v1/door_capture/list",
          { pid: doorCapturePid || sn, limit, offset }
        )
      ),
    handleErrandTask: () =>
      run(() =>
        postWithPopup("A2B Task", "/open-platform-service/v1/task_errand", {
          sn,
          payload: parseJSON(errandPayload),
        })
      ),
    handleErrandAction: () =>
      run(() =>
        postWithPopup("A2B Action", "/open-platform-service/v1/errand_action", {
          sn,
          payload: {
            session_id: errandActionSession,
            action: errandActionType,
            auth: errandActionAuth || undefined,
          },
        })
      ),
  };
}

function OperationsTab(props) {
  const ops = useOperations(props);
  const [activeSection, setActiveSection] = useState("General");
  const sections = [
    //{ id: "General", label: "Estado/Grupos" },
    { id: "Mapas", label: "Mapas/Puntos" },
    { id: "Llamadas", label: "Llamadas" },
    { id: "Hardware", label: "Hardware" },
    { id: "Tareas", label: "Tareas(Avanzado)" },
    { id: "Avanzado", label: "Avanzado" },
  ];

  const mapOptions = useMemo(
    () => ops.mapsList.map((m) => ({ label: m.name, value: m.name })),
    [ops.mapsList]
  );
  const pointOptions = useMemo(() => {
    if (!ops.callMapName)
      return ops.pointsList.map((p) => ({
        label: `${p.name} (${p.map_name})`,
        value: p.name,
      }));
    return ops.pointsList
      .filter((p) => p.map_name === ops.callMapName)
      .map((p) => ({ label: p.name, value: p.name }));
  }, [ops.pointsList, ops.callMapName]);
  const typeOptions = useMemo(() => {
    const filteredPoints = !ops.callMapName
      ? ops.pointsList
      : ops.pointsList.filter((p) => p.map_name === ops.callMapName);
    const types = [
      ...new Set(filteredPoints.map((p) => p.type).filter(Boolean)),
    ];
    return types.map((t) => ({ label: t, value: t }));
  }, [ops.pointsList, ops.callMapName]);

  const availableDoors = ["H_01", "H_02", "H_03", "H_04"];

  // RESPONSIVE NAV (Dropdown on mobile, Sidebar on desktop)
  function SideNav({ tabs, activeKey, onChange }) {
    return (
      <div className="mb-6 lg:mb-0">
        <div className="block lg:hidden">
          <label
            className="text-xs font-bold mb-2 block"
            style={{ color: "var(--neu-text-muted)" }}
          >
            Sección
          </label>
          <select
            className="select-neu w-full"
            value={activeKey}
            onChange={(e) => onChange(e.target.value)}
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden lg:flex card-neu p-0 overflow-hidden sticky top-20">
          <div className="flex flex-col w-full">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`nav-item w-full text-left flex items-center gap-3 ${
                  t.id === activeKey ? "active" : ""
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <RobotHeader state={ops} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-3">
          <SideNav
            tabs={sections}
            activeKey={activeSection}
            onChange={setActiveSection}
          />
        </div>

        <div className="lg:col-span-9 space-y-6">
          {activeSection === "General" && (
            <div className="space-y-4 fade-in">
              <Card>
                <h2 className="mb-4">Consultas de Estado</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    onClick={ops.handleStatusBySn}
                    disabled={ops.busy}
                    className="btn-neu w-full"
                  >
                    Estado (SN)
                  </Button>
                  <Button
                    onClick={ops.handleRobotTaskState}
                    disabled={ops.busy}
                    className="btn-neu w-full"
                  >
                    Tarea Actual
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <input
                    className="input-neu"
                    placeholder="Group ID"
                    value={ops.groupId}
                    onChange={(e) => ops.setGroupId(e.target.value)}
                  />
                  <input
                    className="input-neu"
                    placeholder="Device ID"
                    value={ops.device}
                    onChange={(e) => ops.setDevice(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button
                    onClick={ops.handleStatusByGroup}
                    disabled={ops.busy || !ops.groupId}
                    className="btn-neu"
                  >
                    Estado Grupo
                  </Button>
                  <Button
                    onClick={ops.handleGroupList}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Listar Grupos
                  </Button>
                </div>
              </Card>
              <Card>
                <h2 className="mb-2">Robots por Grupo</h2>
                <div className="flex gap-2">
                  <input
                    className="input-neu flex-1"
                    placeholder="Group ID"
                    value={ops.robotsGroupId}
                    onChange={(e) => ops.setRobotsGroupId(e.target.value)}
                  />
                  <Button
                    onClick={ops.handleRobotsByGroup}
                    disabled={ops.busy || !ops.robotsGroupId}
                    className="btn-neu"
                  >
                    Listar
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeSection === "Mapas" && (
            <div className="space-y-4 fade-in">
              <Card>
                <div className="flex justify-between items-center mb-4">
                  <h2>Mapas</h2>
                  <div className="flex items-center gap-2">
                    <span className="stat-label">Detalles</span>
                    <select
                      className="select-neu py-1"
                      value={String(ops.needElements)}
                      onChange={(e) =>
                        ops.setNeedElements(e.target.value === "true")
                      }
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <Button
                    onClick={ops.handleListMaps}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Listar
                  </Button>
                  <Button
                    onClick={ops.handleCurrentMap}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Actual
                  </Button>
                  <Button
                    onClick={ops.handlePoints}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Puntos
                  </Button>
                </div>
                {ops.mapsList.length > 0 && (
                  <div className="card-inset p-2 mb-4 max-h-40 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Piso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ops.mapsList.map((m, i) => (
                          <tr key={i}>
                            <td>{m.name}</td>
                            <td>{m.floor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="input-neu flex-1"
                    placeholder="Mapa destino..."
                    value={ops.mapName}
                    onChange={(e) => ops.setMapName(e.target.value)}
                  />
                  <Button
                    onClick={ops.handleSwitchInElevator}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Ir (Elev)
                  </Button>
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    className="input-neu flex-1"
                    placeholder="Mapa agrupar..."
                    value={ops.groupMapName}
                    onChange={(e) => ops.setGroupMapName(e.target.value)}
                  />
                  <Button
                    onClick={ops.handlePointGrouping}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Agrupar
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeSection === "Llamadas" && (
            <div className="space-y-4 fade-in">
              <Card>
                <h2 className="mb-4">Llamadas Custom</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      MAPA
                    </label>
                    <div className="flex gap-1">
                      <select
                        className="select-neu w-full"
                        value={ops.callMapName}
                        onChange={(e) => ops.setCallMapName(e.target.value)}
                      >
                        <option value="">-- Seleccionar --</option>
                        {mapOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={ops.handleListMaps}
                        disabled={ops.busy}
                        className="btn-neu px-2"
                        title="Consultar Mapas"
                      >
                        ↻
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      PUNTO
                    </label>
                    <div className="flex gap-1">
                      <select
                        className="select-neu w-full"
                        value={ops.callPoint}
                        onChange={(e) => ops.setCallPoint(e.target.value)}
                      >
                        <option value="">-- Seleccionar --</option>
                        {pointOptions.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={ops.handlePoints}
                        disabled={ops.busy}
                        className="btn-neu px-2"
                        title="Consultar Puntos"
                      >
                        ↻
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      TIPO
                    </label>
                    <select
                      className="select-neu w-full"
                      value={ops.callPointType}
                      onChange={(e) => ops.setCallPointType(e.target.value)}
                    >
                      <option value="">-- (Opcional) --</option>
                      {typeOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      DEVICE NAME
                    </label>
                    <input
                      className="input-neu w-full"
                      value={ops.callDeviceName}
                      onChange={(e) => ops.setCallDeviceName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      MODE
                    </label>
                    <select
                      className="select-neu w-full"
                      value={ops.callMode}
                      onChange={(e) => ops.setCallMode(e.target.value)}
                    >
                      <option value="">(Default)</option>
                      <option>IMG</option>
                      <option>CALL</option>
                      <option>QR_CODE</option>
                      <option>VIDEO</option>
                    </select>
                  </div>
                </div>
                {
                  //<CollapsibleJson
                  //label="Mode Data (JSON)"
                  //value={ops.modeData}
                  //onChange={ops.setModeData}
                  ///>
                }
                <Button
                  onClick={ops.handleCall}
                  disabled={ops.busy}
                  className="w-full btn-neu"
                >
                  Llamar
                </Button>
              </Card>
              <Card>
                <div className="flex items-end gap-2 mb-2">
                  <div className="flex-1">
                    <label
                      className="text-xs font-bold mb-1 block"
                      style={{ color: "var(--neu-text-muted)" }}
                    >
                      TASK ID (Gestión)
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="select-neu flex-1"
                        value={ops.taskId}
                        onChange={(e) => ops.setTaskId(e.target.value)}
                      >
                        <option value="">
                          -- Seleccionar Activa / Histórico --
                        </option>
                        {ops.activeTaskIds.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label || t.id}{" "}
                            {t.timestamp
                              ? `(${new Date(
                                  t.timestamp
                                ).toLocaleTimeString()})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={ops.handleRefreshTaskIds}
                        disabled={ops.busy}
                        className="btn-neu"
                        title="Buscar Tarea Activa"
                      >
                        ↻
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={ops.handleCancelCall}
                      disabled={ops.busy || !ops.taskId}
                      className="btn-neu badge-danger"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={ops.handleCompleteCall}
                      disabled={ops.busy || !ops.taskId}
                      className="btn-neu badge-success"
                    >
                      Completar
                    </Button>
                  </div>
                </div>
                <input
                  className="input-neu w-full text-xs mb-3"
                  placeholder="O escribir ID manual..."
                  value={ops.taskId}
                  onChange={(e) => ops.setTaskId(e.target.value)}
                />
                {
                  //<CollapsibleJson
                  //label="Next Task JSON"
                  //value={ops.nextCallTask}
                  //onChange={ops.setNextCallTask}
                  //height="h-20"
                  ///>
                }
              </Card>
            </div>
          )}

          {activeSection === "Hardware" && (
            <div className="space-y-4 fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <h2 className="mb-2">Energía</h2>
                  <div className="flex gap-2">
                    <Button
                      onClick={ops.handleRechargeV1}
                      disabled={ops.busy}
                      className="flex-1 btn-neu"
                    >
                      V1
                    </Button>
                    <Button
                      onClick={ops.handleRechargeV2}
                      disabled={ops.busy}
                      className="flex-1 btn-neu"
                    >
                      V2
                    </Button>
                  </div>
                </Card>
                <Card>
                  <h2 className="mb-2">Puertas (Multi-select)</h2>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {availableDoors.map((door) => (
                      <button
                        key={door}
                        className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          ops.selectedDoors.includes(door)
                            ? "bg-blue-500 text-white border-blue-600 shadow-md"
                            : "bg-transparent border-gray-400 text-gray-500 hover:bg-gray-100"
                        }`}
                        onClick={() => ops.toggleDoor(door)}
                      >
                        {door}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => ops.handleControlDoors(true)}
                      disabled={ops.busy || ops.selectedDoors.length === 0}
                      className="flex-1 btn-neu"
                      style={{ color: "var(--accent-secondary)" }}
                    >
                      Abrir
                    </Button>
                    <Button
                      onClick={() => ops.handleControlDoors(false)}
                      disabled={ops.busy || ops.selectedDoors.length === 0}
                      className="flex-1 btn-neu"
                      style={{ color: "var(--accent-danger)" }}
                    >
                      Cerrar
                    </Button>
                  </div>
                </Card>
              </div>
              <Card>
                <h2 className="mb-2">Pantalla</h2>
                <div className="flex gap-2">
                  <input
                    className="input-neu w-full"
                    value={ops.screenContent}
                    onChange={(e) => ops.setScreenContent(e.target.value)}
                  />
                  <Button
                    onClick={ops.handleScreenSet}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Set
                  </Button>
                </div>
                <h2 className="mb-2 mt-4">Posición</h2>
                <div className="flex gap-2">
                  <input
                    className="input-neu w-20"
                    placeholder="Int"
                    value={ops.posInterval}
                    onChange={(e) => ops.setPosInterval(e.target.value)}
                  />
                  <input
                    className="input-neu w-20"
                    placeholder="Times"
                    value={ops.posTimes}
                    onChange={(e) => ops.setPosTimes(e.target.value)}
                  />
                  <Button
                    onClick={ops.handlePositionCmd}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Cmd
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeSection === "Tareas" && (
            <div className="space-y-4 fade-in">
              <Card>
                <h3 className="font-bold mb-2">Delivery</h3>
                <CollapsibleJson
                  value={ops.deliveryPayload}
                  onChange={ops.setDeliveryPayload}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={ops.handleDeliveryTask}
                    disabled={ops.busy}
                    className="flex-1 btn-neu"
                  >
                    Enviar
                  </Button>
                  <select
                    className="select-neu w-32"
                    value={ops.deliveryAction}
                    onChange={(e) => ops.setDeliveryAction(e.target.value)}
                  >
                    <option>START</option>
                    <option>CANCEL</option>
                  </select>
                  <Button
                    onClick={ops.handleDeliveryAction}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Act
                  </Button>
                </div>
              </Card>
              <Card>
                <h3 className="font-bold mb-2">Transport</h3>
                <CollapsibleJson
                  value={ops.transportPayload}
                  onChange={ops.setTransportPayload}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={ops.handleTransportTask}
                    disabled={ops.busy}
                    className="flex-1 btn-neu"
                  >
                    Enviar
                  </Button>
                  <select
                    className="select-neu w-32"
                    value={ops.transportAction}
                    onChange={(e) => ops.setTransportAction(e.target.value)}
                  >
                    <option>START</option>
                    <option>CANCEL</option>
                  </select>
                  <Button
                    onClick={ops.handleTransportAction}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Act
                  </Button>
                </div>
              </Card>
              <Card>
                <h3
                  className="font-bold mb-2"
                  style={{ color: "var(--accent-danger)" }}
                >
                  Cancelar Todo
                </h3>
                <CollapsibleJson
                  value={ops.cancelPayload}
                  onChange={ops.setCancelPayload}
                  height="h-20"
                />
                <Button
                  onClick={ops.handleCancelTask}
                  disabled={ops.busy}
                  className="w-full mt-2 btn-neu"
                >
                  Ejecutar Cancelación
                </Button>
              </Card>
            </div>
          )}

          {activeSection === "Avanzado" && (
            <div className="space-y-4 fade-in">
              <Card>
                <h2 className="mb-2">Tray Order</h2>
                <CollapsibleJson
                  value={ops.trayOrderPayload}
                  onChange={ops.setTrayOrderPayload}
                  height="h-24"
                />
                <Button
                  onClick={ops.handleTrayOrder}
                  disabled={ops.busy}
                  className="w-full mt-2 btn-neu"
                >
                  Enviar
                </Button>
              </Card>
              <Card>
                <h2 className="mb-2">A2B (Errand)</h2>
                <CollapsibleJson
                  value={ops.errandPayload}
                  onChange={ops.setErrandPayload}
                  height="h-24"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={ops.handleErrandTask}
                    disabled={ops.busy}
                    className="flex-1 btn-neu"
                  >
                    Enviar
                  </Button>
                  <input
                    className="input-neu flex-1"
                    placeholder="Session ID"
                    value={ops.errandActionSession}
                    onChange={(e) => ops.setErrandActionSession(e.target.value)}
                  />
                  <Button
                    onClick={ops.handleErrandAction}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Action
                  </Button>
                </div>
              </Card>
              <Card>
                <h2 className="mb-2">Door Capture</h2>
                <div className="flex gap-2">
                  <input
                    className="input-neu flex-1"
                    placeholder="PID"
                    value={ops.doorCapturePid}
                    onChange={(e) => ops.setDoorCapturePid(e.target.value)}
                  />
                  <Button
                    onClick={ops.handleDoorCapture}
                    disabled={ops.busy}
                    className="btn-neu"
                  >
                    Listar
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {
        //ops.result && (
        //<Card className="mt-8 border-t border-gray-500">
        //<div className="flex justify-between items-center mb-2">
        //<h3>Resultado</h3>
        //<span className="badge">{new Date().toLocaleTimeString()}</span>
        //</div>
        //<ResultViewer data={ops.result} />
        //</Card>
        //)
      }
    </div>
  );
}

/* ==========================================================================================
 * COMPONENTE PRINCIPAL
 * ========================================================================================== */
export default function Apibella() {
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [tzOffset, setTzOffset] = useState(getDefaultTzHours());
  const [adId, setAdId] = useState("");
  const [alertState, setAlertState] = useState(null);

  const showError = (e, title = "Error") =>
    setAlertState({
      title,
      message: e?.response?.data?.message || e?.message || String(e),
      variant: "error",
    });
  const showOk = (title, res) =>
    setAlertState({ title, message: res?.message ?? "ok", variant: "success" });

  async function getWithPopup(title, url, params) {
    const res = await get(url, params);
    showOk(title, res);
    return res;
  }
  async function postWithPopup(title, url, body) {
    const res = await post(url, body);
    showOk(title, res);
    return res;
  }

  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [manualShopMode, setManualShopMode] = useState(false);

  const loadShops = async () => {
    try {
      setShopsLoading(true);
      const res = await get("/data-open-platform-service/v1/api/shop", {
        limit: 100,
        offset: 0,
      });
      setShops(res?.data?.list || res?.list || []);
    } catch (e) {
    } finally {
      setShopsLoading(false);
    }
  };
  useEffect(() => {
    loadShops();
  }, []);

  const delivery = useModule({
    config: MODULES.delivery,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const cruise = useModule({
    config: MODULES.cruise,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const greeter = useModule({
    config: MODULES.greeter,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const interactive = useModule({
    config: MODULES.interactive,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const solicit = useModule({
    config: MODULES.solicit,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const grid = useModule({
    config: MODULES.grid,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const ad = useModule({
    config: MODULES.ad,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const recovery = useModule({
    config: MODULES.recovery,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });
  const call = useModule({
    config: MODULES.call,
    startDate,
    endDate,
    tzOffset,
    shopId,
    adId,
    getWithPopup,
    showError,
  });

  const tabs = [
    {
      key: "delivery",
      label: "Delivery",
      module: MODULES.delivery,
      state: delivery,
    },
    { key: "cruise", label: "Cruise", module: MODULES.cruise, state: cruise },
    {
      key: "greeter",
      label: "Greeter",
      module: MODULES.greeter,
      state: greeter,
    },
    {
      key: "interactive",
      label: "Interactive",
      module: MODULES.interactive,
      state: interactive,
    },
    {
      key: "solicit",
      label: "Pick-up",
      module: MODULES.solicit,
      state: solicit,
    },
    { key: "grid", label: "Grid", module: MODULES.grid, state: grid },
    { key: "ad", label: "Advertising", module: MODULES.ad, state: ad },
    {
      key: "recovery",
      label: "Recovery",
      module: MODULES.recovery,
      state: recovery,
    },
    { key: "call", label: "Call", module: MODULES.call, state: call },
    { key: "ops", label: "Operaciones" },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].key);

  // RESPONSIVE NAV: Mobile Dropdown / Desktop Tabs
  function TabsNav({ tabs, activeKey, onChange }) {
    return (
      <div className="nav-neu mb-6">
        {/* Mobile: Dropdown */}
        <div className="block lg:hidden w-full">
          <select
            className="select-neu w-full"
            value={activeKey}
            onChange={(e) => onChange(e.target.value)}
          >
            {tabs.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {/* Desktop: Buttons */}
        <div className="hidden lg:flex gap-2 w-full overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`nav-item ${t.key === activeKey ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container-neu">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-12">
          <div className="flex justify-between items-center mb-4">
            <h1>Panel Pudu</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 flex gap-2">
              <select
                className="select-neu w-full"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
              >
                <option value="">Todas las tiendas</option>
                {shops.map((s) => (
                  <option key={s.shop_id} value={s.shop_id}>
                    {s.shop_name}
                  </option>
                ))}
              </select>
              <Button onClick={loadShops} className="btn-neu">
                {shopsLoading ? "..." : "↻"}
              </Button>
            </div>
            <input
              type="date"
              className="input-neu"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="input-neu"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </Card>
        <div className="lg:col-span-12">
          <TabsNav tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        </div>
        <div className="lg:col-span-12">
          {tabs.map(
            (t) =>
              t.key === activeTab && (
                <div key={t.key} className="fade-in">
                  {t.key === "ops" ? (
                    <OperationsTab
                      getWithPopup={getWithPopup}
                      postWithPopup={postWithPopup}
                      showError={showError}
                      shopId={shopId}
                    />
                  ) : (
                    <div className="space-y-6">
                      <SummarySection
                        title={t.module.summaryTitle}
                        module={t.module}
                        state={t.state}
                      />
                      <ListSection
                        title={t.module.listTitle}
                        module={t.module}
                        state={t.state}
                      />
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
      <NeumorphicModal
        open={!!alertState}
        title={alertState?.title}
        confirmText="Cerrar"
        hideCancel
        variant={alertState?.variant}
        onConfirm={() => setAlertState(null)}
        solidBackdrop
      >
        {alertState?.message}
      </NeumorphicModal>
    </div>
  );
}
