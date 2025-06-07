-- TABLES
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routes (
    route_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    name VARCHAR(100) NOT NULL,
    params JSONB DEFAULT '{}',
    is_circular BOOLEAN DEFAULT false,
    is_bidirectional BOOLEAN DEFAULT true,
    visibility VARCHAR(20) DEFAULT 'public',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
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

CREATE TABLE IF NOT EXISTS route_segments (
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

CREATE TABLE IF NOT EXISTS route_branches (
    branch_id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(route_id) ON DELETE CASCADE,
    from_station_id INTEGER REFERENCES stations(station_id),
    to_station_id INTEGER REFERENCES stations(station_id),
    branch_type VARCHAR(20) DEFAULT 'alternative'
);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION update_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- TRIGGERS
CREATE TRIGGER update_route_timestamp
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_route_timestamp();

-- PROCEDURES
CREATE OR REPLACE PROCEDURE create_route_with_stops(
    p_user_id INTEGER,
    p_name VARCHAR,
    p_stops JSONB,
    p_segments JSONB
) AS $$
DECLARE
    v_route_id INTEGER;
    v_stop JSONB;
    v_segment JSONB;
    i INTEGER;
BEGIN
    -- Create route
    INSERT INTO routes (user_id, name)
    VALUES (p_user_id, p_name)
    RETURNING route_id INTO v_route_id;

    -- Add stops
    FOR i IN 0..jsonb_array_length(p_stops) - 1 LOOP
        v_stop := p_stops->i;
        INSERT INTO stations (
            route_id, seq_no, name, geom, stop_time_sec,
            passengers_in, passengers_out, is_terminal
        )
        VALUES (
            v_route_id,
            (i + 1),
            v_stop->>'name',
            ST_SetSRID(ST_MakePoint(
                (v_stop->'coordinates'->0)::FLOAT,
                (v_stop->'coordinates'->1)::FLOAT
            ), 4326),
            COALESCE((v_stop->>'stop_time_sec')::INTEGER, 30),
            COALESCE((v_stop->>'passengers_in')::INTEGER, 0),
            COALESCE((v_stop->>'passengers_out')::INTEGER, 0),
            COALESCE((v_stop->>'is_terminal')::BOOLEAN, false)
        );
    END LOOP;

    -- Add segments
    FOR i IN 0..jsonb_array_length(p_segments) - 1 LOOP
        v_segment := p_segments->i;
        INSERT INTO route_segments (
            route_id, seq_no, geom, max_wagons,
            slope_percent, track_count, max_speed
        )
        VALUES (
            v_route_id,
            (i + 1),
            ST_SetSRID(ST_GeomFromGeoJSON(v_segment->>'geometry'), 4326),
            COALESCE((v_segment->>'max_wagons')::INTEGER, 10),
            COALESCE((v_segment->>'slope_percent')::NUMERIC, 0),
            COALESCE((v_segment->>'track_count')::INTEGER, 2),
            COALESCE((v_segment->>'max_speed')::INTEGER, 60)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql; 