/**
 * Lightweight loader for MQTT.js in the browser without bundler changes.
 * It injects https://unpkg.com/mqtt/dist/mqtt.min.js and returns a Promise
 * that resolves to window.mqtt.
 */
let _mqttPromise = null;

export function loadMqttFromCdn() {
  if (typeof window !== 'undefined' && window.mqtt) {
    return Promise.resolve(window.mqtt);
  }
  if (_mqttPromise) return _mqttPromise;

  _mqttPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/mqtt/dist/mqtt.min.js';
    script.async = true;
    script.onload = () => {
      if (window.mqtt) resolve(window.mqtt);
      else reject(new Error('mqtt global not found after script load'));
    };
    script.onerror = () => reject(new Error('Failed to load mqtt.min.js'));
    document.head.appendChild(script);
  });

  return _mqttPromise;
}
