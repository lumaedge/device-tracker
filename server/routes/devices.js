const { Router } = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const devices = await db.all(`
      SELECT d.*, l.latitude, l.longitude, l.battery, l.timestamp as last_seen
      FROM devices d
      LEFT JOIN locations l ON l.id = (
        SELECT id FROM locations WHERE device_id = d.id ORDER BY timestamp DESC LIMIT 1
      )
      WHERE d.id IN (SELECT device_id FROM device_owners WHERE user_id = ?)
      ORDER BY d.created_at DESC
    `, req.user.id);
    res.json(devices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const device = await db.get(`
      SELECT d.* FROM devices d
      JOIN device_owners o ON o.device_id = d.id AND o.user_id = ?
      WHERE d.id = ?
    `, req.user.id, req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });

    await db.insert('devices', ['id', 'name'], [id, name], '(id)');
    await db.insert('device_owners', ['user_id', 'device_id', 'role'], [req.user.id, id, 'owner'], '(user_id, device_id)');
    const device = await db.get('SELECT * FROM devices WHERE id = ?', id);
    res.status(201).json(device);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const owned = await db.get('SELECT 1 FROM device_owners WHERE user_id = ? AND device_id = ? AND role = ?', req.user.id, req.params.id, 'owner');
    if (!owned) return res.status(403).json({ error: 'Only the owner can rename' });

    const result = await db.run('UPDATE devices SET name = ? WHERE id = ?', name, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Device not found' });

    res.json(await db.get('SELECT * FROM devices WHERE id = ?', req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const owned = await db.get('SELECT 1 FROM device_owners WHERE user_id = ? AND device_id = ? AND role = ?', req.user.id, req.params.id, 'owner');
    if (!owned) return res.status(403).json({ error: 'Only the owner can delete' });

    const result = await db.run('DELETE FROM devices WHERE id = ?', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Device not found' });
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const owned = await db.get('SELECT 1 FROM device_owners WHERE user_id = ? AND device_id = ? AND role = ?', req.user.id, req.params.id, 'owner');
    if (!owned) return res.status(403).json({ error: 'Only the owner can share' });

    const target = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (!target) return res.status(404).json({ error: 'User not found' });

    await db.insert('device_owners', ['user_id', 'device_id', 'role'], [target.id, req.params.id, role || 'viewer'], '(user_id, device_id)');
    res.json({ message: 'Device shared' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
