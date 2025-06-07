// server.js — RAW QUERY BACKEND (50%)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const db = require('./db');
const app = express();

// Detailed CORS configuration
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

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
            'INSERT INTO users(username, password_hash, role) VALUES($1, $2, $3) RETURNING user_id AS id, username, role',
            [username, hashed, 'user']
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
        // Log dla debugowania
        console.log('Próba logowania:', username);
        
        const user = await db.oneOrNone(
            'SELECT user_id AS id, username, role, password_hash FROM users WHERE username = $1',
            [username]
        );

        // Log dla debugowania
        console.log('Znaleziony użytkownik:', user ? 'tak' : 'nie');

        if (!user) {
            console.log('Użytkownik nie znaleziony');
            return res.status(401).send('Invalid credentials');
        }

        // Log dla debugowania
        console.log('Porównuję hasła...');
        
        const valid = await bcrypt.compare(password, user.password_hash);
        
        // Log dla debugowania
        console.log('Wynik porównania:', valid);

        if (!valid) {
            console.log('Nieprawidłowe hasło');
            return res.status(401).send('Invalid credentials');
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role }, 
            JWT_SECRET
        );
        
        // Log dla debugowania
        console.log('Token wygenerowany, logowanie udane');

        res.json({ token });
    } catch (err) {
        console.error('Błąd logowania:', err);
        res.status(500).send('Login failed');
    }
});

// ===== RAW QUERY ENDPOINTS =====

app.get('/routes', async (req, res) => {
    try {
        console.log('Pobieranie tras...');
        const routes = await db.any(`
            SELECT r.route_id, r.name,
                ST_AsGeoJSON(ST_MakeLine(s.geom ORDER BY s.seq_no))::json AS geojson,
                json_agg(json_build_object(
                    'geometry', ST_AsGeoJSON(s.geom)::json,
                    'properties', json_build_object(
                        'name', s.name,
                        'stopTime', s.stop_time_sec,
                        'passengersIn', s.passengers_in,
                        'passengersOut', s.passengers_out,
                        'isTerminal', COALESCE(s.is_terminal, false)::boolean
                    )
                ) ORDER BY s.seq_no) AS stops
            FROM routes r
            JOIN stations s ON s.route_id = r.route_id
            GROUP BY r.route_id
        `);
        console.log(`Znaleziono ${routes.length} tras`);
        res.json(routes);
    } catch (err) {
        console.error('Błąd podczas pobierania tras:', {
            error: err.message,
            stack: err.stack,
            details: err.detail,
            hint: err.hint,
            where: err.where
        });
        res.status(500).json({ error: 'Failed to fetch routes', details: err.message });
    }
});

app.put('/routes/:id', async (req, res) => {
    const routeId = req.params.id;
    const { name, stops, segments, params } = req.body;
    const userId = req.auth.id;

    try {
        await db.tx(async t => {
            // Update route name and params
            await t.none(
                'UPDATE routes SET name = $1, params = $2 WHERE route_id = $3 AND (user_id = $4 OR $5 = true)',
                [name, params, routeId, userId, req.auth.role === 'admin']
            );

            // Update stops
            if (stops && stops.length > 0) {
                // Delete existing stops
                await t.none('DELETE FROM stations WHERE route_id = $1', [routeId]);
                
                // Insert new stops
                for (let i = 0; i < stops.length; i++) {
                    const s = stops[i];
                    await t.none(
                        `INSERT INTO stations(route_id, seq_no, name, geom, stop_time_sec, passengers_in, passengers_out, is_terminal)
                        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9)`,
                        [
                            routeId,
                            i + 1,
                            s.properties.name,
                            s.geometry.coordinates[0],
                            s.geometry.coordinates[1],
                            s.properties.stopTime || 0,
                            s.properties.passengersIn || 0,
                            s.properties.passengersOut || 0,
                            Boolean(s.properties.isTerminal)
                        ]
                    );
                }
            }

            // Update segments if provided
            if (segments && segments.length > 0) {
                // Delete existing segments
                await t.none('DELETE FROM route_segments WHERE route_id = $1', [routeId]);
                
                // Insert new segments
                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    await t.none(
                        `INSERT INTO route_segments(route_id, seq_no, geom, max_wagons, slope_percent, track_count)
                        VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4, $5, $6)`,
                        [
                            routeId,
                            seg.seq_no,
                            JSON.stringify(seg.geom),
                            seg.max_wagons || 10,
                            seg.slope_percent || 0,
                            seg.track_count || 2
                        ]
                    );
                }
            }
        });

        res.send('Route updated');
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).send('Failed to update route');
    }
});

