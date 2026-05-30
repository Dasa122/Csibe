import React, { useState, useEffect, useCallback } from 'react';

export default function ScreenSelector({
  activeScreen,
  subScreen,
  onActiveScreenChange,
  onSubScreenChange,
  onClose,
}) {
  const [screens, setScreens] = useState([]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getScreens().then(setScreens).catch(() => {
        // Fallback: assume 2 screens
        setScreens([
          { id: 0, label: 'Screen 1', isPrimary: true },
          { id: 1, label: 'Screen 2', isPrimary: false },
        ]);
      });
    } else {
      // Browser fallback
      setScreens([
        { id: 0, label: 'Primary Screen', isPrimary: true },
        { id: 1, label: 'Secondary Screen', isPrimary: false },
      ]);
    }
  }, []);

  const handleSetActive = useCallback((id) => {
    onActiveScreenChange(id);
    if (window.electronAPI) {
      window.electronAPI.moveMainWindow(id);
    }
  }, [onActiveScreenChange]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal screen-selector" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🖥 Screen Setup</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="screen-section">
            <h3>Main Board Screen</h3>
            <p className="screen-hint">Where the game grid appears</p>
            <div className="screen-list">
              {screens.map(s => (
                <button
                  key={s.id}
                  className={`screen-btn ${activeScreen === s.id ? 'screen-btn--active' : ''}`}
                  onClick={() => handleSetActive(s.id)}
                >
                  <span className="screen-btn-icon">
                    {activeScreen === s.id ? '✅' : '🖥️'}
                  </span>
                  <span>{s.label}</span>
                  {s.isPrimary && <span className="screen-badge">Primary</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="screen-section">
            <h3>Sub-page Output Screen</h3>
            <p className="screen-hint">Where images/answers appear when a card is opened</p>
            <div className="screen-list">
              {screens.map(s => (
                <button
                  key={s.id}
                  className={`screen-btn ${subScreen === s.id ? 'screen-btn--active' : ''}`}
                  onClick={() => onSubScreenChange(s.id)}
                >
                  <span className="screen-btn-icon">
                    {subScreen === s.id ? '✅' : '📺'}
                  </span>
                  <span>{s.label}</span>
                  {s.isPrimary && <span className="screen-badge">Primary</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
