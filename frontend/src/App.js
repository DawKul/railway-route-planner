// App.js — część 1/5 — Importy, funkcje pomocnicze, komponent Simulation
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './theme.css';
import AuthForm from './AuthForm';
import AdminPanel from './AdminPanel';
import MapLoader from './MapLoader';
import Simulation from './Simulation';
import SidebarMenu from './SidebarMenu';
import RouteFormPopup from './RouteFormPopup';

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
    const overloadMod = actualWagons > maxWagons ? 1 - 0.05 * (actualWagons - maxWagons) : 1;
    const effectiveSpeed = 60 * slopeMod * overloadMod;
    const drivingTimeSec = (distanceKm / effectiveSpeed) * 3600;
    const stopTimeSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);
    const totalSec = drivingTimeSec + stopTimeSec;
    return { formatted: formatTime(totalSec) };
}


// MapWithDrawing i początek App()

function MapWithDrawing({ onStops, onLineGenerated }) {
    const map = useMap();
    const stopsRef = useRef([]);
    const lineRef = useRef(null);

    useEffect(() => {
        if (!map) return;

        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawMarker: false,
            drawPolygon: false,
            drawRectangle: false,
            drawText: false,
            drawPolyline: false,
            drawCircleMarker: true
        });

        map.on('pm:create', (e) => {
            const layer = e.layer;
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
                    properties: { name, stopTime, passengersIn: inP, passengersOut: outP }
                };
                stopsRef.current.push(stop);
                onStops([...stopsRef.current]);

                layer.bindPopup(`${name} (${stopTime}s)`).openPopup();

                if (lineRef.current) map.removeLayer(lineRef.current);
                const latlngs = stopsRef.current.map(s => [s.geometry.coordinates[1], s.geometry.coordinates[0]]);
                lineRef.current = L.polyline(latlngs, { color: 'blue' }).addTo(map);
                onLineGenerated(latlngs);
            }
            map.pm.disableDraw();
        });
    }, [map, onStops, onLineGenerated]);

    return null;
}


