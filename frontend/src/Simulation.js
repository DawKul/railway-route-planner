
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function Simulation({ polylineCoords, stops, run, paused, trainType, routeParams, resetSignal }) {
    const map = useMap();
    const markerRef = useRef(null);
    const animationRef = useRef(null);
    const currentStep = useRef(0);
    const isStopped = useRef(false);

    const stopCoords = (stops || []).map(s =>
        JSON.stringify([s.geometry.coordinates[1], s.geometry.coordinates[0]])
    );

    // reset pozycji po zmianie resetSignal
    useEffect(() => {
        currentStep.current = 0;
    }, [resetSignal]);

    useEffect(() => {
        if (!map || !polylineCoords || polylineCoords.length === 0) return;

        const [lat, lng] = polylineCoords[0];
        const icon = new L.Icon({
            iconUrl: '/train.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });

        if (markerRef.current) {
            map.removeLayer(markerRef.current);
        }

        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);

        return () => {
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
            }
            cancelAnimationFrame(animationRef.current);
        };
    }, [map, polylineCoords]);

    useEffect(() => {
        if (!run || paused || !polylineCoords || polylineCoords.length === 0) return;

        const animate = () => {
            if (!markerRef.current || currentStep.current >= polylineCoords.length) return;

            const [lat, lng] = polylineCoords[currentStep.current];
            const currentCoordKey = JSON.stringify([lat, lng]);

            markerRef.current.setLatLng([lat, lng]);

            const stopIndex = stopCoords.indexOf(currentCoordKey);
            if (stopIndex !== -1 && !isStopped.current) {
                isStopped.current = true;
                const stopTime = stops[stopIndex].properties?.stopTime ?? 0;

                setTimeout(() => {
                    isStopped.current = false;
                    currentStep.current += 1;
                    animationRef.current = requestAnimationFrame(animate);
                }, stopTime * 1000);
                return;
            }

            currentStep.current += 1;
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationRef.current);
    }, [run, paused, polylineCoords, stops]);

    return null;
}
