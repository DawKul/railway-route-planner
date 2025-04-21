import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import AuthForm from "./AuthForm";

const SimulationControls = ({
  onStart,
  onPause,
  onResume,
  onReset,
  isRunning,
  isPaused,
}) => {
  return (
    <div style={{ fontSize: "12px", textAlign: "center" }}>
      <div style={{ marginBottom: "4px", fontWeight: "bold" }}>Pociag</div>
      <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
        <button onClick={onReset} title="Reset" style={{ width: 28, height: 28, fontSize: 16 }}>
          &#8592;
        </button>
        <button
          onClick={onStart}
          title="Jedz"
          style={{ width: 28, height: 28, fontSize: 16 }}
          disabled={isRunning && !isPaused}
        >
          &#9654;
        </button>
        <button
          onClick={isPaused ? onResume : onPause}
          title={isPaused ? "Wznów" : "Pauza"}
          style={{ width: 28, height: 28, fontSize: 16 }}
          disabled={!isRunning}
        >
          {isPaused ? "\u25B6" : "\u23F8"}
        </button>
      </div>
    </div>
  );
};

const Simulation = ({ polylineCoords, stops, run, paused }) => {
  const map = useMap();
  const markerRef = useRef(null);
  const timeoutRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!polylineCoords.length || !run) return;

    const polyline = L.polyline(polylineCoords, { color: "blue" }).addTo(map);
    const marker = L.circleMarker(polylineCoords[0], {
      radius: 6,
      color: "red",
    }).addTo(map);

    markerRef.current = marker;
    indexRef.current = 0;

    return () => {
      map.removeLayer(marker);
      map.removeLayer(polyline);
      clearTimeout(timeoutRef.current);
    };
  }, [polylineCoords, run, map]);

  useEffect(() => {
    if (!run || paused || !markerRef.current) return;

    const coords = polylineCoords;

    const move = () => {
      if (indexRef.current >= coords.length) return;

      const currentPoint = coords[indexRef.current];
      markerRef.current.setLatLng(currentPoint);

      const foundStop = stops.find((stop) => {
        const [lng, lat] = stop.geometry.coordinates;
        return L.latLng(lat, lng).distanceTo(currentPoint) < 10;
      });

      const delay = foundStop ? foundStop.properties.stopTime * 1000 : 100;

      if (foundStop) {
        markerRef.current
          .bindPopup(
            `Postój: ${foundStop.properties.name} (${foundStop.properties.stopTime}s)`
          )
          .openPopup();
      }

      indexRef.current++;
      timeoutRef.current = setTimeout(move, delay);
    };

    move();

    return () => clearTimeout(timeoutRef.current);
  }, [run, paused, polylineCoords, stops]);

  return null;
};

const MapWithDrawing = ({ onSimulate, onAddStops }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: "topright",
      drawCircle: false,
      drawCircleMarker: true,
      drawMarker: false,
      drawRectangle: false,
      drawPolygon: false,
      drawText: false,
    });

    map.on("pm:create", (e) => {
      const layer = e.layer;

      if (layer instanceof L.Polyline) {
        const coords = layer.getLatLngs();
        onSimulate(coords);
      }

      if (layer instanceof L.CircleMarker) {
        if (layer._isProcessed) return;
        layer._isProcessed = true;

        const latlng = layer.getLatLng();
        const stopName = prompt("Nazwa przystanku:");
        const stopTime = prompt("Czas postoju (w sekundach):");

        if (stopName && stopTime) {
          const stop = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [latlng.lng, latlng.lat],
            },
            properties: {
              name: stopName,
              stopTime: parseFloat(stopTime),
            },
          };

          onAddStops((prev) => [...prev, stop]);
          layer.bindPopup(`${stopName} (${stopTime}s)`).openPopup();
        } else {
          map.removeLayer(layer);
        }
      }
    });
  }, [map, onSimulate, onAddStops]);

  return null;
};

function App() {
  const [coords, setCoords] = useState([]);
  const [stops, setStops] = useState([]);
  const [startSignal, setStartSignal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [savedRoutes, setSavedRoutes] = useState([]);

  const handleStart = () => {
    setStartSignal(true);
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => setIsPaused(true);
  const handleResume = () => setIsPaused(false);
  const handleReset = () => {
    setStartSignal(false);
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleSaveRoute = async () => {
    const body = {
      name: routeName,
      route: coords.map((pt) => [pt.lng, pt.lat]),
      stops: stops,
    };

    try {
      const res = await fetch("http://localhost:5000/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        alert("Trasa zapisana!");
        setRouteName("");
      } else {
        alert("Blad zapisu trasy");
      }
    } catch (err) {
      console.error("Blad:", err);
      alert("Nie udalo sie polaczyc z serwerem");
    }
  };

  const handleLoadRoutes = async () => {
    try {
      const res = await fetch("http://localhost:5000/routes");
      const data = await res.json();
      setSavedRoutes(data);
    } catch (err) {
      console.error("Blad ladowania tras:", err);
      alert("Nie udalo sie pobrac tras");
    }
  };

  const handleSelectRoute = (route) => {
    const convertedCoords = route.geojson.coordinates.map(
      ([lng, lat]) => ({ lat, lng })
    );
    setCoords(convertedCoords);
    setStops(route.stops || []);
  };

  return (
    <div className="App" style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer
        center={[49.6218, 20.6972]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapWithDrawing onSimulate={setCoords} onAddStops={setStops} />
        <Simulation
          polylineCoords={coords}
          stops={stops}
          run={startSignal}
          paused={isPaused}
        />
      </MapContainer>

      <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 1000 }}>
        <AuthForm />
      </div>

      <div style={{
        position: "absolute",
        top: "300px",
        right: "10px",
        backgroundColor: "#fff",
        padding: "6px",
        borderRadius: "6px",
        width: "160px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.2)",
        fontSize: "12px",
        zIndex: 1000
      }}>
        <SimulationControls
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onReset={handleReset}
          isRunning={isRunning}
          isPaused={isPaused}
        />

        <div style={{ marginTop: "10px" }}>
          <input
            type="text"
            placeholder="Nazwa trasy"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            style={{ width: "100%", marginBottom: "6px", fontSize: "12px" }}
          />
          <button
            onClick={handleSaveRoute}
            style={{ width: "100%", padding: "4px", fontSize: "12px" }}
            disabled={!coords.length || !routeName}
          >
            Zapisz trase
          </button>
        </div>

        <div style={{ marginTop: "10px" }}>
          <button
            onClick={handleLoadRoutes}
            style={{ width: "100%", padding: "4px", fontSize: "12px" }}
          >
            Pokaz zapisane trasy
          </button>

          {savedRoutes.length > 0 && (
            <select
              onChange={(e) => {
                const selected = savedRoutes.find(r => r.id === parseInt(e.target.value));
                if (selected) handleSelectRoute(selected);
              }}
              style={{ width: "100%", marginTop: "6px", fontSize: "12px" }}
            >
              <option value="">-- wybierz trase --</option>
              {savedRoutes.map(route => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
