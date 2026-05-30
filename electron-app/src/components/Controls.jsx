import React from 'react';

export default function Controls({
  onReset,
  onScreenSelect,
  onPresets,
  onSetupMode,
  setupMode,
  onToggleDevScreen,
  devScreenOpen,
  onEditCategories,
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
        onClick={onReset}
        title="Reset all cards"
      >
        🔄 Reset
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
        onClick={onEditCategories}
        title="Edit categories: rename, reorder, add/remove columns"
      >
        🏷 Categories
      </button>

      <button
        className={`controls-btn ${devScreenOpen ? 'controls-btn--active' : ''}`}
        onClick={onToggleDevScreen}
        title="Toggle dev/operator screen on second monitor"
      >
        📺 Dev Screen
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
