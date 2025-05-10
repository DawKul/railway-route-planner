// App.js – pełny kod React z auth JWT, motywami, rysowaniem mapy, symulacją i edycją przystanków
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './theme.css';
import AuthForm from './AuthForm';

// Pomocnicze funkcje obliczeniowe
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

function calculateTravelTime({ distanceKm, avgSpeed = 60, slopePercent = 0, maxWagons = 5, actualWagons = 5, stops = [] }) {
    const slopeMod = 1 - Math.abs(slopePercent) * 0.02;
    const overloadMod = actualWagons > maxWagons ? 1 - 0.05 * (actualWagons - maxWagons) : 1;
    const effectiveSpeed = avgSpeed * slopeMod * overloadMod;
    const driveSec = (distanceKm / effectiveSpeed) * 3600;
    const stopSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);
    const totalSec = driveSec + stopSec;
    return { driveSec, stopSec, totalSec, formatted: formatTime(totalSec) };
}

// Komponent symulacji ruchu pociągu
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
            const found = stops.find(s => {
                const [lng, lat] = s.geometry.coordinates;
                return Math.hypot(pos[0] - lat, pos[1] - lng) < 1e-4;
            });
            let delay = 500;
            if (found && trainType === 'passenger') delay = found.properties.stopTime * 1000;
            if (routeParams.slope) delay *= 1 + routeParams.slope / 100;
            if (routeParams.maxWagons && trainType === 'freight') delay *= 1 + routeParams.maxWagons / 50;
            if (found && trainType === 'passenger') markerRef.current.bindPopup(`Stop: ${found.properties.name} (${found.properties.stopTime}s)`).openPopup();
            indexRef.current++;
            timeoutRef.current = setTimeout(move, delay);
        }

        move();
        return () => clearTimeout(timeoutRef.current);
    }, [map, polylineCoords, run, paused, trainType, routeParams, stops]);

    return null;
}

// Komponent rysowania tras i przystanków
function MapWithDrawing({ onCoords, onStops, setRouteParams }) {
    const map = useMap();
    const stopsRef = [];

    useEffect(() => {
        if (!map) return;
        map.pm.addControls({ position: 'topleft', drawCircle: false, drawMarker: false, drawPolygon: false, drawRectangle: false, drawText: false, drawPolyline: true, drawCircleMarker: true });
        map.on('pm:create', e => {
            const layer = e.layer;
            if (layer instanceof L.Polyline) {
                const ll = layer.getLatLngs();
                const coords = ll.map(p => [p.lat, p.lng]);
                const maxW = parseInt(prompt('Max wagons:'), 10);
                const slope = parseFloat(prompt('Slope (%):'));
                const actualW = parseInt(prompt('Actual wagons:'), 10);
                const distKm = calculateDistanceKm(ll);
                const tr = calculateTravelTime({ distanceKm: distKm, slopePercent: slope, maxWagons: maxW, actualWagons: actualW, stops: stopsRef });
                layer.bindTooltip(`Length: ${distKm.toFixed(2)} km<br>Time: ${tr.formatted}`, { sticky: true });
                onCoords(coords);
                setRouteParams({ maxWagons: maxW, slope });
            }
            if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();
                const name = prompt('Stop name:');
                const inP = parseInt(prompt('Passengers in:'), 10);
                const outP = parseInt(prompt('Passengers out:'), 10);
                const st = (inP + outP) * 1;
                if (!name) { map.removeLayer(layer); return; }
                const stop = { type: 'Feature', geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] }, properties: { name, stopTime: st, passengersIn: inP, passengersOut: outP } };
                stopsRef.push(stop);
                onStops(prev => [...prev, stop]);
                layer.bindPopup(`${name} (${st}s)`).openPopup();
            }
            map.pm.disableDraw();
        });
    }, [map, onCoords, onStops, setRouteParams]);

    return null;
}

