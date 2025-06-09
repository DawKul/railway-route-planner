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
    const isReversed = useRef(false);
    const stopTimeAccumulator = useRef(0);
    const currentStopTime = useRef(0);
    const simulationStartTime = useRef(0);
    const totalSimulationTime = useRef(0);
    const totalStopTime = useRef(0);

    const stopCoords = (stops || []).map(s =>
        JSON.stringify([s.geometry.coordinates[1], s.geometry.coordinates[0]])
    );

    // Reset position and time when resetSignal changes
    useEffect(() => {
        currentStep.current = 0;
        progressRef.current = 0;
        currentPositionRef.current = null;
        isReversed.current = false;
        simulationStartTime.current = 0;
        totalSimulationTime.current = 0;
        totalStopTime.current = 0;
        if (markerRef.current && polylineCoords?.length > 0) {
            const [lat, lng] = polylineCoords[0];
            markerRef.current.setLatLng([lat, lng]);
            markerRef.current.setRotationAngle(0);
        }
    }, [resetSignal]);

    // Initialize or clean up train marker
    useEffect(() => {
        if (!map || !polylineCoords || polylineCoords.length === 0) return;

        const initialPosition = currentPositionRef.current || polylineCoords[0];

        // Only create marker if we're running or have a saved position
        if (run || currentPositionRef.current) {
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
            }

            const icon = L.divIcon({
                html: `<img src="${trainType === 'cargo' ? '/train.png' : '/train2.png'}" style="width: 40px; height: 40px; transform: ${isReversed.current ? 'scaleX(-1)' : 'none'}">`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                className: 'train-icon'
            });

            markerRef.current = L.marker(initialPosition, {
                icon,
                rotationAngle: calculateAngle(polylineCoords[0], polylineCoords[1]),
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

        const animate = (timestamp) => {
            if (!markerRef.current) {
                currentPositionRef.current = null;
                return;
            }

            // Initialize start time if not set
            if (!simulationStartTime.current) {
                simulationStartTime.current = timestamp;
            }

            if (!lastTime.current) lastTime.current = timestamp;
            const delta = timestamp - lastTime.current;
            lastTime.current = timestamp;

            // Update total simulation time
            const deltaSeconds = (delta / 1000) * speedMultiplier;
            if (isStopped.current) {
                totalStopTime.current += deltaSeconds;
            }
            totalSimulationTime.current = ((timestamp - simulationStartTime.current) * speedMultiplier / 1000) + totalStopTime.current;

            const currentIndex = currentStep.current;
            const nextIndex = isReversed.current 
                ? currentIndex - 1 
                : currentIndex + 1;

            // Check if we need to reverse direction at the end of the route
            if (nextIndex < 0) {
                isReversed.current = false;
                currentStep.current = 0;
                progressRef.current = 0;
                animationRef.current = requestAnimationFrame(animate);
                return;
            } else if (nextIndex >= polylineCoords.length) {
                isReversed.current = true;
                currentStep.current = polylineCoords.length - 1;
                progressRef.current = 0;
                animationRef.current = requestAnimationFrame(animate);
                return;
            }

            const currentPos = polylineCoords[currentIndex];
            const nextPos = polylineCoords[nextIndex];
            const currentLatLng = L.latLng(currentPos);
            const nextLatLng = L.latLng(nextPos);
            
            const distance = currentLatLng.distanceTo(nextLatLng); // in meters
            
            // Calculate effective speed using the same formula as in calculateTravelTime
            const slopeMod = 1 - Math.abs(routeParams?.slope || 0) * 0.02;
            const overloadMod = routeParams?.actualWagons > routeParams?.maxWagons 
                ? 1 - 0.05 * (routeParams.actualWagons - routeParams.maxWagons) 
                : 1;
            const effectiveSpeed = 60 * slopeMod * overloadMod; // km/h
            const speedMetersPerSecond = (effectiveSpeed * 1000) / 3600; // Convert to m/s without multiplier
            
            // Calculate time required for this segment at normal speed
            const timeRequired = distance / speedMetersPerSecond; // in seconds

            if (!isStopped.current) {
                // Progress should be proportional to real time * speedMultiplier
                progressRef.current += (delta / 1000) * speedMultiplier / timeRequired;
            } else {
                // Handle station stop time
                stopTimeAccumulator.current += (delta / 1000) * speedMultiplier;
                if (stopTimeAccumulator.current >= currentStopTime.current) {
                    isStopped.current = false;
                    stopTimeAccumulator.current = 0;
                    currentStopTime.current = 0;
                    if (markerRef.current) {
                        markerRef.current.closePopup();
                    }
                }
            }

            if (progressRef.current >= 1) {
                currentStep.current = nextIndex;
                progressRef.current = 0;
                
                const nextCoordKey = JSON.stringify([nextPos[0], nextPos[1]]);
                const stopIndex = stopCoords.indexOf(nextCoordKey);
                
                if (stopIndex !== -1) {
                    isStopped.current = true;
                    const stop = stops[stopIndex];
                    const stopTime = stop.properties?.stopTime ?? 0;
                    currentStopTime.current = stopTime;
                    stopTimeAccumulator.current = 0;
                    
                    if (markerRef.current) {
                        markerRef.current.bindPopup(
                            `<b>${stop.properties?.name}</b><br/>` +
                            `Postój: ${stopTime}s<br/>` +
                            `Pasażerowie: +${stop.properties?.passengersIn || 0}/-${stop.properties?.passengersOut || 0}<br/>` +
                            `Czas symulacji: ${Math.floor(totalSimulationTime.current)}s<br/>` +
                            `Czas postojów: ${Math.floor(totalStopTime.current)}s`
                        ).openPopup();
                        currentPositionRef.current = markerRef.current.getLatLng();

                        if (stop.properties?.isTerminal) {
                            isReversed.current = !isReversed.current;
                            const icon = L.divIcon({
                                html: `<img src="${trainType === 'cargo' ? '/train.png' : '/train2.png'}" style="width: 40px; height: 40px; transform: ${isReversed.current ? 'scaleX(-1)' : 'none'}">`,
                                iconSize: [40, 40],
                                iconAnchor: [20, 20],
                                className: 'train-icon'
                            });
                            markerRef.current.setIcon(icon);
                        }
                    }
                }
            }

            // Interpolate position
            const progress = progressRef.current;
            const lat = currentPos[0] + (nextPos[0] - currentPos[0]) * progress;
            const lng = currentPos[1] + (nextPos[1] - currentPos[1]) * progress;
            
            // Calculate angle between current and next point
            const angle = calculateAngle(currentPos, nextPos);
            const finalAngle = isReversed.current ? (angle + 180) % 360 : angle;

            // Update marker position and rotation
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
                markerRef.current.setRotationAngle(finalAngle);
                currentPositionRef.current = [lat, lng];
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
    const [lat1, lng1] = point1;
    const [lat2, lng2] = point2;
    
    // Calculate angle in radians using atan2
    const angleRadians = Math.atan2(lng2 - lng1, lat2 - lat1);
    
    // Convert to degrees and normalize to 0-360 range
    let angleDegrees = (angleRadians * 180) / Math.PI;
    angleDegrees = (angleDegrees + 360) % 360;
    
    // Adjust angle to match the train's orientation and flip it 180 degrees
    angleDegrees = (angleDegrees + 270) % 360;
    
    return angleDegrees;
}
