-- Procedura: add_route_with_stops
CREATE OR REPLACE PROCEDURE add_route_with_stops(
  IN p_user_id INT,
  IN p_name TEXT,
  IN p_stops JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  new_route_id INT;
  i INT := 0;
  s JSONB;
BEGIN
  INSERT INTO routes(user_id, name) VALUES (p_user_id, p_name) RETURNING route_id INTO new_route_id;

  FOR i IN 0 .. jsonb_array_length(p_stops) - 1 LOOP
    s := p_stops->i;
    INSERT INTO stations(route_id, seq_no, name, geom, stop_time_sec)
    VALUES (
      new_route_id,
      i + 1,
      s->>'name',
      ST_SetSRID(ST_MakePoint((s->'geom'->>0)::FLOAT, (s->'geom'->>1)::FLOAT), 4326),
      (s->>'stop_time_sec')::INT
    );
  END LOOP;
END;
$$;
