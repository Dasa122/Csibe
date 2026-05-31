import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS_KEY = 'mindent-vagy-semmit-presets';
const ACTIVE_PRESET_KEY = 'mindent-vagy-semmit-active-preset';

function loadPresets() {
  try {
    const saved = localStorage.getItem(PRESETS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function loadActivePresetName() {
  return localStorage.getItem(ACTIVE_PRESET_KEY) || '';
}

function saveActivePresetName(name) {
  localStorage.setItem(ACTIVE_PRESET_KEY, name);
}

export default function PresetManager({
  cardsData,
  onLoad,
  onClose,
}) {
  const [presets, setPresets] = useState(loadPresets);
  const [activeName, setActiveName] = useState(loadActivePresetName);
  const [newName, setNewName] = useState('');
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const handleSave = useCallback(() => {
    if (!activeName) { setSaveAsOpen(true); return; }
    setPresets(prev => ({ ...prev, [activeName]: cardsData }));
  }, [activeName, cardsData]);

  const handleSaveAs = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setPresets(prev => ({ ...prev, [name]: cardsData }));
    setActiveName(name);
    saveActivePresetName(name);
    setNewName('');
    setSaveAsOpen(false);
  }, [newName, cardsData]);

  const handleLoad = useCallback((name) => {
    const data = presets[name];
    if (!data) return;
    setActiveName(name);
    saveActivePresetName(name);
    onLoad(data);
    onClose();
  }, [presets, onLoad, onClose]);

  const handleDelete = useCallback((name) => {
    setPresets(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (activeName === name) {
      setActiveName('');
      saveActivePresetName('');
    }
    setConfirmDelete(null);
  }, [activeName]);

  const handleExport = useCallback((name) => {
    const data = presets[name];
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const handleExportAll = useCallback(() => {
    const names = Object.keys(presets);
    if (names.length === 0) return;
    // Export as a single JSON object: { presetName: presetData, ... }
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `all-presets-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Detect: if first value is an object with "cards" key, it's a single preset
        const firstValue = Object.values(data)[0];
        const isCollection = firstValue && typeof firstValue === 'object' && !firstValue.cards;
        
        if (!isCollection && data.cards) {
          // Single preset file — import as one preset
          const baseName = file.name.replace(/\.json$/i, '');
          let name = baseName;
          let i = 1;
          while (presets[name]) { name = `${baseName} (${i++})`; }
          setPresets(prev => ({ ...prev, [name]: data }));
          setActiveName(name);
          saveActivePresetName(name);
          onLoad(data);
          onClose();
        } else if (typeof data === 'object' && Object.keys(data).length > 0) {
          // Multi-preset collection — merge all
          let imported = 0;
          setPresets(prev => {
            const next = { ...prev };
            for (const [key, val] of Object.entries(data)) {
              if (val && typeof val === 'object' && val.cards) {
                let name = key;
                let j = 1;
                while (next[name]) { name = `${key} (${j++})`; }
                next[name] = val;
                imported++;
              }
            }
            return next;
          });
          if (imported > 0) {
            alert(`Imported ${imported} preset(s).`);
          } else {
            alert('No valid presets found in file.');
          }
        } else {
          alert('Invalid preset file.');
        }
      } catch (err) {
        alert('Invalid preset file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [presets, onLoad, onClose]);

  const presetNames = Object.keys(presets).sort();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal preset-manager" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💾 Presets</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Current preset + quick save */}
          <div className="preset-current">
            <span className="preset-label">Current:</span>
            <strong>{activeName || '(unsaved)'}</strong>
            <div className="preset-current-actions">
              <button className="btn btn--primary btn--sm" onClick={handleSave}>
                💾 {activeName ? 'Save' : 'Save As…'}
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => setSaveAsOpen(true)}>
                📋 Save As…
              </button>
              <button className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>
                📥 Import
              </button>
              <button className="btn btn--secondary btn--sm" onClick={handleExportAll} title="Export all presets as one file">
                📤 Export All
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </div>
          </div>

          {/* Save As inline */}
          {saveAsOpen && (
            <div className="preset-saveas">
              <input
                className="preset-saveas-input"
                type="text"
                placeholder="Preset name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveAs()}
                autoFocus
              />
              <button className="btn btn--primary btn--sm" onClick={handleSaveAs}>Save</button>
              <button className="btn btn--secondary btn--sm" onClick={() => { setSaveAsOpen(false); setNewName(''); }}>Cancel</button>
            </div>
          )}

          {/* Preset list */}
          {presetNames.length === 0 ? (
            <p className="preset-empty">No presets saved yet. Edit your cards and hit <strong>Save As…</strong></p>
          ) : (
            <div className="preset-list">
              {presetNames.map(name => (
                <div
                  key={name}
                  className={`preset-item ${name === activeName ? 'preset-item--active' : ''}`}
                >
                  <div className="preset-item-info" onClick={() => handleLoad(name)} title="Click to load">
                    <span className="preset-item-icon">📦</span>
                    <span className="preset-item-name">{name}</span>
                    {name === activeName && <span className="preset-badge">active</span>}
                  </div>
                  <div className="preset-item-actions">
                    <button
                      className="preset-item-btn"
                      title="Export"
                      onClick={(e) => { e.stopPropagation(); handleExport(name); }}
                    >
                      📤
                    </button>
                    <button
                      className="preset-item-btn preset-item-btn--danger"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(name); }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Confirm delete */}
          {confirmDelete && (
            <div className="preset-confirm">
              <span>Delete <strong>"{confirmDelete}"</strong>?</span>
              <button className="btn btn--danger btn--sm" onClick={() => handleDelete(confirmDelete)}>Delete</button>
              <button className="btn btn--secondary btn--sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
