import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = __DEV__ ? 'http://10.0.2.2:3000' : 'https://device-tracker-production-c455.up.railway.app';

let cachedToken = null;

export function setToken(token) {
  cachedToken = token;
  if (token) {
    AsyncStorage.setItem('token', token);
  } else {
    AsyncStorage.removeItem('token');
  }
}

export async function loadToken() {
  const token = await AsyncStorage.getItem('token');
  cachedToken = token;
  return token;
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (cachedToken) h['Authorization'] = `Bearer ${cachedToken}`;
  return h;
}

export async function api(method, path, body) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  if (res.status === 401) {
    setToken(null);
    throw new Error('Unauthorized');
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function reportLocation(deviceId, lat, lng, extras = {}) {
  return api('POST', '/api/locations', {
    device_id: deviceId,
    latitude: lat,
    longitude: lng,
    ...extras,
  });
}
