import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import NeumorphicModal from "../components/NeumorphicModal.jsx";
import { Pudu, get, post } from "../services/api.js";
import JsonView from "../components/JsonView";

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
  if (
    s === "bellabot pro" ||
    s === "bella bot pro" ||
    s === "bellapro" ||
    s === "bellabotpro"
  )
    return "bellabot pro";
  if (s === "cc1") return "cc1";
  if (s === "flashbot" || s === "flash bot") return "flashbot";
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

// Tabla 100% responsive: scroll horizontal en móvil, thead oculto en móvil con mini-headers por celda
const renderTable = (rows, columns) => (
  <div className="mt-3 overflow-x-auto">
    <table className="min-w-max w-full">
      <thead className="hidden md:table-header-group">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0">
            {columns.map((col) => (
              <td key={col.key} className="px-3 py-2 align-top text-sm">
                <span className="block md:hidden text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                  {col.label}
                </span>
                <div className="whitespace-nowrap md:whitespace-normal">
                  {col.render ? col.render(r) : r[col.key] ?? 0}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// =========================
//  Configuración por módulo
// =========================
const MODULES = {
  delivery: {
    key: "delivery",
    summaryTitle: "Resumen del período (Delivery)",
    listTitle: "Detalle por robot/tienda (Delivery · paginado)",
    popupPrefix: "Delivery",
    pathSummary: "/data-board/v1/analysis/task/delivery",
    pathList: "/data-board/v1/analysis/task/delivery/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km operados", value: s.mileage ?? 0, prev: q.mileage },
        {
          label: "Horas de operación",
          value: s.duration ?? 0,
          prev: q.duration,
        },
        {
          label: "Mesas entregadas",
          value: s.table_count ?? 0,
          prev: q.table_count,
        },
        { label: "Bandejas", value: s.tray_count ?? 0, prev: q.tray_count },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "mileage (km)"),
      c("duration", "duration (h)"),
      c("table_count"),
      c("tray_count"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("table_count", "table"),
      c("tray_count", "tray"),
      c("task_count", "tasks"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("tray_count"),
        c("task_count"),
        c("speed", "speed (m/s)"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("tray_count"),
        c("task_count"),
        c("speed", "speed (m/s)"),
        c("work_days"),
      ],
    },
  },
  cruise: {
    key: "cruise",
    summaryTitle: "Machine mission analysis · Cruise mode",
    listTitle: "Detalle por robot/tienda (Cruise · paginado)",
    popupPrefix: "Cruise",
    pathSummary: "/data-board/v1/analysis/task/cruise",
    pathList: "/data-board/v1/analysis/task/cruise/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km operados", value: s.mileage ?? 0, prev: q.mileage },
        {
          label: "Horas de operación",
          value: s.duration ?? 0,
          prev: q.duration,
        },
        {
          label: "Interacciones",
          value: s.interactive_count ?? 0,
          prev: q.interactive_count,
        },
        {
          label: "Duración interacciones (h)",
          value: s.interactive_duration ?? 0,
          prev: q.interactive_duration,
        },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "mileage (km)"),
      c("duration", "duration (h)"),
      c("interactive_count"),
      c("interactive_duration", "interactive_duration (h)"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("interactive_count"),
      c("interactive_duration"),
      c("task_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("interactive_count"),
        c("interactive_duration"),
        c("task_count", "tasks"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("mileage"),
        c("duration"),
        c("interactive_count"),
        c("interactive_duration"),
        c("task_count", "tasks"),
        c("work_days"),
      ],
    },
  },
  greeter: {
    key: "greeter",
    summaryTitle: "Machine task analysis · Lead mode (Greeter)",
    listTitle: "Detalle por robot/tienda (Greeter · paginado)",
    popupPrefix: "Greeter",
    pathSummary: "/data-board/v1/analysis/task/greeter",
    pathList: "/data-board/v1/analysis/task/greeter/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km operados", value: s.mileage ?? 0, prev: q.mileage },
        {
          label: "Horas de operación",
          value: s.duration ?? 0,
          prev: q.duration,
        },
        {
          label: "Destinos/Leads",
          value: s.destination_count ?? 0,
          prev: q.destination_count,
        },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "mileage (km)"),
      c("duration", "duration (h)"),
      c("destination_count"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("destination_count"),
      c("task_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("destination_count"),
        c("task_count"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("mileage"),
        c("duration"),
        c("destination_count"),
        c("task_count"),
        c("work_days"),
      ],
    },
  },
  interactive: {
    key: "interactive",
    summaryTitle: "Interactive mode · resumen",
    listTitle: "Detalle por robot/tienda (Interactive · paginado)",
    popupPrefix: "Interactive",
    pathSummary: "/data-board/v1/analysis/task/interactive",
    pathList: "/data-board/v1/analysis/task/interactive/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        {
          label: "Interacciones",
          value: s.interactive_count ?? 0,
          prev: q.interactive_count,
        },
        { label: "Voces", value: s.voice_count ?? 0, prev: q.voice_count },
        {
          label: "Duración voz (h)",
          value: s.voice_duration ?? 0,
          prev: q.voice_duration,
        },
      ];
    },
    chartCols: [
      c("task_time"),
      c("interactive_count"),
      c("voice_count"),
      c("voice_duration", "voice_duration (h)"),
    ],
    qoqCols: [
      c("task_time"),
      c("interactive_count"),
      c("voice_count"),
      c("voice_duration", "voice_duration (h)"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("interactive_count"),
        c("voice_count"),
        c("voice_duration", "voice_duration (h)"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("interactive_count"),
        c("voice_count"),
        c("voice_duration", "voice_duration (h)"),
        c("work_days"),
      ],
    },
  },
  solicit: {
    key: "solicit",
    summaryTitle: "Customer collection / Pick-up · resumen",
    listTitle: "Detalle por robot/tienda (Pick-up · paginado)",
    popupPrefix: "Pick-up",
    pathSummary: "/data-board/v1/analysis/task/solicit",
    pathList: "/data-board/v1/analysis/task/solicit/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Horas operación", value: s.duration ?? 0, prev: q.duration },
        { label: "Saludos", value: s.play_count ?? 0, prev: q.play_count },
        {
          label: "Alcance",
          value: s.attach_persons ?? 0,
          prev: q.attach_persons,
        },
        {
          label: "Atraídos",
          value: s.attract_persons ?? 0,
          prev: q.attract_persons,
        },
        {
          label: "Interacciones",
          value: s.interactive_count ?? 0,
          prev: q.interactive_count,
        },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("duration", "duration (h)"),
      c("play_count"),
      c("attach_persons"),
      c("attract_persons"),
      c("interactive_count"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("duration", "duration (h)"),
      c("play_count"),
      c("attach_persons"),
      c("attract_persons"),
      c("interactive_count"),
      c("task_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("duration", "duration (h)"),
        c("play_count"),
        c("attach_persons"),
        c("attract_persons"),
        c("interactive_count"),
        c("task_count"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("duration", "duration (h)"),
        c("play_count"),
        c("attach_persons"),
        c("attract_persons"),
        c("interactive_count"),
        c("task_count"),
        c("work_days"),
      ],
    },
  },
  grid: {
    key: "grid",
    summaryTitle: "Grid clicks · resumen",
    listTitle: "Detalle por robot/tienda (Grid clicks · paginado)",
    popupPrefix: "Grid",
    pathSummary: "/data-board/v1/analysis/task/grid",
    pathList: "/data-board/v1/analysis/task/grid/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      const pair = (k, l) => ({ label: l, value: s[k] ?? 0, prev: q[k] });
      return [
        pair("take_me_in_count", "Clicks: llévame dentro"),
        pair("featured_item_count", "Clicks: destacados"),
        pair("favorable_promotions_count", "Clicks: promos"),
        pair("guide_to_menu_count", "Clicks: pick-up"),
        pair("poster_count", "Clicks: póster"),
        pair("usher_count", "Clicks: guía"),
        pair("dance_count", "Clicks: baile"),
        pair("video_poster_count", "Clicks: video"),
      ];
    },
    chartCols: [
      c("task_time"),
      c("take_me_in_count"),
      c("featured_item_count"),
      c("favorable_promotions_count"),
      c("guide_to_menu_count"),
      c("poster_count"),
      c("usher_count"),
      c("dance_count"),
      c("video_poster_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("take_me_in_count"),
      c("featured_item_count"),
      c("favorable_promotions_count"),
      c("guide_to_menu_count"),
      c("poster_count"),
      c("usher_count"),
      c("dance_count"),
      c("video_poster_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("take_me_in_count"),
        c("featured_item_count"),
        c("favorable_promotions_count"),
        c("guide_to_menu_count"),
        c("poster_count"),
        c("usher_count"),
        c("dance_count"),
        c("video_poster_count"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("take_me_in_count"),
        c("featured_item_count"),
        c("favorable_promotions_count"),
        c("guide_to_menu_count"),
        c("poster_count"),
        c("usher_count"),
        c("dance_count"),
        c("video_poster_count"),
        c("work_days"),
      ],
    },
  },
  ad: {
    key: "ad",
    summaryTitle: "Advertising mode · resumen",
    listTitle: "Detalle por robot/tienda (Advertising · paginado)",
    popupPrefix: "Advertising",
    pathSummary: "/data-board/v1/analysis/task/ad",
    pathList: "/data-board/v1/analysis/task/ad/paging",
    includeAdId: true,
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      const m = (label, val, prev) => ({ label, value: val ?? 0, prev });
      return [
        m("Tiny play (h)", s.tiny_play_duration, q?.tiny_play_duration),
        m("Tiny plays", s.tiny_play_times, q?.tiny_play_times),
        m("Big play (h)", s.big_play_duration, q?.big_play_duration),
        m("Big plays", s.big_play_times, q?.big_play_times),
      ];
    },
    chartCols: [
      c("task_time"),
      c("tiny_play_duration", "tiny_play_duration (h)"),
      c("tiny_play_times"),
      c("big_play_duration", "big_play_duration (h)"),
      c("big_play_times"),
    ],
    qoqCols: [
      c("task_time"),
      c("tiny_play_duration", "tiny_play_duration (h)"),
      c("tiny_play_times"),
      c("big_play_duration", "big_play_duration (h)"),
      c("big_play_times"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("tiny_play_duration", "tiny_play_duration (h)"),
        c("tiny_play_times"),
        c("big_play_duration", "big_play_duration (h)"),
        c("big_play_times"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("tiny_play_duration", "tiny_play_duration (h)"),
        c("tiny_play_times"),
        c("big_play_duration", "big_play_duration (h)"),
        c("big_play_times"),
        c("work_days"),
      ],
    },
  },
  recovery: {
    key: "recovery",
    summaryTitle: "Return / Recovery mode · resumen",
    listTitle: "Detalle por robot/tienda (Recovery · paginado)",
    popupPrefix: "Recovery",
    pathSummary: "/data-board/v1/analysis/task/recovery",
    pathList: "/data-board/v1/analysis/task/recovery/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km", value: s.mileage ?? 0, prev: q.mileage },
        { label: "Horas", value: s.duration ?? 0, prev: q.duration },
        { label: "Mesas", value: s.table_count ?? 0, prev: q.table_count },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "mileage (km)"),
      c("duration", "duration (h)"),
      c("table_count"),
      c("task_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("table_count"),
      c("task_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("task_count"),
        c("speed", "speed (m/s)"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("mileage"),
        c("duration"),
        c("table_count"),
        c("task_count"),
        c("speed", "speed (m/s)"),
        c("work_days"),
      ],
    },
  },
  call: {
    key: "call",
    summaryTitle: "Call pattern · resumen",
    listTitle: "Detalle por robot/tienda (Call pattern · paginado)",
    popupPrefix: "Call",
    pathSummary: "/data-board/v1/analysis/task/call",
    pathList: "/data-board/v1/analysis/task/call/paging",
    kpis: (res) => {
      const s = res?.summary || {};
      const q = res?.qoq || {};
      return [
        { label: "Km", value: s.mileage ?? 0, prev: q.mileage },
        { label: "Horas", value: s.duration ?? 0, prev: q.duration },
        { label: "Tareas", value: s.task_count ?? 0, prev: q.task_count },
        {
          label: "Destinos",
          value: s.destination_count ?? 0,
          prev: q.destination_count,
        },
        {
          label: "Destinos completados",
          value: s.finished_destination_count ?? 0,
          prev: q.finished_destination_count,
        },
      ];
    },
    chartCols: [
      c("task_time"),
      c("mileage", "mileage (km)"),
      c("duration", "duration (h)"),
      c("task_count"),
      c("destination_count"),
      c("finished_destination_count"),
    ],
    qoqCols: [
      c("task_time"),
      c("mileage"),
      c("duration"),
      c("task_count"),
      c("destination_count"),
      c("finished_destination_count"),
    ],
    listCols: {
      robot: [
        c("task_time"),
        c("sn"),
        c("robot_name"),
        c("product_code"),
        c("shop_name"),
        c("mileage"),
        c("duration"),
        c("task_count"),
        c("destination_count"),
        c("finished_destination_count"),
      ],
      shop: [
        c("task_time"),
        c("shop_id"),
        c("shop_name"),
        c("run_count"),
        c("bind_count"),
        c("mileage"),
        c("duration"),
        c("task_count"),
        c("destination_count"),
        c("finished_destination_count"),
        c("work_days"),
      ],
    },
  },
};