app.post('/routes', async (req, res) => {
    const { name, stops, segments, params } = req.body;
    const userId = req.auth.id;

    try {
        // Walidacja danych wejściowych
        if (!name) {
            return res.status(400).json({ error: 'Route name is required' });
        }

        // Szczegółowe logowanie danych wejściowych
        console.log('Dane wejściowe trasy:', JSON.stringify({
            userId,
            name,
            params,
            stops: stops,
            segments: segments
        }, null, 2));

        await db.tx(async t => {
            console.log('Rozpoczęcie transakcji');

            await t.none("SET LOCAL my.current_user_id = $1", [req.auth.id]);

            // Tworzenie trasy
            const route = await t.one(
                'INSERT INTO routes(user_id, name, params) VALUES($1, $2, $3) RETURNING route_id',
                [userId, name, params || {}]
            );

            console.log('Trasa utworzona z ID:', route.route_id);

            // Dodawanie przystanków
            if (stops && Array.isArray(stops) && stops.length > 0) {
                for (let i = 0; i < stops.length; i++) {
                    const s = stops[i];
                    
                    console.log(`Walidacja przystanku ${i}:`, JSON.stringify(s, null, 2));
                    
                    // Szczegółowa walidacja danych przystanku
                    if (!s) {
                        throw new Error(`Station at index ${i} is undefined`);
                    }
                    if (!s.properties) {
                        throw new Error(`Station at index ${i} has no properties`);
                    }
                    if (!s.properties.name) {
                        throw new Error(`Station at index ${i} has no name`);
                    }
                    if (!s.geometry) {
                        throw new Error(`Station at index ${i} has no geometry`);
                    }
                    if (!s.geometry.coordinates || !Array.isArray(s.geometry.coordinates) || s.geometry.coordinates.length !== 2) {
                        throw new Error(`Station at index ${i} has invalid coordinates`);
                    }

                    console.log('Dodawanie przystanku:', {
                        index: i + 1,
                        name: s.properties.name,
                        coordinates: s.geometry.coordinates,
                        stopTime: s.properties?.stopTime,
                        isTerminal: s.properties?.isTerminal
                    });
                    
                    await t.none(
                        `INSERT INTO stations(route_id, seq_no, name, geom, stop_time_sec, is_terminal)
                        VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7)`,
                        [
                            route.route_id,
                            i + 1,
                            s.properties.name,
                            s.geometry.coordinates[0],
                            s.geometry.coordinates[1],
                            s.properties?.stopTime || 0,
                            s.properties?.isTerminal || false
                        ]
                    );
                }
            }

            // Dodawanie segmentów
            if (segments && Array.isArray(segments) && segments.length > 0) {
                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];

                    console.log(`Walidacja segmentu ${i}:`, JSON.stringify(seg, null, 2));

                    // Szczegółowa walidacja danych segmentu
                    if (!seg) {
                        throw new Error(`Segment at index ${i} is undefined`);
                    }
                    if (!seg.geom) {
                        throw new Error(`Segment at index ${i} has no geometry`);
                    }
                    if (!seg.geom.coordinates) {
                        throw new Error(`Segment at index ${i} has no coordinates`);
                    }

                    console.log('Dodawanie segmentu:', {
                        index: i + 1,
                        coordinates: seg.geom?.coordinates,
                        maxWagons: seg.max_wagons,
                        slopePercent: seg.slope_percent,
                        trackCount: seg.track_count
                    });
                    
                    await t.none(
                        `INSERT INTO route_segments(route_id, seq_no, geom, max_wagons, slope_percent, track_count)
                        VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4, $5, $6)`,
                        [
                            route.route_id,
                            i + 1,
                            JSON.stringify(seg.geom),
                            seg.max_wagons || 10,
                            seg.slope_percent || 0,
                            seg.track_count || 2
                        ]
                    );
                }
            }
        });

        console.log('Trasa zapisana pomyślnie');
        res.status(201).send('Route saved');
    } catch (err) {
        console.error('Szczegóły błędu zapisywania trasy:', {
            error: err.message,
            stack: err.stack,
            details: err.detail,
            hint: err.hint,
            where: err.where,
            requestBody: JSON.stringify(req.body, null, 2)
        });
        
        res.status(400).json({ 
            error: err.message,
            details: {
                name: name ? 'OK' : 'Missing',
                stops: stops ? `Array with ${stops.length} items` : 'Missing',
                segments: segments ? `Array with ${segments.length} items` : 'Missing'
            }
        });
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