export default function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(null);
    const [role, setRole] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [selRoute, setSelRoute] = useState(null);
    const [showRouteList, setShowRouteList] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('account');
    const [routeName, setRouteName] = useState('');
    const [resetSignal, setResetSignal] = useState(0);
    const [drawnStops, setDrawnStops] = useState([]);
    const [drawnCoords, setDrawnCoords] = useState([]);
    const [trainObj, setTrainObj] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef(null);
    const [info, setInfo] = useState('');
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [routeParams, setRouteParams] = useState({});



    // App.js — część 3/5 — poprawiona i kompletna logika App()

    useEffect(() => {
        document.body.className = '';
        document.body.classList.add(`${theme}-theme`);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUsername(payload.username);
            setRole(payload.role);
            loadRoutes();
        } catch {
            setUsername(null);
            setRole(null);
        }
    }, [token]);

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

    const handleShowRoutes = async () => {
        if (!showRouteList) {
            const ok = await loadRoutes();
            if (!ok) return;
        }
        setShowRouteList(!showRouteList);
    };

    const handleAuth = (tok) => {
        localStorage.setItem('token', tok);
        setToken(tok);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUsername(null);
        setRole(null);
        setRoutes([]);
        setSelRoute(null);
        setTrainObj(null);
    };

    const handleSaveRoute = async () => {
        if (!routeName || drawnCoords.length < 2) return alert('Minimum 2 przystanki');
        const res = await fetch('http://localhost:5000/routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name: routeName, stops: drawnStops })
        });
        if (!res.ok) return alert(await res.text());
        alert('Zapisano');
        setRouteName('');
        setDrawnCoords([]);
        setDrawnStops([]);
        loadRoutes();
    };

    const handleDeleteRoute = async () => {
        const res = await fetch(`http://localhost:5000/routes/${selRoute.route_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return alert(await res.text());
        alert('Usunięto trasę');
        setSelRoute(null);
        loadRoutes();
    };

    const handleStartTrain = () => {
        if (!trainObj) return;
        let i = 0;
        setIsRunning(true);
        intervalRef.current = setInterval(() => {
            if (!trainObj.marker || i >= trainObj.coords.length) {
                clearInterval(intervalRef.current);
                setIsRunning(false);
                return;
            }
            trainObj.marker.setLatLng(trainObj.coords[i]);
            i++;
        }, 500);
    };

    const handlePauseTrain = () => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const handleResetTrain = () => {
        setIsRunning(false);
        setTrainObj(null);
        setDrawnCoords([]);
        setDrawnStops([]);
        setRouteParams({});
        setResetSignal(prev => prev + 1);

        setTrainObj((prev) => {
            if (prev?.marker) prev.marker.remove();
            return null;
        });

        setResetSignal(prev => prev + 1);
    };

    // return z mapą, menu i panelem admina

    if (!token) return <AuthForm onAuth={handleAuth} />;

    return (
        <div className="app-container">
            <MapContainer
                center={[49.62, 20.7]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                whenCreated={(map) => (window._mapRef = map)}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapWithDrawing onStops={setDrawnStops} onLineGenerated={setDrawnCoords} />
                {selRoute && isRunning && (
                    <Simulation
                        polylineCoords={selRoute.geojson.coordinates.map(([lng, lat]) => [lat, lng])}
                        stops={selRoute.stops}
                        run={true}
                        paused={false}
                        trainType={routeParams.trainType || 'passenger'}
                        routeParams={routeParams}
                        resetSignal={resetSignal}
                    />
                )}



                {selRoute && (
                    <MapLoader
                        route={selRoute}
                        onTrainReady={setTrainObj}
                        showTrain={true}
                        setRouteParams={setRouteParams}
                    />
                )}
            </MapContainer>

            <div className="top-buttons">
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); setShowAdminPanel(false); }}>Menu</button>
                <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); setShowAdminPanel(false); }}>Map</button>
                {role === 'admin' && (
                    <button onClick={() => { setShowAdminPanel(!showAdminPanel); setShowMainMenu(false); setShowMapMenu(false); }}>Admin Panel</button>
                )}
            </div>



            {showMainMenu && (
                <SidebarMenu
                    theme={theme}
                    setTheme={setTheme}
                    username={username}
                    handleLogout={handleLogout}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    role={role}
                    token={token}
                />
            )}



            {showMapMenu && (
                <div className={`mapmenu ${theme}-theme`}>
                    <h3>Map Options</h3>

                    <input
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        placeholder="Route name"
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                    />

                    <button onClick={handleSaveRoute} style={{ width: '100%', marginBottom: '0.5rem' }}>
                        Save route
                    </button>
                    <button onClick={loadRoutes} style={{ width: '100%', marginBottom: '0.5rem' }}>
                        Refresh routes
                    </button>
                    <button onClick={handleShowRoutes} style={{ width: '100%', marginBottom: '0.5rem' }}>
                        Wybierz trasę
                    </button>

                    {showRouteList && routes.length > 0 && (
                        <select
                            onChange={(e) => {
                                const r = routes.find(r => r.route_id.toString() === e.target.value);
                                if (!r) return;

                                const route = {
                                    ...r,
                                    geojson: typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson,
                                    stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops,
                                };
                                setSelRoute(route);
                            }}

                            style={{ width: '100%', marginBottom: '0.5rem' }}
                            defaultValue=""
                        >
                            <option value="" disabled>
                                -- wybierz trasę --
                            </option>
                            {routes.map((r) => (
                                <option key={r.route_id} value={r.route_id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {role === 'admin' && selRoute && (
                        <button
                            onClick={handleDeleteRoute}
                            style={{
                                width: '100%',
                                marginBottom: '0.5rem',
                                background: 'red',
                                color: 'white'
                            }}
                        >
                            Delete route
                        </button>
                    )}

                    <button
                        onClick={handleStartTrain}
                        disabled={!trainObj || isRunning}
                        style={{ width: '100%', marginBottom: '0.25rem' }}
                    >
                        ▶ Start
                    </button>
                    <button
                        onClick={handlePauseTrain}
                        disabled={!isRunning}
                        style={{ width: '100%', marginBottom: '0.25rem' }}
                    >
                        ⏸ Pause
                    </button>
                    <button
                        onClick={handleResetTrain}
                        style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                        🔁 Reset
                    </button>

                    <div className="info">{info}</div>
                </div>
            )}


            {showAdminPanel && (
                <div className={`mapmenu ${theme}-theme`}>
                    <AdminPanel token={token} />
                </div>
            )}
            
        </div>
    );
}

