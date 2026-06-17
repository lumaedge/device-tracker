const { Router } = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, requireAuth } = require('../auth');

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });

    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const { row: user } = await db.insert('users', ['email', 'password', 'name'], [email, hash, name], '(email)');
    if (!user) return res.status(409).json({ error: 'Email already registered' });

    const { password: _, ...safe } = user;
    safe.created_at = safe.created_at?.toISOString?.() ?? safe.created_at;
    const token = generateToken(safe);
    res.status(201).json({ user: safe, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password: _, ...safe } = user;
    safe.created_at = safe.created_at?.toISOString?.() ?? safe.created_at;
    const token = generateToken(safe);
    res.json({ user: safe, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', req.user.id);
    if (user) user.created_at = user.created_at?.toISOString?.() ?? user.created_at;
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
