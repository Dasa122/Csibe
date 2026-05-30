import React from 'react';

export default function Controls({
  undoStack,
  onUndo,
  onReset,
  onToggleEditButtons,
  showEditButtons,
  onScreenSelect,
  onPresets,
  onSetupMode,
  setupMode,
  activePresetName,
  lastClicked,
}) {
  return (
    <div className="controls">
      <span className="controls-last-clicked" title="Last clicked card">
        <strong>Last:</strong> {lastClicked}
      </span>

      <button
        className="controls-btn"
        onClick={onUndo}
        disabled={undoStack.length === 0}
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>

      <button
        className="controls-btn"
        onClick={onReset}
        title="Reset all cards"
      >
        🔄 Reset
      </button>

      <button
        className={`controls-btn ${showEditButtons ? 'controls-btn--active' : ''}`}
        onClick={onToggleEditButtons}
        title="Toggle edit buttons on cards"
      >
        {showEditButtons ? '👁 Hide Edit' : '✏️ Edit Cards'}
      </button>

      <button
        className={`controls-btn ${setupMode ? 'controls-btn--active' : ''}`}
        onClick={onSetupMode}
        title="Setup mode: edit all cards inline, rename categories"
      >
        ⚙️ Setup
      </button>

      <button
        className="controls-btn"
        onClick={onPresets}
        title="Save / Load / Export presets"
      >
        💾 {activePresetName || 'Presets'}
      </button>

      <button
        className="controls-btn"
        onClick={onScreenSelect}
        title="Select output screen (Ctrl+S)"
      >
        🖥 Screens
      </button>
    </div>
  );
}
