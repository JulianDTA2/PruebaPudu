import React, { useMemo, useState, useEffect } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { get, post } from "../services/api";

const DOC_ENDPOINTS = [
  {
    id: "shops_list",
    label: "Get Lista de Tiendas",
    path: "/data-open-platform-service/v1/api/shop",
    method: "GET",
    params: [
      { name: "limit", type: "int", required: false, hint: "Default 10" },
      { name: "offset", type: "int", required: false, hint: "Default 0" },
    ],
  },
  {
    id: "robots_list",
    label: "Get Lista de Maquinas",
    path: "/data-open-platform-service/v1/api/robot",
    method: "GET",
    params: [
      { name: "limit", type: "int", required: false },
      { name: "offset", type: "int", required: false },
      { name: "shop_id", type: "int", required: false },
      { name: "product_code", type: "string[]", required: false, hint: "Comma-separated" },
    ],
  },
  {
    id: "maps_list",
    label: "Get Lista de Mapas",
    path: "/data-open-platform-service/v1/api/maps",
    method: "GET",
    params: [{ name: "shop_id", type: "int", required: true }],
  },
  {
    id: "map_detail_cc1",
    label: "Get Detalles de Mapa (CC1)",
    path: "/data-open-platform-service/v1/api/map",
    method: "GET",
    params: [
      { name: "shop_id", type: "int", required: true },
      { name: "map_name", type: "string", required: true },
      { name: "device_width", type: "int", required: true, default: 1200 },
      { name: "device_height", type: "int", required: true, default: 800 },
    ],
  },
  {
    id: "robot_pos_cc1",
    label: "Posicion Actual (CC1)",
    path: "/data-open-platform-service/v1/api/map/robotCurrentPosition",
    method: "GET",
    params: [
      { name: "shop_id", type: "int", required: true },
      { name: "sn", type: "string", required: true },
    ],
  },
  {
    id: "map_detail_all",
    label: "Get Detalles de Mapa (All products)",
    path: "/data-open-platform-service/v1/api/map",
    method: "GET",
    params: [
      { name: "shop_id", type: "int", required: true },
      { name: "map_name", type: "string", required: true },
      { name: "device_width", type: "int", required: true, default: 1200 },
      { name: "device_height", type: "int", required: true, default: 800 },
    ],
  },
  {
    id: "robot_pos_all",
    label: "Posicion Actual (Todos los Productos)",
    path: "/open-platform-service/v1/robot/get_position",
    method: "GET",
    params: [{ name: "sn", type: "string", required: true }],
  },
];

function mergeUnique(prevArray, nextValues) {
  const set = new Set(prevArray);
  nextValues.forEach((v) => v != null && v !== "" && set.add(String(v)));
  return Array.from(set);
}

function Spinner({ className = "" }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
    </svg>
  );
}

