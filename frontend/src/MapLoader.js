import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Helper functions
function calculateDistanceKm(coords) {
    let d = 0;
    for (let i = 1; i < coords.length; i++) {
        const p1 = L.latLng(coords[i - 1]);
        const p2 = L.latLng(coords[i]);
        d += p1.distanceTo(p2);
    }
    return d / 1000;
}

function calculateDetailedTravelTime({ distanceKm, slope = 0, maxWagons = 10, actualWagons = 5, stops = [] }) {
    const baseSpeed = 60;
    const weightPenalty = (actualWagons / maxWagons) * 10;
    const slopePenalty = Math.abs(slope) * 0.5;
    
    const effectiveSpeed = Math.max(20, baseSpeed - weightPenalty - slopePenalty);
    
    const drivingTime = (distanceKm / effectiveSpeed) * 3600;
    
    const totalStopTime = stops.reduce((sum, stop) => {
        const baseStopTime = 30;
        const passengerTime = ((stop.properties?.passengersIn || 0) + (stop.properties?.passengersOut || 0)) * 2;
        return sum + baseStopTime + passengerTime;
    }, 0);
    
    return {
        totalTime: Math.round(drivingTime + totalStopTime),
        effectiveSpeed
    };
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
}

function calculateTotalRouteParams(route, coordinates) {
    const segments = route.segments || {};
    let totalDistance = 0;
    let weightedSlope = 0;
    let minSpeed = Infinity;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const segmentParams = segments[i] || { maxSpeed: 60, slope: 0 };
        const p1 = L.latLng(coordinates[i]);
        const p2 = L.latLng(coordinates[i + 1]);
        const distance = p1.distanceTo(p2) / 1000; // km

        totalDistance += distance;
        weightedSlope += segmentParams.slope * distance;
        minSpeed = Math.min(minSpeed, segmentParams.maxSpeed);
    }

    const averageSlope = weightedSlope / totalDistance;
    
    return {
        totalDistance,
        averageSlope,
        effectiveSpeed: minSpeed,
        segments: route.segments
    };
}

function updateSegmentStyle(trackCount) {
    if (trackCount === 1) {
        return {
            color: '#ff0000',
            weight: 5,
            dashArray: '12,12',
            opacity: 0.9
        };
    } else {
        return {
            color: '#000000',
            weight: 7,
            opacity: 0.9
        };
    }
}

