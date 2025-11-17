import { useEffect, useRef, useState } from "react";
import { loadMqttFromCdn } from "../services/mqttLoader";

/**
 * useMqtt - minimal MQTT over WSS hook for React
 * @param {object} options
 *  - url: WSS URL of the broker (default: wss://test.mosquitto.org:8081)
 *  - topics: string | string[] of MQTT topics to subscribe (wildcards allowed)
 *  - qos: QoS level (0..2), default 0
 *  - keepalive: seconds, default 30
 *  - onMessage(topic, payloadObj, raw): callback on messages
 */
export function useMqtt(options = {}) {
  const {
    url = "wss://test.mosquitto.org:8081",
    topics = "pudurobotics/devices/+/telemetry",
    qos = 0,
    keepalive = 30,
    onMessage,
    clientIdPrefix = "web-",
    username = undefined,
    password = undefined,
  } = options;

  const clientRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let mqttGlobal = null;
    let client = null;

    (async () => {
      try {
        mqttGlobal = await loadMqttFromCdn();
        if (cancelled) return;

        const clientId = clientIdPrefix + Math.floor(Math.random()*1e9);
        client = mqttGlobal.connect(url, {
          clean: true,
          keepalive,
          clientId,
          username,
          password,
        });

        clientRef.current = client;

        client.on("connect", () => {
          if (cancelled) return;
          setConnected(true);
          setError(null);
          const list = Array.isArray(topics) ? topics : [topics];
          list.forEach((t) => client.subscribe(t, { qos }, (err) => {
            if (err) console.error("MQTT subscribe error", t, err);
          }));
        });

        client.on("message", (topic, payload) => {
          const txt = new TextDecoder().decode(payload);
          let obj = txt;
          try { obj = JSON.parse(txt); } catch {}
          setLast({ topic, data: obj, raw: txt, ts: Date.now() });
          if (onMessage) onMessage(topic, obj, txt);
        });

        client.on("error", (e) => {
          if (cancelled) return;
          setError(e?.message || String(e));
        });

        client.on("close", () => {
          if (cancelled) return;
          setConnected(false);
        });
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        const c = clientRef.current;
        if (c) {
          c.end(true);
        }
      } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(topics), qos, keepalive, username, password]);

  // publish helper
  const publish = (topic, payload, opts = { qos: 0, retain: false }) => {
    const c = clientRef.current;
    if (!c || !connected) return false;
    let buf = payload;
    if (typeof payload === "object") buf = JSON.stringify(payload);
    c.publish(topic, buf, opts);
    return true;
  };

  return { connected, error, last, publish, client: clientRef.current };
}
