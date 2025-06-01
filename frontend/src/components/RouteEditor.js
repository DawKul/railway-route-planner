import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import L from 'leaflet';

const RouteEditor = ({ route, onSave }) => {
    const [isTerminal, setIsTerminal] = useState(false);
    const [selectedStop, setSelectedStop] = useState(null);
    const [branches, setBranches] = useState(route?.branches || []);
    const mapRef = useRef(null);
    const drawnItemsRef = useRef(null);
    const [editMode, setEditMode] = useState(false);

    const createStopPopupContent = (props, index) => `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0;">Edycja parametrów przystanku</h4>
            <div style="margin-bottom: 8px;">
                <label>Nazwa przystanku:</label>
                <input type="text" id="stop-name-${index}" value="${props.name}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 8px;">
                <label>Czas postoju (s):</label>
                <input type="number" id="stop-time-${index}" min="0" value="${props.stopTime || 0}" style="width: 60px;">
            </div>
            <div style="margin-bottom: 8px;">
                <label>Terminal Station:</label>
                <input type="checkbox" id="is-terminal-${index}" ${props.isTerminal ? 'checked' : ''}>
            </div>
            <button id="save-stop-params-${index}" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
        </div>
    `;

    const MapController = () => {
        const map = useMap();
        mapRef.current = map;

        useEffect(() => {
            // Initialize Geoman controls
            map.pm.addControls({
                position: 'topleft',
                drawCircle: false,
                drawCircleMarker: false,
                drawRectangle: false,
                drawPolygon: false,
                editMode: false,
                dragMode: false,
                cutPolygon: false,
                removalMode: false,
            });

            // Create a feature group for drawn items if it doesn't exist
            if (!drawnItemsRef.current) {
                drawnItemsRef.current = new L.FeatureGroup().addTo(map);
            }

            // Add existing stops and lines to the map
            if (route?.stops) {
                route.stops.forEach((stop, index) => {
                    const icon = L.divIcon({
                        className: 'stop-icon',
                        html: `<div style="width:14px;height:14px;background:${stop.properties.isTerminal ? 'black' : 'red'};border-radius:50%;border:2px solid white;"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });

                    const marker = L.marker(
                        [stop.geometry.coordinates[1], stop.geometry.coordinates[0]],
                        { icon }
                    );
                    
                    // Store stop data with marker
                    marker.stopData = stop;
                    marker.stopIndex = index;

                    // Add popup with edit form
                    marker.bindPopup(createStopPopupContent(stop.properties, index));

                    // Add tooltip with info
                    marker.bindTooltip(
                        `<b>${stop.properties.name}</b><br/>` +
                        `Postój: ${stop.properties.stopTime || 0}s<br/>` +
                        `${stop.properties.isTerminal ? '(Terminal Station)' : ''}`
                    );

                    // Setup popup handlers
                    marker.on('popupopen', () => {
                        setTimeout(() => {
                            const saveBtn = document.getElementById(`save-stop-params-${index}`);
                            if (!saveBtn) return;

                            saveBtn.onclick = () => {
                                const newName = document.getElementById(`stop-name-${index}`).value;
                                const newStopTime = parseInt(document.getElementById(`stop-time-${index}`).value) || 0;
                                const isTerminal = document.getElementById(`is-terminal-${index}`).checked;

                                // Update stop data
                                marker.stopData.properties = {
                                    ...marker.stopData.properties,
                                    name: newName,
                                    stopTime: newStopTime,
                                    isTerminal: isTerminal
                                };

                                // Update marker icon if terminal status changed
                                marker.setIcon(L.divIcon({
                                    className: 'stop-icon',
                                    html: `<div style="width:14px;height:14px;background:${isTerminal ? 'black' : 'red'};border-radius:50%;border:2px solid white;"></div>`,
                                    iconSize: [14, 14],
                                    iconAnchor: [7, 7]
                                }));

                                // Update tooltip
                                marker.bindTooltip(
                                    `<b>${newName}</b><br/>` +
                                    `Postój: ${newStopTime}s<br/>` +
                                    `${isTerminal ? '(Terminal Station)' : ''}`
                                );

                                // Call onSave with updated route data
                                const updatedStops = [];
                                drawnItemsRef.current.eachLayer((layer) => {
                                    if (layer.stopData) {
                                        updatedStops.push(layer.stopData);
                                    }
                                });
                                
                                onSave({
                                    ...route,
                                    stops: updatedStops
                                });

                                map.closePopup();
                            };
                        }, 50);
                    });

                    drawnItemsRef.current.addLayer(marker);
                });
            }

            // Handle edit mode changes
            map.on('pm:globaleditmodetoggled', (e) => {
                setEditMode(e.enabled);
            });

            // Handle stop creation
            map.on('pm:create', (e) => {
                if (e.layer instanceof L.Marker) {
                    const coords = e.layer.getLatLng();
                    const index = drawnItemsRef.current.getLayers().length;
                    
                    const stopData = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [coords.lng, coords.lat]
                        },
                        properties: {
                            name: `Stop ${index + 1}`,
                            stopTime: 30,
                            isTerminal: false
                        }
                    };

                    // Store stop data with marker
                    e.layer.stopData = stopData;
                    e.layer.stopIndex = index;

                    // Add popup with edit form
                    e.layer.bindPopup(createStopPopupContent(stopData.properties, index));

                    // Add tooltip with info
                    e.layer.bindTooltip(
                        `<b>${stopData.properties.name}</b><br/>` +
                        `Postój: ${stopData.properties.stopTime}s`
                    );

                    // Setup popup handlers
                    e.layer.on('popupopen', () => {
                        setTimeout(() => {
                            const saveBtn = document.getElementById(`save-stop-params-${index}`);
                            if (!saveBtn) return;

                            saveBtn.onclick = () => {
                                const newName = document.getElementById(`stop-name-${index}`).value;
                                const newStopTime = parseInt(document.getElementById(`stop-time-${index}`).value) || 0;
                                const isTerminal = document.getElementById(`is-terminal-${index}`).checked;

                                // Update stop data
                                e.layer.stopData.properties = {
                                    ...e.layer.stopData.properties,
                                    name: newName,
                                    stopTime: newStopTime,
                                    isTerminal: isTerminal
                                };

                                // Update marker icon if terminal
                                if (isTerminal) {
                                    e.layer.setIcon(L.divIcon({
                                        className: 'stop-icon',
                                        html: `<div style="width:14px;height:14px;background:black;border-radius:50%;border:2px solid white;"></div>`,
                                        iconSize: [14, 14],
                                        iconAnchor: [7, 7]
                                    }));
                                }

                                // Update tooltip
                                e.layer.bindTooltip(
                                    `<b>${newName}</b><br/>` +
                                    `Postój: ${newStopTime}s<br/>` +
                                    `${isTerminal ? '(Terminal Station)' : ''}`
                                );

                                // Call onSave with updated route data
                                const updatedStops = [];
                                drawnItemsRef.current.eachLayer((layer) => {
                                    if (layer.stopData) {
                                        updatedStops.push(layer.stopData);
                                    }
                                });
                                
                                onSave({
                                    ...route,
                                    stops: updatedStops
                                });

                                map.closePopup();
                            };
                        }, 50);
                    });

                    drawnItemsRef.current.addLayer(e.layer);
                }
            });

            // Clean up on unmount
            return () => {
                if (drawnItemsRef.current) {
                    drawnItemsRef.current.clearLayers();
                }
            };
        }, [map]);

        return null;
    };

    const toggleEditMode = () => {
        if (mapRef.current) {
            if (!editMode) {
                mapRef.current.pm.enableGlobalEditMode();
            } else {
                mapRef.current.pm.disableGlobalEditMode();
            }
        }
    };

    const handleSave = () => {
        if (!drawnItemsRef.current) return;

        const stops = [];
        drawnItemsRef.current.getLayers().forEach((layer) => {
            if (layer.stopData) {
                stops.push(layer.stopData);
            }
        });

        onSave({
            ...route,
            stops,
            branches
        });
    };

    return (
        <div className="route-editor">
            <div className="editor-controls">
                <div className="edit-mode-controls">
                    <button 
                        className={`edit-mode-button ${editMode ? 'active' : ''}`}
                        onClick={toggleEditMode}
                    >
                        {editMode ? 'Zakończ edycję' : 'Edytuj warstwę'}
                    </button>
                </div>

                <div className="stop-controls">
                    <h4>Stop Settings</h4>
                    <button onClick={() => mapRef.current?.pm.enableDraw('Marker')}>
                        Add Stop
                    </button>
                </div>

                <button 
                    className="save-button"
                    onClick={handleSave}
                >
                    Save Changes
                </button>
            </div>

            <MapContainer
                center={[52.237049, 21.017532]}
                zoom={13}
                style={{ height: '600px', width: '100%' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapController />
            </MapContainer>

            <style jsx>{`
                .route-editor {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .editor-controls {
                    padding: 1rem;
                    background: #f5f5f5;
                    border-radius: 4px;
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }
                .edit-mode-button {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #4CAF50;
                    color: white;
                }
                .edit-mode-button.active {
                    background: #f44336;
                }
                .stop-controls {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }
                .stop-controls button {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #2196F3;
                    color: white;
                }
                .save-button {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: #4CAF50;
                    color: white;
                    margin-left: auto;
                }
            `}</style>
        </div>
    );
};

export default RouteEditor; 