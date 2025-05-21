// server.js — RAW QUERY BACKEND (50%)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const db = require('./db');
const app = express();
app.use(cors());
app.use(express.json());
const ormRouter = require('./ormRouter');
app.use(ormRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const jwtOpts = { secret: JWT_SECRET, algorithms: ['HS256'] };

app.use(jwtMiddleware(jwtOpts).unless({
    path: [
        { url: '/register', methods: ['POST'] },
        { url: '/login', methods: ['POST'] },
        { url: '/routes', methods: ['GET'] }
    ]
}));

// ===== AUTH =====
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const user = await db.one(
            'INSERT INTO users(username, password_hash) VALUES($1, $2) RETURNING user_id AS id, username, role',
            [username, hashed]
        );
        const token = jwt.sign(user, JWT_SECRET);
        res.status(201).json({ token });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).send('Registration failed');
    }
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.oneOrNone(
            'SELECT user_id AS id, username, role, password_hash FROM users WHERE username = $1',
            [username]
        );
        if (!user) return res.status(401).send('Invalid credentials');
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).send('Invalid credentials');
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Login failed');
    }
});

// ===== RAW QUERY ENDPOINTS =====

app.get('/routes', async (req, res) => {
    try {
        const routes = await db.any(`
      SELECT r.route_id, r.name,
        ST_AsGeoJSON(ST_MakeLine(s.geom ORDER BY s.seq_no))::json AS geojson,
        json_agg(json_build_object(
          'geometry', ST_AsGeoJSON(s.geom)::json,
          'properties', json_build_object(
            'name', s.name,
            'stopTime', s.stop_time_sec
          )
        ) ORDER BY s.seq_no) AS stops
      FROM routes r
      JOIN stations s ON s.route_id = r.route_id
      GROUP BY r.route_id
    `);
        res.json(routes);
    } catch (err) {
        console.error('Fetch error:', err);
        res.status(500).send('Failed to fetch routes');
    }
});


app.post('/routes', async (req, res) => {
    const { name, stops } = req.body;
    const userId = req.auth.id;

    try {
        await db.tx(async t => {
            await t.none("SET LOCAL my.current_user_id = $1", [req.auth.id]);


            const route = await t.one(
                'INSERT INTO routes(user_id, name) VALUES($1, $2) RETURNING route_id',
                [userId, name]
            );

            for (let i = 0; i < stops.length; i++) {
                const s = stops[i];
                await t.none(
                    `INSERT INTO stations(route_id, seq_no, name, geom, stop_time_sec)
           VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)`,
                    [
                        route.route_id,
                        i + 1,
                        s.properties.name,
                        s.geometry.coordinates[0],
                        s.geometry.coordinates[1],
                        s.properties.stopTime
                    ]
                );
            }
        });
        res.status(201).send('Route saved');
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).send('Error saving route');
    }
});

app.get('/admin/routes', async (req, res) => {
    if (!req.auth || req.auth.role !== 'admin') {
        return res.status(403).send('Access denied');
    }

    try {
        const routes = await db.any(`
      SELECT r.route_id, r.name, u.username
      FROM routes r
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.route_id DESC
    `);
        res.json(routes);
    } catch (err) {
        console.error('Admin fetch error:', err);
        res.status(500).send('Admin fetch failed');
    }
});

app.delete('/routes/:id', async (req, res) => {
    const routeId = req.params.id;
    if (req.auth.role !== 'admin') return res.status(403).send('Only admin can delete');

    try {
        const result = await db.result('DELETE FROM routes WHERE route_id = $1', [routeId]);
        if (result.rowCount === 0) return res.status(404).send('Route not found');
        res.send('Deleted');
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).send('Failed to delete route');
    }
});
// GET all routes with user
app.get('/admin/routes', async (req, res) => {
    if (req.auth?.role !== 'admin') return res.status(403).send('Admin only');
    const data = await db.any(`
    SELECT r.route_id, r.name, u.username
    FROM routes r
    JOIN users u ON r.user_id = u.user_id
  `);
    res.json(data);
});

// DELETE route
app.delete('/admin/routes/:id', async (req, res) => {
    if (req.auth?.role !== 'admin') return res.status(403).send('Admin only');
    await db.none('DELETE FROM routes WHERE route_id = $1', [req.params.id]);
    res.sendStatus(204);
});

// GET all users
app.get('/admin/users', async (req, res) => {
    if (req.auth?.role !== 'admin') return res.status(403).send('Admin only');
    const users = await db.any('SELECT user_id, username, role FROM users');
    res.json(users);
});

// DELETE user
app.delete('/admin/users/:id', async (req, res) => {
    if (req.auth?.role !== 'admin') return res.status(403).send('Admin only');
    await db.none('DELETE FROM users WHERE user_id = $1', [req.params.id]);
    res.sendStatus(204);
});

// Promote user
app.put('/admin/users/:id/promote', async (req, res) => {
    if (req.auth?.role !== 'admin') return res.status(403).send('Admin only');
    await db.none("UPDATE users SET role = 'admin' WHERE user_id = $1", [req.params.id]);
    res.sendStatus(204);
});

app.get('/', (_, res) => res.send('RAW API running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
