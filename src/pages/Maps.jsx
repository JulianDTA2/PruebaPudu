// src/pages/Maps.jsx
import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import Button from "../components/Button";
import { Pudu, get } from "../services/api";

function Spinner({ className = "" }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
    </svg>
  );
}

export default function Maps() {
  const [form, setForm] = useState({
    shop_id: "451170001",
    map_name: "",
    device_width: "1200",
    device_height: "682",
  });

  const [res, setRes] = useState(null); // SOLO la URL
  const [err, setErr] = useState(null);
  const [showImg, setShowImg] = useState(true);
  const [loading, setLoading] = useState(false);

  // ---- Nuevos estados para tiendas y mapas ----
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsErr, setShopsErr] = useState(null);

  const [maps, setMaps] = useState([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsErr, setMapsErr] = useState(null);

  // Cargar tiendas al montar
  useEffect(() => {
    (async () => {
      try {
        setShopsLoading(true);
        setShopsErr(null);
        // Puedes ajustar el límite si tienes muchas tiendas
        const data = await get("/data-open-platform-service/v1/api/shop", {
          limit: 100,
          offset: 0,
        });
        const list = data?.data?.list || data?.list || [];
        setShops(list);
      } catch (e) {
        setShopsErr(e?.response?.data || e?.message || "Error cargando tiendas");
      } finally {
        setShopsLoading(false);
      }
    })();
  }, []);

  // Cargar mapas cuando cambia la tienda seleccionada
  useEffect(() => {
    const sid = form.shop_id;
    if (!sid) {
      setMaps([]);
      setForm((prev) => ({ ...prev, map_name: "" }));
      return;
    }
    (async () => {
      try {
        setMapsLoading(true);
        setMapsErr(null);
        const data = await get("/data-open-platform-service/v1/api/maps", {
          shop_id: sid,
        });
        const list = data?.data?.list || data?.list || [];
        setMaps(list);
        // No auto-selecciono mapa; el usuario lo elige
      } catch (e) {
        setMapsErr(e?.response?.data || e?.message || "Error cargando mapas");
        setMaps([]);
      } finally {
        setMapsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shop_id]);

  async function run() {
    try {
      setLoading(true);
      setErr(null);
      setRes(null);
      const data = await Pudu.getMap(form);
      const onlyUrl = data?.url ?? data?.data?.url ?? data?.result?.url ?? null;
      setRes(onlyUrl);
      if (!onlyUrl) setErr("No se encontró una URL de mapa en la respuesta.");
    } catch (e) {
      setErr(e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  }

  const onField = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-6 min-h-screen">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-5 overflow-hidden">
          <h2 className="flex items-center gap-2">
            Detalle de mapa
            {(loading || shopsLoading || mapsLoading) && <Spinner />}
          </h2>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 min-w-0">
            {/* shop_id como SELECT */}
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">Tienda</label>
              <select
                className="input w-full min-w-0 max-w-full"
                value={form.shop_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    shop_id: e.target.value,
                    map_name: "", // al cambiar tienda, resetea mapa
                  }))
                }
              >
                {shopsLoading && <option value={form.shop_id}>Cargando tiendas…</option>}
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

            {/* map_name como SELECT dependiente */}
            <div className="min-w-0">
              <label className="block text-sm text-slate-500">Nombre del Mapa</label>
              <select
                className="input w-full min-w-0 max-w-full"
                value={form.map_name}
                onChange={onField("map_name")}
                disabled={!form.shop_id || mapsLoading || maps.length === 0}
              >
                {!form.shop_id && <option value="">— selecciona una tienda —</option>}
                {form.shop_id && mapsLoading && <option value="">Cargando mapas…</option>}
                {form.shop_id && !mapsLoading && maps.length === 0 && (
                  <option value="">— sin mapas —</option>
                )}
                <option value="">— seleccionar mapa —</option>
                {form.shop_id &&
                  !mapsLoading &&
                  maps.map((m, i) => {
                    const name = m?.map_name ?? m?.name ?? m?.mapName ?? "";
                    const val = String(name);
                    return (
                      <option key={`${val || i}`} value={val}>
                        {val || "(sin nombre)"}
                      </option>
                    );
                  })}
              </select>
              {mapsErr && <div className="text-xs text-red-600 mt-1">{String(mapsErr)}</div>}
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <Button onClick={run} disabled={loading || !form.shop_id || !form.map_name}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Consultando…
                </span>
              ) : (
                "Consultar mapa"
              )}
            </Button>

            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={() => setShowImg((v) => !v)} disabled={!res}>
                {showImg ? "Ocultar imagen" : "Mostrar imagen"}
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

          {/* Errores de la consulta de mapa */}
          <div className="mt-4" aria-live="polite">
            {err && <div className="text-red-600 text-sm neu-lg p-3 rounded-lg">{String(err)}</div>}
          </div>
        </Card>

        <Card className="xl:col-span-7 overflow-hidden">
          <h3 className="text-lg font-semibold">Resultado</h3>
          {res ? (
            <>
              {showImg && (
                <div className="mt-3 overflow-auto">
                  <img
                    className="w-full max-h-[60vh] object-contain rounded-xl"
                    src={res}
                    alt={form.map_name || "mapa"}
                    loading="eager"
                  />
                </div>
              )}
              <h4 className="mt-4">URL del mapa</h4>
              <input
                className="input-url rounded-2xl px-3 py-2 w-full font-mono"
                readOnly
                value={res}
                onFocus={(e) => e.target.select()}
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Button as="a" href={res} target="_blank" rel="noopener noreferrer">
                  Abrir
                </Button>
                <Button onClick={() => navigator.clipboard.writeText(res)}>Copiar URL</Button>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 mt-2">Sin resultados. Ejecuta una consulta.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
