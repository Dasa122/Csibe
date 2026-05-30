import React, { useState, useCallback, useEffect } from 'react';

export default function SubPage({ card, category, onClose }) {
  const [showAnswer, setShowAnswer] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleAnswer = useCallback(() => {
    setShowAnswer(v => !v);
  }, []);

  return (
    <div className="subpage-overlay">
      <div className="subpage-content">
        {card.image && (
          <img
            className="subpage-image"
            src={card.image}
            alt={card.answer || 'Question image'}
          />
        )}

        {!card.image && (
          <div className="subpage-no-image">
            <span className="subpage-placeholder-icon">
              {category?.icon || '❓'}
            </span>
            <p>No image set for this card.</p>
            <p className="subpage-meta">
              {category?.name} — {card.label} pont
            </p>
          </div>
        )}

        <div className="subpage-answer-area">
          {showAnswer ? (
            <div className="subpage-answer">
              <h2>{card.answer || '(No answer set)'}</h2>
            </div>
          ) : (
            <button className="btn btn--primary btn--large" onClick={toggleAnswer}>
              👁 Show Answer
            </button>
          )}
        </div>

        <div className="subpage-actions">
          {showAnswer && (
            <button className="btn btn--secondary" onClick={toggleAnswer}>
              🙈 Hide Answer
            </button>
          )}
          <button className="btn btn--danger" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}
