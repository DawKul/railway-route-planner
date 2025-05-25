
import React, { useState } from 'react';
import ReactDOM from 'react-dom';

export default function RouteFormPopup({ coords, onSave, onClose }) {
  const [wagons, setWagons] = useState(10);
  const [used, setUsed] = useState(5);
  const [slope, setSlope] = useState(5);
  const [tracks, setTracks] = useState(1);
  const [split, setSplit] = useState(false);

  const calcTime = () => {
    const dist = calculateDistanceKm(coords);
    const baseSpeed = 60;
    const weightPenalty = used * 0.2;
    const slopePenalty = slope * 0.1;
    const speed = Math.max(10, baseSpeed - weightPenalty - slopePenalty);
    return Math.round((dist / speed) * 3600);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const time = calcTime();
    onSave({ wagons, used, slope, tracks, split, time });
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="popup-overlay">
      <div className="popup-content">
        <h3>Edycja trasy</h3>
        <form onSubmit={handleSubmit}>
          <label>Maks. wagony: <input type="number" value={wagons} onChange={(e) => setWagons(+e.target.value)} /></label><br />
          <label>Używane wagony: <input type="number" value={used} onChange={(e) => setUsed(+e.target.value)} /></label><br />
          <label>Nachylenie (‰): <input type="number" value={slope} onChange={(e) => setSlope(+e.target.value)} /></label><br />
          <label>Liczba torów:
            <select value={tracks} onChange={(e) => setTracks(+e.target.value)}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label><br />
          {tracks === 2 && (
            <label><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Rozdziel tory</label>
          )}<br />
          <button type="submit">Zapisz</button>
          <button type="button" onClick={onClose} style={{ marginLeft: '0.5rem' }}>Anuluj</button>
        </form>
      </div>
    </div>,
    document.body
  );
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
