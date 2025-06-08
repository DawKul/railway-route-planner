-- Tabela do przechowywania logów audytowych
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela do przechowywania danych symulacji
CREATE TABLE simulations (
    simulation_id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(route_id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    params JSONB DEFAULT '{}',
    results JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger do aktualizacji znacznika czasu dla symulacji
CREATE TRIGGER update_simulation_timestamp
    BEFORE UPDATE ON simulations
    FOR EACH ROW
    EXECUTE FUNCTION update_route_timestamp();

-- Indeksy dla nowych tabel
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_simulations_route_id ON simulations(route_id);
CREATE INDEX idx_simulations_status ON simulations(status);
CREATE INDEX idx_simulations_created_at ON simulations(created_at);

-- Uprawnienia dla nowych tabel
GRANT ALL PRIVILEGES ON TABLE audit_log TO current_user;
GRANT ALL PRIVILEGES ON TABLE simulations TO current_user;
GRANT USAGE, SELECT ON SEQUENCE audit_log_log_id_seq TO current_user;
GRANT USAGE, SELECT ON SEQUENCE simulations_simulation_id_seq TO current_user; 