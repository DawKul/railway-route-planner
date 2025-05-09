// App.js
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "./theme.css";
import AuthForm from "./AuthForm";


const calculateDistanceKm = (latlngs) => {
    let dist = 0;
    for (let i = 1; i < latlngs.length; i++) {
        dist += latlngs[i - 1].distanceTo(latlngs[i]);
    }
    return dist / 1000; // metry -> km
};

const calculateTravelTime = ({ distanceKm, avgSpeed = 60, slopePercent = 0, maxWagons = 5, actualWagons = 5, stops = [] }) => {
    const slopeModifier = 1 - Math.abs(slopePercent) * 0.02;
    const overloadModifier = actualWagons > maxWagons ? 1 - 0.05 * (actualWagons - maxWagons) : 1;

    const effectiveSpeed = avgSpeed * slopeModifier * overloadModifier;
    const drivingTimeSec = (distanceKm / effectiveSpeed) * 3600;

    const stopTimeSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);

    return {
        drivingTime: drivingTimeSec,
        stopTime: stopTimeSec,
        totalTime: drivingTimeSec + stopTimeSec,
        formatted: formatTime(drivingTimeSec + stopTimeSec),
    };
};

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins} min ${secs} s`;
};

const Simulation = ({ polylineCoords, stops, run, paused, trainType, routeParams }) => {

    const map = useMap();
    const trainMarkerRef = useRef(null);

    useEffect(() => {
        if (!map || !route) return;

        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        if (route.geojson?.coordinates) {
            const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coords, { color: "blue" }).addTo(map);
            map.fitBounds(polyline.getBounds());

            if (showTrain && coords.length > 0) {
                const trainIcon = new L.Icon({
                    iconUrl: "/train.png",
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                });
                const marker = L.marker(coords[0], { icon: trainIcon }).addTo(map);
                trainMarkerRef.current = marker;
                onTrainReady({ marker, coords });
            }
        }

        if (Array.isArray(route.stops)) {
            route.stops.forEach((stop, index) => {
                const [lng, lat] = stop.geometry.coordinates;
                let name = stop.properties?.name || "Przystanek";
                let stopTime = stop.properties?.stopTime || 0;

                const icon = L.divIcon({
                    className: 'custom-stop-icon',
                    html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker([lat, lng], { icon }).addTo(map);
                const popupContent = `<b>${name}</b><br/>Czas postoju: ${stopTime}s<br/><button id="edit-${index}">Edytuj</button>`;
                marker.bindPopup(popupContent);

                marker.on("click", (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    marker.openPopup();
                });

                marker.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById(`edit-${index}`);
                        if (btn) {
                            btn.onclick = (ev) => {
                                ev.stopPropagation();
                                const newName = prompt("Nowa nazwa przystanku:", name);
                                const newTime = prompt("Nowy czas postoju (w sekundach):", stopTime);
                                if (newName !== null && newTime !== null) {
                                    stop.properties.name = newName;
                                    stop.properties.stopTime = parseInt(newTime);
                                    name = newName;
                                    stopTime = parseInt(newTime);
                                    marker.setPopupContent(
                                        `<b>${newName}</b><br/>Czas postoju: ${newTime}s<br/><button id="edit-${index}">Edytuj</button>`
                                    );
                                    marker.openPopup();
                                }
                            };
                        }
                    }, 100);
                });
            });


            /*const delay = foundStop
                ? trainType === "freight"
                    ? 100
                    : foundStop.properties.stopTime * 1000
                : 100;*/
            
            const delay = (() => {
                let baseDelay = 100; // domyslnie
            
                if (foundStop && trainType === "passenger") {
                    baseDelay = foundStop.properties.stopTime * 1000;
                }
            
                if (routeParams.slope) {
                    baseDelay *= (1 + routeParams.slope / 100); // wieksze nachylenie = wolniej
                }
            
                if (routeParams.maxWagons && trainType === "freight") {
                    baseDelay *= (1 + routeParams.maxWagons / 50); // uproszczony model
                }
            
                return baseDelay;
            })();                
            
            if (foundStop && trainType === "passenger") {
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
    }, [run, paused, polylineCoords, stops, trainType]);

    return null;
}


const MapWithDrawing = ( onDraw ,onSimulate, onAddStops, setRouteParams }) => {


    const map = useMap();
    const stopsRef = [];

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

        map.off("pm:create");

        map.on("pm:create", (e) => {

            const layer = e.layer;

            if (layer instanceof L.Polyline) {
                const coords = layer.getLatLngs();
                const maxWagons = parseInt(prompt("Maksymalna liczba wagonów:"), 10);
                const slope = parseFloat(prompt("Nachylenie trasy (%):"));
                const actualWagons = parseInt(prompt("Aktualna liczba wagonów:"), 10);

                const distanceKm = calculateDistanceKm(coords);

                const timeResult = calculateTravelTime({
                    distanceKm,
                    slopePercent: slope,
                    maxWagons,
                    actualWagons,
                    stops: stopsRef,
                });

                onSimulate(coords);
                setRouteParams({ maxWagons, slope });

                layer.bindTooltip(
                    `Maks. wagony: ${isNaN(maxWagons) ? "brak" : maxWagons}, Nachylenie: ${isNaN(slope) ? "brak" : slope}%<br>
                    Długość: ${distanceKm.toFixed(2)} km<br>Czas przejazdu: ${timeResult.formatted}`,
                    { sticky: true }
                );
            }

            if (layer instanceof L.CircleMarker) {
                if (layer._isProcessed) return;
                layer._isProcessed = true;

                const latlng = layer.getLatLng();
                const stopName = prompt("Nazwa przystanku:");
                const passengersIn = parseInt(prompt("Średnia liczba wsiadających:"), 10);
                const passengersOut = parseInt(prompt("Średnia liczba wysiadających:"), 10);
                const stopTime = (passengersIn + passengersOut) * 1; // lub inny mnożnik

                if (stopName) {
                    const stop = {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [latlng.lng, latlng.lat],
                        },
                        properties: {
                            name: stopName,
                            stopTime,
                            passengersIn,
                            passengersOut,
                        },
                    };

                    stopsRef.push(stop); // zapamiętaj przystanek

                    onAddStops((prev) => [...prev, stop]);
                    layer.bindPopup(`${stopName} (${stopTime}s)`).openPopup();
                } else {
                    map.removeLayer(layer);
                }
            }
        });
    }, [map, onSimulate, onAddStops, setRouteParams]);


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
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
    const intervalRef = useRef(null);
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [drawnStops, setDrawnStops] = useState([]);
    const [savedRoutes, setSavedRoutes] = useState([]);
    const [trainType, setTrainType] = useState("passenger");
    const [routeParams, setRouteParams] = useState({ maxWagons: null, slope: null });


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
        <div className="app-container">
            <MapContainer center={[49.62, 20.7]} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <MapWithDrawing onSimulate={setCoords} onAddStops={setStops} setRouteParams={setRouteParams} />
                <Simulation
                    polylineCoords={coords}
                    stops={stops}
                    run={startSignal}
                    paused={isPaused}
                    trainType={trainType}
                    routeParams={routeParams}
                />

            </MapContainer>

            <div className="top-buttons">
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); }} style={{ width: 40, height: 40, marginBottom: 8 }}>Menu</button>
                <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); }} style={{ width: 40, height: 40 }}>Mapa</button>
            </div>

            {showMainMenu && (
                <div className={`sidebar ${theme}-theme`}>
                    <div style={{ marginBottom: "1rem" }}>
                        <button onClick={() => setActiveTab("konto")}>Konto</button>
                        <button onClick={() => setActiveTab("mapy")}>Mapy</button>
                        <button onClick={() => setActiveTab("wyglad")}>Wyglad</button>
                    </div>
                    {activeTab === "konto" && <AuthForm />}
                    {activeTab === "mapy" && <p>Import map z internetu - wkrótce</p>}
                    {activeTab === "wyglad" && (
                        <div>
                            <label htmlFor="theme-select">Wybierz motyw:</label>
                            <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: "100%", marginTop: "0.5rem" }}>
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
                    <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Nazwa nowej trasy" style={{ width: "100%", marginBottom: "0.5rem" }} />
                    <button onClick={handleSaveRoute} style={{ width: "100%", marginBottom: "0.5rem" }}>Zapisz trasę</button>
                    <button onClick={handleLoadRoutes} style={{ width: "100%", marginBottom: "0.5rem" }}>Odśwież trasy</button>
                    {allRoutes.length > 0 && (
                        <select onChange={(e) => {
                            const selected = allRoutes.find((r) => r.id.toString() === e.target.value);
                            setSelectedRoute(selected);
                        }} style={{ width: "100%", marginBottom: "0.5rem" }}>
                            <option value="">Wybierz trasę</option>
                            {allRoutes.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={handleDeleteRoute} style={{ width: "100%", marginBottom: "0.5rem" }}>Usuń trasę</button>
                    <button onClick={handleStartTrain} style={{ width: "100%", marginBottom: "0.25rem" }} disabled={!train || isRunning}>Start</button>
                    <button onClick={handlePauseTrain} style={{ width: "100%", marginBottom: "0.25rem" }} disabled={!isRunning}>Pauza</button>
                    <button onClick={handleResetTrain} style={{ width: "100%", marginBottom: "0.5rem" }}>Reset</button>
                    <div>{info}</div>
                </div>
            )}
        </div>
    );
}

export default App;