export default function ApiExplorer() {
  const [endpointId, setEndpointId] = useState("maps_list");
  const endpoint = useMemo(() => DOC_ENDPOINTS.find((e) => e.id === endpointId), [endpointId]);

  const initialParams = useMemo(() => {
    const obj = {};
    endpoint.params.forEach((p) => {
      if (p.default != null) obj[p.name] = String(p.default);
    });
    return obj;
  }, [endpoint]);
  const [paramsState, setParamsState] = useState(initialParams);

  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const [knownShopIds, setKnownShopIds] = useState([]);
  const [knownSNs, setKnownSNs] = useState([]);
  const [knownMapNames, setKnownMapNames] = useState([]);

  useEffect(() => {
    setParamsState(initialParams);
    setErr(null);
    setRes(null);
  }, [initialParams]);

  function buildParamsObject() {
    const out = {};
    endpoint.params.forEach((p) => {
      const v = paramsState[p.name];
      if (v != null && v !== "") out[p.name] = v;
    });
    return out;
  }

  function harvestSuggestions(payload) {
    const d = payload?.data;
    const list = Array.isArray(d?.list) ? d.list : null;

    if (list && list.length) {
      setKnownShopIds((prev) => mergeUnique(prev, list.map((i) => i.shop_id)));
      setKnownSNs((prev) => mergeUnique(prev, list.map((i) => i.sn)));
      setKnownMapNames((prev) => mergeUnique(prev, list.map((i) => i.map_name)));
    } else if (d) {
      if (d.map_name) setKnownMapNames((prev) => mergeUnique(prev, [d.map_name]));
      if (d.shop_id) setKnownShopIds((prev) => mergeUnique(prev, [d.shop_id]));
      if (d.sn) setKnownSNs((prev) => mergeUnique(prev, [d.sn]));
    }
  }

  async function run() {
    try {
      setLoading(true);
      setErr(null);
      setRes(null);

      const queryObj = buildParamsObject();
      const data =
        endpoint.method === "GET"
          ? await get(endpoint.path, queryObj)
          : await post(endpoint.path, {});

      setRes(data);
      harvestSuggestions(data);
    } catch (e) {
      setErr(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }

  function handleParamChange(name, value) {
    setParamsState((s) => ({ ...s, [name]: value }));
  }

  function suggestionsFor(name) {
    if (name === "shop_id") return knownShopIds;
    if (name === "sn") return knownSNs;
    if (name === "map_name") return knownMapNames;
    return [];
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-5 overflow-hidden">
          <h2 className="flex items-center gap-2">
            PUDU — API Explorer
            {loading && <Spinner />}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 min-w-0">
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">Path</label>
              <select
                className="input w-full min-w-0 max-w-full"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                {DOC_ENDPOINTS.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 min-w-0">
              <div className="text-sm text-slate-500">Parámetros de consulta</div>
              {endpoint.params.map((p) => {
                const sugg = suggestionsFor(p.name);
                const inputType = p.type === "int" ? "number" : "text";
                const id = `dl_${p.name}`;
                return (
                  <div key={p.name} className="min-w-0">
                    <label className="block text-sm text-slate-500">
                      {p.name}
                      {p.required && <span className="text-red-500"> *</span>}
                      {p.hint && <span className="ml-1 text-xs text-slate-400">({p.hint})</span>}
                    </label>
                    <input
                      type={inputType}
                      className="input w-full min-w-0 max-w-full"
                      list={sugg.length ? id : undefined}
                      placeholder={p.required ? "Requerido" : "Opcional"}
                      value={paramsState[p.name] ?? ""}
                      onChange={(e) => handleParamChange(p.name, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && run()}
                    />
                    {sugg.length > 0 && (
                      <datalist id={id}>
                        {sugg.map((v) => (
                          <option key={`${p.name}-${v}`} value={v} />
                        ))}
                      </datalist>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="min-w-0">
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={run} disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Ejecutando…
                    </span>
                  ) : (
                    "Ejecutar"
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setRes(null);
                    setErr(null);
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-7 overflow-hidden">
          <h3 className="text-lg font-semibold">Respuesta</h3>
          <div className="mt-3 min-w-0" aria-live="polite">
            {err && (
              <div className="neu-lg rounded-2xl p-3 text-red-600 text-sm overflow-auto">
                {typeof err === "string" ? err : JSON.stringify(err)}
              </div>
            )}
            {res && (
              <div className="overflow-auto max-h-[60vh]">
                <JsonView data={res} />
              </div>
            )}
            {!err && !res && <div className="text-sm text-slate-400">Sin respuesta aún…</div>}
          </div>
        </Card>
      </div>

      {(knownShopIds.length || knownSNs.length || knownMapNames.length) > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
          <Card className="xl:col-span-12 overflow-hidden">
            <h3 className="text-lg font-semibold">Sugerencias recolectadas</h3>
            <div className="mt-3 grid md:grid-cols-3 gap-3 text-xs">
              <div className="min-w-0">
                <div className="text-slate-500 mb-1">shop_id vistos</div>
                <div className="flex flex-wrap gap-2">
                  {knownShopIds.map((v) => (
                    <span key={`shop-${v}`} className="px-2 py-1 rounded-lg bg-card/60">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 mb-1">sn vistos</div>
                <div className="flex flex-wrap gap-2">
                  {knownSNs.map((v) => (
                    <span key={`sn-${v}`} className="px-2 py-1 rounded-lg bg-card/60">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 mb-1">map_name vistos</div>
                <div className="flex flex-wrap gap-2">
                  {knownMapNames.map((v) => (
                    <span key={`map-${v}`} className="px-2 py-1 rounded-lg bg-card/60">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
