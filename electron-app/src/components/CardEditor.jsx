import React, { useState } from 'react';

export default function CardEditor({ card, categories, onSave, onCancel }) {
  const [label, setLabel] = useState(card.label);
  const [image, setImage] = useState(card.image || '');
  const [answer, setAnswer] = useState(card.answer || '');
  const [enabled, setEnabled] = useState(card.enabled);

  const handleSave = () => {
    onSave({
      ...card,
      label,
      image,
      answer,
      enabled,
    });
  };

  const catName = categories[card.col]?.name || `Column ${card.col + 1}`;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal card-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Card</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <div className="editor-info">
            <span className="editor-badge">{catName}</span>
            <span className="editor-badge">{card.label} pont</span>
          </div>

          <label className="editor-field">
            <span>Label:</span>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. 100"
            />
          </label>

          <label className="editor-field">
            <span>Image path:</span>
            <input
              type="text"
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="e.g. emoji/dog.png"
            />
          </label>

          <label className="editor-field">
            <span>Answer text:</span>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="The answer to show..."
              rows={3}
            />
          </label>

          <label className="editor-field editor-field--checkbox">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <span>Enabled</span>
          </label>

          {image && (
            <div className="editor-preview">
              <span>Image preview:</span>
              <img
                src={image}
                alt="Preview"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}