// =========================
//  Hook reutilizable por módulo
// =========================
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

  const [listTimeUnit, setListTimeUnit] = useState("auto"); // auto | day | hour | all
  const [groupBy, setGroupBy] = useState("robot"); // robot | shop
  const [limit, setLimit] = useState(10); // 1..20
  const [offset, setOffset] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listRes, setListRes] = useState(null);

  async function fetchSummary() {
    try {
      setLoadingSummary(true);
      setSummaryRes(null);
      const start = toUnixSec(startDate + "T00:00:00");
      const end = toUnixSec(endDate + "T23:59:59");
      const chosenUnit = chooseUnit(timeUnit, startDate, endDate);
      const params = {
        start_time: start,
        end_time: end,
        timezone_offset: Number(tzOffset),
        time_unit: chosenUnit,
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
      showError(e, `No se pudo obtener el análisis (${config.key})`);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function fetchList(customOffset = null) {
    try {
      setLoadingList(true);
      const start = toUnixSec(startDate + "T00:00:00");
      const end = toUnixSec(endDate + "T23:59:59");
      const chosenUnit = chooseUnit(listTimeUnit, startDate, endDate);
      const params = {
        start_time: start,
        end_time: end,
        timezone_offset: Number(tzOffset),
        time_unit: chosenUnit,
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
      showError(e, `No se pudo obtener la lista paginada (${config.key})`);
    } finally {
      setLoadingList(false);
    }
  }

  const clearSummary = () => setSummaryRes(null);
  const clearList = () => {
    setListRes(null);
    setOffset(0);
  };

  return {
    // summary
    timeUnit,
    setTimeUnit,
    loadingSummary,
    summaryRes,
    fetchSummary,
    clearSummary,
    // list
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
  };
}

// =========================
//  Secciones UI: Summary / List
// =========================
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
  const qoqChart = summaryRes?.qoq_chart || [];
  const kpis = useMemo(() => module.kpis(summaryRes), [summaryRes, module]);

  return (
    <Card className="lg:col-span-12">
      <h2>{title}</h2>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="min-w-0">
          <label className="block text-sm text-slate-500">time_unit</label>
          <select
            className="input w-full"
            value={timeUnit}
            onChange={(e) => setTimeUnit(e.target.value)}
          >
            <option value="auto">auto</option>
            <option value="day">day</option>
            <option value="hour">hour</option>
          </select>
          <p className="text-xs mt-1">auto: por día si &gt; 24h.</p>
        </div>
        <div className="md:col-span-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Button
                onClick={fetchSummary}
                disabled={loadingSummary}
                className="w-full"
              >
                {loadingSummary ? (
                  <>
                    <Spinner /> Consultando…
                  </>
                ) : (
                  "Consultar"
                )}
              </Button>
            </div>
            <div>
              <Button onClick={clearSummary} className="w-full">
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {summaryRes && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="stat-card">
              <div className="stat-label">{k.label}</div>
              <div className="stat-value">{k.value}</div>
              {k.prev != null && (
                <div className="stat-hint">Periodo previo: {k.prev}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {chart.length > 0 && renderTable(chart, module.chartCols)}
      {qoqChart.length > 0 && renderTable(qoqChart, module.qoqCols)}
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

  const makePager = (res, offsetVal, limitVal) => {
    const total = res?.total ?? 0;
    const from = total ? offsetVal + 1 : 0;
    const to = Math.min(offsetVal + Number(limitVal), total);
    const list = res?.list || [];
    return { total, from, to, list };
  };

  const { total, from, to, list } = makePager(listRes, offset, limit);

  return (
    <Card className="lg:col-span-12">
      <h2>{title}</h2>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <div className="min-w-0">
          <label className="block text-sm text-slate-500">group_by</label>
          <select
            className="input w-full"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            <option value="robot">robot</option>
            <option value="shop">shop</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-sm text-slate-500">
            time_unit (list)
          </label>
          <select
            className="input w-full"
            value={listTimeUnit}
            onChange={(e) => setListTimeUnit(e.target.value)}
          >
            <option value="auto">auto</option>
            <option value="day">day</option>
            <option value="hour">hour</option>
            <option value="all">all</option>
          </select>
          <p className="text-xs mt-1">“all” solo con group_by=shop.</p>
        </div>
        <div className="min-w-0">
          <label className="block text-sm text-slate-500">limit</label>
          <input
            className="input-neu w-full"
            value={limit}
            onChange={(e) =>
              setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 10)))
            }
            inputMode="numeric"
            placeholder="1..20"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-sm text-slate-500">offset</label>
          <input
            className="input-neu w-full"
            value={offset}
            onChange={(e) =>
              setOffset(Math.max(0, Number(e.target.value) || 0))
            }
            inputMode="numeric"
          />
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch">
            <div>
              <Button
                onClick={() => fetchList(0)}
                disabled={loadingList}
                className="w-full"
              >
                Consultar lista
              </Button>
            </div>
            <div>
              <Button onClick={clearList} className="w-full">
                Limpiar
              </Button>
            </div>
            {total > 0 && (
              <div className="text-sm text-slate-500 flex items-center justify-center sm:justify-end">
                Mostrando {from}-{to} de {total}
              </div>
            )}
          </div>
        </div>
      </div>

      {list.length > 0 && renderTable(list, module.listCols[groupBy])}

      {total > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch">
          <div>
            <Button
              onClick={() => fetchList(Math.max(0, offset - Number(limit)))}
              disabled={loadingList || offset === 0}
              className="w-full"
            >
              ← Anterior
            </Button>
          </div>
          <div>
            <Button
              onClick={() => fetchList(offset + Number(limit))}
              disabled={loadingList || offset + Number(limit) >= total}
              className="w-full"
            >
              Siguiente →
            </Button>
          </div>
          <div className="text-sm text-slate-500 flex items-center justify-center sm:justify-start">
            Página {Math.floor(offset / Number(limit)) + 1} · {from}-{to} de{" "}
            {total}
          </div>
        </div>
      )}
    </Card>
  );
}

function TabsNav({ tabs, activeKey, onChange }) {
  const handleKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.key === activeKey);
    if (e.key === "ArrowRight") {
      const next = tabs[(idx + 1) % tabs.length];
      onChange(next.key);
    } else if (e.key === "ArrowLeft") {
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      onChange(prev.key);
    }
  };

  return (
    <div className="relative -mx-1">
      <div className="overflow-x-auto px-1" onKeyDown={handleKeyDown}>
        <div
          role="tablist"
          aria-label="Módulos"
          className="min-w-full flex flex-nowrap gap-2 py-1"
        >
          {tabs.map((t) => {
            const active = t.key === activeKey;
            return (
              <button
                key={t.key}
                id={`tab-${t.key}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.key}`}
                onClick={() => onChange(t.key)}
                className={`btn-neu shrink-0 px-3 py-2 text-sm font-medium rounded-md border transition
                  ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
                  }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabPanel({ tabKey, activeKey, children }) {
  const active = tabKey === activeKey;
  return (
    <div
      role="tabpanel"
      id={`panel-${tabKey}`}
      aria-labelledby={`tab-${tabKey}`}
      hidden={!active}
      className="contents"
    >
      {active && children}
    </div>
  );
}

/**
 * =========================
 *  Pestaña: Operaciones
 * =========================
 */
function JsonBlock({ data }) {
  return (
    <pre className="mt-3 p-3 bg-slate-50 rounded-md overflow-x-auto text-xs">
      {data ? JSON.stringify(data, null, 2) : "// sin resultados"}
    </pre>
  );
}

function OperationsTab({ getWithPopup, postWithPopup, showError, shopId }) {
  // Campos comunes para esta pestaña
  const [sn, setSn] = useState("");
  const [needElements, setNeedElements] = useState(true);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // ---- Selector de robots (SN) ----
  const [robotsLoading, setRobotsLoading] = useState(false);
  const [robotsErr, setRobotsErr] = useState(null);
  const [robots, setRobots] = useState([]);
  const [manualSnMode, setManualSnMode] = useState(false);

  async function loadRobots() {
    try {
      setRobotsLoading(true);
      setRobotsErr(null);
      setRobots([]);
      const res = await Pudu.getRobots({ shop_id: shopId || undefined });

      const list =
        res?.data?.list ??
        res?.list ??
        res?.data?.data?.list ??
        (Array.isArray(res) ? res : []);

      const mapped = (Array.isArray(list) ? list : []).map((r) => {
        const productRaw =
          r?.product_code ??
          r?.product ??
          r?.productCode ??
          r?.productType ??
          r?.type ??
          "-";
        const snVal =
          r?.sn ?? r?.device_sn ?? r?.robot_sn ?? r?.serial ?? r?.id ?? "-";
        const productKey = normalizeProductName(productRaw);
        const img = productKey ? PRODUCT_IMAGES[productKey] : null;
        return {
          productRaw,
          productKey,
          sn: snVal,
          img,
          label: `${productRaw} - ${snVal}`,
        };
      });

      const seen = new Set();
      const unique = mapped.filter((it) => {
        const key = `${it.productKey || "x"}::${it.sn || it.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setRobots(unique);

      // autoseleccionar si hay solo uno
      if (unique.length === 1) {
        setManualSnMode(false);
        setSn(unique[0].sn);
      }
    } catch (e) {
      setRobotsErr(e?.response?.data || e?.message || String(e));
    } finally {
      setRobotsLoading(false);
    }
  }

  // recargar lista al cambiar shopId
  useEffect(() => {
    loadRobots();
  }, [shopId]);

  // Mapas / puntos
  const [mapName, setMapName] = useState("");
  const [pointsList, setPointsList] = useState([]);
  const [mapsList, setMapsList] = useState([]);
  const [currentMap, setCurrentMap] = useState(null);

  // Llamadas
  const [callDeviceName, setCallDeviceName] = useState("appKey");
  const [callMapName, setCallMapName] = useState("");
  const [callPoint, setCallPoint] = useState("");
  const [callPointType, setCallPointType] = useState("");
  const [callMode, setCallMode] = useState("");
  const [modeData, setModeData] = useState(
    JSON.stringify(
      {
        urls: [],
        switch_time: 2,
        play_count: 1,
        cancel_btn_time: 0,
        show_timeout: 30,
        qrcode: "",
        text: "",
      },
      null,
      2
    )
  );
  const [taskId, setTaskId] = useState("");
  const [nextCallTask, setNextCallTask] = useState(
    JSON.stringify(
      {
        map_name: "",
        point: "",
        point_type: "table",
        call_device_name: "appKey",
        call_mode: "",
        mode_data: {},
      },
      null,
      2
    )
  );

  // Puertas y pantalla
  const [doorNumber, setDoorNumber] = useState("H_01");
  const [doorOp, setDoorOp] = useState(true);
  const [screenContent, setScreenContent] = useState("content");
  const [screenShow, setScreenShow] = useState(true);

  // Posición
  const [posInterval, setPosInterval] = useState(3);
  const [posTimes, setPosTimes] = useState(1);

  // Delivery / Transport
  const [deliveryPayload, setDeliveryPayload] = useState(
    JSON.stringify(
      {
        type: "NEW",
        delivery_sort: "AUTO",
        execute_task: false,
        trays: [{ destinations: [{ points: "A1", id: "1111" }] }],
      },
      null,
      2
    )
  );
  const [deliveryAction, setDeliveryAction] = useState("START"); // START | COMPLETE | CANCEL_ALL_DELIVERY

  const [transportPayload, setTransportPayload] = useState(
    JSON.stringify(
      {
        task_id: "",
        type: "NEW",
        delivery_sort: "AUTO",
        execute_task: false,
        start_point: { destination: "", content_type: "IMG", content_data: "" },
        start_wait_time: 10,
        end_wait_time: 10,
        priority: 1,
        trays: [
          {
            destinations: [
              { points: "A1", id: "1111", name: "item", amount: 1 },
            ],
          },
        ],
      },
      null,
      2
    )
  );
  const [transportAction, setTransportAction] = useState("START");

  // Cancel task
  const [cancelTasksPayload, setCancelTasksPayload] = useState(
    JSON.stringify({ tasks: [{ name: "A1", type: "DIRECT" }] }, null, 2)
  );

  // Estados / grupos / robots
  const [groupId, setGroupId] = useState("");
  const [device, setDevice] = useState("");
  const [robotsGroupId, setRobotsGroupId] = useState("");
  const [doorCapturePid, setDoorCapturePid] = useState("");

  // Tray order
  const [trayOrderPayload, setTrayOrderPayload] = useState(
    JSON.stringify(
      {
        orders: [
          {
            table_no: "2",
            table_name: "A2",
            name: "Tea",
            amount: 1,
            id: "id-1",
          },
        ],
      },
      null,
      2
    )
  );

  // Grouping POST
  const [groupMapName, setGroupMapName] = useState("");

  // A2B (errand) + control
  const [errandPayload, setErrandPayload] = useState(
    JSON.stringify(
      {
        auth: "0000",
        tasks: [
          {
            task_name: "task 1",
            task_desc: "desc",
            point_list: [
              {
                map_name: "map 1",
                map_code: "xxxx",
                point: "front desk",
                point_type: "table",
                mobile: "",
                verification_code: "",
                remark: "",
              },
            ],
          },
        ],
      },
      null,
      2
    )
  );
  const [errandActionSession, setErrandActionSession] = useState("");
  const [errandActionType, setErrandActionType] = useState("CANCEL");
  const [errandActionAuth, setErrandActionAuth] = useState("");

  // Helper
  const parseJSON = (txt, fallback = {}) => {
    try {
      const v = txt ? JSON.parse(txt) : fallback;
      return v ?? fallback;
    } catch (e) {
      showError(e, "JSON inválido");
      throw e;
    }
  };

  // Handlers (cada botón tiene su propio espacio y su propio handler)
  const run = async (fn) => {
    try {
      setBusy(true);
      const data = await fn();
      setResult(data?.data || data);
      return data;
    } finally {
      setBusy(false);
    }
  };

  // Mapas
  const handleListMaps = () =>
    run(() =>
      getWithPopup("Operaciones · Listar mapas", "/map-service/v1/open/list", {
        sn,
      }).then((r) => {
        const list = r?.data?.list || r?.list || [];
        setMapsList(list);
        return r;
      })
    );

  const handleCurrentMap = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Mapa actual",
        "/map-service/v1/open/current",
        { sn, need_element: needElements }
      ).then((r) => {
        setCurrentMap(r?.data || r);
        return r;
      })
    );

  const handlePoints = () =>
    run(() =>
      getWithPopup("Operaciones · Puntos", "/map-service/v1/open/point", {
        sn,
        limit,
        offset,
      }).then((r) => {
        const list = r?.data?.list || r?.list || [];
        setPointsList(list);
        return r;
      })
    );

  // Llamadas
  const handleCall = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Llamar",
        "/open-platform-service/v1/custom_call",
        {
          sn,
          map_name: callMapName,
          point: callPoint,
          point_type: callPointType || undefined,
          call_device_name: callDeviceName,
          call_mode: callMode || undefined,
          mode_data: parseJSON(modeData, {}),
        }
      )
    );

  const handleCancelCall = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Cancelar llamada",
        "/open-platform-service/v1/custom_call/cancel",
        { task_id: taskId, call_device_name: callDeviceName }
      )
    );

  const handleCompleteCall = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Completar llamada",
        "/open-platform-service/v1/custom_call/complete",
        {
          task_id: taskId,
          call_device_name: callDeviceName,
          next_call_task: parseJSON(nextCallTask, undefined),
        }
      )
    );

  // Energía
  const handleRechargeV1 = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Recargar (v1)",
        "/open-platform-service/v1/recharge",
        {
          sn,
        }
      )
    );
  const handleRechargeV2 = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Recargar (v2)",
        "/open-platform-service/v2/recharge",
        {
          sn,
        }
      )
    );

  // Puertas
  const handleDoorState = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Estado de puertas",
        "/open-platform-service/v1/door_state",
        {
          sn,
        }
      )
    );

  const handleControlDoors = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Control de puertas",
        "/open-platform-service/v1/control_doors",
        {
          sn,
          payload: {
            control_states: [{ door_number: doorNumber, operation: !!doorOp }],
          },
        }
      )
    );

  // Pantalla
  const handleScreenSet = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Pantalla",
        "/open-platform-service/v1/robot/screen/set",
        {
          sn,
          payload: { info: { content: screenContent, show: !!screenShow } },
        }
      )
    );

  // Posición
  const handlePositionCmd = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Comando de posición",
        "/open-platform-service/v1/position_command",
        {
          sn,
          payload: {
            interval: Number(posInterval),
            times: Number(posTimes) || 1,
            source: "openAPI",
          },
        }
      )
    );

  // Delivery
  const handleDeliveryTask = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Delivery task",
        "/open-platform-service/v1/delivery_task",
        {
          sn,
          payload: parseJSON(deliveryPayload, {}),
        }
      )
    );

  const handleDeliveryAction = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Delivery action",
        "/open-platform-service/v1/delivery_action",
        {
          sn,
          payload: { action: deliveryAction },
        }
      )
    );

  // Transport
  const handleTransportTask = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Transport task",
        "/open-platform-service/v1/transport_task",
        {
          sn,
          payload: parseJSON(transportPayload, {}),
        }
      )
    );

  const handleTransportAction = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Transport action",
        "/open-platform-service/v1/transport_action",
        {
          sn,
          payload: { action: transportAction },
        }
      )
    );

  // Map switch (ascensor)
  const handleSwitchInElevator = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Cambiar mapa (ascensor)",
        "/open-platform-service/v1/robot/map/switch_in_elevator",
        {
          sn,
          payload: {
            map: { name: mapName, floor: String(currentMap?.floor || "") },
          },
        }
      )
    );

  // Cancel task
  const handleCancelTask = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Cancelar tareas",
        "/open-platform-service/v1/cancel_task",
        {
          sn,
          payload: parseJSON(cancelTasksPayload, {}),
        }
      )
    );

  // Estados
  const handleStatusBySn = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Estado por SN",
        "/open-platform-service/v1/status/get_by_sn",
        {
          sn,
        }
      )
    );

  const handleStatusByGroup = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Estado por grupo",
        "/open-platform-service/v1/status/get_by_group_id",
        { group_id: groupId }
      )
    );

  // Grupos y robots
  const handleGroupList = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Grupos vinculados",
        "/open-platform-service/v1/robot/group/list",
        {
          device: device || undefined,
          shop_id: shopId || undefined,
        }
      )
    );

  const handleRobotsByGroup = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Robots por grupo",
        "/open-platform-service/v1/robot/list_by_device_and_group",
        { group_id: robotsGroupId }
      )
    );

  // Estado de tarea actual
  const handleRobotTaskState = () =>
    run(() =>
      getWithPopup(
        "Operaciones · Estado de tarea en ejecución",
        "/open-platform-service/v1/robot/task/state/get",
        { sn }
      )
    );

  // Tray order
  const handleTrayOrder = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Tray order",
        "/open-platform-service/v1/tray_order",
        {
          sn,
          payload: parseJSON(trayOrderPayload, {}),
        }
      )
    );

  // Agrupación de puntos (map tool)
  const handlePointGrouping = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Agrupación de puntos",
        "/map-service/v1/open/group",
        {
          sn,
          map_name: groupMapName,
        }
      )
    );

  // A2B (errand) + control
  const handleErrandTask = () =>
    run(() =>
      postWithPopup(
        "Operaciones · A2B (errand)",
        "/open-platform-service/v1/task_errand",
        {
          sn,
          payload: parseJSON(errandPayload, {}),
        }
      )
    );

  const handleErrandAction = () =>
    run(() =>
      postWithPopup(
        "Operaciones · A2B control",
        "/open-platform-service/v1/errand_action",
        {
          sn,
          payload: {
            session_id: errandActionSession,
            action: errandActionType,
            auth: errandActionAuth || undefined,
          },
        }
      )
    );

  // Door Capture
  const handleDoorCapture = () =>
    run(() =>
      postWithPopup(
        "Operaciones · Door Capture",
        "/biz-open-service/v1/robotDoor/task_list",
        {
          pid: doorCapturePid || sn,
          limit,
          offset,
        }
      )
    );

  // Tab content
  return (
    <>
      {/* Controles comunes de la pestaña */}
      <Card className="lg:col-span-12">
        <h2>Operaciones · Controles comunes</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="min-w-0">
            <label className="block text-sm text-slate-500">sn (robot)</label>
            <div className="flex flex-wrap gap-2">
              <select
                className="input-neu w-full sm:flex-1"
                value={
                  manualSnMode
                    ? "__manual__"
                    : robots.find((r) => r.sn === sn)
                    ? sn
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__manual__") {
                    setManualSnMode(true);
                  } else {
                    setManualSnMode(false);
                    setSn(v);
                  }
                }}
                title="Selecciona un robot por SN"
              >
                <option value="">— seleccionar SN —</option>
                {robots.map((r) => (
                  <option key={r.sn} value={r.sn}>
                    {r.sn} · {r.productRaw}
                  </option>
                ))}
                <option value="__manual__">Escribir SN</option>
              </select>

              <Button
                onClick={loadRobots}
                disabled={robotsLoading}
                className="w-full sm:w-auto"
              >
                {robotsLoading ? (
                  <>
                    <Spinner /> Actualizando…
                  </>
                ) : (
                  "Actualizar lista"
                )}
              </Button>
            </div>

            {robotsErr && (
              <div className="text-xs text-red-600 mt-1">
                {String(robotsErr)}
              </div>
            )}

            {manualSnMode && (
              <input
                className="input-neu w-full mt-2"
                value={sn}
                onChange={(e) => setSn(e.target.value)}
                placeholder="OP..."
              />
            )}

            {!robotsLoading && !robotsErr && !!robots.length && (
              <div className="text-xs text-foreground/60 mt-1">
                {robots.length} robot(s) disponibles para seleccionar.
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-slate-500">limit</label>
            <input
              className="input-neu w-full"
              value={limit}
              onChange={(e) =>
                setLimit(Math.max(0, Number(e.target.value) || 0))
              }
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">offset</label>
            <input
              className="input-neu w-full"
              value={offset}
              onChange={(e) =>
                setOffset(Math.max(0, Number(e.target.value) || 0))
              }
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">
              need_element (mapa actual)
            </label>
            <select
              className="input-neu w-full"
              value={needElements}
              onChange={(e) => setNeedElements(e.target.value === "true")}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <Button
                disabled={busy}
                onClick={() => setResult(null)}
                className="w-full"
              >
                Limpiar resultado
              </Button>
            </div>
          </div>
          {busy && (
            <div className="flex items-end">
              <div className="w-full">
                <Button disabled className="w-full">
                  <Spinner /> Procesando…
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Mapas */}
      <Card className="lg:col-span-12">
        <h2>Mapas y puntos</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <Button className="w-full" onClick={handleListMaps} disabled={busy}>
              Listar mapas
            </Button>
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleCurrentMap}
              disabled={busy}
            >
              Mapa actual
            </Button>
          </div>
          <div>
            <Button className="w-full" onClick={handlePoints} disabled={busy}>
              Puntos (lista)
            </Button>
          </div>
          <div>
            <label className="block text-sm text-slate-500">
              map_name (switch/elevador)
            </label>
            <input
              className="input-neu w-full"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            />
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleSwitchInElevator}
              disabled={busy || !mapName}
            >
              Cambiar mapa en ascensor
            </Button>
          </div>
        </div>

        {mapsList.length > 0 &&
          renderTable(mapsList, [c("name", "name"), c("floor", "floor")])}

        {pointsList.length > 0 &&
          renderTable(pointsList, [
            c("name"),
            c("type"),
            c("x"),
            c("y"),
            c("z"),
          ])}

        {currentMap && (
          <div className="mt-3 text-sm text-slate-600">
            Mapa actual: <b>{currentMap?.name}</b> · piso:{" "}
            <b>{currentMap?.floor}</b>{" "}
            {Array.isArray(currentMap?.elements) && (
              <span>· elementos: {currentMap.elements.length}</span>
            )}
          </div>
        )}
      </Card>

      {/* Llamadas */}
      <Card className="lg:col-span-12">
        <h2>Llamadas (custom_call)</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm text-slate-500">
              call_device_name
            </label>
            <input
              className="input-neu w-full"
              value={callDeviceName}
              onChange={(e) => setCallDeviceName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">map_name</label>
            <input
              className="input-neu w-full"
              value={callMapName}
              onChange={(e) => setCallMapName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">point</label>
            <input
              className="input-neu w-full"
              value={callPoint}
              onChange={(e) => setCallPoint(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">
              point_type (opcional)
            </label>
            <input
              className="input-neu w-full"
              value={callPointType}
              onChange={(e) => setCallPointType(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">call_mode</label>
            <select
              className="input w-full"
              value={callMode}
              onChange={(e) => setCallMode(e.target.value)}
            >
              <option value="">(vacío)</option>
              <option value="IMG">IMG</option>
              <option value="QR_CODE">QR_CODE</option>
              <option value="VIDEO">VIDEO</option>
              <option value="CALL_CONFIRM">CALL_CONFIRM</option>
              <option value="CALL">CALL</option>
            </select>
          </div>
          <div>
            <Button className="w-full" onClick={handleCall} disabled={busy}>
              Llamar
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <label className="block text-sm text-slate-500">
            mode_data (JSON)
          </label>
          <textarea
            className="input-neu w-full h-36"
            value={modeData}
            onChange={(e) => setModeData(e.target.value)}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-slate-500">task_id</label>
            <input
              className="input-neu w-full"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            />
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleCancelCall}
              disabled={busy || !taskId}
            >
              Cancelar llamada
            </Button>
          </div>
          <div className="lg:col-span-2">
            <Button
              className="w-full"
              onClick={handleCompleteCall}
              disabled={busy || !taskId}
            >
              Completar llamada
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <label className="block text-sm text-slate-500">
            next_call_task (JSON opcional)
          </label>
          <textarea
            className="input-neu w-full h-32"
            value={nextCallTask}
            onChange={(e) => setNextCallTask(e.target.value)}
          />
        </div>
      </Card>

      {/* Energía / Puertas / Pantalla / Posición */}
      <Card className="lg:col-span-12">
        <h2>Robot · Energía, Puertas, Pantalla y Posición</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Button
              className="w-full"
              onClick={handleRechargeV1}
              disabled={busy}
            >
              Recargar (v1)
            </Button>
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleRechargeV2}
              disabled={busy}
            >
              Recargar (v2)
            </Button>
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleDoorState}
              disabled={busy}
            >
              Estado de puertas
            </Button>
          </div>
          <div>
            <label className="block text-sm text-slate-500">door_number</label>
            <input
              className="input-neu w-full"
              value={doorNumber}
              onChange={(e) => setDoorNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">operation</label>
            <select
              className="input w-full"
              value={doorOp}
              onChange={(e) => setDoorOp(e.target.value === "true")}
            >
              <option value="true">abrir</option>
              <option value="false">cerrar</option>
            </select>
          </div>
          <div>
            <Button
              className="w-full"
              onClick={handleControlDoors}
              disabled={busy}
            >
              Controlar puerta
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-3">
            <label className="block text-sm text-slate-500">
              screen.content
            </label>
            <input
              className="input-neu w-full"
              value={screenContent}
              onChange={(e) => setScreenContent(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">screen.show</label>
            <select
              className="input w-full"
              value={screenShow}
              onChange={(e) => setScreenShow(e.target.value === "true")}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <Button
              className="w-full"
              onClick={handleScreenSet}
              disabled={busy}
            >
              Actualizar pantalla
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-sm text-slate-500">
              pos.interval (s)
            </label>
            <input
              className="input-neu w-full"
              value={posInterval}
              onChange={(e) => setPosInterval(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500">pos.times</label>
            <input
              className="input-neu w-full"
              value={posTimes}
              onChange={(e) => setPosTimes(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="lg:col-span-2">
            <Button
              className="w-full"
              onClick={handlePositionCmd}
              disabled={busy}
            >
              Enviar comando de posición
            </Button>
          </div>
        </div>
      </Card>

      {/* Delivery / Transport */}
      <Card className="lg:col-span-12">
        <h2>Delivery / Transport</h2>
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium">delivery_task</h3>
            <textarea
              className="input-neu w-full h-40"
              value={deliveryPayload}
              onChange={(e) => setDeliveryPayload(e.target.value)}
            />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-slate-500">
                  delivery_action
                </label>
                <select
                  className="input w-full"
                  value={deliveryAction}
                  onChange={(e) => setDeliveryAction(e.target.value)}
                >
                  <option value="START">START</option>
                  <option value="COMPLETE">COMPLETE</option>
                  <option value="CANCEL_ALL_DELIVERY">
                    CANCEL_ALL_DELIVERY
                  </option>
                </select>
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleDeliveryTask}
                  disabled={busy}
                >
                  Enviar delivery_task
                </Button>
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleDeliveryAction}
                  disabled={busy}
                >
                  Enviar delivery_action
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">transport_task</h3>
            <textarea
              className="input-neu w-full h-40"
              value={transportPayload}
              onChange={(e) => setTransportPayload(e.target.value)}
            />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-slate-500">
                  transport_action
                </label>
                <select
                  className="input w-full"
                  value={transportAction}
                  onChange={(e) => setTransportAction(e.target.value)}
                >
                  <option value="START">START</option>
                  <option value="COMPLETE">COMPLETE</option>
                  <option value="CANCEL_ALL_DELIVERY">
                    CANCEL_ALL_DELIVERY
                  </option>
                </select>
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleTransportTask}
                  disabled={busy}
                >
                  Enviar transport_task
                </Button>
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleTransportAction}
                  disabled={busy}
                >
                  Enviar transport_action
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cancelar tareas / Estado / Grupos / Robots */}
      <Card className="lg:col-span-12">
        <h2>Gestión de tareas y estado</h2>
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium">Cancelar tareas</h3>
            <textarea
              className="input-neu w-full h-28"
              value={cancelTasksPayload}
              onChange={(e) => setCancelTasksPayload(e.target.value)}
            />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Button
                  className="w-full"
                  onClick={handleCancelTask}
                  disabled={busy}
                >
                  Cancelar
                </Button>
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleRobotTaskState}
                  disabled={busy}
                >
                  Estado tarea actual
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">Estado / Grupos / Robots</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Button
                  className="w-full"
                  onClick={handleStatusBySn}
                  disabled={busy}
                >
                  Estado por SN
                </Button>
              </div>
              <div>
                <label className="block text-sm text-slate-500">group_id</label>
                <input
                  className="input-neu w-full"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                />
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleStatusByGroup}
                  disabled={busy || !groupId}
                >
                  Estado por grupo
                </Button>
              </div>

              <div>
                <label className="block text-sm text-slate-500">
                  device (para grupos)
                </label>
                <input
                  className="input-neu w-full"
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  placeholder="device_id"
                />
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleGroupList}
                  disabled={busy}
                >
                  Listar grupos
                </Button>
              </div>

              <div>
                <label className="block text-sm text-slate-500">
                  group_id (robots)
                </label>
                <input
                  className="input-neu w-full"
                  value={robotsGroupId}
                  onChange={(e) => setRobotsGroupId(e.target.value)}
                />
              </div>
              <div>
                <Button
                  className="w-full"
                  onClick={handleRobotsByGroup}
                  disabled={busy || !robotsGroupId}
                >
                  Robots del grupo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tray orders / Agrupación / Door Capture / A2B */}
      <Card className="lg:col-span-12">
        <h2>Pedidos a bandejas · Agrupación de puntos · Door Capture · A2B</h2>
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium">Tray order</h3>
            <textarea
              className="input-neu w-full h-28"
              value={trayOrderPayload}
              onChange={(e) => setTrayOrderPayload(e.target.value)}
            />
            <div className="mt-2">
              <Button
                className="w-full"
                onClick={handleTrayOrder}
                disabled={busy}
              >
                Enviar tray_order
              </Button>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">
                Agrupación de puntos (map tool)
              </h3>
              <label className="block text-sm text-slate-500">map_name</label>
              <input
                className="input-neu w-full"
                value={groupMapName}
                onChange={(e) => setGroupMapName(e.target.value)}
              />
              <div className="mt-2">
                <Button
                  className="w-full"
                  onClick={handlePointGrouping}
                  disabled={busy || !groupMapName}
                >
                  Obtener agrupación
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">Door Capture</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-sm text-slate-500">pid (SN)</label>
                <input
                  className="input-neu w-full"
                  value={doorCapturePid}
                  onChange={(e) => setDoorCapturePid(e.target.value)}
                  placeholder="por defecto usa SN"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500">limit</label>
                <input
                  className="input-neu w-full"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 10)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500">offset</label>
                <input
                  className="input-neu w-full"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value) || 0)}
                  inputMode="numeric"
                />
              </div>
              <div className="sm:col-span-3">
                <Button
                  className="w-full"
                  onClick={handleDoorCapture}
                  disabled={busy}
                >
                  Consultar Door Capture
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">A2B (errand)</h3>
              <textarea
                className="input-neu w-full h-28"
                value={errandPayload}
                onChange={(e) => setErrandPayload(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Button
                    className="w-full"
                    onClick={handleErrandTask}
                    disabled={busy}
                  >
                    Enviar A2B (task_errand)
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    className="input-neu w-full"
                    placeholder="session_id"
                    value={errandActionSession}
                    onChange={(e) => setErrandActionSession(e.target.value)}
                  />
                  <select
                    className="input w-full"
                    value={errandActionType}
                    onChange={(e) => setErrandActionType(e.target.value)}
                  >
                    <option value="CANCEL">CANCEL</option>
                    <option value="RETRY">RETRY</option>
                  </select>
                  <input
                    className="input-neu w-full"
                    placeholder="auth (opcional)"
                    value={errandActionAuth}
                    onChange={(e) => setErrandActionAuth(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    className="w-full"
                    onClick={handleErrandAction}
                    disabled={busy || !errandActionSession}
                  >
                    Control A2B (errand_action)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Panel de resultados */}
      <Card className="lg:col-span-12">
        <h2>Resultado</h2>
        <JsonView className="card-response" data={result} />
      </Card>
    </>
  );
}

export default function Apibella() {
  // Controles comunes
  const [shopId, setShopId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [tzOffset, setTzOffset] = useState(getDefaultTzHours());
  const [adId, setAdId] = useState(""); // opcional, solo afecta módulo Advertising

  // Alertas
  const [alertState, setAlertState] = useState(null);
  const showError = (e, title = "Error") => {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.code ||
      e?.message ||
      String(e);
    setAlertState({ title, message: msg, variant: "error" });
  };
  const showOk = (title, res) => {
    const msg = res?.message ?? "ok";
    setAlertState({ title, message: msg, variant: "success" });
  };
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

  // Hooks por módulo (usan misma infraestructura)
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
    // Nueva pestaña: Operaciones
    { key: "ops", label: "Operaciones" },
  ];

  const [activeTab, setActiveTab] = useState(tabs[0].key);
  const logicTabs = tabs.filter((t) => t.state); // solo los modulares para el spinner global
  const anyLoading = logicTabs.some(
    (t) => t.state.loadingSummary || t.state.loadingList
  );

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Encabezado + Controles comunes */}
        <Card className="lg:col-span-12">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="min-w-0">
              Machine task analysis · Distribution line
            </h2>
            {anyLoading && <Spinner />}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">
                shop_id (opcional)
              </label>
              <input
                className="input-neu w-full"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                placeholder="Ej: 331300000"
                inputMode="numeric"
              />
              <p className="text-xs mt-1">
                Si lo dejas vacío, consulta global (según permisos).
              </p>
            </div>
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">Inicio</label>
              <input
                type="date"
                className="input-neu w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">Fin</label>
              <input
                type="date"
                className="input-neu w-full"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">
                timezone_offset (h)
              </label>
              <input
                className="input-neu w-full"
                value={tzOffset}
                onChange={(e) => setTzOffset(e.target.value)}
                placeholder="Ej: 8 para UTC+8"
                inputMode="numeric"
              />
              <p className="text-xs mt-1">
                Rango: -12 a 14. Por defecto: tu zona.
              </p>
            </div>
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">
                ad_id (opcional)
              </label>
              <input
                className="input-neu w-full"
                value={adId}
                onChange={(e) => setAdId(e.target.value)}
                placeholder="Ej: 123"
                inputMode="numeric"
              />
              <p className="text-xs mt-1">Filtra endpoints de publicidad.</p>
            </div>
          </div>
        </Card>

        {/* NAV DE PESTAÑAS */}
        <Card className="lg:col-span-12 sticky top-0 z-10">
          <TabsNav tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        </Card>

        {/* PANELES (contenido por pestaña) */}
        {tabs.map((t) => (
          <TabPanel key={t.key} tabKey={t.key} activeKey={activeTab}>
            {t.key !== "ops" ? (
              <>
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
              </>
            ) : (
              <OperationsTab
                getWithPopup={getWithPopup}
                postWithPopup={postWithPopup}
                showError={showError}
                shopId={shopId}
              />
            )}
          </TabPanel>
        ))}
      </div>

      {/* Modal de alertas */}
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
        <div className="whitespace-pre-wrap break-words">
          {alertState?.message}
        </div>
      </NeumorphicModal>
    </div>
  );
}
