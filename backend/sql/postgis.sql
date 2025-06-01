-- Upewnij się, że PostGIS jest zainstalowany
CREATE EXTENSION IF NOT EXISTS postgis;

-- Sprawdź wersję PostGIS
SELECT PostGIS_Version(); 