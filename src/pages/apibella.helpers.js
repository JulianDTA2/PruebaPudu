// src/pages/apibella.helpers.js
// --- ARCHIVO COMPLETO Y CORREGIDO ---

import { get } from "../services/api.js";
import { useState, useMemo } from "react";

/* =========================
 * Constantes / Helpers
 * ========================= */

export const PRODUCT_IMAGES = {
  bellabot:
    "https://cdn.pudutech.com/website/images/pc/bellabot/parameter2.2.0.png",
  cc1: "https://cdn.pudutech.com/website/images/cc1/parameters_robot_en.png",
  "bellabot pro":
    "https://cdn.pudutech.com/official-website/bellabotpro/S13_1.png",
  flashbot:
    "https://cdn.pudutech.com/official-website/flashbot_new/s16-tuya.webp",
};

/** Normaliza el nombre/código del producto para matchear el mapeo */
export function normalizeProductName(raw) {
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

/** Utils de tiempo/unidades */
export const toUnixSec = (d) => Math.floor(new Date(d).getTime() / 1000);
export const diffDays = (a, b) =>
  Math.max(0, Math.round((toUnixSec(b) - toUnixSec(a)) / 86400));
export const getDefaultTzHours = () =>
  Math.round(-new Date().getTimezoneOffset() / 60);
export const chooseUnit = (choice, startDate, endDate) =>
  choice === "auto"
    ? diffDays(startDate, endDate) > 1
      ? "day"
      : "hour"
    : choice;

/** Helper columnas para tablas */
export const c = (key, label = key) => ({ key, label });

// (MÓDULOS COMPLETOS)
export const MODULES = {
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

/**
 * Hook reutilizable por módulo
 */
export function useModule({
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
