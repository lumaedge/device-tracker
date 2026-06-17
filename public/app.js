const API = '';
let token = localStorage.getItem('token');
let user = null;
let selectedDeviceId = null;
const markers = {};
const historyLines = {};
const geofenceCircles = {};

let map = null;

const socket = io();

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function api(method, path, body) {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Auth ----

let authMode = 'login';

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authMode = tab.dataset.tab;
    document.getElementById('auth-name').style.display = authMode === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('auth-error').textContent = '';
  });
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value;
  const err = document.getElementById('auth-error');

  try {
    if (authMode === 'login') {
      const data = await api('POST', '/api/auth/login', { email, password });
      token = data.token;
      user = data.user;
    } else {
      if (!name) { err.textContent = 'Name is required'; return; }
      const data = await api('POST', '/api/auth/register', { email, password, name });
      token = data.token;
      user = data.user;
    }
    localStorage.setItem('token', token);
    showApp();
  } catch (e) {
    err.textContent = 'Failed. Check credentials or register first.';
  }
});

document.getElementById('btn-logout').addEventListener('click', logout);

function logout() {
  localStorage.removeItem('token');
  token = null;
  user = null;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-display').textContent = user ? user.email : '';
  if (!map) {
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  } else {
    map.invalidateSize();
  }
  loadDevices();
  loadGeofences();
}

if (token) {
  api('GET', '/api/auth/me').then(u => { user = u; showApp(); }).catch(() => logout());
}

// ---- Map helpers ----

function deviceIcon(battery, isSelected) {
  const color = isSelected ? '#e94560' : '#4fc3f7';
  const batt = battery != null ? battery : 50;
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: bold; color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    ">${Math.round(batt)}%</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

// ---- Devices ----

async function loadDevices() {
  try {
    const devices = await api('GET', '/api/devices');
    const list = document.getElementById('device-list');
    list.innerHTML = '';
    const now = Date.now();

    for (const d of devices) {
      const li = document.createElement('li');
      li.dataset.id = d.id;

      const lastSeen = d.last_seen ? new Date(d.last_seen + 'Z').getTime() : 0;
      const isOnline = (now - lastSeen) < 5 * 60 * 1000;

      li.innerHTML = `
        <span>
          <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
          <span class="name">${escapeHtml(d.name)}</span>
        </span>
        <span class="time">${d.last_seen ? timeAgo(d.last_seen) : 'never'}</span>
      `;
      li.addEventListener('click', () => selectDevice(d.id));
      list.appendChild(li);

      if (d.latitude != null) updateMarker(d);
    }
  } catch {}
}

function updateMarker(device) {
  const id = device.id;
  const latlng = [device.latitude, device.longitude];
  const isSelected = id === selectedDeviceId;

  if (markers[id]) {
    markers[id].setLatLng(latlng);
    markers[id].setIcon(deviceIcon(device.battery, isSelected));
  } else {
    markers[id] = L.marker(latlng, { icon: deviceIcon(device.battery, isSelected) })
      .addTo(map)
      .bindPopup(`<b>${escapeHtml(device.name)}</b>`);
  }
  markers[id].on('click', () => selectDevice(id));
}

function selectDevice(id) {
  selectedDeviceId = id;
  document.querySelectorAll('#device-list li').forEach(el => el.style.borderLeft = '');
  const el = document.querySelector(`#device-list li[data-id="${id}"]`);
  if (el) el.style.borderLeft = '3px solid #e94560';
  loadDeviceDetail(id);
}

async function loadDeviceDetail(id) {
  const section = document.getElementById('device-detail');
  section.classList.remove('hidden');

  try {
    const device = await api('GET', `/api/devices/${id}`);
    document.getElementById('detail-name').textContent = device.name;
  } catch {}

  try {
    const loc = await api('GET', `/api/locations/${id}/latest`);
    document.getElementById('detail-info').innerHTML = `
      Lat: ${loc.latitude.toFixed(6)}<br>
      Lng: ${loc.longitude.toFixed(6)}<br>
      ${loc.accuracy ? `Accuracy: ${loc.accuracy.toFixed(0)}m<br>` : ''}
      ${loc.battery != null ? `Battery: ${loc.battery.toFixed(0)}%<br>` : ''}
      ${loc.speed ? `Speed: ${loc.speed.toFixed(1)} m/s<br>` : ''}
      Last: ${timeAgo(loc.timestamp)}
    `;
  } catch {
    document.getElementById('detail-info').textContent = 'No locations yet.';
  }

  try {
    const history = await api('GET', `/api/locations/${id}?limit=50`);
    document.getElementById('history-list').innerHTML = history.map(l => `
      <li>${l.timestamp} — ${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}${l.battery != null ? ` (${l.battery.toFixed(0)}%)` : ''}</li>
    `).join('');

    if (history.length > 1 && markers[id]) {
      if (historyLines[id]) map.removeLayer(historyLines[id]);
      historyLines[id] = L.polyline(
        history.map(l => [l.latitude, l.longitude]).reverse(),
        { color: '#e94560', weight: 2, opacity: 0.5 }
      ).addTo(map);
    }
  } catch {}
}

// ---- Geofences ----

async function loadGeofences() {
  try {
    const geofences = await api('GET', '/api/geofences');
    Object.values(geofenceCircles).forEach(c => map.removeLayer(c));

    for (const gf of geofences) {
      const circle = L.circle([gf.latitude, gf.longitude], {
        radius: gf.radius_meters,
        color: '#e94560',
        fillColor: '#e94560',
        fillOpacity: 0.1,
        weight: 2
      }).addTo(map);
      circle.bindPopup(`<b>${escapeHtml(gf.name)}</b><br>${gf.radius_meters}m radius`);
      geofenceCircles[gf.id] = circle;
    }
  } catch {}
}

document.getElementById('btn-geofence').addEventListener('click', () => {
  document.getElementById('geofence-modal').classList.remove('hidden');
  if (selectedDeviceId && markers[selectedDeviceId]) {
    const ll = markers[selectedDeviceId].getLatLng();
    document.getElementById('gf-lat').value = ll.lat.toFixed(6);
    document.getElementById('gf-lng').value = ll.lng.toFixed(6);
  }
});

document.getElementById('gf-cancel').addEventListener('click', () => {
  document.getElementById('geofence-modal').classList.add('hidden');
});

document.getElementById('geofence-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api('POST', '/api/geofences', {
    name: document.getElementById('gf-name').value,
    latitude: parseFloat(document.getElementById('gf-lat').value),
    longitude: parseFloat(document.getElementById('gf-lng').value),
    radius_meters: parseFloat(document.getElementById('gf-radius').value),
    trigger_on_entry: document.getElementById('gf-entry').checked,
    trigger_on_exit: document.getElementById('gf-exit').checked
  });
  document.getElementById('geofence-modal').classList.add('hidden');
  document.getElementById('geofence-form').reset();
  loadGeofences();
});

