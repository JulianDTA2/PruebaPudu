// src/services/api.js
import http from "./http";

/**
 * En este front *no* firmamos HMAC. El proxy /pudu-entry firma aguas arriba.
 */

export async function get(path, params) {
  const { data } = await http.get(path, { params });
  return data;
}

export async function post(path, body) {
  const { data } = await http.post(path, body);
  return data;
}

export async function ping() {
  const { data } = await http.get("/");
  return data;
}

export const Pudu = {
  getMap: (query) => get("/data-open-platform-service/v1/api/map", query),
  getRobots: (q) => get("/data-open-platform-service/v1/api/robot", q),
  getcc: (q) => get("/cleanbot-service/v1/api/open/task/list", q),
  // listDevices: (q) => get('/data-open-platform-service/v1/api/devices', q),
  // sendCommand: (payload) => post('/data-open-platform-service/v1/api/command', payload),
};
