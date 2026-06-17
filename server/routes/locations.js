const { Router } = require('express');
const db = require('../db');

const router = Router();

function broadcast(io, event, data) {
  if (io) io.emit(event, data);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkGeofences(deviceId, lat, lng) {
  const geofences = await db.all(
    'SELECT gf.*, (SELECT event_type FROM geofence_events WHERE geofence_id = gf.id AND device_id = ? ORDER BY timestamp DESC LIMIT 1) as last_event FROM geofences gf WHERE gf.device_id IS NULL OR gf.device_id = ?',
    deviceId, deviceId
  );

  for (const gf of geofences) {
    const dist = haversine(lat, lng, gf.latitude, gf.longitude);
    const inside = dist <= gf.radius_meters;
    const wasInside = gf.last_event === 'entry';

    if (inside && !wasInside && gf.trigger_on_entry) {
      await db.insert('geofence_events', ['geofence_id', 'device_id', 'event_type', 'latitude', 'longitude'], [gf.id, deviceId, 'entry', lat, lng]);
      return { type: 'geofence_event', event: 'entry', geofence_id: gf.id, geofence_name: gf.name, device_id: deviceId };
    }
    if (!inside && wasInside && gf.trigger_on_exit) {
      await db.insert('geofence_events', ['geofence_id', 'device_id', 'event_type', 'latitude', 'longitude'], [gf.id, deviceId, 'exit', lat, lng]);
      return { type: 'geofence_event', event: 'exit', geofence_id: gf.id, geofence_name: gf.name, device_id: deviceId };
    }
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { device_id, latitude, longitude, accuracy, battery, speed, heading, altitude } = req.body;
    if (!device_id || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'device_id, latitude, longitude required' });
    }

    await db.insert('devices', ['id', 'name'], [device_id, device_id], '(id)');

    const { row: location } = await db.insert('locations', ['device_id', 'latitude', 'longitude', 'accuracy', 'battery', 'speed', 'heading', 'altitude'],
      [device_id, latitude, longitude, accuracy ?? null, battery ?? null, speed ?? null, heading ?? null, altitude ?? null]);

    const io = req.app.get('io');
    broadcast(io, 'location', location);

    const geofenceAlert = await checkGeofences(device_id, latitude, longitude);
    if (geofenceAlert) broadcast(io, 'geofence_alert', geofenceAlert);

    res.status(201).json(location);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:deviceId', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const locations = await db.all('SELECT * FROM locations WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?', req.params.deviceId, limit);
    res.json(locations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:deviceId/latest', async (req, res) => {
  try {
    const location = await db.get('SELECT * FROM locations WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1', req.params.deviceId);
    if (!location) return res.status(404).json({ error: 'No locations found' });
    res.json(location);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:deviceId/history', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const from = req.query.from;
    const to = req.query.to;
    const step = parseInt(req.query.step) || 1;

    let sql = 'SELECT * FROM locations WHERE device_id = ?';
    const params = [deviceId];
    if (from) { sql += ' AND timestamp >= ?'; params.push(from); }
    if (to) { sql += ' AND timestamp <= ?'; params.push(to); }
    sql += ' ORDER BY timestamp ASC';

    let locations = await db.all(sql, ...params);
    if (step > 1) locations = locations.filter((_, i) => i % step === 0);
    res.json(locations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
