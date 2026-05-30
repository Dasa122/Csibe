import React, { memo, useState, useCallback } from 'react';

const Card = memo(function Card({
  card,
  row,
  col,
  category,
  isSelected,
  showButtons,
  setupMode,
  onCardChange,
  onClick,
  onDoubleClick,
  onContextMenu,
  onEdit,
  onOpenOther,
}) {
  const [ripple, setRipple] = useState(null);

  const handleClick = useCallback((e) => {
    if (setupMode) return; // no ripple/select in setup mode
    if (!card.enabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    setRipple({ x: x - size / 2, y: y - size / 2, size });
    setTimeout(() => setRipple(null), 700);

    onClick();
  }, [card.enabled, onClick, setupMode]);

  const handleFieldChange = useCallback((field, value) => {
    onCardChange?.({ ...card, [field]: value });
  }, [card, onCardChange]);

  const classNames = [
    'card',
    !card.enabled && 'card--disabled',
    isSelected && 'card--selected',
    card.image && 'card--has-image',
    setupMode && 'card--setup',
  ].filter(Boolean).join(' ');

  // ---- SETUP MODE: inline form ----
  if (setupMode) {
    return (
      <div className={classNames} role="gridcell">
        <div className="card-setup-form">
          <input
            className="card-setup-input card-setup-input--label"
            type="text"
            value={card.label}
            onChange={e => handleFieldChange('label', e.target.value)}
            placeholder="Label"
            onClick={e => e.stopPropagation()}
          />
          <input
            className="card-setup-input card-setup-input--image"
            type="text"
            value={card.image || ''}
            onChange={e => handleFieldChange('image', e.target.value)}
            placeholder="Image path"
            onClick={e => e.stopPropagation()}
          />
          <textarea
            className="card-setup-input card-setup-input--answer"
            value={card.answer || ''}
            onChange={e => handleFieldChange('answer', e.target.value)}
            placeholder="Answer text"
            rows={2}
            onClick={e => e.stopPropagation()}
          />
          <input
            className="card-setup-input card-setup-input--audio"
            type="text"
            value={card.audio || ''}
            onChange={e => handleFieldChange('audio', e.target.value)}
            placeholder="Audio path (mp3/wav)"
            onClick={e => e.stopPropagation()}
          />
          <label className="card-setup-checkbox">
            <input
              type="checkbox"
              checked={card.enabled}
              onChange={e => handleFieldChange('enabled', e.target.checked)}
              onClick={e => e.stopPropagation()}
            />
            <span>Enabled</span>
          </label>
        </div>
      </div>
    );
  }

  // ---- PLAY MODE: normal card ----
  return (
    <div
      className={classNames}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      role="gridcell"
      tabIndex={card.enabled ? 0 : -1}
      aria-disabled={!card.enabled}
      aria-label={`${card.label} pont — ${category.name}`}
    >
      <span className="card-label">{card.label}</span>

      {showButtons && card.enabled && (
        <div className="card-actions">
          <button
            className="card-action-btn card-action-btn--edit"
            title="Szerkesztés"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            ✏️
          </button>
          <button
            className="card-action-btn card-action-btn--screen"
            title="Megnyitás másik képernyőn"
            onClick={(e) => { e.stopPropagation(); onOpenOther(); }}
          >
            🖥️
          </button>
        </div>
      )}

      {ripple && (
        <span
          className="card-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      )}
    </div>
  );
});

export default Card;
