const db = require('./db');
const pgp = require('pg-promise')();
const { ColumnSet } = pgp.helpers;

const stopsCols = new ColumnSet(['route_id', 'seq_no', 'name', 'geom:raw', 'stop_time_sec'], { table: 'stations' });
const segmentsCols = new ColumnSet(['route_id', 'seq_no', 'geom:raw', 'max_wagons', 'slope_percent'], { table: 'route_segments' });

async function insertStops(stopsData) {
    const query = pgp.helpers.insert(stopsData, stopsCols);
    return db.none(query);
}

async function insertSegments(segmentData) {
    const query = pgp.helpers.insert(segmentData, segmentsCols);
    return db.none(query);
}

async function getAllRoutesWithUser() {
    return db.any(`
    SELECT r.route_id, r.name, u.username
    FROM routes r
    JOIN users u ON u.user_id = r.user_id
    ORDER BY r.route_id DESC
  `);
}

module.exports = {
    insertStops,
    insertSegments,
    getAllRoutesWithUser
};
