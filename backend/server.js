// backend/server.js
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

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const jwtOpts = { secret: JWT_SECRET, algorithms: ['HS256'] };

// chronimy wszystko poza rejestracją, logowaniem i checkami
app.use(
    jwtMiddleware(jwtOpts).unless({
        path: [
            { url: '/register', methods: ['POST'] },
            { url: '/login', methods: ['POST'] },
            { url: '/', methods: ['GET'] },
            { url: '/test', methods: ['GET'] }
        ]
    })
);

// Rejestracja
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        const user = await db.one(
            'INSERT INTO users(username, password) VALUES($1,$2) RETURNING id, username, role',
            [username, hashed]
        );
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        res.status(201).json({ token });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).send('Registration failed');
    }
});

// Logowanie
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.oneOrNone(
            'SELECT id, username, role, password FROM users WHERE username=$1',
            [username]
        );
        if (!user) return res.status(401).json({ message: 'Invalid username or password' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: 'Invalid username or password' });
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Utworzenie trasy (wymaga JWT)
app.post('/routes', async (req, res) => {
    if (!req.auth) return res.status(401).send('Invalid or missing token');
    const { name, route, stops, max_wagons, slope } = req.body;
    const userId = req.auth.id;
    if (!name || !Array.isArray(route) || route.length === 0) {
        return res.status(400).send('Invalid route data');
    }
    try {
        const geojsonString = JSON.stringify({ type: 'LineString', coordinates: route });
        const stopsString = JSON.stringify(stops || []);
        await db.none(
            `INSERT INTO routes
         (name, geojson, stops, max_wagons, slope, user_id)
       VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6)`,
            [name, geojsonString, stopsString, max_wagons, slope, userId]
        );
        res.status(201).send('Route saved');
    } catch (err) {
        console.error('Route save error:', err.message);
        res.status(500).send('Route save failed: ' + err.message);
    }
});

// Pobranie tras (wymaga JWT)
app.get('/routes', async (req, res) => {
    if (!req.auth) return res.status(401).send('Invalid or missing token');
    const userId = req.auth.id;
    try {
        const routes = await db.any(
            'SELECT * FROM routes WHERE user_id=$1 ORDER BY id DESC',
            [userId]
        );
        res.json(routes);
    } catch (err) {
        console.error('Fetch routes error:', err.message);
        res.status(500).send('Failed to fetch routes: ' + err.message);
    }
});

// Usuwanie trasy – tylko admin
app.delete('/routes/:id', async (req, res) => {
    if (!req.auth) return res.status(401).send('Invalid or missing token');
    if (req.auth.role !== 'admin') return res.status(403).send('Only admin can delete routes');
    const userId = req.auth.id;
    const routeId = req.params.id;
    try {
        const result = await db.result(
            'DELETE FROM routes WHERE id=$1 AND user_id=$2',
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

// Health check i test PostGIS
app.get('/', (_, res) => res.send('Railway backend is running'));
app.get('/test', async (_, res) => {
    try {
        const result = await db.any('SELECT PostGIS_Version();');
        res.json(result);
    } catch (err) {
        console.error('Test error:', err);
        res.status(500).send('Database connection failed');
    }
});

// Obsługa błędów JWT
app.use((err, _, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).send('Invalid or missing token');
    }
    next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
