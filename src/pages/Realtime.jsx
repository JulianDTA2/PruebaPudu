import React from "react";
import MqttPanel from "../components/MqttPanel";

export default function Realtime() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Datos en tiempo real (MQTT)</h1>
      <MqttPanel />
      <div className="text-sm text-gray-600">
        Para producción, usa tu propio broker con TLS + usuario/clave y restringe tópicos.
      </div>
    </div>
  );
}
