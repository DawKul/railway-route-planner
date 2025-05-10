// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const db = require('./db');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const jwtOpts = { secret: JWT_SECRET, algorithms: ['HS256'] };

// Protect routes: POST, DELETE require auth; GET /routes open if desired
app.use(
    ['/routes', '/routes/:id'],
    jwtMiddleware(jwtOpts).unless({ path: ['/routes'], method: ['GET'] })
);

// Registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const user = await db.one(
            'INSERT INTO users(username, password) VALUES($1, $2) RETURNING id, username',
            [username, hashed]
        );
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.status(201).json({ token });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).send('Registration failed');
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
        if (!user) return res.status(401).send('Invalid username or password');
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).send('Invalid username or password');
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Login failed');
    }
});

// Create route (protected)
app.post('/routes', async (req, res) => {
    const { name, route, stops, max_wagons, slope } = req.body;
    const userId = req.auth.id;
    if (!name || !Array.isArray(route) || route.length === 0) {
        return res.status(400).send('Invalid route data');
    }
    try {
        const geojsonString = JSON.stringify({ type: 'LineString', coordinates: route });
        const stopsString = JSON.stringify(stops || []);
        await db.none(
            `INSERT INTO routes (name, geojson, stops, max_wagons, slope, user_id)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)`,
            [name, geojsonString, stopsString, max_wagons, slope, userId]
        );
        res.status(201).send('Route saved');
    } catch (err) {
        console.error('Route save error:', err.message);
        res.status(500).send('Route save failed: ' + err.message);
    }
});

// Get routes (protected)
app.get('/routes', async (req, res) => {
    const userId = req.auth.id;
    try {
        const routes = await db.any(
            'SELECT * FROM routes WHERE user_id = $1 ORDER BY id DESC',
            [userId]
        );
        res.json(routes);
    } catch (err) {
        console.error('Fetch routes error:', err.message);
        res.status(500).send('Failed to fetch routes: ' + err.message);
    }
});

// Delete route (protected)
app.delete('/routes/:id', async (req, res) => {
    const userId = req.auth.id;
    const routeId = req.params.id;
    try {
        const result = await db.result(
            'DELETE FROM routes WHERE id = $1 AND user_id = $2',
            [routeId, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).send('Route not found or access denied');
        }
        res.send('Route deleted');
    } catch (err) {
        console.error('Delete route error:', err.message);
        res.status(500).send('Delete failed: ' + err.message);
    }
});

// Health check and PostGIS test
app.get('/', (req, res) => res.send('Railway backend is running'));
app.get('/test', async (req, res) => {
    try {
        const result = await db.any('SELECT PostGIS_Version();');
        res.json(result);
    } catch (err) {
        console.error('Test error:', err);
        res.status(500).send('Database connection failed');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
