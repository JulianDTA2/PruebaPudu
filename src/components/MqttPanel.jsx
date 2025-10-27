import React, { useMemo } from "react";
import { useMqtt } from "../hooks/useMqtt";

export default function MqttPanel({
  brokerUrl = "wss://test.mosquitto.org:8081",
  topic = "pudurobotics/devices/+/telemetry",
}) {
  const { connected, error, last } = useMqtt({
    url: brokerUrl,
    topics: topic,
  });

  const lastPretty = useMemo(() => {
    if (!last) return "—";
    try {
      return JSON.stringify(last, null, 2);
    } catch {
      return String(last?.raw ?? "");
    }
  }, [last]);

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">MQTT realtime</h3>
        <span
          className={`inline-flex items-center gap-2 text-sm ${
            connected ? "text-green-600" : "text-red-600"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {error ? (
        <div className="text-red-600 text-sm mb-2">Error: {error}</div>
      ) : null}

      <div className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64 bg-gray-50 p-3 rounded-lg">
        {lastPretty}
      </div>

      {last?.data?.ip ? (
        <div className="mt-3 text-sm">
          <div className="mb-1">
            IP local reportada: <code>{last.data.ip}</code>
          </div>
          <div className="text-gray-600">
            El stream local suele estar en{" "}
            <code>http://{last.data.ip}/stream</code>.
            <br />
            Nota: los navegadores bloquean contenido HTTP dentro de una página
            HTTPS (mixed content). Puedes abrir el stream en una pestaña aparte:{" "}
            <a
              className="underline text-blue-600"
              href={`http://${last.data.ip}/stream`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir stream local
            </a>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-gray-500 mt-2">
        Suscrito a <code>{topic}</code> via <code>{brokerUrl}</code>.
      </p>
    </div>
  );
}
