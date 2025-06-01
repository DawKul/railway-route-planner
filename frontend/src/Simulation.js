import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-rotatedmarker';

export default function Simulation({ 
    polylineCoords, 
    stops, 
    run, 
    paused, 
    trainType, 
    routeParams, 
    resetSignal,
    speedMultiplier = 1 
}) {
    const map = useMap();
    const markerRef = useRef(null);
    const animationRef = useRef(null);
    const currentStep = useRef(0);
    const isStopped = useRef(false);
    const lastTime = useRef(0);
    const progressRef = useRef(0);
    const currentPositionRef = useRef(null);

    const stopCoords = (stops || []).map(s =>
        JSON.stringify([s.geometry.coordinates[1], s.geometry.coordinates[0]])
    );

    // Reset position when resetSignal changes
    useEffect(() => {
        currentStep.current = 0;
        progressRef.current = 0;
        currentPositionRef.current = null;
        if (markerRef.current && polylineCoords?.length > 0) {
            const [lat, lng] = polylineCoords[0];
            markerRef.current.setLatLng([lat, lng]);
        }
    }, [resetSignal]);

    // Initialize or clean up train marker
    useEffect(() => {
        if (!map || !polylineCoords || polylineCoords.length === 0) return;

        const initialPosition = currentPositionRef.current || polylineCoords[0];
        const icon = new L.Icon({
            iconUrl: trainType === 'cargo' ? '/train.png' : '/train2.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            className: 'train-icon'
        });

        // Only create marker if we're running or have a saved position
        if (run || currentPositionRef.current) {
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
            }

            markerRef.current = L.marker(initialPosition, {
                icon,
                rotationAngle: 0,
                rotationOrigin: 'center center'
            }).addTo(map);
        }

        return () => {
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [map, polylineCoords, run]);

    // Animation logic
    useEffect(() => {
        if (!run || !polylineCoords || polylineCoords.length === 0) return;
        if (paused) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            // Save current position when paused
            if (markerRef.current) {
                currentPositionRef.current = markerRef.current.getLatLng();
            }
            return;
        }

        const baseSpeed = routeParams?.effectiveSpeed || 60; // km/h
        const speedMetersPerSecond = (baseSpeed * 1000 * speedMultiplier) / 3600; // Convert to m/s

        const animate = (timestamp) => {
            if (!markerRef.current || currentStep.current >= polylineCoords.length - 1) {
                if (markerRef.current) {
                    currentPositionRef.current = null;
                    map.removeLayer(markerRef.current);
                    markerRef.current = null;
                }
                return;
            }

            if (!lastTime.current) lastTime.current = timestamp;
            const delta = timestamp - lastTime.current;
            lastTime.current = timestamp;

            const currentPos = polylineCoords[currentStep.current];
            const nextPos = polylineCoords[currentStep.current + 1];
            const currentLatLng = L.latLng(currentPos);
            const nextLatLng = L.latLng(nextPos);
            
            const distance = currentLatLng.distanceTo(nextLatLng);
            const timeRequired = (distance / speedMetersPerSecond) * 1000;

            if (!isStopped.current) {
                progressRef.current += delta / timeRequired;
            }

            if (progressRef.current >= 1) {
                currentStep.current++;
                progressRef.current = 0;
                
                const nextCoordKey = JSON.stringify([nextPos[0], nextPos[1]]);
                const stopIndex = stopCoords.indexOf(nextCoordKey);
                
                if (stopIndex !== -1) {
                    isStopped.current = true;
                    const stopTime = stops[stopIndex].properties?.stopTime ?? 0;
                    
                    if (markerRef.current) {
                        const stop = stops[stopIndex];
                        markerRef.current.bindPopup(
                            `<b>${stop.properties?.name}</b><br/>` +
                            `Postój: ${stopTime}s<br/>` +
                            `Pasażerowie: +${stop.properties?.passengersIn || 0}/-${stop.properties?.passengersOut || 0}`
                        ).openPopup();
                        currentPositionRef.current = markerRef.current.getLatLng();
                    }

                    setTimeout(() => {
                        isStopped.current = false;
                        if (markerRef.current) {
                            markerRef.current.closePopup();
                        }
                        animationRef.current = requestAnimationFrame(animate);
                    }, stopTime * 1000 / speedMultiplier);
                    return;
                }
            } else if (currentStep.current < polylineCoords.length - 1) {
                const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * progressRef.current;
                const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * progressRef.current;
                markerRef.current.setLatLng([lat, lng]);
                currentPositionRef.current = [lat, lng];

                const angle = calculateAngle(currentPos, nextPos);
                markerRef.current.setRotationAngle(angle);
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        lastTime.current = 0;
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [map, run, paused, polylineCoords, stops, routeParams, speedMultiplier, stopCoords]);

    return null;
}

function calculateAngle(point1, point2) {
    const deltaY = point2[0] - point1[0];
    const deltaX = point2[1] - point1[1];
    const angleRadians = Math.atan2(deltaY, deltaX);
    return (angleRadians * 180) / Math.PI;
}
