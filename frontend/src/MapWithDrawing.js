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

    // Dodaj polskie tłumaczenia dla przycisków
    map.pm.setLang('custom', {
      tooltips: {
        drawMarker: 'Dodaj przystanek',
        editMode: 'Edytuj przystanki',
        dragMode: 'Przesuń przystanki',
        removalMode: 'Usuń przystanek'
      }
    });
    map.pm.setLang('custom');

    let currentMarkers = [];

    // Disable the default marker prompt
    map.pm.setGlobalOptions({
      markerEditable: false,
      templineStyle: {},
      hintlineStyle: {},
      snappable: false,
      snapDistance: 20,
      requireSnapToFinish: false,
    });

    map.on('pm:create', (e) => {
      if (e.layer instanceof L.Marker) {
        const marker = e.layer;
        const pt = marker.getLatLng();
        
        marker.setIcon(
          L.divIcon({
            className: 'stop-icon',
            html: '<div style="width:14px;height:14px;background:red;border-radius:50%;border:2px solid white;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
        );

        // Create stop with default values
        const stopData = {
          name: `P${currentMarkers.length + 1}`,
          stopTime: 0,
          passengersIn: 0,
          passengersOut: 0
        };
        marker.options.stopData = stopData;

        const createStopPopupContent = (props) => `
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
            <button id="save-stop-params" style="width: 100%; padding: 5px; margin-top: 5px;">Zapisz parametry</button>
            <button id="set-final" style="width: 100%; padding: 5px; margin-top: 5px;">Ustaw jako końcowy</button>
          </div>
        `;

        // Bind popup with form but don't open automatically
        marker.bindPopup(createStopPopupContent(stopData));

        // Add tooltip with initial name
        marker.bindTooltip(`<b>${stopData.name}</b>`);

        marker.on('popupopen', () => {
          setTimeout(() => {
            const saveBtn = document.getElementById('save-stop-params');
            const finalBtn = document.getElementById('set-final');
            if (!saveBtn || !finalBtn) return;

            saveBtn.onclick = () => {
              const name = document.getElementById('stop-name').value;
              const stopTime = parseInt(document.getElementById('stop-time').value) || 0;
              const passengersIn = parseInt(document.getElementById('passengers-in').value) || 0;
              const passengersOut = parseInt(document.getElementById('passengers-out').value) || 0;

              // Update stop data
              marker.options.stopData = {
                name,
                stopTime,
                passengersIn,
                passengersOut
              };

              // Update tooltip with full info after saving
              marker.bindTooltip(
                `<b>${name}</b><br/>` +
                `Postój: ${stopTime}s<br/>` +
                `Pasażerowie (+${passengersIn}/-${passengersOut})`
              );

              updateStops();
              map.closePopup();
            };

            finalBtn.onclick = () => {
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
              map.closePopup();
            };
          }, 50);
        });

        marker.on('move', () => updatePolyline());
        markerLayer.addLayer(marker);
        currentMarkers.push(marker);
        updatePolyline();
        updateStops();
      }
    });

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
