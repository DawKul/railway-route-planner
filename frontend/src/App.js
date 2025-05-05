// App.js – Zapis trasy z rysowaniem i przystankami
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import AuthForm from "./AuthForm";

const trainIcon = new L.Icon({
    iconUrl: "/train.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

function MapLoader({ route, onTrainReady, showTrain }) {
    const map = useMap();
    const trainMarkerRef = useRef(null);

    useEffect(() => {
        if (!map || !route) return;

        map.eachLayer(layer => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        if (route.geojson?.coordinates) {
            const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coords, { color: "blue" }).addTo(map);
            map.fitBounds(polyline.getBounds());

            if (showTrain && coords.length > 0) {
                const marker = L.marker(coords[0], { icon: trainIcon }).addTo(map);
                trainMarkerRef.current = marker;
                onTrainReady({ marker, coords });
            }
        }

        if (Array.isArray(route.stops)) {
            route.stops.forEach((stop) => {
                const [lng, lat] = stop.geometry.coordinates;
                const name = stop.properties?.name || "Przystanek";
                const stopTime = stop.properties?.stopTime || 0;

                L.circleMarker([lat, lng], { radius: 6, color: "red" })
                    .bindPopup(`<b>${name}</b><br/>Czas postoju: ${stopTime}s`)
                    .addTo(map);
            });
        }
    }, [map, route, onTrainReady, showTrain]);

    return null;
}

function MapDrawingTools({ onDraw }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        map.pm.addControls({
            position: "topleft",
            drawCircle: false,
            drawMarker: false,
            drawPolygon: false,
            drawRectangle: false,
            drawText: false,
            drawPolyline: true,
            drawCircleMarker: true,
        });

        map.on("pm:create", (e) => {
            if (onDraw) onDraw(e);
        });
    }, [map, onDraw]);

    return null;
}

