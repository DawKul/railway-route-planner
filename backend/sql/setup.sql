-- Najpierw usuwamy istniejące tabele (jeśli istnieją)
DROP TABLE IF EXISTS route_branches CASCADE;
DROP TABLE IF EXISTS route_segments CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Tworzymy tabelę użytkowników
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tworzymy tabelę tras
CREATE TABLE routes (
    route_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    params JSONB DEFAULT '{}',
    is_circular BOOLEAN DEFAULT false,
    is_bidirectional BOOLEAN DEFAULT true,
    visibility VARCHAR(20) DEFAULT 'public',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tworzymy tabelę przystanków
CREATE TABLE stations (
    station_id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(route_id) ON DELETE CASCADE,
    seq_no INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    geom GEOMETRY(Point, 4326),
    stop_time_sec INTEGER DEFAULT 30,
    passengers_in INTEGER DEFAULT 0,
    passengers_out INTEGER DEFAULT 0,
    is_terminal BOOLEAN DEFAULT false,
    UNIQUE (route_id, seq_no)
);

-- Tworzymy tabelę segmentów trasy
CREATE TABLE route_segments (
    segment_id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(route_id) ON DELETE CASCADE,
    seq_no INTEGER NOT NULL,
    geom GEOMETRY(LineString, 4326),
    max_wagons INTEGER DEFAULT 10,
    slope_percent NUMERIC DEFAULT 0,
    track_count INTEGER DEFAULT 2,
    max_speed INTEGER DEFAULT 60,
    UNIQUE (route_id, seq_no)
);

-- Tworzymy tabelę odgałęzień trasy
CREATE TABLE route_branches (
    branch_id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(route_id) ON DELETE CASCADE,
    from_station_id INTEGER REFERENCES stations(station_id) ON DELETE CASCADE,
    to_station_id INTEGER REFERENCES stations(station_id) ON DELETE CASCADE,
    branch_type VARCHAR(20) DEFAULT 'alternative'
);

-- Funkcja do aktualizacji znacznika czasu
CREATE OR REPLACE FUNCTION update_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Funkcja do obliczania statystyk trasy
CREATE OR REPLACE FUNCTION calculate_route_stats(p_route_id INTEGER)
RETURNS TABLE (
    total_distance NUMERIC,
    total_stops INTEGER,
    avg_stop_time NUMERIC,
    max_slope NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ST_Length(ST_MakeLine(s.geom ORDER BY s.seq_no)::geography)/1000 as total_distance,
        COUNT(DISTINCT st.station_id) as total_stops,
        AVG(st.stop_time_sec) as avg_stop_time,
        MAX(ABS(s.slope_percent)) as max_slope
    FROM route_segments s
    JOIN stations st ON s.route_id = st.route_id
    WHERE s.route_id = p_route_id
    GROUP BY s.route_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger do aktualizacji znacznika czasu
CREATE TRIGGER update_route_timestamp
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_route_timestamp();

-- Indeksy dla lepszej wydajności
CREATE INDEX idx_stations_route_id ON stations(route_id);
CREATE INDEX idx_route_segments_route_id ON route_segments(route_id);
CREATE INDEX idx_route_branches_route_id ON route_branches(route_id);
CREATE INDEX idx_stations_geom ON stations USING GIST(geom);
CREATE INDEX idx_route_segments_geom ON route_segments USING GIST(geom);

-- Uprawnienia (dostosuj według potrzeb)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO current_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO current_user; 