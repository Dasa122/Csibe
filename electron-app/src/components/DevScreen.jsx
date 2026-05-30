import React, { useState, useEffect, useCallback, useRef } from 'react';
import CardEditor from './CardEditor';

/**
 * DevScreen — Controller Dashboard (second monitor).
 * Shows a mini 7×N grid to select cards on the main screen,
 * plus a detail panel with image/answer preview, audio controls,
 * and the edit/undo tools that stay off the main display.
 */
export default function DevScreen() {
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [points, setPoints] = useState([]);
  const [connected, setConnected] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);

  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const audioRef = useRef(null);

  const stopAudioRef = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      setConnected(false);
      return;
    }

    const cleanup = window.electronAPI.onDevScreenUpdate((action, data) => {
      switch (action) {
        case 'sync-grid':
          if (data.cards) setCards(data.cards);
          if (data.categories) setCategories(data.categories);
          if (data.points) setPoints(data.points);
          setUndoDepth(data.undoDepth || 0);
          setConnected(true);
          break;
        case 'select-card':
          setSelected(data.card || null);
          setShowAnswer(false);
          stopAudioRef();
          break;
        case 'ping':
          setConnected(true);
          break;
        default:
          break;
      }
    });

    window.electronAPI.selectOnMain('dev-ready');
    const retry = setTimeout(() => {
      window.electronAPI.selectOnMain('dev-ready');
    }, 500);

    setConnected(true);
    return () => {
      cleanup();
      clearTimeout(retry);
    };
  }, [stopAudioRef]);

  useEffect(() => {
    stopAudioRef();
  }, [selected, stopAudioRef]);

  const handleSelectCard = useCallback((card) => {
    setSelected(card);
    setShowAnswer(false);
    stopAudioRef();

    if (window.electronAPI) {
      window.electronAPI.selectOnMain('select-card', {
        card,
        categoryName: categories[card.col]?.name || '',
      });
    }
  }, [categories, stopAudioRef]);

  const handleOpenEditor = useCallback(() => {
    if (!selected) return;
    setEditingCard({ ...selected });
  }, [selected]);

  const handleSaveEditor = useCallback((edited) => {
    setEditingCard(null);
    setSelected(edited);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('save-card', { card: edited });
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('request-undo', {});
    }
  }, []);

  const toggleAudio = useCallback((e) => {
    e.stopPropagation();
    if (!selected?.audio || !audioRef.current) return;
    if (audioPlaying) {
      stopAudioRef();
    } else {
      audioRef.current.play().catch(() => {});
      setAudioPlaying(true);
    }
  }, [selected?.audio, audioPlaying, stopAudioRef]);

  const handleAudioEnded = useCallback(() => setAudioPlaying(false), []);

  const handleRevealAnswer = useCallback(() => {
    setShowAnswer(true);
    if (window.electronAPI && selected) {
      window.electronAPI.selectOnMain('show-answer', { card: selected });
    }
  }, [selected]);

  const handleHideAnswer = useCallback(() => {
    setShowAnswer(false);
    if (window.electronAPI && selected) {
      window.electronAPI.selectOnMain('hide-answer', { card: selected });
    }
  }, [selected]);

  const handleMarkDone = useCallback(() => {
    if (!selected) return;
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('disable-card', { card: selected });
    }
    setSelected(null);
    setShowAnswer(false);
    stopAudioRef();
  }, [selected, stopAudioRef]);

  const getCard = (r, c) => cards.find(cd => cd.row === r && cd.col === c);
  const isSelectedCard = (card) => selected?.row === card?.row && selected?.col === card?.col;

  if (cards.length === 0) {
    return (
      <div className="ds-shell ds-shell--idle">
        <div className="ds-hero">
          <div>
            <div className="ds-kicker">Operator Console</div>
            <h1 className="ds-title">Card Forge</h1>
            <p className="ds-subtitle">Edit, reveal, and recover cards without touching the main screen.</p>
          </div>
          <div className={`ds-status ds-status--hero ${connected ? 'ds-status--ok' : 'ds-status--wait'}`}>
            <span className="ds-status-dot" />
            {connected ? 'Connected' : 'Waiting…'}
          </div>
        </div>

        <div className="ds-idle">
          <div className="ds-idle-icon">🎛️</div>
          <h2 className="ds-idle-title">Open a card on the board</h2>
          <p className="ds-idle-sub">Use the grid to jump into a card, then edit it from this screen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-shell">
      <div className="ds-hero">
        <div>
          <div className="ds-kicker">Operator Console</div>
          <h1 className="ds-title">Card Forge</h1>
          <p className="ds-subtitle">Live selection, preview, edit, and undo in one place.</p>
        </div>
        <div className="ds-hero-stats">
          <div className="ds-status ds-status--hero">
            <span className="ds-status-dot" />
            {connected ? 'Connected' : 'Waiting…'}
          </div>
          <div className="ds-undo-pill">Undo depth: {undoDepth}</div>
        </div>
      </div>

      <div className="ds-layout">
        <div className="ds-grid-panel">
          <div className="ds-grid-header">
            <div>
              <h2>Card Selector</h2>
              <p>Tap a tile to sync the main screen.</p>
            </div>
            <div className={`ds-status-sm ${connected ? 'ds-status--ok' : 'ds-status--wait'}`}>
              <span className="ds-status-dot" />
            </div>
          </div>

          <div className="ds-mini-grid">
            <div className="ds-mini-row ds-mini-row--header">
              <div className="ds-mini-cell ds-mini-cell--row-label" />
              {categories.map((cat, ci) => (
                <div key={ci} className="ds-mini-cell ds-mini-cell--header" title={cat.name}>
                  {cat.icon}
                </div>
              ))}
            </div>

            {points.map((pts, ri) => (
              <div key={ri} className="ds-mini-row">
                <div className="ds-mini-cell ds-mini-cell--row-label">{pts}</div>
                {categories.map((cat, ci) => {
                  const card = getCard(ri, ci);
                  if (!card) return <div key={ci} className="ds-mini-cell ds-mini-cell--empty" />;
                  const sel = isSelectedCard(card);
                  return (
                    <button
                      key={ci}
                      className={`ds-mini-cell ${!card.enabled ? 'ds-mini-cell--disabled' : ''} ${sel ? 'ds-mini-cell--selected' : ''} ${card.image ? 'ds-mini-cell--has-image' : ''} ${card.audio ? 'ds-mini-cell--has-audio' : ''}`}
                      onClick={() => card.enabled && handleSelectCard(card)}
                      disabled={!card.enabled}
                      title={`${card.label} — ${cat.name}${card.image ? ' 🖼' : ''}${card.audio ? ' 🎵' : ''}`}
                    >
                      <span className="ds-mini-label">{card.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="ds-detail-panel">
          {selected ? (
            <>
              <div className="ds-detail-header">
                <div>
                  <h2>{categories[selected.col]?.icon} {categories[selected.col]?.name}</h2>
                  <p>{selected.label} pont</p>
                </div>
                <div className="ds-detail-chip-row">
                  <span className="ds-detail-chip">{selected.enabled ? 'Live' : 'Disabled'}</span>
                  {selected.audio && <span className="ds-detail-chip ds-detail-chip--accent">Audio</span>}
                  {selected.image && <span className="ds-detail-chip ds-detail-chip--accent">Image</span>}
                </div>
              </div>

              <div className="ds-detail-image-area">
                {selected.image ? (
                  <img src={selected.image} alt="Preview" className="ds-detail-image" />
                ) : (
                  <div className="ds-detail-no-image">No image</div>
                )}
              </div>

              <div className="ds-detail-answer">
                {showAnswer ? (
                  <div className="ds-detail-answer-text">{selected.answer || '(No answer)'}</div>
                ) : (
                  <div className="ds-detail-answer-hidden">Answer hidden</div>
                )}
              </div>

              <div className="ds-detail-controls">
                <button
                  className="btn btn--sm btn--secondary"
                  onClick={handleUndo}
                  disabled={undoDepth === 0}
                >
                  ↩ Undo
                </button>
                <button className="btn btn--sm btn--secondary" onClick={handleOpenEditor}>
                  ✏️ Edit
                </button>
                {selected.audio && (
                  <button
                    className={`btn btn--sm ${audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                    onClick={toggleAudio}
                  >
                    {audioPlaying ? '⏹ Stop' : '🎵 Play'}
                  </button>
                )}
                {!showAnswer ? (
                  <button className="btn btn--sm btn--primary" onClick={handleRevealAnswer}>
                    👁 Reveal
                  </button>
                ) : (
                  <button className="btn btn--sm btn--secondary" onClick={handleHideAnswer}>
                    🙈 Hide
                  </button>
                )}
                <button className="btn btn--sm btn--danger" onClick={handleMarkDone}>
                  ✅ Done
                </button>
              </div>

              <audio ref={audioRef} src={selected.audio || ''} onEnded={handleAudioEnded} style={{ display: 'none' }} />
            </>
          ) : (
            <div className="ds-detail-empty">
              <span className="ds-detail-empty-icon">👆</span>
              <p>Select a card from the grid</p>
            </div>
          )}
        </div>
      </div>

      {editingCard && (
        <CardEditor
          card={editingCard}
          categories={categories}
          onSave={handleSaveEditor}
          onCancel={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
