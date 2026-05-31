import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import CardEditor from './CardEditor';
import Preferences from './Preferences';
import { PLACEHOLDER_IMAGE } from './imagePlaceholder';

/**
 * DevScreen — Controller Dashboard (second monitor).
 * Shows a mini 7×N grid to select cards on the main screen,
 * plus a detail panel with image/answer preview, audio controls,
 * and the edit/undo tools that stay off the main display.
 */
export default function DevScreen() {
  const log = useCallback((message, payload) => {
    console.log(`[DevScreen] ${new Date().toLocaleTimeString()} │ ${message}`, payload ?? '');
  }, []);

  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [points, setPoints] = useState([]);
  const [connected, setConnected] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [lastClicked, setLastClicked] = useState('—');

  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [activeAudioMode, setActiveAudioMode] = useState(null); // 'easy' | 'hard' | null — which audio is loaded in the player
  const [editingCard, setEditingCard] = useState(null);
  const [previewFallback, setPreviewFallback] = useState(PLACEHOLDER_IMAGE);
  const [showMode, setShowMode] = useState(null); // 'easy' | 'hard' | null
  const audioRef = useRef(null);

  // Modal states
  const [showPreferences, setShowPreferences] = useState(false);
  const [activeScreen, setActiveScreen] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  const [appTitle, setAppTitle] = useState('Mindent vagy semmit!');

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
      log(`ipc:${action}`, data);
      switch (action) {
        case 'sync-grid':
          if (data.cards) setCards(data.cards);
          if (data.categories) setCategories(data.categories);
          if (data.points) setPoints(data.points);
          setUndoDepth(data.undoDepth || 0);
          setLastClicked(data.lastClicked || '—');
          if (data.activeScreen !== undefined) setActiveScreen(data.activeScreen);
          if (data.subScreen !== undefined) setSubScreen(data.subScreen);
          if (data.appTitle !== undefined) setAppTitle(data.appTitle);
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
    log('ipc:dev-ready sent');
    const retry = setTimeout(() => {
      window.electronAPI.selectOnMain('dev-ready');
      log('ipc:dev-ready retry sent');
    }, 500);

    setConnected(true);
    return () => {
      cleanup();
      clearTimeout(retry);
    };
  }, [stopAudioRef]);

  useEffect(() => {
    stopAudioRef();
    setActiveAudioMode(null);
  }, [selected, stopAudioRef]);

  // Reload + auto-play audio when activeAudioMode changes
  useEffect(() => {
    if (!audioRef.current) return;
    if (activeAudioMode) {
      // Mode set to 'easy' or 'hard' — load and play
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setAudioPlaying(true);
      }).catch((err) => {
        console.log('Audio play failed:', err);
        setAudioPlaying(false);
      });
    }
  }, [activeAudioMode]);

  useEffect(() => {
    const img = selected?.easyImage || selected?.image || PLACEHOLDER_IMAGE;
    setPreviewFallback(img);
    setShowMode(null);
  }, [selected?.easyImage, selected?.image]);

  const handleSelectCard = useCallback((card) => {
    log('card:select', { row: card.row, col: card.col, label: card.label });
    setSelected(card);
    setShowAnswer(false);
    stopAudioRef();
    setPreviewFallback(card.easyImage || card.image || PLACEHOLDER_IMAGE);
    setShowMode(null);

    if (window.electronAPI) {
      window.electronAPI.selectOnMain('select-card', {
        card,
        categoryName: categories[card.col]?.name || '',
      });
    }
  }, [categories, stopAudioRef]);

  const handleOpenEditor = useCallback(() => {
    if (!selected) return;
    log('action:open-editor', { row: selected.row, col: selected.col, label: selected.label });
    setEditingCard({ ...selected });
  }, [selected]);

  const handleSaveEditor = useCallback((edited) => {
    log('action:save-editor', { row: edited.row, col: edited.col, label: edited.label });
    setEditingCard(null);
    setSelected(edited);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('save-card', { card: edited });
    }
  }, []);

  const handleUndo = useCallback(() => {
    log('action:undo-request');
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('request-undo', {});
    }
  }, []);

  const notifyMainAudio = useCallback((mode, playing) => {
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('audio-playing', { mode, playing });
    }
  }, []);

  const playEasyAudio = useCallback((e) => {
    e.stopPropagation();
    const audioPath = selected?.easyAudio || selected?.audio;
    if (!audioPath) return;
    if (activeAudioMode === 'easy' && audioPlaying) {
      stopAudioRef();
      setActiveAudioMode(null);
      notifyMainAudio('easy', false);
    } else {
      stopAudioRef();
      setActiveAudioMode('easy');
      notifyMainAudio('easy', true);
    }
  }, [selected?.easyAudio, selected?.audio, activeAudioMode, audioPlaying, stopAudioRef, notifyMainAudio]);

  const playHardAudio = useCallback((e) => {
    e.stopPropagation();
    const audioPath = selected?.hardAudio;
    if (!audioPath) return;
    if (activeAudioMode === 'hard' && audioPlaying) {
      stopAudioRef();
      setActiveAudioMode(null);
      notifyMainAudio('hard', false);
    } else {
      stopAudioRef();
      setActiveAudioMode('hard');
      notifyMainAudio('hard', true);
    }
  }, [selected?.hardAudio, activeAudioMode, audioPlaying, stopAudioRef, notifyMainAudio]);

  const handleAudioEnded = useCallback(() => {
    setAudioPlaying(false);
    setActiveAudioMode(null);
    notifyMainAudio(null, false);
  }, [notifyMainAudio]);

  const handleHideMedia = useCallback(() => {
    setShowMode(null);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('hide-media', {});
    }
  }, []);

  const handleShowEasy = useCallback(() => {
    if (!selected) return;
    const image = selected.easyImage || selected.image || '';
    const audio = selected.easyAudio || selected.audio || '';
    if (!image && !audio) return; // nothing to show
    if (showMode === 'easy') {
      handleHideMedia();
      return;
    }
    stopAudioRef();
    const mode = 'easy';
    setShowMode(mode);
    setPreviewFallback(image || PLACEHOLDER_IMAGE);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('show-media', {
        card: selected,
        mode,
        image,
        audio,
        categoryName: categories[selected.col]?.name || '',
      });
    }
    log('action:show-easy', { image, audio });
  }, [selected, showMode, stopAudioRef, categories]);

  const handleShowHard = useCallback(() => {
    if (!selected) return;
    const image = selected.hardImage || '';
    const audio = selected.hardAudio || '';
    if (!image && !audio) return; // nothing to show
    if (showMode === 'hard') {
      handleHideMedia();
      return;
    }
    stopAudioRef();
    const mode = 'hard';
    setShowMode(mode);
    setPreviewFallback(image || PLACEHOLDER_IMAGE);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('show-media', {
        card: selected,
        mode,
        image,
        audio,
        categoryName: categories[selected.col]?.name || '',
      });
    }
    log('action:show-hard', { image, audio });
  }, [selected, showMode, stopAudioRef, categories]);

  const handleRevealAnswer = useCallback(() => {
    log('action:reveal-answer', selected ? { row: selected.row, col: selected.col, label: selected.label } : null);
    setShowAnswer(true);
    if (window.electronAPI && selected) {
      window.electronAPI.selectOnMain('show-answer', {
        answer: selected.answer || '',
        answerImage: selected.answerImage || '',
        categoryName: categories[selected.col]?.name || '',
        label: selected.label,
      });
    }
  }, [selected, categories]);

  const handleHideAnswer = useCallback(() => {
    log('action:hide-answer', selected ? { row: selected.row, col: selected.col, label: selected.label } : null);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('hide-answer', {});
    }
  }, [selected]);

  const handleMarkDone = useCallback(() => {
    if (!selected) return;
    log('action:done', { row: selected.row, col: selected.col, label: selected.label });
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('disable-card', { card: selected });
    }
    setShowAnswer(false);
    stopAudioRef();
  }, [selected, stopAudioRef]);

  // ---- Controls ----
  const handleReset = useCallback(() => {
    log('action:reset');
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('request-reset', {});
    }
  }, []);

  const handleOpenPreferences = useCallback(() => {
    log('action:open-preferences');
    setShowPreferences(true);
  }, []);

  const handlePreferencesSave = useCallback((result) => {
    setShowPreferences(false);
    if (!window.electronAPI) return;
    if (result.type === 'load-preset') {
      window.electronAPI.selectOnMain('replace-all-cards', result.data);
    } else if (result.type === 'apply-all') {
      window.electronAPI.selectOnMain('apply-preferences', result);
    }
  }, []);

  const handleCloseDevScreen = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.closeDevScreen();
    }
  }, []);

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

        <div className="ds-controls-bar">
          <button className="controls-btn" onClick={handleReset} title="Reset all cards">🔄 Reset</button>
          <button className="controls-btn" onClick={handleUndo} disabled={undoDepth === 0} title="Undo last action">↩ Undo</button>
          <button className="controls-btn" onClick={handleOpenPreferences} title="Preferences">⚙️ Preferences</button>
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
          <div className="ds-undo-pill">Undo: {undoDepth}</div>
          <button
            className="controls-btn"
            onClick={handleCloseDevScreen}
            title="Close dev screen (Esc)"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* ---- Operator controls ---- */}
      <div className="ds-controls-bar">
        <span className="controls-last-clicked" title="Last clicked card">
          <strong>Last:</strong> {lastClicked}
        </span>
        <button className="controls-btn" onClick={handleReset} title="Reset all cards">
          🔄 Reset
        </button>
        <button className="controls-btn" onClick={handleUndo} disabled={undoDepth === 0} title="Undo last action (re-enable cards, revert edits)">
          ↩ Undo
        </button>
        <button className="controls-btn" onClick={handleOpenPreferences} title="Preferences: General, Categories, Presets, Screens">
          ⚙️ Preferences
        </button>
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
                      className={`ds-mini-cell ${!card.enabled ? 'ds-mini-cell--disabled' : ''} ${sel ? 'ds-mini-cell--selected' : ''} ${(card.easyImage || card.image) ? 'ds-mini-cell--has-image' : ''} ${(card.easyAudio || card.audio || card.hardAudio) ? 'ds-mini-cell--has-audio' : ''}`}
                      onClick={() => card.enabled && handleSelectCard(card)}
                      disabled={!card.enabled}
                      title={`${card.label} — ${cat.name}${(card.easyImage || card.image) ? ' 🖼' : ''}${card.hardImage ? ' 🖼🔥' : ''}${(card.easyAudio || card.audio) ? ' 🎵' : ''}${card.hardAudio ? ' 🎵🔥' : ''}`}
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
                  {(selected.easyAudio || selected.audio) && <span className="ds-detail-chip ds-detail-chip--accent">🎵E</span>}
                  {selected.hardAudio && <span className="ds-detail-chip ds-detail-chip--danger">🎵H</span>}
                  {(selected.easyImage || selected.image) && <span className="ds-detail-chip ds-detail-chip--accent">🖼E</span>}
                  {selected.hardImage && <span className="ds-detail-chip ds-detail-chip--danger">🖼H</span>}
                </div>
              </div>

              <div className="ds-detail-image-area">
                {showMode && (
                  <div className={`ds-show-badge ${showMode === 'hard' ? 'ds-show-badge--hard' : 'ds-show-badge--easy'}`}>
                    {showMode === 'hard' ? '🔴 HARD' : '🟢 EASY'}
                  </div>
                )}
                <img
                  src={previewFallback}
                  alt="Preview"
                  className={`ds-detail-image ${previewFallback === PLACEHOLDER_IMAGE && !(selected?.easyImage || selected?.image || selected?.hardImage) ? 'ds-detail-image--placeholder' : ''}`}
                  onError={() => setPreviewFallback(PLACEHOLDER_IMAGE)}
                />
              </div>

              <div className="ds-detail-answer">
                {showAnswer ? (
                  <>
                    <div className="ds-detail-answer-text">{selected.answer || '(No answer)'}</div>
                    {selected.answerImage && (
                      <img
                        src={selected.answerImage}
                        alt="Answer"
                        className="ds-detail-answer-image"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </>
                ) : (
                  <div className="ds-detail-answer-hidden">Answer hidden</div>
                )}
              </div>

              <div className="ds-detail-controls">
                <button className="btn btn--sm btn--secondary" onClick={handleOpenEditor}>
                  ✏️ Edit
                </button>
                <button className="btn btn--sm btn--danger" onClick={handleMarkDone}>
                  ✅ Done
                </button>
              </div>

              {/* ── Show buttons: send image to main screen (hidden when no image) ── */}
              {((selected.hardImage) || (selected.easyImage || selected.image)) && (
                <div className="ds-detail-controls">
                  {selected.hardImage && (
                    <button
                      className={`btn btn--sm ${showMode === 'hard' ? 'btn--danger' : 'btn--secondary'}`}
                      onClick={handleShowHard}
                    >
                      🔴 Show Hard
                    </button>
                  )}
                  {(selected.easyImage || selected.image) && (
                    <button
                      className={`btn btn--sm ${showMode === 'easy' ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={handleShowEasy}
                    >
                      🟢 Show Easy
                    </button>
                  )}
                </div>
              )}

              {/* ── Play buttons: play audio locally on dev screen (hidden when no audio) ── */}
              {(selected.hardAudio || selected.easyAudio || selected.audio) && (
                <div className="ds-detail-controls">
                  {selected.hardAudio && (
                    <button
                      className={`btn btn--sm ${activeAudioMode === 'hard' && audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                      onClick={playHardAudio}
                    >
                      {activeAudioMode === 'hard' && audioPlaying ? '⏹ Stop Hard' : '🎵 Play Hard'}
                    </button>
                  )}
                  {(selected.easyAudio || selected.audio) && (
                    <button
                      className={`btn btn--sm ${activeAudioMode === 'easy' && audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                      onClick={playEasyAudio}
                    >
                      {activeAudioMode === 'easy' && audioPlaying ? '⏹ Stop Easy' : '🎵 Play Easy'}
                    </button>
                  )}
                </div>
              )}

              {/* ── Reveal text answer ── */}
              <div className="ds-detail-controls">
                {!showAnswer ? (
                  <button className="btn btn--sm btn--primary" onClick={handleRevealAnswer}>
                    👁 Reveal Answer
                  </button>
                ) : (
                  <button className="btn btn--sm btn--secondary" onClick={handleHideAnswer}>
                    🙈 Hide Answer
                  </button>
                )}
              </div>

              <audio ref={audioRef} src={activeAudioMode === 'hard' ? (selected.hardAudio || '') : (selected.easyAudio || selected.audio || '')} onEnded={handleAudioEnded} style={{ display: 'none' }} />
            </>
          ) : (
            <div className="ds-detail-empty">
              <span className="ds-detail-empty-icon">👆</span>
              <p>Select a card from the grid</p>
            </div>
          )}
        </div>
      </div>

      {editingCard && createPortal(
        <CardEditor
          card={editingCard}
          categories={categories}
          onSave={handleSaveEditor}
          onCancel={() => setEditingCard(null)}
        />,
        document.body
      )}

      {/* ── Preferences modal (consolidates General, Categories, Presets, Screens) ── */}
      {showPreferences && createPortal(
        <Preferences
          appTitle={appTitle}
          categories={categories}
          points={points}
          cards={cards}
          activeScreen={activeScreen}
          subScreen={subScreen}
          onSave={handlePreferencesSave}
          onClose={() => setShowPreferences(false)}
        />,
        document.body
      )}
    </div>
  );
}
