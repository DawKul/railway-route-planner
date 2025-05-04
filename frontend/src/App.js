import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
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
};

const MapWithDrawing = ({ onSimulate, onAddStops, setRouteParams }) => {
    const map = useMap();
    const stopsRef = [];

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
                    `Maks. wagony: ${isNaN(maxWagons) ? "brak" : maxWagons}\n, Nachylenie: ${isNaN(slope) ? "brak" : slope}%\n, 
                    Długość: ${distanceKm.toFixed(2)} km\n, Czas przejazdu: ${timeResult.formatted}`,
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
};

function App() {
    const [coords, setCoords] = useState([]);
    const [stops, setStops] = useState([]);
    const [startSignal, setStartSignal] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [routeName, setRouteName] = useState("");
    const [savedRoutes, setSavedRoutes] = useState([]);
    const [trainType, setTrainType] = useState("passenger");
    const [routeParams, setRouteParams] = useState({ maxWagons: null, slope: null });

    // ... funkcje handleStart, Pause, SaveRoute, LoadRoutes itd.

    return (
        <div className="App" style={{ height: "100vh", width: "100vw", position: "relative" }}>
            <MapContainer
                center={[49.6218, 20.6972]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
            >
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

            <div style={{ position: "absolute", top: "80px", right: "10px", backgroundColor: "#fff", padding: "6px", borderRadius: "6px", width: "160px", boxShadow: "0 1px 6px rgba(0,0,0,0.2)", fontSize: "12px", zIndex: 1000 }}>
                {/* Kontrolki symulacji + zapis trasy */}

                <select
                    value={trainType}
                    onChange={(e) => setTrainType(e.target.value)}
                    style={{ width: "100%", marginTop: "6px", fontSize: "12px" }}
                >
                    <option value="passenger">Pociąg pasażerski</option>
                    <option value="freight">Pociąg towarowy</option>
                </select>
            </div>
        </div>
    );
}

export default App;
