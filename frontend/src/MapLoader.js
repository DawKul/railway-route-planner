
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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
        const polyline = L.polyline(coords, { color: 'blue' }).addTo(map);
        map.fitBounds(polyline.getBounds());

        polyline.bindPopup('<button id="edit-route">Edytuj trasę</button>');
        polyline.on('popupopen', () => {
            setTimeout(() => {
                const btn = document.getElementById('edit-route');
                if (!btn) return;
                btn.onclick = () => {
                    const wagons = parseInt(prompt("Maksymalna liczba wagonów:", "10")) || 10;
                    const slope = parseFloat(prompt("Nachylenie (‰):", "5")) || 0;
                    const used = parseInt(prompt("Używane wagony:", "5")) || 5;
                    const distance = calculateDistanceKm(coords);
                    const time = calculateTravelTime(distance, slope, used);

                    polyline.bindTooltip(`⏱ ${time}s | 🔻 ${slope}‰ | 🚃 ${used}/${wagons}`, { permanent: true }).openTooltip();
                    map.closePopup();
                    setRouteParams?.({ wagons, slope, used, time });
                };
            }, 50);
        });

        if (showTrain && coords.length > 0 && route.route_id) {
            const icon = new L.Icon({
                iconUrl: '/train.png',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });
            const marker = L.marker(coords[0], { icon }).addTo(map);
            onTrainReady?.({ marker, coords });
        }

        (route.stops || []).forEach((stop, i) => {
            const [lng, lat] = stop.geometry.coordinates;
            const name = stop.properties?.name || `P${i + 1}`;
            const stopTime = stop.properties?.stopTime ?? 0;

            const icon = L.divIcon({
                className: 'stop-icon',
                html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
                iconSize: [14, 14], iconAnchor: [7, 7]
            });

            const marker = L.marker([lat, lng], { icon }).addTo(map);
            marker.bindPopup(`<b>${name}</b><br/>Postój: ${stopTime}s`);
        });

    }, [map, route, onTrainReady, showTrain, setRouteParams]);

    return null;
}

function calculateDistanceKm(coords) {
    let d = 0;
    for (let i = 1; i < coords.length; i++) {
        const dx = coords[i][0] - coords[i - 1][0];
        const dy = coords[i][1] - coords[i - 1][1];
        d += Math.sqrt(dx * dx + dy * dy);
    }
    return d * 111;
}

function calculateTravelTime(distanceKm, slope, wagonsUsed) {
    const baseSpeed = 60;
    const weightPenalty = wagonsUsed * 0.2;
    const slopePenalty = slope * 0.1;
    const effectiveSpeed = Math.max(10, baseSpeed - weightPenalty - slopePenalty);
    return Math.round((distanceKm / effectiveSpeed) * 3600);
}
