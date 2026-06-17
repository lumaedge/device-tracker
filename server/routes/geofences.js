const { Router } = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const geofences = await db.all('SELECT * FROM geofences WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
    res.json(geofences);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, latitude, longitude, radius_meters, device_id, trigger_on_entry, trigger_on_exit } = req.body;
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'name, latitude, longitude required' });
    }
    const { row: gf } = await db.insert('geofences', ['user_id', 'name', 'latitude', 'longitude', 'radius_meters', 'device_id', 'trigger_on_entry', 'trigger_on_exit'],
      [req.user.id, name, latitude, longitude, radius_meters || 100, device_id || null, trigger_on_entry ?? 1, trigger_on_exit ?? 0]);
    res.status(201).json(gf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const gf = await db.get('SELECT * FROM geofences WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!gf) return res.status(404).json({ error: 'Geofence not found' });

    const { name, latitude, longitude, radius_meters, device_id, trigger_on_entry, trigger_on_exit } = req.body;
    await db.run('UPDATE geofences SET name=?, latitude=?, longitude=?, radius_meters=?, device_id=?, trigger_on_entry=?, trigger_on_exit=? WHERE id=?',
      name ?? gf.name, latitude ?? gf.latitude, longitude ?? gf.longitude,
      radius_meters ?? gf.radius_meters, device_id ?? gf.device_id,
      trigger_on_entry ?? gf.trigger_on_entry, trigger_on_exit ?? gf.trigger_on_exit,
      gf.id);

    res.json(await db.get('SELECT * FROM geofences WHERE id = ?', gf.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM geofences WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Geofence not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/events', requireAuth, async (req, res) => {
  try {
    const gf = await db.get('SELECT * FROM geofences WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!gf) return res.status(404).json({ error: 'Geofence not found' });

    const events = await db.all('SELECT * FROM geofence_events WHERE geofence_id = ? ORDER BY timestamp DESC LIMIT 100', gf.id);
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
