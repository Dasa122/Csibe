import React, { useState } from 'react';

export default function CategoryEditor({ categories, points, cards, onSave, onCancel }) {
  const [cats, setCats] = useState(categories.map(c => ({ ...c })));

  const handleChange = (idx, field, value) => {
    setCats(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleAdd = () => {
    const newId = `cat-${Date.now()}`;
    setCats(prev => [...prev, { id: newId, name: 'New Category', icon: '❓' }]);
  };

  const handleRemove = (idx) => {
    if (cats.length <= 1) return;
    setCats(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    setCats(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const handleMoveDown = (idx) => {
    if (idx === cats.length - 1) return;
    setCats(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    // Remap cards: cols that got removed get mapped to col 0, new cols get empty cards
    const oldCount = categories.length;
    const newCount = cats.length;

    let newCards = [...cards];

    if (newCount !== oldCount) {
      newCards = [];
      for (let r = 0; r < points.length; r++) {
        for (let c = 0; c < newCount; c++) {
          if (c < oldCount) {
            const existing = cards.find(card => card.row === r && card.col === c);
            newCards.push(existing || {
              row: r, col: c,
              label: String(points[r]),
              image: '', answer: '', audio: '',
              enabled: true,
            });
          } else {
            newCards.push({
              row: r, col: c,
              label: String(points[r]),
              image: '', answer: '', audio: '',
              enabled: true,
            });
          }
        }
      }
    }

    onSave({ categories: cats, cards: newCards });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal category-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏷 Edit Categories</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <p className="cat-editor-hint">
            Rename categories, change icons, reorder, add or remove columns.
            The grid will adjust automatically.
          </p>

          <div className="cat-editor-list">
            {cats.map((cat, idx) => (
              <div key={cat.id} className="cat-editor-row">
                <div className="cat-editor-col-num">{idx + 1}</div>
                <input
                  className="cat-editor-input cat-editor-input--icon"
                  type="text"
                  value={cat.icon}
                  onChange={e => handleChange(idx, 'icon', e.target.value)}
                  placeholder="😀"
                  maxLength={4}
                  title="Icon (emoji)"
                />
                <input
                  className="cat-editor-input cat-editor-input--name"
                  type="text"
                  value={cat.name}
                  onChange={e => handleChange(idx, 'name', e.target.value)}
                  placeholder="Category name"
                />
                <div className="cat-editor-actions">
                  <button
                    className="cat-editor-btn"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    title="Move up"
                  >▲</button>
                  <button
                    className="cat-editor-btn"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === cats.length - 1}
                    title="Move down"
                  >▼</button>
                  <button
                    className="cat-editor-btn cat-editor-btn--remove"
                    onClick={() => handleRemove(idx)}
                    disabled={cats.length <= 1}
                    title="Remove column"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn--secondary btn--sm cat-editor-add" onClick={handleAdd}>
            ＋ Add Column
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>💾 Apply</button>
        </div>
      </div>
    </div>
  );
}