function App() {
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [activeTab, setActiveTab] = useState("konto");
    const [routeName, setRouteName] = useState("");
    const [allRoutes, setAllRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [train, setTrain] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [info, setInfo] = useState("");
    const intervalRef = useRef(null);
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [drawnStops, setDrawnStops] = useState([]);

    const handleSaveRoute = async () => {
        if (!routeName || drawnCoords.length === 0) return alert("Podaj nazwę i narysuj trasę.");
        try {
            await fetch("http://localhost:5000/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: routeName, route: drawnCoords, stops: drawnStops })
            });
            alert("Zapisano trasę");
            setRouteName("");
            setDrawnCoords([]);
            setDrawnStops([]);
            handleLoadRoutes();
        } catch (err) {
            alert("Błąd zapisu trasy");
        }
    };

    const handleLoadRoutes = async () => {
        try {
            const response = await fetch("http://localhost:5000/routes");
            const data = await response.json();
            setAllRoutes(data);
        } catch (err) {
            alert("Nie udało się pobrać tras");
        }
    };

    const handleDeleteRoute = async () => {
        if (!selectedRoute) return alert("Wybierz trasę do usunięcia");
        try {
            await fetch(`http://localhost:5000/routes/${selectedRoute.id}`, { method: "DELETE" });
            alert("Usunięto trasę");
            setSelectedRoute(null);
            handleLoadRoutes();
        } catch (err) {
            alert("Błąd usuwania");
        }
    };

    const handleStartTrain = () => {
        if (!train) return;
        let i = 0;
        setIsRunning(true);
        intervalRef.current = setInterval(() => {
            if (!train.marker || i >= train.coords.length) {
                clearInterval(intervalRef.current);
                setIsRunning(false);
                return;
            }
            train.marker.setLatLng(train.coords[i]);
            i++;
        }, 500);
    };

    const handlePauseTrain = () => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const handleResetTrain = () => {
        if (train && train.coords.length > 0 && train.marker) {
            train.marker.setLatLng(train.coords[0]);
        }
        handlePauseTrain();
    };

    useEffect(() => {
        if (!selectedRoute || !selectedRoute.geojson?.coordinates) return;
        const coords = selectedRoute.geojson.coordinates;
        let distance = 0;
        for (let i = 1; i < coords.length; i++) {
            const [lng1, lat1] = coords[i - 1];
            const [lng2, lat2] = coords[i];
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance += 6371 * c;
        }
        setInfo(`Długość trasy: ${distance.toFixed(2)} km`);
    }, [selectedRoute]);

    return (
        <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
            <MapContainer center={[49.62, 20.7]} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapLoader route={selectedRoute} onTrainReady={setTrain} showTrain={true} />
                <MapDrawingTools
                    onDraw={(e) => {
                        const geo = e.layer.toGeoJSON();
                        if (geo.geometry.type === "LineString") {
                            setDrawnCoords(geo.geometry.coordinates);
                        }
                        if (geo.geometry.type === "Point") {
                            const stop = {
                                type: "Feature",
                                geometry: geo.geometry,
                                properties: {
                                    name: "Nowy przystanek",
                                    stopTime: 0,
                                },
                            };
                            setDrawnStops((prev) => [...prev, stop]);
                        }
                    }}
                />
            </MapContainer>

            <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}>
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); }} style={{ width: 40, height: 40, marginBottom: 8 }}>☰</button>
                <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); }} style={{ width: 40, height: 40 }}>🗺</button>
            </div>

            {showMainMenu && (
                <div style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "300px", backgroundColor: "#ffffffdd", zIndex: 999, padding: "1rem", boxShadow: "-2px 0 6px rgba(0,0,0,0.1)" }}>
                    <div style={{ marginBottom: "1rem" }}>
                        <button onClick={() => setActiveTab("konto")}>Konto</button>
                        <button onClick={() => setActiveTab("mapy")}>Mapy</button>
                        <button onClick={() => setActiveTab("wyglad")}>Wygląd</button>
                    </div>
                    {activeTab === "konto" && <AuthForm />}
                    {activeTab === "mapy" && <p>Import map z internetu – wkrótce</p>}
                    {activeTab === "wyglad" && <p>Ustawienia wyglądu aplikacji</p>}
                </div>
            )}

            {showMapMenu && (
                <div style={{ position: "absolute", top: 70, right: 0, height: "calc(100% - 70px)", width: "250px", backgroundColor: "#ffffffcc", zIndex: 998, padding: "1rem", boxShadow: "-2px 0 4px rgba(0,0,0,0.1)" }}>
                    <h3>Opcje mapy</h3>
                    <input
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        placeholder="Nazwa nowej trasy"
                        style={{ width: "100%", marginBottom: "0.5rem" }}
                    />
                    <button onClick={handleSaveRoute} style={{ width: "100%", marginBottom: "0.5rem" }}>💾 Zapisz trasę</button>
                    <button onClick={handleLoadRoutes} style={{ width: "100%", marginBottom: "0.5rem" }}>🔄 Odśwież trasy</button>
                    {allRoutes.length > 0 && (
                        <select
                            onChange={(e) => {
                                const selected = allRoutes.find((r) => r.id.toString() === e.target.value);
                                setSelectedRoute(selected);
                            }}
                            style={{ width: "100%", marginBottom: "0.5rem" }}
                        >
                            <option value="">Wybierz trasę</option>
                            {allRoutes.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={handleDeleteRoute} style={{ width: "100%", marginBottom: "0.5rem" }}>🗑 Usuń trasę</button>
                    <button onClick={handleStartTrain} style={{ width: "100%", marginBottom: "0.25rem" }} disabled={!train || isRunning}>▶ Start</button>
                    <button onClick={handlePauseTrain} style={{ width: "100%", marginBottom: "0.25rem" }} disabled={!isRunning}>⏸ Pauza</button>
                    <button onClick={handleResetTrain} style={{ width: "100%", marginBottom: "0.5rem" }}>🔁 Reset</button>
                    <div>{info}</div>
                </div>
            )}
        </div>
    );
}

export default App;
