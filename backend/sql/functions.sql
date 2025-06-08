-- Funkcja: calculate_total_stop_time
CREATE OR REPLACE FUNCTION calculate_total_stop_time(route_id INT)
RETURNS INT AS $$
BEGIN
  RETURN (SELECT SUM(stop_time_sec) FROM stations WHERE route_id = route_id);
END;
$$ LANGUAGE plpgsql;