export default function MapLoader({ route, onTrainReady, showTrain, setRouteParams }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !route || !route.geojson?.coordinates?.length) return;

        map.eachLayer(layer => {
            if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                map.removeLayer(layer);
            }
        });

        const coords = route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
        
        // Create bounds for map fitting
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds);

        // Create route info tooltip function
        function updateMainRouteTooltip() {
            const distance = calculateDistanceKm(coords);
            const { totalTime, effectiveSpeed } = calculateDetailedTravelTime({
                distanceKm: distance,
                slope: route.slope || 0,
                maxWagons: route.maxWagons || 10,
                actualWagons: route.actualWagons || 5,
                stops: route.stops || []
            });
            const timeStr = formatTime(totalTime);
            return `⏱ ${timeStr} | 🛤 ${distance.toFixed(2)} km | 🚄 ${Math.round(effectiveSpeed)} km/h`;
        }
        
        // Create individual segments
        for (let i = 0; i < coords.length - 1; i++) {
            const segmentCoords = [coords[i], coords[i + 1]];
            
            // Initialize segment parameters
            const segmentParams = route.segments?.[i] || {
                maxSpeed: 60,
                slope: 0,
                trackCount: 2
            };
            
            // Create visible track line
            const trackLine = L.polyline(segmentCoords, {
                ...updateSegmentStyle(segmentParams.trackCount),
                weight: 7,
                opacity: 0.9
            }).addTo(map);

            // Enable Geoman options but don't activate edit mode
            trackLine.pm.setOptions({
                allowSelfIntersection: false,
                snapDistance: 20,
                snapSegment: true,
                preventMarkerRemoval: true,
                removeLayerOnCancel: false
            });

            // Handle edit events to update route coordinates
            trackLine.on('pm:edit', () => {
                // Get all track lines
                const allLines = [];
                map.eachLayer(layer => {
                    if (layer instanceof L.Polyline && !(layer instanceof L.CircleMarker)) {
                        allLines.push(layer);
                    }
                });

                // Sort lines by their order in the route
                allLines.sort((a, b) => {
                    const aIndex = a._leaflet_id;
                    const bIndex = b._leaflet_id;
                    return aIndex - bIndex;
                });

                // Collect all coordinates
                const newCoords = allLines.map(line => {
                    const latLngs = line.getLatLngs();
                    return [latLngs[0], latLngs[latLngs.length - 1]];
                }).flat();

                // Update route's geojson coordinates
                if (route.geojson) {
                    route.geojson.coordinates = newCoords.map(coord => [coord.lng, coord.lat]);
                }

                // Update route parameters
                const totalParams = calculateTotalRouteParams(route, newCoords);
                setRouteParams?.(prev => ({
                    ...prev,
                    ...totalParams,
                    coordinates: newCoords.map(coord => [coord.lat, coord.lng])
                }));
            });

            // Create tooltip with segment info and route info
            const tooltipContent = () => {
                const mainInfo = updateMainRouteTooltip();
                const segmentInfo = `Odcinek ${i + 1}<br>` +
                    `Prędkość max: ${segmentParams.maxSpeed} km/h<br>` +
                    `Nachylenie: ${segmentParams.slope}‰<br>` +
                    `Tory: ${segmentParams.trackCount === 1 ? 'Jednotorowy' : 'Dwutorowy'}`;
                return segmentInfo + '<hr>' + mainInfo;
            };

            trackLine.bindTooltip(tooltipContent, { sticky: true });

            // Highlight effect on hover
            trackLine.on('mouseover', () => {
                trackLine.setStyle({ 
                    weight: trackLine.options.weight + 2,
                    opacity: 1
                });
                trackLine.getElement()?.setAttribute('style', 'cursor: pointer;');
            });

            trackLine.on('mouseout', () => {
                trackLine.setStyle({ 
                    weight: 7,
                    opacity: 0.9
                });
            });

            const createSegmentPopupContent = (params) => `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 10px 0;">Edycja parametrów odcinka ${i + 1}</h4>
                    <div style="margin-bottom: 8px;">
                        <label>Prędkość maksymalna (km/h):</label>
                        <input type="number" id="segment-speed-${i}" min="20" max="160" value="${params.maxSpeed}" style="width: 60px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Nachylenie (‰):</label>
                        <input type="number" id="segment-slope-${i}" step="0.1" value="${params.slope}" style="width: 60px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Liczba torów:</label>
                        <select id="segment-tracks-${i}" style="width: 100px;">
                            <option value="1" ${params.trackCount === 1 ? 'selected' : ''}>Jednotorowy</option>
                            <option value="2" ${params.trackCount === 2 ? 'selected' : ''}>Dwutorowy</option>
                        </select>
                    </div>
                    <button id="save-segment-${i}" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry odcinka</button>
                </div>
            `;

            // Add click handler for segment editing
            trackLine.bindPopup(createSegmentPopupContent(segmentParams));

            trackLine.on('popupopen', () => {
                setTimeout(() => {
                    const saveBtn = document.getElementById(`save-segment-${i}`);
                    if (!saveBtn) return;

                    saveBtn.onclick = () => {
                        const maxSpeed = parseInt(document.getElementById(`segment-speed-${i}`).value) || 60;
                        const slope = parseFloat(document.getElementById(`segment-slope-${i}`).value) || 0;
                        const trackCount = parseInt(document.getElementById(`segment-tracks-${i}`).value) || 2;

                        // Update segment parameters
                        const newParams = { maxSpeed, slope, trackCount };
                        if (!route.segments) route.segments = {};
                        route.segments[i] = newParams;

                        // Update tooltip
                        trackLine.setTooltipContent(tooltipContent());

                        // Update track line style
                        trackLine.setStyle({
                            ...updateSegmentStyle(trackCount),
                            weight: 7,
                            opacity: 0.9
                        });

                        // Update popup content
                        trackLine.bindPopup(createSegmentPopupContent(newParams));

                        // Recalculate total route parameters
                        const totalParams = calculateTotalRouteParams(route, coords);
                        setRouteParams?.(totalParams);

                        map.closePopup();
                    };
                }, 50);
            });
        }

        const createRoutePopupContent = (currentParams = {}) => `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 10px 0;">Edycja parametrów trasy</h4>
                <div style="margin-bottom: 8px;">
                    <label>Maksymalna liczba wagonów:</label>
                    <input type="number" id="max-wagons" min="1" max="20" value="${currentParams.wagons || 10}" style="width: 60px;">
                </div>
                <div style="margin-bottom: 8px;">
                    <label>Nachylenie (‰):</label>
                    <input type="number" id="slope" step="0.1" value="${currentParams.slope || 5}" style="width: 60px;">
                </div>
                <div style="margin-bottom: 8px;">
                    <label>Używane wagony:</label>
                    <input type="number" id="used-wagons" min="1" value="${currentParams.used || 5}" style="width: 60px;">
                </div>
                <button id="save-route-params" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
            </div>
        `;

        const setupRoutePopupHandlers = () => {
            setTimeout(() => {
                const saveBtn = document.getElementById('save-route-params');
                if (!saveBtn) return;

                saveBtn.onclick = () => {
                    const wagons = parseInt(document.getElementById('max-wagons').value) || 10;
                    const slope = parseFloat(document.getElementById('slope').value) || 0;
                    const used = parseInt(document.getElementById('used-wagons').value) || 5;
                    
                    const distance = calculateDistanceKm(coords);
                    const { totalTime, effectiveSpeed } = calculateDetailedTravelTime({
                        distanceKm: distance,
                        slope,
                        maxWagons: wagons,
                        actualWagons: used,
                        stops: route.stops || []
                    });

                    const timeStr = formatTime(totalTime);
                    const speedStr = Math.round(effectiveSpeed);
                    return `⏱ ${timeStr} | 🛤 ${distance.toFixed(2)} km | 🚄 ${speedStr} km/h`;
                };
            }, 50);
        };

        if (showTrain && coords.length > 0 && route.route_id) {
            const icon = new L.Icon({
                iconUrl: route.params?.trainType === 'cargo' ? '/train.png' : '/train2.png',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                className: 'train-icon'
            });
            const marker = L.marker(coords[0], { icon, rotationAngle: 0, rotationOrigin: 'center center' });
            onTrainReady?.({ marker, coords });
        }

        (route.stops || []).forEach((stop, i) => {
            const [lng, lat] = stop.geometry.coordinates;
            const name = stop.properties?.name || `P${i + 1}`;
            const stopTime = stop.properties?.stopTime ?? 0;
            const passengersIn = stop.properties?.passengersIn ?? 0;
            const passengersOut = stop.properties?.passengersOut ?? 0;

            const icon = L.divIcon({
                className: 'stop-icon',
                html: `<div style="width:14px;height:14px;background:${stop.properties?.isTerminal ? 'black' : 'red'};border-radius:50%;border:2px solid white;"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

            const marker = L.marker([lat, lng], { 
                icon,
                draggable: true // Enable dragging
            }).addTo(map);

            // Add drag handlers
            marker.on('dragstart', () => {
                // Store initial position
                marker._initialPosition = marker.getLatLng();
            });

            marker.on('dragend', () => {
                // Update stop coordinates
                const newPos = marker.getLatLng();
                stop.geometry.coordinates = [newPos.lng, newPos.lat];
            });
            
            // Bind tooltip for hover info
            marker.bindTooltip(
                `<b>${name}</b><br/>` +
                `Postój: ${stopTime}s<br/>` +
                `Pasażerowie (+${passengersIn}/-${passengersOut})` +
                `${stop.properties?.isTerminal ? '<br/>Stacja końcowa' : ''}`
            );

            const createStopPopupContent = (stopData) => `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 10px 0;">Edycja parametrów przystanku</h4>
                    <div style="margin-bottom: 8px;">
                        <label>Nazwa przystanku:</label>
                        <input type="text" id="stop-name-${i}" value="${stopData.name}" style="width: 100%;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Czas postoju (s):</label>
                        <input type="number" id="stop-time-${i}" min="0" value="${stopData.stopTime}" style="width: 60px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Pasażerowie wsiadający:</label>
                        <input type="number" id="passengers-in-${i}" min="0" value="${stopData.passengersIn}" style="width: 60px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label>Pasażerowie wysiadający:</label>
                        <input type="number" id="passengers-out-${i}" min="0" value="${stopData.passengersOut}" style="width: 60px;">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" id="is-terminal-${i}" ${stopData.isTerminal ? 'checked' : ''}>
                            Przystanek końcowy
                        </label>
                    </div>
                    <button id="save-stop-params-${i}" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
                </div>
            `;

            // Bind popup with form
            marker.bindPopup(createStopPopupContent({
                name,
                stopTime,
                passengersIn,
                passengersOut,
                isTerminal: stop.properties?.isTerminal || false
            }));

            // Add popup handler
            marker.on('popupopen', () => {
                setTimeout(() => {
                    const saveBtn = document.getElementById(`save-stop-params-${i}`);
                    if (!saveBtn) return;

                    saveBtn.onclick = () => {
                        const newName = document.getElementById(`stop-name-${i}`).value;
                        const newStopTime = parseInt(document.getElementById(`stop-time-${i}`).value) || 0;
                        const newPassengersIn = parseInt(document.getElementById(`passengers-in-${i}`).value) || 0;
                        const newPassengersOut = parseInt(document.getElementById(`passengers-out-${i}`).value) || 0;
                        const isTerminal = document.getElementById(`is-terminal-${i}`).checked;

                        // Update stop properties in route object
                        stop.properties = {
                            ...stop.properties,
                            name: newName,
                            stopTime: newStopTime,
                            passengersIn: newPassengersIn,
                            passengersOut: newPassengersOut,
                            isTerminal: isTerminal
                        };

                        // Update marker icon based on terminal status
                        const icon = L.divIcon({
                            className: 'stop-icon',
                            html: `<div style="width:14px;height:14px;background:${isTerminal ? 'black' : 'red'};border-radius:50%;border:2px solid white;"></div>`,
                            iconSize: [14, 14],
                            iconAnchor: [7, 7]
                        });
                        marker.setIcon(icon);

                        // Update tooltip
                        marker.bindTooltip(
                            `<b>${newName}</b><br/>` +
                            `Postój: ${newStopTime}s<br/>` +
                            `Pasażerowie (+${newPassengersIn}/-${newPassengersOut})` +
                            `${isTerminal ? '<br/>Stacja końcowa' : ''}`
                        );

                        map.closePopup();
                    };
                }, 50);
            });
        });
    }, [map, route, onTrainReady, showTrain, setRouteParams]);

    return null;
}