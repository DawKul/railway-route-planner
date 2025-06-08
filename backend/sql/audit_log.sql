-- Audit log tabela
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT,
  route_id INT,
  action TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Funkcja logujaca
CREATE OR REPLACE FUNCTION log_route_changes()
RETURNS trigger AS $$
DECLARE
  current_user_id INT;
BEGIN
  BEGIN
    current_user_id := current_setting('my.current_user_id')::INT;
  EXCEPTION WHEN others THEN
    current_user_id := NULL;
  END;

  INSERT INTO audit_log(user_id, route_id, action)
  VALUES (
    current_user_id,
    COALESCE(NEW.route_id, OLD.route_id),
    TG_OP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

