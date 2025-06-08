<<<<<<< HEAD
﻿// frontend/src/App.js
=======
﻿// App.js — część 1/5 — Importy, funkcje pomocnicze, komponent Simulation
>>>>>>> D_Kulig
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './theme.css';
import AuthForm from './AuthForm';
<<<<<<< HEAD

// --- Helper functions ---
=======
import AdminPanel from './AdminPanel';
import MapLoader from './MapLoader';
import Simulation from './Simulation';
import SidebarMenu from './SidebarMenu';
import RouteFormPopup from './RouteFormPopup';

>>>>>>> D_Kulig
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
<<<<<<< HEAD
    const overloadMod = actualWagons > maxWagons
        ? 1 - 0.05 * (actualWagons - maxWagons)
        : 1;
=======
    const overloadMod = actualWagons > maxWagons ? 1 - 0.05 * (actualWagons - maxWagons) : 1;
>>>>>>> D_Kulig
    const effectiveSpeed = 60 * slopeMod * overloadMod;
    const drivingTimeSec = (distanceKm / effectiveSpeed) * 3600;
    const stopTimeSec = stops.reduce((sum, stop) => sum + (stop.properties?.stopTime || 0), 0);
    const totalSec = drivingTimeSec + stopTimeSec;
    return { formatted: formatTime(totalSec) };
}

<<<<<<< HEAD
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
=======
// MapWithDrawing i początek App()

function MapWithDrawing({ onStops, onLineGenerated, setRouteParams }) {
    const map = useMap();
    const stopsRef = useRef([]);
    const linesRef = useRef([]);
>>>>>>> D_Kulig

    useEffect(() => {
        if (!map) return;

<<<<<<< HEAD
        map.off("pm:create");
        map.pm.addControls({ 
            position: "topleft", 
            drawCircle: false, 
            drawMarker: false, 
            drawPolygon: false, 
            drawRectangle: false, 
            drawText: false, 
            drawPolyline: true, 
            drawCircleMarker: true,
            editMode: true,
            dragMode: true,
            removalMode: true,
        });
        map.on("pm:create", e => {
            const layer = e.layer;
            if (layer instanceof L.Polyline) {
                const coords = layer.getLatLngs().map(p => [p.lat, p.lng]);
                const maxW = parseInt(prompt("Maksymalna liczba wagonów:"), 10);
                const slope = parseFloat(prompt("Nachylenie trasy (%):"));
                const actualW = parseInt(prompt("Aktualna liczba wagonów:"), 10);
                const distKm = calculateDistanceKm(layer.getLatLngs());
                const timeRes = calculateTravelTime({ distanceKm: distKm, slopePercent: slope, maxWagons: maxW, actualWagons: actualW, stops: stopsRef });
                layer.bindTooltip(
                    `Długość: ${distKm.toFixed(2)} km<br>
                    Czas: ${timeRes.formatted}`, 
                    { sticky: true }
                );
                onCoords(coords);
                setRouteParams({ maxWagons: maxW, slope });
                layer.bindPopup(
                    `<button id="edit-route">Edytuj</button>`
                );
                layer.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById("edit-route");
                        if (!btn) return;

                        btn.onclick = (ev) => {
                            ev.stopPropagation();
                            const newmaxW = parseInt(prompt("Nowa maksymalna liczba wagonów:"), 10);
                            const newslope = parseFloat(prompt("Nowe nachylenie trasy (%):"));
                            const newactualW = parseInt(prompt("Nowa aktualna liczba wagonów:"), 10);
                            const newdistKm = calculateDistanceKm(layer.getLatLngs());
                            const newtimeRes = calculateTravelTime({ 
                                distanceKm: newdistKm, 
                                slopePercent: newslope, 
                                maxWagons: newmaxW, 
                                actualWagons: newactualW, 
                                stops: stopsRef 
                            });
                            if ( !isNaN(newmaxW) && !isNaN(newslope) && !isNaN(newactualW)) {
                                // zaktualizuj właściwości
                                setRouteParams({ maxWagons: maxW, newslope });
                                // zaktualizuj treść tooltipa
                                layer.setTooltipContent(
                                    `Długość: ${newdistKm.toFixed(2)} km<br>
                                    Czas: ${newtimeRes.formatted}`, 
                                    { sticky: true }
                                );
                                layer.setPopupContent(
                                    `<button id="edit-route">Edytuj</button>`
                                );
                                layer.openPopup();
                            }
                        };
                    }, 50);
                });
            }
            /*if (layer instanceof L.Polyline) {
                const coords = layer.getLatLngs().map(p => [p.lat, p.lng]);

                // Formularz HTML w popupie
                const formHTML = `
                    <b>Właściwości trasy:</b><br/>
                    Max wagony: <input type="number" id="form-max" min="0" placeholder="10"><br/>
                    Aktualne wagony: <input type="number" id="form-act" min="0" placeholder="8"><br/>
                    Nachylenie (%): <input type="number" step="0.1" id="form-slope" min="0" placeholder="2"><br/>
                    <button id="form-save">Zapisz</button>
                `;

                layer.bindPopup(formHTML).openPopup();

                layer.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById("form-save");
                        if (!btn) return;

                        btn.onclick = () => {
                            const maxW = parseInt(document.getElementById("form-max").value, 10);
                            const actualW = parseInt(document.getElementById("form-act").value, 10);
                            const slope = parseFloat(document.getElementById("form-slope").value);

                            if (isNaN(maxW) || isNaN(actualW) || isNaN(slope)) {
                                alert("Nieprawidłowe dane.");
                                return;
                            }

                            const distKm = calculateDistanceKm(layer.getLatLngs());
                            const timeRes = calculateTravelTime({
                                distanceKm: distKm,
                                slopePercent: slope,
                                maxWagons: maxW,
                                actualWagons: actualW,
                                stops: stopsRef,
                            });

                            // Ustaw dane + tooltip
                            setRouteParams({ maxWagons: maxW, slope });
                            onCoords(coords);

                            layer.bindTooltip(
                                `Długość: ${distKm.toFixed(2)} km<br/>Czas: ${timeRes.formatted}`,
                                { sticky: true }
                            ).openTooltip();

                            layer.closePopup(); // zamknij formularz po zapisaniu
                        };
                    }, 50);
                });
            }*/

            if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();

                const name = prompt("Nazwa przystanku:");
                const inP = parseInt(prompt("Liczba wsiadających:"), 10);
                const outP = parseInt(prompt("Liczba wysiadających:"), 10);
                const sTime = (inP + outP) * 1;
                if (!name) { map.removeLayer(layer); return; }
                const stop = { 
                    type: "Feature", 
                    geometry: { type: "Point", coordinates: [pt.lng, pt.lat] }, 
                    properties: { name, stopTime: sTime, passengersIn: inP, passengersOut: outP } };
                stopsRef.push(stop);
                onStops(prev => [...prev, stop]);
                layer.bindPopup(
                    `<b>${name}</b><br/>Czas postoju: ${sTime}s<br/><button id="edit-stop">Edytuj</button>`
                );
                //Przycisk edycji przystanku
                layer.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById("edit-stop");
                        if (!btn) return;

                        btn.onclick = (ev) => {
                            ev.stopPropagation();
                            const newName = prompt("Nowa nazwa:", stop.properties.name);
                            const newIn   = parseInt(prompt("Nowa liczba wsiadających:",  stop.properties.passengersIn), 10);
                            const newOut  = parseInt(prompt("Nowa liczba wysiadających:", stop.properties.passengersOut), 10);
                            const newTime = (newIn + newOut) * 1;
                            if (newName && !isNaN(newIn) && !isNaN(newOut)) {
                                // zaktualizuj właściwości
                                stop.properties = {
                                    name: newName,
                                    passengersIn: newIn,
                                    passengersOut: newOut,
                                    stopTime: newTime,
                                };
                                // zaktualizuj treść tooltipa
                                layer.setPopupContent(
                                    `<b>${newName}</b><br/>Czas postoju: ${newTime}s<br/><button id="edit-stop">Edytuj</button>`
                                );
                                layer.openPopup();
                            }
                        };
                    }, 50);
                });

            }
            /*if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();

                const formHTML = `
                    <b>Właściwości przystanku:</b><br/>
                    Nazwa przystanku: <input type="text" id="form-name" value="${name}"><br/>
                    Liczba wsiadających: <input type="number" id="form-pass-in" value="${inP}"><br/>
                    Liczba wysiadających: <input type="number" id="form-pass-out" value="${outP}"><br/>
                    <button id="form-save-stop">Zapisz</button>
                `;

                const name = prompt("Nazwa przystanku:");
                const inP = parseInt(prompt("Liczba wsiadających:"), 10);
                const outP = parseInt(prompt("Liczba wysiadających:"), 10);
                const sTime = (inP + outP) * 1;
                if (!name) { map.removeLayer(layer); return; }
                const stop = { 
                    type: "Feature", 
                    geometry: { type: "Point", coordinates: [pt.lng, pt.lat] }, 
                    properties: { name, stopTime: sTime, passengersIn: inP, passengersOut: outP } };
                stopsRef.push(stop);
                onStops(prev => [...prev, stop]);
                layer.bindPopup(
                    `<b>${name}</b><br/>Czas postoju: ${sTime}s<br/><button id="edit-stop">Edytuj</button>`
                );
                //Przycisk edycji przystanku
                layer.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById("edit-stop");
                        if (!btn) return;

                        btn.onclick = (ev) => {
                            ev.stopPropagation();
                            const newName = prompt("Nowa nazwa:", stop.properties.name);
                            const newIn   = parseInt(prompt("Nowa liczba wsiadających:",  stop.properties.passengersIn), 10);
                            const newOut  = parseInt(prompt("Nowa liczba wysiadających:", stop.properties.passengersOut), 10);
                            const newTime = (newIn + newOut) * 1;
                            if (newName && !isNaN(newIn) && !isNaN(newOut)) {
                                // zaktualizuj właściwości
                                stop.properties = {
                                    name: newName,
                                    passengersIn: newIn,
                                    passengersOut: newOut,
                                    stopTime: newTime,
                                };
                                // zaktualizuj treść tooltipa
                                layer.setPopupContent(
                                    `<b>${newName}</b><br/>Czas postoju: ${newTime}s<br/><button id="edit-stop">Edytuj</button>`
                                );
                                layer.openPopup();
                            }
                        };
                    }, 50);
                });
            }*/
            map.pm.disableDraw();
        });
    }, [map, onCoords, onStops, setRouteParams]);

    return null;
}


