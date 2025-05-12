// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './theme.css';
import AuthForm from './AuthForm';

// --- Helper functions ---
function calculateDistanceKm(latlngs) {
    let dist = 0;
    for (let i = 1; i < latlngs.length; i++) {
        dist += latlngs[i - 1].distanceTo(latlngs[i]);
    }
    return dist / 1000;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins} min ${secs} s`;
}

function calculateTravelTime({ distanceKm, slopePercent = 0, maxWagons = 5, actualWagons = 5, stops = [] }) {
    const slopeMod = 1 - Math.abs(slopePercent) * 0.02;
    const overloadMod = actualWagons > maxWagons
        ? 1 - 0.05 * (actualWagons - maxWagons)
        : 1;
    const effectiveSpeed = 60 * slopeMod * overloadMod;
    const drivingTimeSec = (distanceKm / effectiveSpeed) * 3600;
    const stopTimeSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);
    const totalSec = drivingTimeSec + stopTimeSec;
    return { formatted: formatTime(totalSec) };
}

// --- Map Components ---
function Simulation({ polylineCoords, stops, run, paused, trainType, routeParams }) {
    const map = useMap();
    const markerRef = useRef(null);
    const timeoutRef = useRef(null);
    const indexRef = useRef(0);

    useEffect(() => {
        if (!map || !polylineCoords || !run || paused) return;
        if (!markerRef.current) {
            const icon = new L.Icon({ iconUrl: '/train.png', iconSize: [32, 32], iconAnchor: [16, 16] });
            markerRef.current = L.marker(polylineCoords[0], { icon }).addTo(map);
        }
        indexRef.current = 0;

        function move() {
            const i = indexRef.current;
            if (i >= polylineCoords.length) return;
            const pos = polylineCoords[i];
            markerRef.current.setLatLng(pos);

            let delay = 500;
            indexRef.current++;
            timeoutRef.current = setTimeout(move, delay);
        }

        move();
        return () => clearTimeout(timeoutRef.current);
    }, [map, polylineCoords, run, paused, trainType, routeParams, stops]);

    return null;
}

function MapWithDrawing({ onCoords, onStops, setRouteParams }) {
    const map = useMap();
    const stopsRef = [];

    useEffect(() => {
        if (!map) return;
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawMarker: false,
            drawPolygon: false,
            drawRectangle: false,
            drawText: false,
            drawPolyline: true,
            drawCircleMarker: true
        });
        map.on('pm:create', e => {
            const layer = e.layer;
            if (layer instanceof L.Polyline) {
                const latlngs = layer.getLatLngs();
                const coords = latlngs.map(p => [p.lat, p.lng]);
                const maxWagons = parseInt(prompt('Max wagons:'), 10);
                const slope = parseFloat(prompt('Slope (%):'));
                const actualWagons = parseInt(prompt('Actual wagons:'), 10);
                const distKm = calculateDistanceKm(latlngs);
                const tt = calculateTravelTime({ distanceKm: distKm, slopePercent: slope, maxWagons, actualWagons, stops: stopsRef });
                layer.bindTooltip(`Length: ${distKm.toFixed(2)} km\nTime: ${tt.formatted}`, { sticky: true });
                onCoords(coords);
                setRouteParams({ maxWagons, slope });
            }
            if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();
                const name = prompt('Stop name:');
                const inP = parseInt(prompt('Passengers in:'), 10);
                const outP = parseInt(prompt('Passengers out:'), 10);
                const stopTime = inP + outP;
                if (!name) {
                    map.removeLayer(layer);
                    return;
                }
                const stop = {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
                    properties: { name, stopTime }
                };
                stopsRef.push(stop);
                onStops(prev => [...prev, stop]);
                layer.bindPopup(`${name} (${stopTime}s)`).openPopup();
            }
            map.pm.disableDraw();
        });
    }, [map, onCoords, onStops, setRouteParams]);

    return null;
}

function MapLoader({ route, onTrainReady, showTrain }) {
    const map = useMap();
    const trainMarkerRef = useRef(null);

    useEffect(() => {
        if (!map) return;
        map.eachLayer(layer => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });
        if (route?.geojson?.coordinates) {
            const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coords, { color: 'blue' }).addTo(map);
            map.fitBounds(polyline.getBounds());

            if (showTrain && coords.length > 0) {
                const icon = new L.Icon({ iconUrl: '/train.png', iconSize: [32, 32], iconAnchor: [16, 16] });
                const marker = L.marker(coords[0], { icon }).addTo(map);
                trainMarkerRef.current = marker;
                onTrainReady({ marker, coords });
            }
        }
        (route?.stops || []).forEach((stop, idx) => {
            const [lng, lat] = stop.geometry.coordinates;
            let name = stop.properties.name;
            let stopTime = stop.properties.stopTime;
            const icon = L.divIcon({
                className: 'stop-icon',
                html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
                iconSize: [14, 14], iconAnchor: [7, 7]
            });
            const marker = L.marker([lat, lng], { icon }).addTo(map);
            marker.bindPopup(`<b>${name}</b><br/>Time: ${stopTime}s<br/><button id="edit-${idx}">Edit</button>`);
            marker.on('popupopen', () => {
                setTimeout(() => {
                    const btn = document.getElementById(`edit-${idx}`);
                    if (btn) btn.onclick = ev => {
                        ev.stopPropagation();
                        const newName = prompt('New name:', name);
                        const newTime = prompt('New time (s):', stopTime);
                        if (newName !== null && newTime !== null) {
                            stop.properties.name = newName;
                            stop.properties.stopTime = parseInt(newTime, 10);
                            name = newName;
                            stopTime = parseInt(newTime, 10);
                            marker.setPopupContent(`<b>${name}</b><br/>Time: ${stopTime}s<br/><button id="edit-${idx}">Edit</button>`);
                            marker.openPopup();
                        }
                    };
                }, 100);
            });
        });
    }, [map, route, onTrainReady, showTrain]);

    return null;
}

function MapDrawingTools({ onDraw }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        map.pm.addControls({
            position: 'topleft', drawCircle: false, drawMarker: false, drawPolygon: false,
            drawRectangle: false, drawText: false, drawPolyline: true, drawCircleMarker: true
        });
        map.on('pm:create', e => { onDraw && onDraw(e); map.pm.disableDraw(); });
    }, [map, onDraw]);
    return null;
}

export default function App() {
    // Auth
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(null);
    const [role, setRole] = useState(null);
    // Routes
    const [routes, setRoutes] = useState([]);
    const [selRoute, setSelRoute] = useState(null);
    const [showRouteList, setShowRouteList] = useState(false);
    // Theme & menus
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('account');
    // Drawing & simulation
    const [routeName, setRouteName] = useState('');
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [drawnStops, setDrawnStops] = useState([]);
    const [coords, setCoords] = useState(null);
    const [stops, setStops] = useState([]);
    const [routeParams, setRouteParams] = useState({ maxWagons: null, slope: null });
    const [trainObj, setTrainObj] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [info, setInfo] = useState('');
    const intervalRef = useRef(null);

    // Apply theme
    useEffect(() => {
        document.body.className = '';
        document.body.classList.add(`${theme}-theme`);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // On token change: decode and load
    useEffect(() => {
        if (!token) return;
        try {
            const p = JSON.parse(atob(token.split('.')[1]));
            setUsername(p.username);
            setRole(p.role);
            loadRoutes();
        } catch {
            setUsername(null);
            setRole(null);
        }
    }, [token]);

    // Load routes
    const loadRoutes = async () => {
        const res = await fetch('http://localhost:5000/routes', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            alert(await res.text());
            return false;
        }
        setRoutes(await res.json());
        return true;
    };

    // Show/hide route select
    const handleShowRoutes = async () => {
        if (!showRouteList) {
            const ok = await loadRoutes();
            if (!ok) return;
        }
        setShowRouteList(!showRouteList);
    };

    // Auth handlers
    const handleAuth = tok => { localStorage.setItem('token', tok); setToken(tok); };
    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null); setUsername(null); setRole(null); setRoutes([]);
    };

    // CRUD handlers
    const handleSaveRoute = async () => {
        if (!routeName || drawnCoords.length === 0) return alert('Provide name and draw route');
        const res = await fetch('http://localhost:5000/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: routeName, route: drawnCoords, stops: drawnStops, max_wagons: routeParams.maxWagons, slope: routeParams.slope })
        });
        if (!res.ok) return alert(await res.text());
        alert('Route saved'); setRouteName(''); setDrawnCoords([]); setDrawnStops([]); loadRoutes();
    };

    const handleDeleteRoute = async () => {
        const res = await fetch(`http://localhost:5000/routes/${selRoute.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return alert(await res.text());
        alert('Route deleted'); setSelRoute(null); loadRoutes();
    };

    const handleStartTrain = () => { if (!trainObj) return; let i = 0; setIsRunning(true); intervalRef.current = setInterval(() => { if (!trainObj.marker || i >= trainObj.coords.length) { clearInterval(intervalRef.current); setIsRunning(false); return; } trainObj.marker.setLatLng(trainObj.coords[i]); i++; }, 500); };
    const handlePauseTrain = () => { clearInterval(intervalRef.current); setIsRunning(false); };
    const handleResetTrain = () => { if (trainObj?.marker) trainObj.marker.setLatLng(trainObj.coords[0]); handlePauseTrain(); };

    if (!token) return <AuthForm onAuth={handleAuth} />;

    return (
        <div className="app-container">
            <MapContainer center={[49.62, 20.7]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapWithDrawing onCoords={setCoords} onStops={setStops} setRouteParams={setRouteParams} />
                <Simulation polylineCoords={coords} stops={stops} run={isRunning} paused={!isRunning} trainType="passenger" routeParams={routeParams} />
                <MapLoader route={selRoute} onTrainReady={setTrainObj} showTrain />
                <MapDrawingTools onDraw={e => {
                    const geo = e.layer.toGeoJSON();
                    if (geo.geometry.type === 'LineString') setDrawnCoords(geo.geometry.coordinates);
                    if (geo.geometry.type === 'Point') {
                        setDrawnStops(prev => [...prev, { type: 'Feature', geometry: geo.geometry, properties: { name: 'New Stop', stopTime: 0 } }]);
                    }
                }} />
            </MapContainer>

            <div className="top-buttons">
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); }}>Menu</button>
                <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); }}>Map</button>
            </div>

            {showMainMenu && (
                <div className={`sidebar ${theme}-theme`}>
                    <div className="tab-buttons">
                        <button onClick={() => setActiveTab('account')}>Account</button>
                        <button onClick={() => setActiveTab('map')}>Map</button>
                        <button onClick={() => setActiveTab('theme')}>Theme</button>
                    </div>
                    {activeTab === 'account' && (
                        <div style={{ padding: '1rem' }}>
                            <p>Zalogowany jako:</p>
                            <h3>{username}</h3>
                            <button onClick={handleLogout}>Logout</button>
                        </div>
                    )}
                    {activeTab === 'map' && <p>Map settings coming soon...</p>}
                    {activeTab === 'theme' && (
                        <div style={{ padding: '1rem' }}>
                            <label htmlFor="theme-select">Select theme:</label>
                            <select id="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                                <option value="gray">Gray</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {showMapMenu && (
                <div className={`mapmenu ${theme}-theme`}>
                    <h3>Map Options</h3>
                    <input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Route name" style={{ width: '100%', marginBottom: '0.5rem' }} />
                    <button onClick={handleSaveRoute} style={{ width: '100%', marginBottom: '0.5rem' }}>Save route</button>
                    <button onClick={loadRoutes} style={{ width: '100%', marginBottom: '0.5rem' }}>Refresh routes</button>

                    <button onClick={handleShowRoutes} style={{ width: '100%', marginBottom: '0.5rem' }}>Wybierz trasę</button>

                    {showRouteList && routes.length > 0 && (
                        <select onChange={e => setSelRoute(routes.find(r => r.id.toString() === e.target.value))} style={{ width: '100%', marginBottom: '0.5rem' }} defaultValue="">
                            <option value="" disabled>-- wybierz trasę --</option>
                            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    )}

                    {role === 'admin' && <button onClick={handleDeleteRoute} style={{ width: '100%', marginBottom: '0.5rem', background: 'red', color: 'white' }}>Delete route</button>}
                    <button onClick={handleStartTrain} disabled={!trainObj || isRunning} style={{ width: '100%', marginBottom: '0.25rem' }}>▶ Start</button>
                    <button onClick={handlePauseTrain} disabled={!isRunning} style={{ width: '100%', marginBottom: '0.25rem' }}>⏸ Pause</button>
                    <button onClick={handleResetTrain} style={{ width: '100%', marginBottom: '0.5rem' }}>🔁 Reset</button>
                    <div className="info">{info}</div>
                </div>
            )}
        </div>
    );
}