// Komponent wyświetlania zapisanej trasy i edycji przystanków
function MapLoader({ route, onTrainReady, showTrain }) {
    const map = useMap();
    const trainRef = useRef(null);

    useEffect(() => {
        if (!map || !route) return;
        map.eachLayer(l => { if (l instanceof L.Polyline || l instanceof L.Marker || l instanceof L.CircleMarker) map.removeLayer(l); });
        if (route.geojson?.coordinates) {
            const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
            L.polyline(coords, { color: 'blue' }).addTo(map).fitBounds(coords);
            if (showTrain && coords.length > 0) { const icon = new L.Icon({ iconUrl: '/train.png', iconSize: [32, 32], iconAnchor: [16, 16] }); const m = L.marker(coords[0], { icon }).addTo(map); trainRef.current = m; onTrainReady({ marker: m, coords }); }
        }
        (route.stops || []).forEach((s, i) => {
            const [lng, lat] = s.geometry.coordinates;
            let n = s.properties.name || 'Stop'; let t = s.properties.stopTime || 0;
            const icon = L.divIcon({ className: 'stop-icon', html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
            const m = L.marker([lat, lng], { icon }).addTo(map);
            m.bindPopup(`<b>${n}</b><br>Time: ${t}s<br><button id=\`edit-${i}\`>Edit</button>`);
            m.on('click', e => { L.DomEvent.stopPropagation(e.originalEvent); m.openPopup(); });
            m.on('popupopen', () => { setTimeout(() => { const btn = document.getElementById(`edit-${i}`); if (btn) btn.onclick = ev => { ev.stopPropagation(); const nn = prompt('Name', n); const tt = prompt('Time (s)', t); if (nn !== null && tt !== null) { s.properties.name = nn; s.properties.stopTime = parseInt(tt); n = nn; t = parseInt(tt); m.setPopupContent(`<b>${nn}</b><br>Time: ${tt}s<br><button id=\`edit-${i}\`>Edit</button>`); m.openPopup(); } } }, 100); });
        });
    }, [map, route, onTrainReady, showTrain]);

    return null;
}

// Komponent narzędzi rysowania
function MapDrawingTools({ onDraw }) {
    const map = useMap();
    useEffect(() => { if (!map) return; map.pm.addControls({ position: 'topleft', drawCircle: false, drawMarker: false, drawPolygon: false, drawRectangle: false, drawText: false, drawPolyline: true, drawCircleMarker: true }); map.on('pm:create', e => { onDraw && onDraw(e); map.pm.disableDraw(); }); }, [map, onDraw]);
    return null;
}

// Główny komponent App
export default function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [showMain, setShowMain] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [tab, setTab] = useState('account');
    const [routeName, setRouteName] = useState('');
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [drawnStops, setDrawnStops] = useState([]);
    const [coords, setCoords] = useState(null);
    const [stops, setStops] = useState([]);
    const [params, setParams] = useState({ maxWagons: null, slope: null });
    const [runSim, setRunSim] = useState(false);
    const [paused, setPaused] = useState(false);
    const [trainType, setTrainType] = useState('passenger');
    const [routes, setRoutes] = useState([]);
    const [selRoute, setSelRoute] = useState(null);
    const [train, setTrain] = useState(null);
    const [running, setRunning] = useState(false);
    const [info, setInfo] = useState('');
    const interval = useRef(null);

    useEffect(() => { document.body.className = ''; document.body.classList.add(`${theme}-theme`); localStorage.setItem('theme', theme); }, [theme]);
    useEffect(() => { if (token) loadRoutes(); }, [token]);

    const loadRoutes = async () => { const r = await fetch('http://localhost:5000/routes', { headers: { 'Authorization': `Bearer ${token}` } }); if (!r.ok) return alert(await r.text()); setRoutes(await r.json()); };
    const handleSaveRoute = async () => { if (!routeName || !drawnCoords.length) return alert('Provide name and draw'); const r = await fetch('http://localhost:5000/routes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: routeName, route: drawnCoords, stops: drawnStops, max_wagons: params.maxWagons, slope: params.slope }) }); if (!r.ok) return alert(await r.text()); alert('Saved'); setRouteName(''); setDrawnCoords([]); setDrawnStops([]); loadRoutes(); };
    const handleDelRoute = async () => { if (!selRoute) return alert('Select route'); const r = await fetch(`http://localhost:5000/routes/${selRoute.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (!r.ok) return alert(await r.text()); alert('Deleted'); setSelRoute(null); loadRoutes(); };
    const handleStartTrain = () => { if (!train) return; let i = 0; setRunning(true); interval.current = setInterval(() => { if (!train.marker || i >= train.coords.length) { clearInterval(interval.current); setRunning(false); return; } train.marker.setLatLng(train.coords[i]); i++; }, 500); };
    const handlePauseTrain = () => { clearInterval(interval.current); setRunning(false); };
    const handleResetTrain = () => { if (train && train.marker) train.marker.setLatLng(train.coords[0]); handlePauseTrain(); };

    if (!token) return <AuthForm onAuth={setToken} />;
    return (
        <div className="app-container">
            <MapContainer center={[49.62, 20.7]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapWithDrawing onCoords={setCoords} onStops={setStops} setRouteParams={setParams} />
                <Simulation polylineCoords={coords} stops={stops} run={runSim} paused={!runSim} trainType={trainType} routeParams={params} />
                <MapLoader route={selRoute} onTrainReady={setTrain} showTrain={true} />
                <MapDrawingTools onDraw={e => { const g = e.layer.toGeoJSON(); if (g.geometry.type === 'LineString') setDrawnCoords(g.geometry.coordinates); if (g.geometry.type === 'Point') { const st = { type: 'Feature', geometry: g.geometry, properties: { name: 'New Stop', stopTime: 0 } }; setDrawnStops(p => [...p, st]); } }} />
            </MapContainer>
            <div className="top-buttons">
                <button onClick={() => { setShowMain(!showMain); setShowMap(false); }}>Menu</button><button onClick={() => { setShowMap(!showMap); setShowMain(false); }}>Map</button>
            </div>
            {showMain && <div className={`sidebar ${theme}-theme`}><div className="tab-buttons"><button onClick={() => setTab('account')}>Account</button><button onClick={() => setTab('map')}>Map</button><button onClick={() => setTab('theme')}>Theme</button></div>{tab === 'account' ? <AuthForm onAuth={setToken} /> : tab === 'map' ? <p>Map settings soon</p> : <div><label htmlFor="theme-select">Theme:</label><select id="theme-select" value={theme} onChange={e => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="gray">Gray</option></select></div>}</div>}
            {showMap && <div className={`mapmenu ${theme}-theme`}><h3>Map Options</h3><input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Route name" /><button onClick={handleSaveRoute}>Save</button><button onClick={loadRoutes}>Refresh</button>{routes.length > 0 && <select onChange={e => setSelRoute(routes.find(r => r.id.toString() === e.target.value))}><option value="">Select</option>{routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}<button onClick={handleDelRoute}>Delete</button><button onClick={handleStartTrain} disabled={!train || running}>Start</button><button onClick={handlePauseTrain} disabled={!running}>Pause</button><button onClick={handleResetTrain}>Reset</button><div className="info">{info}</div></div>}
        </div>
    );
}
