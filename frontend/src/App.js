import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import AuthForm from './AuthForm';

const MapWithDrawing = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.pm.addControls({
      position: "topright",
      drawCircle: false,
    });

    map.on("pm:create", (e) => {
      console.log("Nowa trasa:", e.layer.toGeoJSON());
    });
  }, [map]);

  return null;
};

function App() {
  return (
    <div className="App" style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapContainer
        center={[49.6218, 20.6972]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapWithDrawing />
      </MapContainer>

      {/* Okno logowania/profilu – unosi sie nad mapa */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        zIndex: 1000
      }}>
        <AuthForm />
      </div>
    </div>
  );
}

export default App;
