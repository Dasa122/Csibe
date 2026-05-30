import React, { useState, useEffect, useCallback } from 'react';

const FALLBACK_SCREENS = [
  { id: 0, index: 0, label: 'Primary Screen', isPrimary: true, size: '—' },
  { id: 1, index: 1, label: 'Secondary Screen', isPrimary: false, size: '—' },
];

export default function ScreenSelector({
  activeScreen,
  subScreen,
  onActiveScreenChange,
  onSubScreenChange,
  onClose,
}) {
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScreens() {
      setLoading(true);
      try {
        if (window.electronAPI) {
          const result = await window.electronAPI.getScreens();
          if (!cancelled) {
            setScreens(result.length > 0 ? result : FALLBACK_SCREENS);
            setError(null);
          }
        } else {
          // Browser fallback: show generic screens
          if (!cancelled) setScreens(FALLBACK_SCREENS);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to get screens:', err);
          setScreens(FALLBACK_SCREENS);
          setError('Could not detect screens. Using defaults.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchScreens();
    return () => { cancelled = true; };
  }, []);

  const handleSetActive = useCallback(async (displayId) => {
    onActiveScreenChange(displayId);
    if (window.electronAPI) {
      try {
        await window.electronAPI.moveMainWindow(displayId);
      } catch (err) {
        console.error('Failed to move window:', err);
      }
    }
  }, [onActiveScreenChange]);

  const isSelected = (displayId, mode) => {
    return mode === 'active' ? activeScreen === displayId : subScreen === displayId;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal screen-selector" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🖥 Screen Setup</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="screen-loading">Detecting screens…</div>
          )}
          {error && <div className="screen-error">{error}</div>}

          {!loading && (
            <>
              {/* Main Board Screen */}
              <div className="screen-section">
                <h3>🎮 Main Board Screen</h3>
                <p className="screen-hint">Where the 7×7 game grid appears</p>
                <div className="screen-list">
                  {screens.map(s => (
                    <button
                      key={s.id}
                      className={`screen-btn ${isSelected(s.id, 'active') ? 'screen-btn--active' : ''}`}
                      onClick={() => handleSetActive(s.id)}
                    >
                      <span className="screen-btn-icon">
                        {isSelected(s.id, 'active') ? '✅' : '🖥️'}
                      </span>
                      <div className="screen-btn-info">
                        <span className="screen-btn-label">{s.label}</span>
                        <span className="screen-btn-size">{s.size}</span>
                      </div>
                      {s.isPrimary && <span className="screen-badge">Primary</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dev Screen (second monitor output) */}
              <div className="screen-section">
                <h3>📺 Dev Screen Output</h3>
                <p className="screen-hint">Images, answers &amp; audio appear here — open with double-click or 🖥️ button</p>
                <div className="screen-list">
                  {screens.map(s => (
                    <button
                      key={s.id}
                      className={`screen-btn ${isSelected(s.id, 'sub') ? 'screen-btn--active' : ''}`}
                      onClick={() => onSubScreenChange(s.id)}
                    >
                      <span className="screen-btn-icon">
                        {isSelected(s.id, 'sub') ? '✅' : '📺'}
                      </span>
                      <div className="screen-btn-info">
                        <span className="screen-btn-label">{s.label}</span>
                        <span className="screen-btn-size">{s.size}</span>
                      </div>
                      {s.isPrimary && <span className="screen-badge">Primary</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick tips */}
              <div className="screen-tips">
                <p>💡 <strong>Tip:</strong> Double-click any card or use its 🖥️ button to send content to the dev screen.</p>
                <p>💡 <strong>Tip:</strong> Click on the dev screen to reveal/hide the answer.</p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
