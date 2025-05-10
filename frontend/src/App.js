// App.js – pełny, poprawny plik scalający funkcje Szymon i D_Doktor
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "./theme.css";
import AuthForm from "./AuthForm";

// Oblicza długość trasy w km na podstawie tablicy LatLng
function calculateDistanceKm(latlngs) {
    let dist = 0;
    for (let i = 1; i < latlngs.length; i++) {
        dist += latlngs[i - 1].distanceTo(latlngs[i]);
    }
    return dist / 1000;
}

// Formatuje czas (s) na "X min Y s"
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins} min ${secs} s`;
}

// Oblicza czas przejazdu biorąc pod uwagę nachylenie, wagony i postoje
function calculateTravelTime({ distanceKm, avgSpeed = 60, slopePercent = 0, maxWagons = 5, actualWagons = 5, stops = [] }) {
    const slopeModifier = 1 - Math.abs(slopePercent) * 0.02;
    const overloadModifier = actualWagons > maxWagons ? 1 - 0.05 * (actualWagons - maxWagons) : 1;
    const effectiveSpeed = avgSpeed * slopeModifier * overloadModifier;
    const drivingTimeSec = (distanceKm / effectiveSpeed) * 3600;
    const stopTimeSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);
    const totalSec = drivingTimeSec + stopTimeSec;
    return { drivingTime: drivingTimeSec, stopTime: stopTimeSec, totalTime: totalSec, formatted: formatTime(totalSec) };
}

// Komponent symulacji ruchu pociągu
function Simulation({ polylineCoords, stops, run, paused, trainType, routeParams }) {
    const map = useMap();
    const markerRef = useRef(null);
    const timeoutRef = useRef(null);
    const indexRef = useRef(0);

    useEffect(() => {
        if (!map || !polylineCoords || !run || paused) return;
        // Inicjalizacja markera
        if (!markerRef.current) {
            const trainIcon = new L.Icon({ iconUrl: "/train.png", iconSize: [32, 32], iconAnchor: [16, 16] });
            markerRef.current = L.marker(polylineCoords[0], { icon: trainIcon }).addTo(map);
        }
        indexRef.current = 0;

        function move() {
            const i = indexRef.current;
            if (i >= polylineCoords.length) return;
            const latlng = polylineCoords[i];
            markerRef.current.setLatLng(latlng);
            // Sprawdź postój
            const foundStop = stops.find(s => {
                const [lng, lat] = s.geometry.coordinates;
                return Math.abs(latlng[0] - lat) < 1e-4 && Math.abs(latlng[1] - lng) < 1e-4;
            });
            let delay = 100;
            if (foundStop && trainType === "passenger") delay = foundStop.properties.stopTime * 1000;
            if (routeParams.slope) delay *= 1 + routeParams.slope / 100;
            if (routeParams.maxWagons && trainType === "freight") delay *= 1 + routeParams.maxWagons / 50;
            if (foundStop && trainType === "passenger") {
                markerRef.current.bindPopup(`Postój: ${foundStop.properties.name} (${foundStop.properties.stopTime}s)`).openPopup();
            }
            indexRef.current++;
            timeoutRef.current = setTimeout(move, delay);
        }

        move();
        return () => clearTimeout(timeoutRef.current);
    }, [map, polylineCoords, run, paused, trainType, routeParams, stops]);

    return null;
}

// Komponent do rysowania trasy i dodawania przystanków + parametrów trasy
function MapWithDrawing({ onCoords, onStops, setRouteParams }) {
    const map = useMap();
    const stopsRef = [];

    useEffect(() => {
        if (!map) return;
        map.pm.addControls({ position: "topleft", drawCircle: false, drawMarker: false, drawPolygon: false, drawRectangle: false, drawText: false, drawPolyline: true, drawCircleMarker: true });
        map.on("pm:create", e => {
            const layer = e.layer;
            if (layer instanceof L.Polyline) {
                const coords = layer.getLatLngs().map(p => [p.lat, p.lng]);
                const maxW = parseInt(prompt("Maksymalna liczba wagonów:"), 10);
                const slope = parseFloat(prompt("Nachylenie trasy (%):"));
                const actualW = parseInt(prompt("Aktualna liczba wagonów:"), 10);
                const distKm = calculateDistanceKm(layer.getLatLngs());
                const timeRes = calculateTravelTime({ distanceKm: distKm, slopePercent: slope, maxWagons: maxW, actualWagons: actualW, stops: stopsRef });
                layer.bindTooltip(`Długość: ${distKm.toFixed(2)} km<br>Czas: ${timeRes.formatted}`, { sticky: true });
                onCoords(coords);
                setRouteParams({ maxWagons: maxW, slope });
            }
            if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();
                const name = prompt("Nazwa przystanku:");
                const inP = parseInt(prompt("Liczba wsiadających:"), 10);
                const outP = parseInt(prompt("Liczba wysiadających:"), 10);
                const sTime = (inP + outP) * 1;
                if (!name) { map.removeLayer(layer); return; }
                const stop = { type: "Feature", geometry: { type: "Point", coordinates: [pt.lng, pt.lat] }, properties: { name, stopTime: sTime, passengersIn: inP, passengersOut: outP } };
                stopsRef.push(stop);
                onStops(prev => [...prev, stop]);
                layer.bindPopup(`${name} (${sTime}s)`).openPopup();
            }
            map.pm.disableDraw();
        });
    }, [map, onCoords, onStops, setRouteParams]);

    return null;
}

// Komponent do wyświetlania zapisanej trasy i edycji przystanków
function MapLoader({ route, onTrainReady, showTrain }) {
    const map = useMap();
    const trainMarkerRef = useRef(null);

    useEffect(() => {
        if (!map || !route) return;
        map.eachLayer(layer => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer);
        });

        if (route.geojson?.coordinates) {
            const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coords, { color: "blue" }).addTo(map);
            map.fitBounds(polyline.getBounds());
            if (showTrain && coords.length > 0) {
                const trainIcon = new L.Icon({ iconUrl: "/train.png", iconSize: [32, 32], iconAnchor: [16, 16] });
                const marker = L.marker(coords[0], { icon: trainIcon }).addTo(map);
                trainMarkerRef.current = marker;
                onTrainReady({ marker, coords });
            }
        }

        if (Array.isArray(route.stops)) {
            route.stops.forEach((stop, idx) => {
                const [lng, lat] = stop.geometry.coordinates;
                let name = stop.properties?.name || "Przystanek";
                let stopTime = stop.properties?.stopTime || 0;
                const icon = L.divIcon({ className: 'custom-stop-icon', html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
                const marker = L.marker([lat, lng], { icon }).addTo(map);
                marker.bindPopup(`<b>${name}</b><br/>Czas postoju: ${stopTime}s<br/><button id=\`edit-${idx}\`>Edytuj</button>`);
                marker.on("click", e => { L.DomEvent.stopPropagation(e.originalEvent); marker.openPopup(); });
                marker.on("popupopen", () => { setTimeout(() => { const btn = document.getElementById(`edit-${idx}`); if (btn) btn.onclick = ev => { ev.stopPropagation(); const nName = prompt("Nowa nazwa przystanku:", name); const nTime = prompt("Nowy czas postoju (s):", stopTime); if (nName !== null && nTime !== null) { stop.properties.name = nName; stop.properties.stopTime = parseInt(nTime); name = nName; stopTime = parseInt(nTime); marker.setPopupContent(`<b>${nName}</b><br/>Czas postoju: ${nTime}s<br/><button id=\`edit-${idx}\`>Edytuj</button>`); marker.openPopup(); } }; }, 100); });
            });
        }
    }, [map, route, onTrainReady, showTrain]);

    return null;
}

