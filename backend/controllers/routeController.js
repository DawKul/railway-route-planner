const Route = require('../models/Route');
const db = require('../config/database');
const { QueryTypes } = require('sequelize');

// ORM: Create new route
exports.createRoute = async (req, res) => {
    const t = await db.transaction();
    try {
        const { name, stops, segments, userId } = req.body;
        
        // Use stored procedure via RAW QUERY
        await db.query(
            'CALL create_route_with_stops(:userId, :name, :stops, :segments)',
            {
                replacements: {
                    userId,
                    name,
                    stops: JSON.stringify(stops),
                    segments: JSON.stringify(segments)
                },
                type: QueryTypes.RAW,
                transaction: t
            }
        );

        await t.commit();
        res.status(201).json({ message: 'Route created successfully' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// RAW QUERY: Get route with stats
exports.getRouteWithStats = async (req, res) => {
    try {
        const { id } = req.params;
        const [route] = await db.query(`
            SELECT r.*,
                   stats.total_distance,
                   stats.total_stops,
                   stats.avg_stop_time,
                   stats.max_slope,
                   json_agg(DISTINCT jsonb_build_object(
                       'id', s.station_id,
                       'name', s.name,
                       'coordinates', json_build_array(
                           ST_X(s.geom::geometry),
                           ST_Y(s.geom::geometry)
                       ),
                       'stopTime', s.stop_time_sec,
                       'isTerminal', s.is_terminal
                   )) as stops,
                   json_agg(DISTINCT jsonb_build_object(
                       'id', seg.segment_id,
                       'geometry', ST_AsGeoJSON(seg.geom)::jsonb,
                       'maxWagons', seg.max_wagons,
                       'trackCount', seg.track_count
                   )) as segments
            FROM routes r
            LEFT JOIN LATERAL calculate_route_stats(r.route_id) stats ON true
            LEFT JOIN stations s ON s.route_id = r.route_id
            LEFT JOIN route_segments seg ON seg.route_id = r.route_id
            WHERE r.route_id = :id
            GROUP BY r.route_id, stats.total_distance, stats.total_stops, 
                     stats.avg_stop_time, stats.max_slope
        `, {
            replacements: { id },
            type: QueryTypes.SELECT
        });

        if (!route) {
            return res.status(404).json({ message: 'Route not found' });
        }

        res.json(route);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ORM: Update route
exports.updateRoute = async (req, res) => {
    const t = await db.transaction();
    try {
        const { id } = req.params;
        const { name, params, is_circular, is_bidirectional } = req.body;

        const route = await Route.findByPk(id, { transaction: t });
        if (!route) {
            await t.rollback();
            return res.status(404).json({ message: 'Route not found' });
        }

        await route.update({
            name,
            params,
            is_circular,
            is_bidirectional
        }, { transaction: t });

        await t.commit();
        res.json(route);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

// Mixed: Get filtered routes
exports.getFilteredRoutes = async (req, res) => {
    try {
        const { userId, visibility, search } = req.query;

        // Start with ORM query
        let routes = await Route.findAll({
            where: {
                ...(userId && { user_id: userId }),
                ...(visibility && { visibility })
            }
        });

        if (search) {
            // Use RAW QUERY for complex search
            routes = await db.query(`
                SELECT DISTINCT r.*
                FROM routes r
                LEFT JOIN stations s ON s.route_id = r.route_id
                WHERE 
                    r.name ILIKE :search OR
                    s.name ILIKE :search OR
                    r.route_id IN (
                        SELECT route_id 
                        FROM route_segments 
                        WHERE ST_DWithin(
                            geom::geography,
                            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                            5000
                        )
                    )
            `, {
                replacements: {
                    search: `%${search}%`,
                    lon: req.query.lon || 0,
                    lat: req.query.lat || 0
                },
                type: QueryTypes.SELECT
            });
        }

        res.json(routes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// RAW QUERY: Delete route with all related data
exports.deleteRoute = async (req, res) => {
    const t = await db.transaction();
    try {
        const { id } = req.params;
        
        await db.query(`
            WITH RECURSIVE route_data AS (
                -- Delete stations
                DELETE FROM stations
                WHERE route_id = :id
                RETURNING station_id
            ),
            segment_data AS (
                -- Delete segments
                DELETE FROM route_segments
                WHERE route_id = :id
                RETURNING segment_id
            ),
            branch_data AS (
                -- Delete branches
                DELETE FROM route_branches
                WHERE route_id = :id
                RETURNING branch_id
            )
            -- Finally delete the route
            DELETE FROM routes
            WHERE route_id = :id
            RETURNING route_id
        `, {
            replacements: { id },
            type: QueryTypes.DELETE,
            transaction: t
        });

        await t.commit();
        res.json({ message: 'Route deleted successfully' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
}; 