// Komponent do wyświetlania zapisanej trasy i edycji przystanków
function MapLoader({ route, onTrainReady, showTrain, setRouteParams, onCoords }) {

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


            const distKm = calculateDistanceKm(polyline.getLatLngs());
            const slope = route.slope || 0;
            const maxW = route.maxWagons || 5;
            const actualW = route.actualWagons || 5;
            const timeRes = calculateTravelTime({
                distanceKm: distKm, 
                slopePercent: slope, 
                maxWagons: maxW, 
                actualWagons: actualW, 
                stops: route.stops || [], 
            });

            polyline.bindTooltip(
                `Długość: ${distKm.toFixed(2)} km<br>
                Czas: ${timeRes.formatted}`, 
                { sticky: true }
            );

            //Przycisk edycji linii
            const formHTML = `
                <b>Właściwości trasy:</b><br/>
                Max wagony: <input type="number" id="form-max" value="10"><br/>
                Aktualne wagony: <input type="number" id="form-act" value="8"><br/>
                Nachylenie (%): <input type="number" step="0.1" id="form-slope" value="2"><br/>
                <button id="form-save">Zapisz</button>
                `;

            /*polyline.bindPopup(formHTML).openPopup();
            polyline.on("popupopen", () => {
                setTimeout(() => {
                    const btn = document.getElementById("form-save");
                    if (!btn) return;

                    btn.onclick = () => {
                        const maxW = parseInt(document.getElementById("form-max").value, 10);
                        const actualW = parseInt(document.getElementById("form-act").value, 10);
                        const slope = parseFloat(document.getElementById("form-slope").value);

                        if (isNaN(maxW) || isNaN(actualW) || isNaN(slope)) {
                            alert("Nieprawidłowe dane.");
                            return;
                        }

                        const distKm = calculateDistanceKm(polyline.getLatLngs());
                        const timeRes = calculateTravelTime({
                            distanceKm: distKm,
                            slopePercent: slope,
                            maxWagons: maxW,
                            actualWagons: actualW,
                            stops: route?.stops || [],
                        });

                        // Ustaw dane + tooltip
                        setRouteParams({ maxWagons: maxW, slope });
                        onCoords(coords);

                        polyline.setTooltipContent(
                            `Długość: ${distKm.toFixed(2)} km<br/>Czas: ${timeRes.formatted}`,
                            { sticky: true }
                        ).openTooltip();

                        polyline.closePopup(); // zamknij formularz po zapisaniu
                    };
                }, 50);
            });*/
            
            polyline.bindPopup(
                    `<button id="edit-route">Edytuj</button>`
            );
            polyline.on("popupopen", () => {
                setTimeout(() => {
                    const btn = document.getElementById("edit-route");
                    if (!btn) return;

                    btn.onclick = (ev) => {
                        ev.stopPropagation();
                        const newmaxW = parseInt(prompt("Nowa maksymalna liczba wagonów:"), 10);
                        const newslope = parseFloat(prompt("Nowe nachylenie trasy (%):"));
                        const newactualW = parseInt(prompt("Nowa aktualna liczba wagonów:"), 10);
                        const newdistKm = calculateDistanceKm(polyline.getLatLngs());
                        const newtimeRes = calculateTravelTime({ 
                            distanceKm: newdistKm, 
                            slopePercent: newslope, 
                            maxWagons: newmaxW, 
                            actualWagons: newactualW, 
                            stops: route.stops || [], 
                        });
                        if ( !isNaN(newmaxW) && !isNaN(newslope) && !isNaN(newactualW)) {
                            // zaktualizuj właściwości
                            setRouteParams({ maxWagons: newmaxW, newslope });
                            // zaktualizuj treść tooltipa
                            polyline.setTooltipContent(
                                `Długość: ${newdistKm.toFixed(2)} km<br>
                                Czas: ${newtimeRes.formatted}`, 
                                { sticky: true }
                            );
                            polyline.setPopupContent(
                                `<button id="edit-route">Edytuj</button>`
                            );
                            polyline.openPopup();
                        }
                    };
                }, 50);
            });

            if (showTrain && coords.length > 0) {
                const icon = new L.Icon({ iconUrl: '/train.png', iconSize: [32, 32], iconAnchor: [16, 16] });
                const marker = L.marker(coords[0], { icon }).addTo(map);
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

                marker.pm.enable({ draggable: true });
                marker.on("pm:dragend", () => {
                    const newLatLng = marker.getLatLng();
                    stop.geometry.coordinates = [newLatLng.lng, newLatLng.lat];
                });
                //Przycisk edycji stacji
                marker.bindPopup(
                    `<b>${name}</b><br/>Czas postoju: ${stopTime}s<br/><button id="edit-${idx}">Edytuj</button>`
                );
                marker.on("click", e => { marker.openPopup(); });
                marker.on("popupopen", () => {
                    setTimeout(() => {
                        const btn = document.getElementById(`edit-${idx}`);
                        if (btn) {
                            btn.onclick = (ev) => {
                                ev.stopPropagation();
                                const newName = prompt("Nowa nazwa przystanku:", name);
                                const newIn = parseInt(prompt("Nowa liczba wsiadających:", stop.properties.passengersIn || 0), 10);
                                const newOut = parseInt(prompt("Nowa liczba wysiadających:", stop.properties.passengersOut || 0), 10);
                                const newStopTime = (newIn + newOut) * 1;
                                if (newName && !isNaN(newIn) && !isNaN(newOut)) {
                                    stop.properties.name = newName;
                                    stop.properties.passengersIn = newIn;
                                    stop.properties.passengersOut = newOut;
                                    stop.properties.stopTime = newStopTime;
                                    name = newName;
                                    stopTime = newStopTime;
                                    marker.setPopupContent(
                                        `<b>${newName}</b><br/>Czas postoju: ${newStopTime}s<br/><button id="edit-${idx}">Edytuj</button>`
                                    );
                                    marker.openPopup();
                                }
                            };
                        }
                    }, 100);
                });

            });
            /*
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
            });*/
        };
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
=======
        // Function to update metrics - move it inside the component to access refs and props
        const updateMetrics = (layer, lineParams) => {
            const coords = layer.getLatLngs();
            const distKm = calculateDistanceKm(coords);
            const timeRes = calculateTravelTime({ 
                distanceKm: distKm, 
                slopePercent: lineParams.slope, 
                maxWagons: lineParams.maxWagons, 
                actualWagons: lineParams.actualWagons, 
                stops: stopsRef.current 
            });

            layer.bindTooltip(
                `Długość: ${distKm.toFixed(2)} km<br>` +
                `Czas: ${timeRes.formatted}`,
                { sticky: true }
            );

            // Update route coordinates
            const allLines = linesRef.current.map(l => l.line.getLatLngs()).flat();
            onLineGenerated(allLines.map(latLng => [latLng.lat, latLng.lng]));
        };

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

        // Dodaj polskie tłumaczenia dla przycisków
        map.pm.setLang('custom', {
            tooltips: {
                drawCircleMarker: 'Dodaj przystanek',
                editMode: 'Edytuj przystanki',
                dragMode: 'Przesuń przystanki',
                removalMode: 'Usuń przystanek'
            }
        });
        map.pm.setLang('custom');

        // Enhanced snapping options
        map.pm.setGlobalOptions({
            snappable: true,
            snapDistance: 20,
            snapSegment: true,
            snapMiddle: false,
            snapMarker: true,
            // Make edit vertices more visible when editing is enabled
            vertexStyle: {
                color: '#0000ff',
                fillColor: '#fff',
                fillOpacity: 1,
                radius: 6,
                weight: 2
            }
        });

        map.on('pm:create', (e) => {
            const layer = e.layer;
            
            if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
                // Find closest stops to line endpoints
                const linePoints = layer.getLatLngs();
                const startPoint = linePoints[0];
                const endPoint = linePoints[linePoints.length - 1];

                const findClosestStop = (point) => {
                    let closestStop = null;
                    let minDistance = Infinity;
                    
                    stopsRef.current.forEach(stop => {
                        const stopLatLng = stop.marker.getLatLng();
                        const distance = point.distanceTo(stopLatLng);
                        if (distance < minDistance && distance < 50) {
                            minDistance = distance;
                            closestStop = stop;
                        }
                    });
                    
                    return closestStop;
                };

                const startStop = findClosestStop(startPoint);
                const endStop = findClosestStop(endPoint);

                if (startStop && endStop && startStop !== endStop) {
                    // Update line endpoints to exactly match the stops
                    const newLatLngs = [...layer.getLatLngs()];
                    newLatLngs[0] = startStop.marker.getLatLng();
                    newLatLngs[newLatLngs.length - 1] = endStop.marker.getLatLng();
                    layer.setLatLngs(newLatLngs);

                    // Style the line
                    layer.setStyle({
                        color: 'black',
                        weight: 7,
                        opacity: 0.9
                    });

                    // Configure Geoman options for this line (but don't enable editing yet)
                    layer.pm.setOptions({
                        allowSelfIntersection: false,
                        snapDistance: 20,
                        snapSegment: true,
                        preventMarkerRemoval: true,
                        removeLayerOnCancel: false
                    });

                    // Initialize line parameters
                    const lineParams = {
                        maxSpeed: 60,
                        slope: 0,
                        trackCount: 2,
                        maxWagons: 10,
                        actualWagons: 5
                    };

                    // Handle editing events when they occur
                    layer.on('pm:edit', () => {
                        updateMetrics(layer, lineParams);
                    });

                    // Initial metrics calculation
                    updateMetrics(layer, lineParams);

                    // Add click handler for parameters
                    layer.on('click', () => {
                        const popup = L.popup()
                            .setLatLng(layer.getLatLngs()[0])
                            .setContent(createLinePopupContent(lineParams));
                        
                        popup.openOn(map);
                        
                        setTimeout(() => {
                            const saveBtn = document.getElementById('save-line-params');
                            if (!saveBtn) return;

                            saveBtn.onclick = () => {
                                const maxWagons = parseInt(document.getElementById('max-wagons').value) || 10;
                                const slope = parseFloat(document.getElementById('slope').value) || 0;
                                const actualWagons = parseInt(document.getElementById('actual-wagons').value) || 5;
                                const trackCount = parseInt(document.getElementById('track-count').value) || 2;

                                // Update parameters
                                Object.assign(lineParams, {
                                    maxWagons,
                                    slope,
                                    actualWagons,
                                    trackCount
                                });

                                // Update line style based on track count
                                layer.setStyle({ 
                                    color: trackCount === 1 ? '#ff0000' : '#000000',
                                    weight: 7,
                                    dashArray: trackCount === 1 ? '12,12' : null,
                                    opacity: 0.9
                                });

                                updateMetrics(layer, lineParams);
                                map.closePopup();
                            };
                        }, 50);
                    });

                    // Add to lines array
                    linesRef.current.push({
                        line: layer,
                        from: startStop,
                        to: endStop,
                        params: lineParams
                    });

                    // Create connection objects
                    const connection = { 
                        line: layer,
                        connectedTo: endStop,
                        isOutgoing: true,
                        params: lineParams
                    };

                    const targetConnection = { 
                        line: layer,
                        connectedTo: startStop,
                        isOutgoing: false,
                        params: lineParams
                    };

                    // Add connections
                    startStop.connections.push(connection);
                    endStop.connections.push(targetConnection);
                } else {
                    // If no valid stops found, remove the line
                    map.removeLayer(layer);
                }
            }
            
            if (layer instanceof L.CircleMarker) {
                const pt = layer.getLatLng();
                
                // Create stop with default values
                const stopData = {
                    name: `P${stopsRef.current.length + 1}`,
                    stopTime: 0,
                    passengersIn: 0,
                    passengersOut: 0
                };

                const stop = {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [pt.lng, pt.lat] },
                    properties: stopData,
                    connections: []
                };

                const createStopPopupContent = (props, stop) => {
                    const currentConnections = stop.connections?.map(conn => {
                        const direction = conn.direction === 'outgoing' ? '→' : '←';
                        const targetName = conn.connectedTo.properties.name;
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px;">
                                <span>${direction} ${targetName}</span>
                                <button class="remove-connection" data-stop="${targetName}" style="border: none; background: none; color: red; cursor: pointer;">×</button>
                            </div>
                        `;
                    }) || [];

                    const otherStops = stopsRef.current.filter(s => s !== stop);
                    
                    return `
                        <div style="min-width: 200px;">
                            <h4 style="margin: 0 0 10px 0;">Edycja parametrów przystanku</h4>
                            <div style="margin-bottom: 8px;">
                                <label>Nazwa przystanku:</label>
                                <input type="text" id="stop-name" value="${props.name}" style="width: 100%;">
                            </div>
                            <div style="margin-bottom: 8px;">
                                <label>Czas postoju (s):</label>
                                <input type="number" id="stop-time" min="0" value="${props.stopTime}" style="width: 60px;">
                            </div>
                            <div style="margin-bottom: 8px;">
                                <label>Pasażerowie wsiadający:</label>
                                <input type="number" id="passengers-in" min="0" value="${props.passengersIn}" style="width: 60px;">
                            </div>
                            <div style="margin-bottom: 8px;">
                                <label>Pasażerowie wysiadający:</label>
                                <input type="number" id="passengers-out" min="0" value="${props.passengersOut}" style="width: 60px;">
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <label for="is-terminal" style="margin: 0;">Przystanek końcowy</label>
                                <input type="checkbox" id="is-terminal" ${props.isTerminal ? 'checked' : ''} style="width: 20px; height: 20px;">
                            </div>
                            <div style="margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <label style="font-weight: bold;">Połączenia:</label>
                                    <button id="toggle-connections" style="border: none; background: none; cursor: pointer; color: #666;">
                                        ${currentConnections.length > 0 ? '▼' : '▶'}
                                    </button>
                                </div>
                                <div id="connections-list" style="
                                    max-height: ${currentConnections.length > 0 ? '150px' : '0'};
                                    overflow-y: auto;
                                    transition: max-height 0.3s ease-in-out;
                                    border: ${currentConnections.length > 0 ? '1px solid #ddd' : 'none'};
                                    border-radius: 4px;
                                    margin-bottom: ${currentConnections.length > 0 ? '8px' : '0'};
                                ">
                                    ${currentConnections.length > 0 ? 
                                        currentConnections.join('<hr style="margin: 0; border-top: 1px solid #eee;">') 
                                        : '<div style="padding: 4px;">Brak połączeń</div>'
                                    }
                                </div>
                                ${otherStops.length > 0 ? `
                                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                                        <select id="new-connection" style="flex-grow: 1;">
                                            <option value="">-- Wybierz przystanek do połączenia --</option>
                                            ${otherStops.map(s => 
                                                `<option value="${s.properties.name}">${s.properties.name}</option>`
                                            ).join('')}
                                        </select>
                                        <select id="connection-direction" style="width: 100px;">
                                            <option value="outgoing">→ Do</option>
                                            <option value="incoming">← Z</option>
                                        </select>
                                    </div>
                                    <button id="add-connection" style="width: 100%; padding: 5px; margin-top: 5px;">Dodaj połączenie</button>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button id="save-stop-params" style="flex: 1; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
                                <button id="delete-stop" style="padding: 5px; margin-top: 5px; background: red; color: white;">Usuń</button>
                            </div>
                        </div>
                    `;
                };

                // Function to refresh all stop popups
                const refreshAllStopPopups = () => {
                    stopsRef.current.forEach(s => {
                        if (s.marker) {
                            s.marker.bindPopup(createStopPopupContent(s.properties, s));
                        }
                    });
                };

                // Function to remove a connection
                const removeConnection = (stop1, stop2) => {
                    // Find the connection objects
                    const connection = stop1.connections.find(c => c.connectedTo === stop2);
                    const reverseConnection = stop2.connections.find(c => c.connectedTo === stop1);

                    if (connection) {
                        // Remove the visual elements
                        if (connection.line) map.removeLayer(connection.line);
                        if (connection.trackLine) map.removeLayer(connection.trackLine);

                        // Remove the connections from both stops
                        stop1.connections = stop1.connections.filter(c => c !== connection);
                        stop2.connections = stop2.connections.filter(c => c !== reverseConnection);

                        // Remove from lines array
                        linesRef.current = linesRef.current.filter(l => 
                            l.trackLine !== connection.trackLine
                        );

                        // Update route coordinates
                        const orderedLines = linesRef.current.sort((a, b) => {
                            const aFromName = a.from.properties.name;
                            const bFromName = b.from.properties.name;
                            return aFromName.localeCompare(bFromName);
                        });

                        const allLines = orderedLines.map(l => [
                            [l.from.geometry.coordinates[1], l.from.geometry.coordinates[0]],
                            [l.to.geometry.coordinates[1], l.to.geometry.coordinates[0]]
                        ]).flat();
                        onLineGenerated(allLines);

                        // Refresh all popups to show updated connections
                        refreshAllStopPopups();
                    }
                };

                const icon = L.divIcon({
                    className: 'stop-icon',
                    html: `<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                const marker = L.marker([pt.lat, pt.lng], { 
                    icon,
                    draggable: true // Enable dragging
                }).addTo(map);
                stop.marker = marker;
                
                // Add drag handlers
                marker.on('dragstart', () => {
                    // Store initial position
                    marker._initialPosition = marker.getLatLng();
                });

                marker.on('drag', () => {
                    // Update connections during drag
                    stop.connections?.forEach(conn => {
                        const lineCoords = [
                            conn.isOutgoing ? marker.getLatLng() : conn.connectedTo.marker.getLatLng(),
                            conn.isOutgoing ? conn.connectedTo.marker.getLatLng() : marker.getLatLng()
                        ];
                        conn.line.setLatLngs(lineCoords);
                        conn.trackLine.setLatLngs(lineCoords);
                    });
                });

                marker.on('dragend', () => {
                    // Update stop coordinates
                    const newPos = marker.getLatLng();
                    stop.geometry.coordinates = [newPos.lng, newPos.lat];
                    
                    // Update all connections
                    stop.connections?.forEach(conn => {
                        // Recalculate metrics for this connection
                        const distKm = calculateDistanceKm([
                            conn.isOutgoing ? newPos : conn.connectedTo.marker.getLatLng(),
                            conn.isOutgoing ? conn.connectedTo.marker.getLatLng() : newPos
                        ]);
                        
                        const timeRes = calculateTravelTime({
                            distanceKm: distKm,
                            slopePercent: conn.params?.slope || 0,
                            maxWagons: conn.params?.maxWagons || 10,
                            actualWagons: conn.params?.actualWagons || 5,
                            stops: stopsRef.current
                        });

                        // Update tooltip
                        conn.line.setTooltipContent(
                            `Długość: ${distKm.toFixed(2)} km<br>` +
                            `Czas: ${timeRes.formatted}`
                        );
                    });

                    // Update route coordinates
                    const allLines = linesRef.current.map(l => [
                        [l.from.geometry.coordinates[1], l.from.geometry.coordinates[0]],
                        [l.to.geometry.coordinates[1], l.to.geometry.coordinates[0]]
                    ]).flat();
                    onLineGenerated(allLines);
                });

                // Add initial tooltip
                marker.bindTooltip(`<b>${stopData.name}</b>`);

                // Bind popup with form
                marker.bindPopup(createStopPopupContent(stopData, stop));

                // Add popup handler
                marker.on('popupopen', () => {
                    setTimeout(() => {
                        const saveBtn = document.getElementById('save-stop-params');
                        const addConnectionBtn = document.getElementById('add-connection');
                        const toggleConnectionsBtn = document.getElementById('toggle-connections');
                        const connectionsList = document.getElementById('connections-list');
                        const deleteBtn = document.getElementById('delete-stop');
                        
                        if (toggleConnectionsBtn && connectionsList) {
                            toggleConnectionsBtn.onclick = () => {
                                const isExpanded = connectionsList.style.maxHeight !== '0px';
                                connectionsList.style.maxHeight = isExpanded ? '0px' : '150px';
                                toggleConnectionsBtn.textContent = isExpanded ? '▶' : '▼';
                                connectionsList.style.border = isExpanded ? 'none' : '1px solid #ddd';
                                connectionsList.style.marginBottom = isExpanded ? '0' : '8px';
                            };
                        }

                        // Add handlers for remove connection buttons
                        document.querySelectorAll('.remove-connection').forEach(btn => {
                            btn.onclick = (e) => {
                                e.preventDefault();
                                const targetStopName = btn.getAttribute('data-stop');
                                const targetStop = stopsRef.current.find(s => s.properties.name === targetStopName);
                                if (targetStop) {
                                    removeConnection(stop, targetStop);
                                }
                            };
                        });

                        if (!saveBtn) return;

                        if (addConnectionBtn) {
                            addConnectionBtn.onclick = () => {
                                const selectedStopName = document.getElementById('new-connection').value;
                                const direction = document.getElementById('connection-direction').value;
                                if (!selectedStopName) return;

                                const targetStop = stopsRef.current.find(s => s.properties.name === selectedStopName);
                                if (!targetStop || targetStop === stop) {
                                    alert('Nie można połączyć przystanku z samym sobą');
                                    return;
                                }

                                // Check if connection already exists
                                const existingConnection = stop.connections?.find(conn => 
                                    conn.connectedTo === targetStop
                                );
                                if (existingConnection) {
                                    alert('To połączenie już istnieje');
                                    return;
                                }

                                try {
                                    const isOutgoing = direction === 'outgoing';
                                    
                                    // Create a single line
                                    const line = L.polyline([
                                        isOutgoing ? marker.getLatLng() : targetStop.marker.getLatLng(),
                                        isOutgoing ? targetStop.marker.getLatLng() : marker.getLatLng()
                                    ], {
                                        color: 'black',
                                        weight: 7,
                                        opacity: 0.9
                                    }).addTo(map);

                                    // Handle editing events when they occur
                                    line.on('pm:edit', () => {
                                        updateMetrics(line, lineParams);
                                    });

                                    // Initial metrics calculation
                                    updateMetrics(line, lineParams);

                                    // Add click handler for parameters
                                    line.on('click', () => {
                                        const popup = L.popup()
                                            .setLatLng(line.getLatLngs()[0])
                                            .setContent(createLinePopupContent(lineParams));
                                        
                                        popup.openOn(map);
                                        
                                        setTimeout(() => {
                                            const saveBtn = document.getElementById('save-line-params');
                                            if (!saveBtn) return;

                                            saveBtn.onclick = () => {
                                                const maxWagons = parseInt(document.getElementById('max-wagons').value) || 10;
                                                const slope = parseFloat(document.getElementById('slope').value) || 0;
                                                const actualWagons = parseInt(document.getElementById('actual-wagons').value) || 5;
                                                const trackCount = parseInt(document.getElementById('track-count').value) || 2;

                                                // Update parameters
                                                Object.assign(lineParams, {
                                                    maxWagons,
                                                    slope,
                                                    actualWagons,
                                                    trackCount
                                                });

                                                // Update line style based on track count
                                                line.setStyle({ 
                                                    color: trackCount === 1 ? '#ff0000' : '#000000',
                                                    weight: 7,
                                                    dashArray: trackCount === 1 ? '12,12' : null,
                                                    opacity: 0.9
                                                });

                                                updateMetrics(line, lineParams);
                                                map.closePopup();
                                            };
                                        }, 50);
                                    });

                                    // Add to lines array
                                    linesRef.current.push({
                                        line,
                                        from: isOutgoing ? stop : targetStop,
                                        to: isOutgoing ? targetStop : stop,
                                        params: lineParams
                                    });

                                    // Create connection objects
                                    const connection = { 
                                        line,
                                        connectedTo: targetStop,
                                        isOutgoing,
                                        params: lineParams
                                    };

                                    const targetConnection = { 
                                        line,
                                        connectedTo: stop,
                                        isOutgoing: !isOutgoing,
                                        params: lineParams
                                    };

                                    // Add connections
                                    stop.connections.push(connection);
                                    targetStop.connections.push(targetConnection);

                                    // Add cleanup function to the line
                                    line.on('remove', () => {
                                        // Remove connections from both stops
                                        stop.connections = stop.connections.filter(c => c !== connection);
                                        targetStop.connections = targetStop.connections.filter(c => c !== targetConnection);
                                        
                                        // Remove from lines array
                                        linesRef.current = linesRef.current.filter(l => l.line !== line);
                                        
                                        // Update popups to reflect removed connection
                                        refreshAllStopPopups();
                                    });

                                    // Update all popups to show new connections
                                    refreshAllStopPopups();
                                    
                                    // Reopen popups that were open
                                    stopsRef.current.forEach(s => {
                                        if (s.marker && s.marker.isPopupOpen()) {
                                            s.marker.setPopupContent(createStopPopupContent(s.properties, s));
                                            
                                            // Reattach event handlers for the refreshed popup
                                            setTimeout(() => {
                                                document.querySelectorAll('.remove-connection').forEach(btn => {
                                                    btn.onclick = (e) => {
                                                        e.preventDefault();
                                                        const targetStopName = btn.getAttribute('data-stop');
                                                        const targetStop = stopsRef.current.find(s => s.properties.name === targetStopName);
                                                        if (targetStop) {
                                                            removeConnection(s, targetStop);
                                                        }
                                                    };
                                                });
                                            }, 50);
                                        }
                                    });

                                    // Update route coordinates
                                    const orderedLines = linesRef.current.sort((a, b) => {
                                        const aFromName = a.from.properties.name;
                                        const bFromName = b.from.properties.name;
                                        return aFromName.localeCompare(bFromName);
                                    });

                                    const allLines = orderedLines.map(l => [
                                        [l.from.geometry.coordinates[1], l.from.geometry.coordinates[0]],
                                        [l.to.geometry.coordinates[1], l.to.geometry.coordinates[0]]
                                    ]).flat();
                                    onLineGenerated(allLines);

                                    map.closePopup();
                                } catch (error) {
                                    console.error('Connection creation error:', error);
                                    alert(`Wystąpił błąd podczas tworzenia połączenia: ${error.message}`);
                                }
                            };
                        }

                        if (deleteBtn) {
                            deleteBtn.onclick = () => {
                                // Remove all connections
                                stop.connections?.forEach(conn => {
                                    removeConnection(stop, conn.connectedTo);
                                });
                                
                                // Remove marker from map
                                map.removeLayer(marker);
                                
                                // Remove stop from list
                                stopsRef.current = stopsRef.current.filter(s => s !== stop);
                                onStops([...stopsRef.current]);
                                
                                // Update route coordinates
                                const allLines = linesRef.current.map(l => [
                                    [l.from.geometry.coordinates[1], l.from.geometry.coordinates[0]],
                                    [l.to.geometry.coordinates[1], l.to.geometry.coordinates[0]]
                                ]).flat();
                                onLineGenerated(allLines);
                                
                                map.closePopup();
                            };
                        }

                        saveBtn.onclick = () => {
                            const name = document.getElementById('stop-name').value;
                            const stopTime = parseInt(document.getElementById('stop-time').value) || 0;
                            const passengersIn = parseInt(document.getElementById('passengers-in').value) || 0;
                            const passengersOut = parseInt(document.getElementById('passengers-out').value) || 0;
                            const isTerminal = document.getElementById('is-terminal').checked;

                            // Update stop data
                            stop.properties = {
                                name,
                                stopTime,
                                passengersIn,
                                passengersOut,
                                isTerminal
                            };

                            // Update marker icon based on terminal status
                            marker.setIcon(L.divIcon({
                                className: 'stop-icon',
                                html: `<div style="width:14px;height:14px;background:${isTerminal ? 'black' : 'red'};border-radius:50%;border:2px solid white;"></div>`,
                                iconSize: [14, 14],
                                iconAnchor: [7, 7]
                            }));

                            // Update tooltip
                            marker.bindTooltip(
                                `<b>${name}</b><br/>` +
                                `Postój: ${stopTime}s<br/>` +
                                `Pasażerowie (+${passengersIn}/-${passengersOut})` +
                                `${isTerminal ? '<br/>Stacja końcowa' : ''}`
                            );

                            // Refresh all popups to show the new stop as a connection option
                            refreshAllStopPopups();

                            map.closePopup();
                        };
                    }, 50);
                });

                // Add stop to the list
                stopsRef.current.push(stop);
                onStops([...stopsRef.current]);

                // Refresh all popups to show the new stop as a connection option
                refreshAllStopPopups();

                map.removeLayer(layer);
            }
            
            map.pm.disableDraw();
        });

        return () => {
            map.pm.disableDraw();
            map.pm.removeControls();
            map.off('pm:create');
            linesRef.current.forEach(l => map.removeLayer(l.line));
            stopsRef.current.forEach(s => {
                if (s.marker) map.removeLayer(s.marker);
                s.connections.forEach(c => map.removeLayer(c.line));
            });
        };
    }, [map, onStops, onLineGenerated, setRouteParams]);

    return null;
}

// Initialize line parameters
const lineParams = {
    maxSpeed: 60,
    slope: 0,
    trackCount: 2,
    maxWagons: 10,
    actualWagons: 5
};

// Create popup content function
const createLinePopupContent = (params) => `
    <div style="min-width: 200px;">
        <h4 style="margin: 0 0 10px 0;">Edycja parametrów odcinka</h4>
        <div style="margin-bottom: 8px;">
            <label>Maksymalna liczba wagonów:</label>
            <input type="number" id="max-wagons" min="1" max="20" value="${params.maxWagons}" style="width: 60px;">
        </div>
        <div style="margin-bottom: 8px;">
            <label>Nachylenie (‰):</label>
            <input type="number" id="slope" step="0.1" value="${params.slope}" style="width: 60px;">
        </div>
        <div style="margin-bottom: 8px;">
            <label>Używane wagony:</label>
            <input type="number" id="actual-wagons" min="1" value="${params.actualWagons}" style="width: 60px;">
        </div>
        <div style="margin-bottom: 8px;">
            <label>Liczba torów:</label>
            <select id="track-count" style="width: 100px;">
                <option value="1" ${params.trackCount === 1 ? 'selected' : ''}>Jednotorowy</option>
                <option value="2" ${params.trackCount === 2 ? 'selected' : ''}>Dwutorowy</option>
            </select>
        </div>
        <button id="save-line-params" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
    </div>
`;

export default function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(null);
    const [role, setRole] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [selRoute, setSelRoute] = useState(null);
    const [showRouteList, setShowRouteList] = useState(false);
>>>>>>> D_Kulig
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('account');
<<<<<<< HEAD
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
=======
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
    const [simulationSpeed, setSimulationSpeed] = useState(1);
    
    // Add refs for stops and lines
    const stopsRef = useRef([]);
    const linesRef = useRef([]);

    // Update refs when drawn stops change
    useEffect(() => {
        stopsRef.current = drawnStops;
    }, [drawnStops]);

    // App.js — część 3/5 — poprawiona i kompletna logika App()

>>>>>>> D_Kulig
    useEffect(() => {
        document.body.className = '';
        document.body.classList.add(`${theme}-theme`);
        localStorage.setItem('theme', theme);
    }, [theme]);

<<<<<<< HEAD
    // On token change: decode and load
    useEffect(() => {
        if (!token) return;
        try {
            const p = JSON.parse(atob(token.split('.')[1]));
            setUsername(p.username);
            setRole(p.role);
=======
    useEffect(() => {
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUsername(payload.username);
            setRole(payload.role);
>>>>>>> D_Kulig
            loadRoutes();
        } catch {
            setUsername(null);
            setRole(null);
        }
    }, [token]);

<<<<<<< HEAD
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
=======
    const loadRoutes = async () => {
        try {
            const res = await fetch('http://localhost:5000/routes', {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) {
                const errorText = await res.text();
                alert(`Błąd: ${errorText}`);
                return false;
            }
            setRoutes(await res.json());
            return true;
        } catch (error) {
            console.error('Error loading routes:', error);
            alert('Błąd podczas ładowania tras');
            return false;
        }
    };

>>>>>>> D_Kulig
    const handleShowRoutes = async () => {
        if (!showRouteList) {
            const ok = await loadRoutes();
            if (!ok) return;
        }
        setShowRouteList(!showRouteList);
    };

<<<<<<< HEAD
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
=======
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
        if (!routeName || drawnStops.length < 2) return alert('Minimum 2 przystanki');
        
        // Przygotuj przystanki w formacie GeoJSON
        const cleanStops = drawnStops.map((stop, index) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [stop.geometry.coordinates[0], stop.geometry.coordinates[1]]
            },
            properties: {
                name: stop.properties.name || `Stop ${index + 1}`,
                stopTime: stop.properties.stopTime || 0,
                isTerminal: stop.properties.isTerminal || false
            }
        }));

        // Przygotuj segmenty w formacie GeoJSON
        const cleanSegments = [];
        if (linesRef.current) {
            linesRef.current.forEach((line, index) => {
                const coords = line.line.getLatLngs();
                cleanSegments.push({
                    geom: {
                        type: 'LineString',
                        coordinates: coords.map(coord => [coord.lng, coord.lat])
                    },
                    max_wagons: line.params?.maxWagons || 10,
                    slope_percent: line.params?.slope || 0,
                    track_count: line.params?.trackCount || 2
                });
            });
        }

        const routeData = {
            name: routeName,
            stops: cleanStops,
            segments: cleanSegments,
            params: {
                trainType: routeParams.trainType || 'passenger',
                maxSpeed: routeParams.maxSpeed || 60,
                actualWagons: routeParams.actualWagons || 5
            }
        };

        console.log('Wysyłane dane:', JSON.stringify(routeData, null, 2));

        try {
            const res = await fetch('http://localhost:5000/routes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(routeData)
            });

            if (!res.ok) {
                const errorData = await res.json();
                alert(`Błąd: ${errorData.error}`);
                return;
            }
            
            alert('Zapisano');
            setRouteName('');
            setDrawnCoords([]);
            setDrawnStops([]);
            linesRef.current = [];
            loadRoutes();
        } catch (error) {
            console.error('Error saving route:', error);
            alert('Błąd podczas zapisywania trasy');
        }
    };

    const handleUpdateRoute = async () => {
        if (!selRoute) return;

        // Przygotuj oczyszczone dane przystanków
        const cleanStops = selRoute.stops.map((stop, index) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: Array.isArray(stop.geometry.coordinates) 
                    ? stop.geometry.coordinates 
                    : [stop.geometry.coordinates.lng, stop.geometry.coordinates.lat]
            },
            properties: {
                name: stop.properties.name || `Stop ${index + 1}`,
                stopTime: stop.properties.stopTime || 0,
                isTerminal: stop.properties.isTerminal || false
            }
        }));

        // Przygotuj oczyszczone segmenty
        const cleanSegments = [];
        if (selRoute.segments) {
            Object.entries(selRoute.segments).forEach(([key, segment], index) => {
                cleanSegments.push({
                    seq_no: index + 1,
                    geom: {
                        type: 'LineString',
                        coordinates: segment.coordinates || []
                    },
                    max_wagons: segment.maxWagons || 10,
                    slope_percent: segment.slope || 0,
                    track_count: segment.trackCount || 2
                });
            });
        }

        const updatedRoute = {
            name: selRoute.name,
            stops: cleanStops,
            segments: cleanSegments,
            params: {
                trainType: routeParams.trainType || selRoute.params?.trainType || 'passenger',
                maxSpeed: routeParams.maxSpeed || selRoute.params?.maxSpeed || 60,
                actualWagons: routeParams.actualWagons || selRoute.params?.actualWagons || 5
            }
        };

        const res = await fetch(`http://localhost:5000/routes/${selRoute.route_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updatedRoute)
        });

        if (!res.ok) {
            const errorText = await res.text();
            alert(`Błąd: ${errorText}`);
            return;
        }
        
        alert('Zaktualizowano trasę');
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
        setIsRunning(true);
    };

    const handlePauseTrain = () => {
        setIsRunning(false);
    };

    const handleResetTrain = () => {
        setIsRunning(false);
        
        // Remove the simulation train marker
        setResetSignal(prev => prev + 1);
        
        // Remove any existing train markers and reset state
        if (trainObj?.marker) {
            trainObj.marker.remove();
        }
        
        // Reset state and recreate initial train marker
        setTrainObj(null);
        setDrawnCoords([]);
        setDrawnStops([]);
        setRouteParams({});
        
        // Force MapLoader to recreate the initial train marker
        const currentRoute = selRoute;
        setSelRoute(null);
        setTimeout(() => {
            setSelRoute(currentRoute);
        }, 50);
    };

    // Load saved state on mount
    useEffect(() => {
        const savedState = localStorage.getItem('currentRouteState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                if (state.stops) {
                    setDrawnStops(state.stops);
                }
                // Route parameters will be loaded by MapWithDrawing component
            } catch (error) {
                console.error('Error loading saved state:', error);
            }
        }
    }, []);

    const handleSaveChanges = () => {
        // Save current state
        const currentState = {
            stops: drawnStops.map(stop => ({
                geometry: stop.geometry,
                properties: stop.properties
            })),
            lines: linesRef.current.map(line => ({
                from: line.from.properties.name,
                to: line.to.properties.name,
                params: line.params
            }))
        };
        
        // Store in localStorage
        localStorage.setItem('currentRouteState', JSON.stringify(currentState));
        alert('Zmiany zostały zapisane');
    };

    // return z mapą, menu i panelem admina
>>>>>>> D_Kulig

    if (!token) return <AuthForm onAuth={handleAuth} />;

    return (
        <div className="app-container">
<<<<<<< HEAD
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
=======
            <MapContainer
                center={[49.62, 20.7]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                whenCreated={(map) => (window._mapRef = map)}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapWithDrawing onStops={setDrawnStops} onLineGenerated={setDrawnCoords} setRouteParams={setRouteParams} />
                {selRoute && (
                    <MapLoader
                        route={selRoute}
                        onTrainReady={setTrainObj}
                        showTrain={true}
                        setRouteParams={setRouteParams}
                    />
                )}
                {selRoute && (
                    <Simulation
                        polylineCoords={selRoute.geojson.coordinates.map(([lng, lat]) => [lat, lng])}
                        stops={selRoute.stops}
                        run={isRunning}
                        paused={!isRunning}
                        trainType={routeParams.trainType || 'passenger'}
                        routeParams={routeParams}
                        resetSignal={resetSignal}
                        speedMultiplier={simulationSpeed}
                    />
                )}
            </MapContainer>

            <div className="top-buttons">
                <button onClick={() => { setShowMainMenu(!showMainMenu); setShowMapMenu(false); setShowAdminPanel(false); }}>Menu</button>
                {!selRoute && (
                    <button onClick={() => { setShowMapMenu(!showMapMenu); setShowMainMenu(false); setShowAdminPanel(false); }}>Trasa</button>
                )}
                {role === 'admin' && (
                    <button onClick={() => { setShowAdminPanel(!showAdminPanel); setShowMainMenu(false); setShowMapMenu(false); }}>Panel Admina</button>
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
>>>>>>> D_Kulig
            )}

            {showMapMenu && (
                <div className={`mapmenu ${theme}-theme`}>
<<<<<<< HEAD
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
=======
                    <h3>Kontrolki mapy</h3>
                    
                    {!selRoute && (
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                            <input
                                value={routeName}
                                onChange={(e) => setRouteName(e.target.value)}
                                placeholder="Nazwa trasy"
                                style={{ width: '100%' }}
                            />
                            
                            <button 
                                onClick={handleSaveRoute} 
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    backgroundColor: '#4CAF50', 
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}
                                disabled={!routeName || drawnStops.length < 2}
                            >
                                Zapisz nową trasę
                            </button>
                        </div>
                    )}
                    
                    {selRoute && (
                        <>
                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ margin: '0.5rem 0' }}>Typ pociągu</h4>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: '1fr 1fr', 
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    <button
                                        onClick={() => setRouteParams(prev => ({ ...prev, trainType: 'passenger' }))}
                                        style={{
                                            padding: '0.5rem',
                                            backgroundColor: (!routeParams.trainType || routeParams.trainType === 'passenger') ? '#4CAF50' : undefined,
                                            color: (!routeParams.trainType || routeParams.trainType === 'passenger') ? 'white' : undefined,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        🚂 Pasażerski
                                    </button>
                                    <button
                                        onClick={() => setRouteParams(prev => ({ ...prev, trainType: 'cargo' }))}
                                        style={{
                                            padding: '0.5rem',
                                            backgroundColor: routeParams.trainType === 'cargo' ? '#4CAF50' : undefined,
                                            color: routeParams.trainType === 'cargo' ? 'white' : undefined,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        🚂 Towarowy
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ margin: '0.5rem 0' }}>Prędkość symulacji</h4>
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', 
                                    gap: '0.25rem', 
                                    marginBottom: '0.5rem' 
                                }}>
                                    {[1, 2, 4, 5, 10, 100].map(speed => (
                                        <button
                                            key={speed}
                                            onClick={() => setSimulationSpeed(speed)}
                                            style={{
                                                padding: '0.25rem',
                                                backgroundColor: simulationSpeed === speed ? '#4CAF50' : undefined,
                                                color: simulationSpeed === speed ? 'white' : undefined
                                            }}
                                        >
                                            {speed}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                    onClick={handleStartTrain}
                                    disabled={!trainObj || isRunning}
                                    style={{ width: '100%' }}
                                >
                                    ▶ Start
                                </button>
                                <button
                                    onClick={handlePauseTrain}
                                    disabled={!isRunning}
                                    style={{ width: '100%' }}
                                >
                                    ⏸ Pauza
                                </button>
                                <button
                                    onClick={handleResetTrain}
                                    style={{ width: '100%' }}
                                >
                                    🔁 Reset
                                </button>

                                <button
                                    onClick={handleUpdateRoute}
                                    style={{ 
                                        width: '100%', 
                                        padding: '8px', 
                                        backgroundColor: '#2196F3', 
                                        color: 'white',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    💾 Zapisz zmiany w bazie
                                </button>

                                {role === 'admin' && (
                                    <button
                                        onClick={handleDeleteRoute}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            background: 'red',
                                            color: 'white',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        🗑️ Usuń trasę
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button onClick={handleShowRoutes} style={{ width: '100%' }}>
                            📋 Lista tras
                        </button>

                        {showRouteList && routes.length > 0 && (
                            <select
                                onChange={(e) => {
                                    const r = routes.find(r => r.route_id.toString() === e.target.value);
                                    if (!r) return;

                                    const route = {
                                        ...r,
                                        geojson: typeof r.geojson === 'string' ? JSON.parse(r.geojson) : r.geojson,
                                        stops: typeof r.stops === 'string' ? JSON.parse(r.stops) : r.stops.map(stop => ({
                                            ...stop,
                                            properties: {
                                                ...stop.properties,
                                                isTerminal: Boolean(stop.properties.isTerminal)
                                            }
                                        }))
                                    };
                                    setSelRoute(route);
                                }}
                                style={{ width: '100%' }}
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
                    </div>
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

>>>>>>> D_Kulig
