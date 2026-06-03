import React, { useState, useRef, useCallback } from 'react';

const PRESETS_KEY = 'mindent-vagy-semmit-presets';
const ACTIVE_PRESET_KEY = 'mindent-vagy-semmit-active-preset';

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || {}; } catch { return {}; }
}
function savePresets(presets) { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); }
function loadActivePresetName() { return localStorage.getItem(ACTIVE_PRESET_KEY) || ''; }
function saveActivePresetName(name) { localStorage.setItem(ACTIVE_PRESET_KEY, name); }

const TABS = [
  { id: 'general', label: '📋 General', icon: '📋' },
  { id: 'categories', label: '🏷 Categories', icon: '🏷' },
  { id: 'teams', label: '👥 Teams', icon: '👥' },
  { id: 'presets', label: '💾 Presets', icon: '💾' },
  { id: 'screens', label: '🖥 Screens', icon: '🖥' },
];

export default function Preferences({
  appTitle,
  categories,
  points,
  cards,
  teams,
  activeScreen,
  subScreen,
  onSave,
  onClose,
}) {
  const [tab, setTab] = useState('general');

  // ── General tab state ──
  const [title, setTitle] = useState(appTitle);

  // ── Categories tab state ──
  const [cats, setCats] = useState(categories.map(c => ({ ...c })));

  // ── Presets tab state ──
  const [presets, setPresets] = useState(loadPresets);
  const [activeName, setActiveName] = useState(loadActivePresetName);
  const [newName, setNewName] = useState('');
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);

  // ── Screens tab state ──
  const [screens, setScreens] = useState([]);
  const [screensLoading, setScreensLoading] = useState(true);
  const [localActive, setLocalActive] = useState(activeScreen);
  const [localSub, setLocalSub] = useState(subScreen);

  // ── Teams tab state ──
  const [localTeams, setLocalTeams] = useState(teams ? teams.map(t => ({ ...t })) : []);

  // Load screens on mount
  React.useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getScreens().then(d => {
        setScreens(d.length > 0 ? d : [
          { id: 0, index: 0, label: 'Primary Screen', isPrimary: true, size: '—' },
          { id: 1, index: 1, label: 'Secondary Screen', isPrimary: false, size: '—' },
        ]);
        setScreensLoading(false);
      }).catch(() => setScreensLoading(false));
    } else {
      setScreens([{ id: 0, index: 0, label: 'Primary Screen', isPrimary: true, size: '—' }]);
      setScreensLoading(false);
    }
  }, []);

  // ── Category helpers ──
  const handleCatChange = (idx, field, value) => {
    setCats(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  const handleCatAdd = () => {
    setCats(prev => [...prev, { id: `cat-${Date.now()}`, name: 'New Category', icon: '❓' }]);
  };
  const handleCatRemove = (idx) => {
    if (cats.length <= 1) return;
    setCats(prev => prev.filter((_, i) => i !== idx));
  };
  const handleCatMoveUp = (idx) => {
    if (idx === 0) return;
    setCats(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; });
  };
  const handleCatMoveDown = (idx) => {
    if (idx === cats.length - 1) return;
    setCats(prev => { const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; });
  };

  // ── Team helpers ──
  const handleTeamNameChange = (idx, name) => {
    setLocalTeams(prev => prev.map((t, i) => i === idx ? { ...t, name } : t));
  };
  const handleTeamMoveUp = (idx) => {
    if (idx === 0) return;
    setLocalTeams(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; });
  };
  const handleTeamMoveDown = (idx) => {
    if (idx === localTeams.length - 1) return;
    setLocalTeams(prev => { const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; });
  };

  // ── Preset helpers ──
  const cardsData = { cards, categories, points };
  const handlePresetSave = useCallback(() => {
    if (!activeName) { setSaveAsOpen(true); return; }
    setPresets(prev => ({ ...prev, [activeName]: cardsData }));
  }, [activeName, cardsData]);
  const handlePresetSaveAs = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setPresets(prev => ({ ...prev, [name]: cardsData }));
    setActiveName(name);
    saveActivePresetName(name);
    setNewName('');
    setSaveAsOpen(false);
  }, [newName, cardsData]);
  const handlePresetLoad = useCallback((name) => {
    const data = presets[name];
    if (!data) return;
    setActiveName(name);
    saveActivePresetName(name);
    onSave({ type: 'load-preset', data });
    onClose();
  }, [presets, onSave, onClose]);
  const handlePresetDelete = useCallback((name) => {
    setPresets(prev => { const n = { ...prev }; delete n[name]; return n; });
    if (activeName === name) { setActiveName(''); saveActivePresetName(''); }
    setConfirmDelete(null);
  }, [activeName]);
  const handlePresetExport = useCallback((name) => {
    const data = presets[name];
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const handlePresetExportAll = useCallback(() => {
    const names = Object.keys(presets);
    if (names.length === 0) return;
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `all-presets-${timestamp}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const handlePresetImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const firstValue = Object.values(data)[0];
        const isCollection = firstValue && typeof firstValue === 'object' && !firstValue.cards;
        
        if (!isCollection && data.cards) {
          const baseName = file.name.replace(/\.json$/i, '');
          let name = baseName; let i = 1;
          while (presets[name]) { name = `${baseName} (${i++})`; }
          setPresets(prev => ({ ...prev, [name]: data }));
          setActiveName(name);
          saveActivePresetName(name);
          onSave({ type: 'load-preset', data });
          onClose();
        } else if (typeof data === 'object' && Object.keys(data).length > 0) {
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
          alert(imported > 0 ? `Imported ${imported} preset(s).` : 'No valid presets found in file.');
        } else {
          alert('Invalid preset file.');
        }
      } catch { alert('Invalid preset file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [presets, onSave, onClose]);

  React.useEffect(() => { savePresets(presets); }, [presets]);

  // ── Save handler ──
  const handleApply = () => {
    // Remap cards for category changes
    const oldCount = categories.length;
    const newCount = cats.length;
    let newCards = [...cards];
    if (newCount !== oldCount) {
      newCards = [];
      for (let r = 0; r < points.length; r++) {
        for (let c = 0; c < newCount; c++) {
          if (c < oldCount) {
            const existing = cards.find(cd => cd.row === r && cd.col === c);
            newCards.push(existing || { row: r, col: c, label: String(points[r]), easyImage: '', hardImage: '', answer: '', easyAudio: '', hardAudio: '', enabled: true });
          } else {
            newCards.push({ row: r, col: c, label: String(points[r]), easyImage: '', hardImage: '', answer: '', easyAudio: '', hardAudio: '', enabled: true });
          }
        }
      }
    }
    onSave({
      type: 'apply-all',
      appTitle: title,
      categories: cats,
      cards: newCards,
      teams: localTeams,
      activeScreen: localActive,
      subScreen: localSub,
    });
    onClose();
  };

  const presetNames = Object.keys(presets).sort();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal prefs-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Preferences</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="prefs-layout">
          {/* ── Sidebar ── */}
          <nav className="prefs-sidebar">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`prefs-tab ${tab === t.id ? 'prefs-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="prefs-tab-icon">{t.icon}</span>
                <span className="prefs-tab-label">{t.label.replace(/^.\s/, '')}</span>
              </button>
            ))}
          </nav>

          {/* ── Content ── */}
          <div className="prefs-content">
            {/* GENERAL */}
            {tab === 'general' && (
              <div className="prefs-section">
                <h3>📋 General</h3>
                <label className="editor-field">
                  <span>App Title:</span>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Mindent vagy semmit!" />
                </label>
              </div>
            )}

            {/* CATEGORIES */}
            {tab === 'categories' && (
              <div className="prefs-section">
                <h3>🏷 Categories</h3>
                <p className="cat-editor-hint">Rename, reorder, add or remove columns. Grid adjusts automatically.</p>
                <div className="cat-editor-list">
                  {cats.map((cat, idx) => (
                    <div key={cat.id} className="cat-editor-row">
                      <div className="cat-editor-col-num">{idx + 1}</div>
                      <input className="cat-editor-input cat-editor-input--icon" type="text" value={cat.icon} onChange={e => handleCatChange(idx, 'icon', e.target.value)} placeholder="😀" maxLength={4} />
                      <input className="cat-editor-input cat-editor-input--name" type="text" value={cat.name} onChange={e => handleCatChange(idx, 'name', e.target.value)} placeholder="Category name" />
                      <div className="cat-editor-actions">
                        <button className="cat-editor-btn" onClick={() => handleCatMoveUp(idx)} disabled={idx === 0}>▲</button>
                        <button className="cat-editor-btn" onClick={() => handleCatMoveDown(idx)} disabled={idx === cats.length - 1}>▼</button>
                        <button className="cat-editor-btn cat-editor-btn--remove" onClick={() => handleCatRemove(idx)} disabled={cats.length <= 1}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn--secondary btn--sm cat-editor-add" onClick={handleCatAdd}>＋ Add Column</button>
              </div>
            )}

            {/* TEAMS */}
            {tab === 'teams' && (
              <div className="prefs-section">
                <h3>👥 Teams</h3>
                <p className="cat-editor-hint">Rename and reorder teams. Team scores are preserved when reordering.</p>
                <div className="cat-editor-list">
                  {localTeams.map((team, idx) => (
                    <div key={team.id} className="cat-editor-row">
                      <div className="cat-editor-col-num">{idx + 1}</div>
                      <input
                        className="cat-editor-input cat-editor-input--name"
                        type="text"
                        value={team.name}
                        onChange={e => handleTeamNameChange(idx, e.target.value)}
                        placeholder="Team name"
                      />
                      <div className="cat-editor-actions">
                        <button className="cat-editor-btn" onClick={() => handleTeamMoveUp(idx)} disabled={idx === 0}>▲</button>
                        <button className="cat-editor-btn" onClick={() => handleTeamMoveDown(idx)} disabled={idx === localTeams.length - 1}>▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRESETS */}
            {tab === 'presets' && (
              <div className="prefs-section">
                <h3>💾 Presets</h3>
                <div className="preset-current">
                  <span className="preset-label">Current:</span>
                  <strong>{activeName || '(unsaved)'}</strong>
                  <div className="preset-current-actions">
                    <button className="btn btn--primary btn--sm" onClick={handlePresetSave}>💾 {activeName ? 'Save' : 'Save As…'}</button>
                    <button className="btn btn--secondary btn--sm" onClick={() => setSaveAsOpen(true)}>📋 Save As…</button>
                    <button className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>📥 Import</button>
                    <button className="btn btn--secondary btn--sm" onClick={handlePresetExportAll} title="Export all presets as one file">📤 Export All</button>
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handlePresetImport} />
                  </div>
                </div>
                {saveAsOpen && (
                  <div className="preset-saveas">
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Preset name…" onKeyDown={e => e.key === 'Enter' && handlePresetSaveAs()} />
                    <button className="btn btn--primary btn--sm" onClick={handlePresetSaveAs}>Save</button>
                    <button className="btn btn--secondary btn--sm" onClick={() => setSaveAsOpen(false)}>Cancel</button>
                  </div>
                )}
                {presetNames.length > 0 && (
                  <div className="preset-list">
                    {presetNames.map(name => (
                      <div key={name} className={`preset-item ${name === activeName ? 'preset-item--active' : ''}`}>
                        <span className="preset-item-name" onClick={() => handlePresetLoad(name)}>{name}</span>
                        <div className="preset-item-actions">
                          <button className="btn btn--secondary btn--sm" onClick={() => handlePresetExport(name)}>📤</button>
                          <button className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(name)}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {confirmDelete && (
                  <div className="preset-confirm">
                    <p>Delete "{confirmDelete}"?</p>
                    <button className="btn btn--danger btn--sm" onClick={() => handlePresetDelete(confirmDelete)}>Delete</button>
                    <button className="btn btn--secondary btn--sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* SCREENS */}
            {tab === 'screens' && (
              <div className="prefs-section">
                <h3>🖥 Screens</h3>
                {screensLoading && <div className="screen-loading">Detecting screens…</div>}
                {!screensLoading && (
                  <>
                    <div className="screen-section">
                      <h4>🎮 Main Board</h4>
                      <p className="screen-hint">Where the 7×7 game grid appears</p>
                      <div className="screen-list">
                        {screens.map(s => (
                          <button key={s.id} className={`screen-btn ${localActive === s.id ? 'screen-btn--active' : ''}`} onClick={() => setLocalActive(s.id)}>
                            <span className="screen-btn-icon">{localActive === s.id ? '✅' : '🖥️'}</span>
                            <div className="screen-btn-info">
                              <span className="screen-btn-label">{s.label}</span>
                              <span className="screen-btn-size">{s.size}</span>
                            </div>
                            {s.isPrimary && <span className="screen-badge">Primary</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="screen-section">
                      <h4>🖥️ Dev Screen</h4>
                      <p className="screen-hint">Operator dashboard (second monitor)</p>
                      <div className="screen-list">
                        {screens.map(s => (
                          <button key={s.id} className={`screen-btn ${localSub === s.id ? 'screen-btn--active' : ''}`} onClick={() => setLocalSub(s.id)}>
                            <span className="screen-btn-icon">{localSub === s.id ? '✅' : '🖥️'}</span>
                            <div className="screen-btn-info">
                              <span className="screen-btn-label">{s.label}</span>
                              <span className="screen-btn-size">{s.size}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleApply}>💾 Apply</button>
        </div>
      </div>
    </div>
  );
}
