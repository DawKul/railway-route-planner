// ormRouter.js
const express = require('express');
const orm = require('./orm');
const router = express.Router();

// Get all routes with user info
router.get('/orm/routes', async (req, res) => {
    try {
        const routes = await orm.getAllRoutesWithUser();
        res.json(routes);
    } catch (err) {
        console.error('ORM GET error:', err);
        res.status(500).json({ error: 'Failed to fetch routes', details: err.message });
    }
});

// Get single route with all details
router.get('/orm/routes/:id', async (req, res) => {
    try {
        const route = await orm.getRouteWithDetails(req.params.id);
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.json(route);
    } catch (err) {
        console.error('ORM GET detail error:', err);
        res.status(500).json({ error: 'Failed to fetch route details', details: err.message });
    }
});

// Create new route with stops and segments
router.post('/orm/routes', async (req, res) => {
    const { name, user_id, params, stops, segments } = req.body;

    try {
        // Create route first
        const route = await orm.createRoute({ name, user_id, params });
        
        // Add stops and segments if provided
        if (stops && stops.length > 0) {
            const stopsData = stops.map((stop, idx) => ({
                route_id: route.route_id,
                seq_no: idx + 1,
                name: stop.name,
                geom: `ST_SetSRID(ST_MakePoint(${stop.longitude}, ${stop.latitude}), 4326)`,
                stop_time_sec: stop.stopTime || 30,
                passengers_in: stop.passengersIn || 0,
                passengers_out: stop.passengersOut || 0,
                is_terminal: stop.isTerminal || false
            }));
            await orm.insertStops(stopsData);
        }

        if (segments && segments.length > 0) {
            const segmentsData = segments.map((seg, idx) => ({
                route_id: route.route_id,
                seq_no: idx + 1,
                geom: `ST_GeomFromGeoJSON('${JSON.stringify(seg.geometry)}')`,
                max_wagons: seg.maxWagons || 10,
                slope_percent: seg.slopePercent || 0
            }));
            await orm.insertSegments(segmentsData);
        }

        // Get complete route details
        const completeRoute = await orm.getRouteWithDetails(route.route_id);
        res.status(201).json(completeRoute);
    } catch (err) {
        console.error('ORM CREATE error:', err);
        res.status(500).json({ error: 'Failed to create route', details: err.message });
    }
});

// Get route statistics
router.get('/orm/routes/:id/stats', async (req, res) => {
    try {
        const stats = await orm.calculateRouteStatistics(req.params.id);
        res.json(stats);
    } catch (err) {
        console.error('ORM GET stats error:', err);
        res.status(500).json({ error: 'Failed to calculate route statistics', details: err.message });
    }
});

// Update route
router.put('/orm/routes/:id', async (req, res) => {
    const { name, params, stops } = req.body;
    try {
        const route = await orm.updateRoute(req.params.id, { name, params });
        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        // Update stops if provided
        if (stops && stops.length > 0) {
            // Delete existing stops
            await db.none('DELETE FROM stations WHERE route_id = $1', [req.params.id]);
            
            // Insert new stops
            const stopsData = stops.map((stop, idx) => ({
                route_id: req.params.id,
                seq_no: idx + 1,
                name: stop.name,
                geom: `ST_SetSRID(ST_MakePoint(${stop.longitude}, ${stop.latitude}), 4326)`,
                stop_time_sec: stop.stopTime || 30,
                passengers_in: stop.passengersIn || 0,
                passengers_out: stop.passengersOut || 0,
                is_terminal: stop.isTerminal || false
            }));
            await orm.insertStops(stopsData);
        }

        const updatedRoute = await orm.getRouteWithDetails(req.params.id);
        res.json(updatedRoute);
    } catch (err) {
        console.error('ORM UPDATE error:', err);
        res.status(500).json({ error: 'Failed to update route', details: err.message });
    }
});

module.exports = router;
