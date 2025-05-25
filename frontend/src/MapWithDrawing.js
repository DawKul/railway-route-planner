import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

export default function MapWithDrawing({ onStops, onLineGenerated, onFinalStop }) {
  const map = useMap();
  const markerLayer = L.featureGroup().addTo(map);
  let finalStopMarker = null;

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawPolygon: false,
      drawPolyline: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawRectangle: false,
      cutPolygon: false,
      rotateMode: false,
      dragMode: false,
      editMode: true,
      removalMode: true,
    });

    let currentMarkers = [];

    map.on('pm:create', (e) => {
      if (e.layer instanceof L.Marker) {
        const marker = e.layer;
        marker.setIcon(
          L.divIcon({
            className: 'stop-icon',
            html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
        );

        marker.options.stopData = {
          name: `P${currentMarkers.length + 1}`,
          stopTime: 10,
        };

        marker.bindPopup(createStopPopup(marker));

        marker.on('move', () => updatePolyline());
        markerLayer.addLayer(marker);
        currentMarkers.push(marker);
        updatePolyline();
        updateStops();
      }
    });

    function createStopPopup(marker) {
      const props = marker.options.stopData;
      const div = document.createElement('div');

      div.innerHTML = `
        <label>Nazwa: <input id="stop-name" value="${props.name}" /></label><br/>
        <label>Postój (s): <input type="number" id="stop-time" value="${props.stopTime}" /></label><br/>
        <button id="set-final">Ustaw jako końcowy</button>
      `;

      setTimeout(() => {
        div.querySelector('#stop-name').onchange = (e) => {
          props.name = e.target.value;
          updateStops();
        };
        div.querySelector('#stop-time').onchange = (e) => {
          props.stopTime = parseInt(e.target.value, 10) || 0;
          updateStops();
        };
        div.querySelector('#set-final').onclick = () => {
          if (finalStopMarker) resetMarkerIcon(finalStopMarker);
          finalStopMarker = marker;
          marker.setIcon(
            L.divIcon({
              className: 'stop-icon',
              html: '<div style="width:20px;height:20px;background:black;border-radius:50%;border:2px solid white;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })
          );
          onFinalStop?.(marker.getLatLng());
        };
      }, 50);

      return div;
    }

    function resetMarkerIcon(marker) {
      marker.setIcon(
        L.divIcon({
          className: 'stop-icon',
          html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
      );
    }

    function updatePolyline() {
      const latlngs = currentMarkers.map(m => m.getLatLng());
      if (polyline) {
        polyline.setLatLngs(latlngs);
      } else {
        polyline = L.polyline(latlngs, { color: 'blue' }).addTo(map);
      }
      onLineGenerated?.(latlngs.map(p => [p.lat, p.lng]));
    }

    function updateStops() {
      const stops = currentMarkers.map(m => ({
        geometry: {
          type: 'Point',
          coordinates: [m.getLatLng().lng, m.getLatLng().lat]
        },
        properties: m.options.stopData
      }));
      onStops?.(stops);
    }

    let polyline = null;

    return () => {
      map.pm.disableDraw();
      map.pm.removeControls();
      map.off('pm:create');
      map.removeLayer(markerLayer);
      if (polyline) map.removeLayer(polyline);
    };
  }, [map]);

  return null;
}