// ---- History Playback ----

let playbackInterval = null;

document.getElementById('btn-playback').addEventListener('click', async () => {
  if (playbackInterval) {
    clearInterval(playbackInterval);
    playbackInterval = null;
    document.getElementById('btn-playback').textContent = 'Play History';
    return;
  }

  if (!selectedDeviceId || !markers[selectedDeviceId]) return;
  document.getElementById('btn-playback').textContent = 'Stop';

  const history = await api('GET', `/api/locations/${selectedDeviceId}/history`);
  if (!history || history.length < 2) {
    document.getElementById('btn-playback').textContent = 'Play History';
    return;
  }

  let i = 0;
  const marker = markers[selectedDeviceId];
  playbackInterval = setInterval(() => {
    if (i >= history.length) {
      clearInterval(playbackInterval);
      playbackInterval = null;
      document.getElementById('btn-playback').textContent = 'Play History';
      return;
    }
    const loc = history[i];
    marker.setLatLng([loc.latitude, loc.longitude]);
    map.setView([loc.latitude, loc.longitude], map.getZoom());
    i++;
  }, 500);
});

// ---- Real-time ----

socket.on('location', (loc) => {
  loadDevices();
  if (selectedDeviceId === loc.device_id) loadDeviceDetail(loc.device_id);
});

socket.on('geofence_alert', (alert) => {
  const msg = `${escapeHtml(alert.device_id)} ${alert.event === 'entry' ? 'entered' : 'exited'} ${escapeHtml(alert.geofence_name)}`;
  showNotification(msg);
});

let notifTimeout = null;
function showNotification(msg) {
  const existing = document.getElementById('notification');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'notification';
  el.style.cssText = `
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    background: #e94560; color: white; padding: 12px 24px;
    border-radius: 8px; z-index: 3000; font-size: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => el.remove(), 4000);
}

// ---- Controls ----

document.getElementById('btn-center').addEventListener('click', () => {
  if (selectedDeviceId && markers[selectedDeviceId]) {
    map.setView(markers[selectedDeviceId].getLatLng(), 15);
  }
});

document.getElementById('btn-simulate').addEventListener('click', async () => {
  const deviceId = 'sim-' + Math.random().toString(36).slice(2, 8);
  const names = ['Pixel', 'iPhone', 'Galaxy', 'Xiaomi', 'OnePlus', 'iPad', 'MacBook'];
  const name = names[Math.floor(Math.random() * names.length)];

  await api('POST', '/api/devices', { id: deviceId, name: name + '-' + deviceId.slice(-4) });

  let lat = 40.7128 + (Math.random() - 0.5) * 10;
  let lng = -74.006 + (Math.random() - 0.5) * 10;

  const interval = setInterval(async () => {
    lat += (Math.random() - 0.5) * 0.01;
    lng += (Math.random() - 0.5) * 0.01;
    await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        latitude: lat,
        longitude: lng,
        battery: Math.max(0, Math.random() * 100),
        accuracy: 5 + Math.random() * 30
      })
    });
  }, 3000);

  setTimeout(() => clearInterval(interval), 120000);
  selectDevice(deviceId);
});

// ---- Utils ----

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

setInterval(loadDevices, 15000);