// Komponent narzędzi rysowania tras i przystanków (D_Doktor)
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
            map.pm.disableDraw();
        });
    }, [map, onDraw]);

    return null;
}

export default function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [activeTab, setActiveTab] = useState("konto");
    const [routeName, setRouteName] = useState("");
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [drawnStops, setDrawnStops] = useState([]);
    const [coords, setCoords] = useState(null);
    const [stops, setStops] = useState([]);
    const [routeParams, setRouteParams] = useState({ maxWagons: null, slope: null });
    const [runSim, setRunSim] = useState(false);
    const [paused, setPaused] = useState(false);
    const [trainType, setTrainType] = useState("passenger");
    const [allRoutes, setAllRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [trainMarker, setTrainMarker] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [info, setInfo] = useState("");
    const intervalRef = useRef(null);

    useEffect(() => {
        document.body.className = "";
        document.body.classList.add(`${theme}-theme`);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const handleSaveRoute = async () => {
        if (!routeName || drawnCoords.length === 0) return alert("Podaj nazwę i narysuj trasę.");
        try {
            await fetch("http://localhost:5000/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: routeName, route: drawnCoords, stops: drawnStops }),
            });
            alert("Zapisano trasę");
            setRouteName(""); setDrawnCoords([]); setDrawnStops([]);
            handleLoadRoutes();
        } catch (err) {
            alert("Błąd zapisu trasy");
        }
    };

    const handleLoadRoutes = async () => {
        try {
            const resp = await fetch("http://localhost:5000/routes");
            const data = await resp.json(); setAllRoutes(data);
        } catch {
            alert("Nie udało się pobrać tras");
        }
    };

    const handleDeleteRoute = async () => {
        if (!selectedRoute) return alert("Wybierz trasę do usunięcia");
        try {
            await fetch(`http://localhost:5000/routes/${selectedRoute.id}`, { method: "DELETE" });
            alert("Usunięto trasę"); setSelectedRoute(null);
            handleLoadRoutes();
        } catch {
            alert("Błąd usuwania");
        }
    };

    const handleStartTrain = () => {
        if (!trainMarker) return;
        let i = 0; setIsRunning(true);
        intervalRef.current = setInterval(() => {
            if (!trainMarker.marker || i >= trainMarker.coords.length) { clearInterval(intervalRef.current); setIsRunning(false); return; }
            trainMarker.marker.setLatLng(trainMarker.coords[i]); i++;
        }, 500);
    };

    const handlePauseTrain = () => { clearInterval(intervalRef.current); setIsRunning(false); };

    const handleResetTrain = () => { if (trainMarker && trainMarker.marker) trainMarker.marker.setLatLng(trainMarker.coords[0]); handlePauseTrain(); };

    useEffect(() => {
        if (!selectedRoute || !selectedRoute.geojson?.coordinates) return;
        const coordsArr = selectedRoute.geojson.coordinates;
        let dist = 0;
        for (let i = 1; i < coordsArr.length; i++) {
            const [lng1, lat1] = coordsArr[i - 1]; const [lng2, lat2] = coordsArr[i];
            const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); dist += 6371 * c;
        }
        setInfo(`Długość trasy: ${dist.toFixed(2)} km`);
    }, [selectedRoute]);

    return (
        <div className="app-container">
            <MapContainer center={[49.62, 20.7]} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapWithDrawing onCoords={setCoords} onStops={setStops} setRouteParams={setRouteParams} />
                <Simulation polylineCoords={coords} stops={stops} run={runSim} paused={paused} trainType={trainType} routeParams={routeParams} />
                <MapLoader route={selectedRoute} onTrainReady={setTrainMarker} showTrain={true} />
                <MapDrawingTools onDraw={e => {
                    const geo = e.layer.toGeoJSON();
                    if (geo.geometry.type === "LineString") setDrawnCoords(geo.geometry.coordinates);
                    if (geo.geometry.type === "Point") {
                        const stop = { type: "Feature", geometry: geo.geometry, properties: { name: "Nowy przystanek", stopTime: 0 } };
                        setDrawnStops(prev => [...prev, stop]);
                    }
                }} />
            </MapContainer>

            <div className="top-buttons">
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); }} className="top-btn">Menu</button>
                <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); }} className="top-btn">Mapa</button>
            </div>

            {showMainMenu && (
                <div className={`sidebar ${theme}-theme`}>
                    <div className="tab-buttons">
                        <button onClick={() => setActiveTab("konto")}>Konto</button>
                        <button onClick={() => setActiveTab("mapy")}>Mapy</button>
                        <button onClick={() => setActiveTab("wyglad")}>Wyglad</button>
                    </div>
                    {activeTab === "konto" && <AuthForm />}
                    {activeTab === "mapy" && <p>Import map z internetu - wkrótce</p>}
                    {activeTab === "wyglad" && (
                        <div>
                            <label htmlFor="theme-select">Wybierz motyw:</label>
                            <select id="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
                                <option value="light">Jasny</option>
                                <option value="dark">Ciemny</option>
                                <option value="gray">Szary</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {showMapMenu && (
                <div className={`mapmenu ${theme}-theme`}>
                    <h3>Opcje mapy</h3>
                    <input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Nazwa nowej trasy" />
                    <button onClick={handleSaveRoute}>Zapisz trasę</button>
                    <button onClick={handleLoadRoutes}>Odśwież trasy</button>
                    {allRoutes.length > 0 && (
                        <select onChange={e => setSelectedRoute(allRoutes.find(r => r.id.toString() === e.target.value))}>
                            <option value="">Wybierz trasę</option>
                            {allRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    )}
                    <button onClick={handleDeleteRoute}>Usuń trasę</button>
                    <button onClick={handleStartTrain} disabled={!trainMarker || isRunning}>Start</button>
                    <button onClick={handlePauseTrain} disabled={!isRunning}>Pauza</button>
                    <button onClick={handleResetTrain}>Reset</button>
                    <div className="info">{info}</div>
                </div>
            )}
        </div>
    );
}
