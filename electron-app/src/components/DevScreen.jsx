import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * DevScreen — Controller Dashboard (second monitor).
 * Shows a mini 7×N grid to select cards on the main screen,
 * plus a detail panel with image/answer preview and audio controls.
 */
export default function DevScreen() {
  // Data synced from main window
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [points, setPoints] = useState([]);
  const [connected, setConnected] = useState(false);

  // Currently selected card (on this dashboard)
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  // Listen for data sync from main window
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
          setConnected(true);
          break;
        case 'select-card':
          if (data.card) {
            setSelected(data.card);
            setShowAnswer(false);
            stopAudioRef();
          }
          break;
        case 'ping':
          setConnected(true);
          break;
        default:
          break;
      }
    });

    setConnected(true);
    return () => cleanup();
  }, []);

  // Stop audio helper (stable ref for use in effect)
  const stopAudioRef = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
  }, []);

  // Stop audio when card changes
  useEffect(() => {
    stopAudioRef();
  }, [selected, stopAudioRef]);

  // ---- Select a card from the dashboard grid → sends to main screen ----
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

  // ---- Audio ----
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

  // ---- Answer reveal on main screen ----
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

  // ---- Mark card as done (disable it) ----
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

  // ---- Idle / loading state ----
  if (cards.length === 0) {
    return (
      <div className="ds-overlay">
        <div className="ds-idle">
          <div className="ds-idle-icon">🎮</div>
          <h1 className="ds-idle-title">Controller Dashboard</h1>
          <p className="ds-idle-sub">Open a card on the main board to begin…</p>
          <div className={`ds-status ${connected ? 'ds-status--ok' : 'ds-status--wait'}`}>
            <span className="ds-status-dot" />
            {connected ? 'Connected' : 'Waiting…'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-dashboard">
      {/* ---- Left panel: Mini grid selector ---- */}
      <div className="ds-grid-panel">
        <div className="ds-grid-header">
          <h2>🎯 Card Selector</h2>
          <div className={`ds-status-sm ${connected ? 'ds-status--ok' : 'ds-status--wait'}`}>
            <span className="ds-status-dot" />
          </div>
        </div>

        <div className="ds-mini-grid">
          {/* Column headers */}
          <div className="ds-mini-row ds-mini-row--header">
            <div className="ds-mini-cell ds-mini-cell--row-label" />
            {categories.map((cat, ci) => (
              <div key={ci} className="ds-mini-cell ds-mini-cell--header" title={cat.name}>
                {cat.icon}
              </div>
            ))}
          </div>

          {/* Grid rows */}
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

      {/* ---- Right panel: Detail / Preview ---- */}
      <div className="ds-detail-panel">
        {selected ? (
          <>
            <div className="ds-detail-header">
              <h2>📋 Detail</h2>
              <span className="ds-detail-meta">
                {categories[selected.col]?.icon} {categories[selected.col]?.name} — {selected.label} pont
              </span>
            </div>

            {/* Image preview */}
            <div className="ds-detail-image-area">
              {selected.image ? (
                <img src={selected.image} alt="Preview" className="ds-detail-image" />
              ) : (
                <div className="ds-detail-no-image">No image</div>
              )}
            </div>

            {/* Answer */}
            <div className="ds-detail-answer">
              {showAnswer ? (
                <div className="ds-detail-answer-text">{selected.answer || '(No answer)'}</div>
              ) : (
                <div className="ds-detail-answer-hidden">Answer hidden</div>
              )}
            </div>

            {/* Controls */}
            <div className="ds-detail-controls">
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
  );
}
