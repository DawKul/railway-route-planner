const db = require('./db');
const pgp = require('pg-promise')();
const { ColumnSet } = pgp.helpers;

// Column sets for bulk operations
const stopsCols = new ColumnSet([
    'route_id', 
    'seq_no', 
    'name', 
    'geom:raw', 
    'stop_time_sec',
    'passengers_in',
    'passengers_out',
    'is_terminal'
], { table: 'stations' });

const segmentsCols = new ColumnSet([
    'route_id', 
    'seq_no', 
    'geom:raw', 
    'max_wagons', 
    'slope_percent'
], { table: 'route_segments' });

// ORM-style functions for simple CRUD operations
async function getRouteById(routeId) {
    return db.oneOrNone('SELECT * FROM routes WHERE route_id = $1', routeId);
}

async function createRoute(routeData) {
    return db.one(
        'INSERT INTO routes(user_id, name, params) VALUES($1, $2, $3) RETURNING route_id',
        [routeData.user_id, routeData.name, routeData.params || {}]
    );
}

async function updateRoute(routeId, routeData) {
    return db.oneOrNone(
        'UPDATE routes SET name = $2, params = $3 WHERE route_id = $1 RETURNING *',
        [routeId, routeData.name, routeData.params]
    );
}

// Bulk insert functions using pg-promise helpers
async function insertStops(stopsData) {
    const query = pgp.helpers.insert(stopsData, stopsCols);
    return db.none(query);
}

async function insertSegments(segmentData) {
    const query = pgp.helpers.insert(segmentData, segmentsCols);
    return db.none(query);
}

// Complex queries using raw SQL
async function getAllRoutesWithUser() {
    return db.any(`
        SELECT r.route_id, r.name, u.username,
        (
            SELECT json_agg(json_build_object(
                'id', s.station_id,
                'name', s.name,
                'passengersIn', COALESCE(s.passengers_in, 0),
                'passengersOut', COALESCE(s.passengers_out, 0)
            ))
            FROM stations s
            WHERE s.route_id = r.route_id
        ) as stations
        FROM routes r
        JOIN users u ON u.user_id = r.user_id
        ORDER BY r.route_id DESC
    `);
}

async function getRouteWithDetails(routeId) {
    return db.one(`
        SELECT 
            r.route_id, 
            r.name,
            ST_AsGeoJSON(ST_MakeLine(s.geom ORDER BY s.seq_no))::json AS route_geometry,
            json_agg(DISTINCT jsonb_build_object(
                'id', s.station_id,
                'name', s.name,
                'geometry', ST_AsGeoJSON(s.geom)::json,
                'stop_time', s.stop_time_sec,
                'passengersIn', COALESCE(s.passengers_in, 0),
                'passengersOut', COALESCE(s.passengers_out, 0),
                'isTerminal', COALESCE(s.is_terminal, false)
            )) AS stations,
            json_agg(DISTINCT jsonb_build_object(
                'id', seg.segment_id,
                'geometry', ST_AsGeoJSON(seg.geom)::json,
                'max_wagons', seg.max_wagons,
                'slope_percent', seg.slope_percent
            )) AS segments
        FROM routes r
        LEFT JOIN stations s ON s.route_id = r.route_id
        LEFT JOIN route_segments seg ON seg.route_id = r.route_id
        WHERE r.route_id = $1
        GROUP BY r.route_id
    `, routeId);
}

// Statistics and calculations using PostGIS
async function calculateRouteStatistics(routeId) {
    return db.one(`
        SELECT 
            ST_Length(ST_MakeLine(s.geom ORDER BY s.seq_no)::geography)/1000 as total_distance_km,
            COUNT(DISTINCT s.station_id) as total_stops,
            SUM(s.stop_time_sec)/60.0 as total_stop_time_minutes,
            SUM(s.passengers_in) as total_passengers_in,
            SUM(s.passengers_out) as total_passengers_out,
            MAX(seg.slope_percent) as max_slope_percent
        FROM routes r
        LEFT JOIN stations s ON s.route_id = r.route_id
        LEFT JOIN route_segments seg ON seg.route_id = r.route_id
        WHERE r.route_id = $1
        GROUP BY r.route_id
    `, routeId);
}

module.exports = {
    // ORM-style functions
    getRouteById,
    createRoute,
    updateRoute,
    
    // Bulk operations
    insertStops,
    insertSegments,
    
    // Complex queries
    getAllRoutesWithUser,
    getRouteWithDetails,
    calculateRouteStatistics
};
