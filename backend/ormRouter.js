// ormRouter.js
const express = require('express');
const db = require('./db');
const orm = require('./orm');
const router = express.Router();

router.get('/orm/routes', async (req, res) => {
    try {
        const routes = await orm.getAllRoutesWithUser();
        res.json(routes);
    } catch (err) {
        console.error('ORM GET error:', err);
        res.status(500).send('ORM fetch failed');
    }
});

router.post('/orm/route', async (req, res) => {
    const { route_id, stops, segments } = req.body;

    try {
        await orm.insertStops(stops);
        await orm.insertSegments(segments);
        res.status(201).send('Inserted via ORM');
    } catch (err) {
        console.error('ORM POST error:', err);
        res.status(500).send('ORM insert failed');
    }
});

module.exports = router;
