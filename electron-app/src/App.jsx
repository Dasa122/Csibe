import React, { useState, useCallback, useEffect, useRef } from 'react';
import Grid from './components/Grid';
import { loadActivePresetName } from './components/PresetManager';
import DevScreen from './components/DevScreen';
import defaultCards from './data/cards.json';

const STORAGE_KEY = 'mindent-vagy-semmit-cards';
const TITLE_KEY = 'mindent-vagy-semmit-title';

function loadTitle() {
  return localStorage.getItem(TITLE_KEY) || 'Mindent vagy semmit!';
}
function saveTitle(t) { localStorage.setItem(TITLE_KEY, t); }

// Hash-based routing for Electron windows
function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || '/');

  useEffect(() => {
    const handler = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}

function loadCards() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return defaultCards;
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export default function App() {
  const route = useHashRoute();

  const log = useCallback((message, payload) => {
    console.log(`[MainScreen] ${new Date().toLocaleTimeString()} │ ${message}`, payload ?? '');
  }, []);

  // Dev screen route — render standalone operator view
  if (route === '/dev-screen') {
    return <DevScreen />;
  }
  const [cardsData, setCardsData] = useState(loadCards);
  const [appTitle, setAppTitle] = useState(loadTitle);
  const [selectedCard, setSelectedCard] = useState(null);
  const [frozenCard, setFrozenCard] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [lastClicked, setLastClicked] = useState('—');
  const [activeScreen, setActiveScreen] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  const [showMedia, setShowMedia] = useState(null); // { card, mode: 'easy'|'hard', image, audio, categoryName }
  const [audioIndicator, setAudioIndicator] = useState(null); // { mode: 'easy'|'hard', visible: boolean }
  const [answerOverlay, setAnswerOverlay] = useState(null); // { text: string, image: string, categoryName: string, label: string } | null
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);
  
  // Initialize screen defaults from Electron on first load
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getScreens().then(displays => {
      if (displays.length > 0 && activeScreen === null) {
        setActiveScreen(displays[0].id);
      }
      if (displays.length > 1 && subScreen === null) {
        setSubScreen(displays[1].id);
      } else if (displays.length === 1 && subScreen === null) {
        setSubScreen(displays[0].id);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line
  const [devScreenOpen, setDevScreenOpen] = useState(false);
  const [activePresetName, setActivePresetName] = useState(loadActivePresetName);

  // Auto-open dev screen on startup
  useEffect(() => {
    if (!window.electronAPI || subScreen === null) return;
    const timer = setTimeout(() => {
      window.electronAPI.openDevScreen(subScreen).then(() => {
        setDevScreenOpen(true);
        syncDevScreen();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [subScreen]); // eslint-disable-line

  // Refs for stable access in event listeners
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;
  const selectedCardRef = useRef(selectedCard);
  selectedCardRef.current = selectedCard;
  const frozenCardRef = useRef(frozenCard);
  frozenCardRef.current = frozenCard;

  const syncDevScreen = useCallback(() => {
    if (!window.electronAPI) return;

    const selectedSnapshot = selectedCardRef.current
      ? cardsData.cards.find(card => (
        card.row === selectedCardRef.current.row && card.col === selectedCardRef.current.col
      )) || selectedCardRef.current
      : null;

    window.electronAPI.sendToDevScreen('sync-grid', {
      cards: cardsData.cards,
      categories: cardsData.categories,
      points: cardsData.points,
      undoDepth: undoStackRef.current.length,
      lastClicked: lastClicked,
      activeScreen: activeScreen,
      subScreen: subScreen,
      appTitle: appTitle,
    });

    window.electronAPI.sendToDevScreen('select-card', {
      card: selectedSnapshot ? { ...selectedSnapshot } : null,
      categoryName: selectedSnapshot ? (cardsData.categories[selectedSnapshot.col]?.name || '') : '',
    });
    log('syncDevScreen()', {
      selected: selectedSnapshot ? { row: selectedSnapshot.row, col: selectedSnapshot.col, label: selectedSnapshot.label } : null,
      undoDepth: undoStackRef.current.length,
      frozenCard: frozenCardRef.current ? { row: frozenCardRef.current.row, col: frozenCardRef.current.col, label: frozenCardRef.current.label } : null,
    });
  }, [cardsData.cards, cardsData.categories, cardsData.points, lastClicked, log]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
  }, []);

  // Reload audio element when source changes (browser requires explicit .load())
  useEffect(() => {
    if (audioRef.current && showMedia?.audio) {
      audioRef.current.load();
    }
  }, [showMedia?.audio]);

  const toggleMainAudio = useCallback(() => {
    if (!showMedia?.audio || !audioRef.current) return;
    if (audioPlaying) {
      stopAudio();
    } else {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
      setAudioPlaying(true);
    }
  }, [showMedia?.audio, audioPlaying, stopAudio]);

  const pushUndo = useCallback((action) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  // Persist card changes
  useEffect(() => {
    saveCards(cardsData);
  }, [cardsData]);

  useEffect(() => {
    syncDevScreen();
  }, [syncDevScreen, selectedCard, undoStack, lastClicked]);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    if (action.type === 'disable') {
      log('undo:disable', { row: action.row, col: action.col });
      setCardsData(cd => ({ ...cd, cards: cd.cards.map(c =>
        c.row === action.row && c.col === action.col
          ? { ...c, enabled: true }
          : c
      ) }));
      setFrozenCard(prev => prev?.row === action.row && prev?.col === action.col ? null : prev);
      setRoundComplete(false);
    } else if (action.type === 'select') {
      log('undo:select', { row: action.row, col: action.col });
      setSelectedCard(null);
    } else if (action.type === 'edit') {
      const previous = action.previous;
      if (!previous) return;
      log('undo:edit', { row: previous.row, col: previous.col, label: previous.label });
      setCardsData(cd => ({ ...cd, cards: cd.cards.map(c =>
        c.row === previous.row && c.col === previous.col ? previous : c
      ) }));
      setSelectedCard(prev => prev?.row === previous.row && prev?.col === previous.col ? previous : prev);
    }
  }, [log]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if (e.key === 'Escape') {
        if (selectedCardRef.current) {
          setSelectedCard(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  // Listen for actions from the dev screen (reverse IPC)
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.onMainScreenAction((action, data) => {
      switch (action) {
        case 'dev-ready':
          log('ipc:dev-ready');
          syncDevScreen();
          break;
        case 'select-card': {
          const card = data.card;
          if (!card) {
            setSelectedCard(null);
            setFrozenCard(null);
            setRoundComplete(false);
            log('ipc:select-card cleared');
            return;
          }
          pushUndo({ type: 'select', row: card.row, col: card.col });
          setSelectedCard(card);
          setFrozenCard(null);
          setRoundComplete(false);
          const catName = cardsData.categories[card.col]?.name || '';
          setLastClicked(`${card.label} — ${catName}`);
          log('ipc:select-card', { row: card.row, col: card.col, label: card.label, categoryName: catName });
          break;
        }
        case 'show-media': {
          const { card, mode, image, audio, categoryName } = data;
          if (!card) return;
          stopAudio();
          setShowMedia({ card, mode, image, audio, categoryName });
          log('ipc:show-media', { mode, label: card.label, image, audio });
          break;
        }
        case 'hide-media':
          stopAudio();
          setShowMedia(null);
          log('ipc:hide-media');
          break;
        case 'audio-playing': {
          const { mode, playing } = data;
          if (playing) {
            setAudioIndicator({ mode, visible: true });
          } else {
            setAudioIndicator(null);
          }
          log('ipc:audio-playing', { mode, playing });
          break;
        }
        case 'show-answer': {
          const { answer, answerImage, categoryName, label } = data;
          setAnswerOverlay({ text: answer || '(No answer)', image: answerImage || '', categoryName, label });
          log('ipc:show-answer', { answer, answerImage });
          break;
        }
        case 'hide-answer':
          setAnswerOverlay(null);
          log('ipc:hide-answer');
          break;
        case 'disable-card': {
          const c = data.card;
          if (!c) return;
          pushUndo({ type: 'disable', row: c.row, col: c.col });
          log('ipc:disable-card', { row: c.row, col: c.col, label: c.label });

          // Compute the next state synchronously – cardsData is fresh because
          // this IPC listener is re-registered whenever cardsData changes.
          const nextCards = cardsData.cards.map(cd =>
            cd.row === c.row && cd.col === c.col ? { ...cd, enabled: false } : cd
          );
          const stillAlive = nextCards.some(cd =>
            !(cd.row === c.row && cd.col === c.col) && cd.enabled
          );

          setCardsData(prev => ({ ...prev, cards: nextCards }));
          setSelectedCard(prev =>
            prev?.row === c.row && prev?.col === c.col
              ? { ...prev, enabled: false }
              : prev
          );

          if (stillAlive) {
            setFrozenCard({ ...c, enabled: false });
          } else {
            log('round-complete', { lastCard: { row: c.row, col: c.col, label: c.label } });
            setFrozenCard(null);
            setRoundComplete(true);
            setLastClicked('Round complete');
          }
          break;
        }
        case 'save-card': {
          const edited = data.card;
          if (!edited) return;
          const previous = cardsData.cards.find(cd => cd.row === edited.row && cd.col === edited.col);
          if (previous) {
            pushUndo({ type: 'edit', previous });
          }
          log('ipc:save-card', { row: edited.row, col: edited.col, label: edited.label, enabled: edited.enabled });
          setCardsData(prev => ({ ...prev, cards: prev.cards.map(cd =>
            cd.row === edited.row && cd.col === edited.col ? edited : cd
          ) }));
          setSelectedCard(prev => prev?.row === edited.row && prev?.col === edited.col ? edited : prev);
          const catName = cardsData.categories[edited.col]?.name || '';
          setLastClicked(`${edited.label} — ${catName}`);
          break;
        }
        case 'request-undo':
          log('ipc:request-undo');
          handleUndo();
          break;
        case 'request-reset':
          handleReset();
          break;
        case 'replace-all-cards': {
          setCardsData(data);
          setSelectedCard(null);
          setUndoStack([]);
          setActivePresetName(loadActivePresetName());
          log('ipc:replace-all-cards');
          break;
        }
        case 'save-categories': {
          const { categories, cards } = data;
          setCardsData(prev => ({ ...prev, categories, cards }));
          log('ipc:save-categories', { cats: categories.length, cards: cards.length });
          break;
        }
        case 'set-active-screen': {
          setActiveScreen(data);
          if (window.electronAPI) {
            window.electronAPI.moveMainWindow(data);
          }
          log('ipc:set-active-screen', { id: data });
          break;
        }
        case 'set-sub-screen': {
          const displayId = data;
          setSubScreen(displayId);
          if (devScreenOpen && window.electronAPI) {
            window.electronAPI.closeDevScreen().then(() => {
              window.electronAPI.openDevScreen(displayId).then(() => syncDevScreen());
            });
          }
          log('ipc:set-sub-screen', { id: displayId });
          break;
        }
        case 'apply-preferences': {
          const { appTitle: newTitle, categories: newCats, cards: newCards, activeScreen: newActive, subScreen: newSub } = data;
          if (newTitle !== undefined) {
            setAppTitle(newTitle);
            saveTitle(newTitle);
          }
          if (newCats || newCards) {
            setCardsData(prev => ({
              ...prev,
              categories: newCats || prev.categories,
              cards: newCards || prev.cards,
            }));
          }
          if (newActive !== undefined) {
            setActiveScreen(newActive);
            if (window.electronAPI) window.electronAPI.moveMainWindow(newActive);
          }
          if (newSub !== undefined) {
            setSubScreen(newSub);
            if (devScreenOpen && window.electronAPI) {
              window.electronAPI.closeDevScreen().then(() => {
                window.electronAPI.openDevScreen(newSub).then(() => syncDevScreen());
              });
            }
          }
          log('ipc:apply-preferences', { title: newTitle, cats: newCats?.length, cards: newCards?.length });
          break;
        }
        default:
          break;
      }
    });
    return cleanup;
  }, [cardsData, handleUndo, pushUndo, syncDevScreen]);

  const handleCardClick = useCallback((card) => {
    if (frozenCardRef.current) return;
    if (!card.enabled) return;
    log('card:click', { row: card.row, col: card.col, label: card.label });
    setSelectedCard(card);
    const catName = cardsData.categories[card.col]?.name || '';
    setLastClicked(`${card.label} — ${catName}`);
    pushUndo({ type: 'select', row: card.row, col: card.col });

    // Sync to dev screen if open
    if (window.electronAPI) {
      window.electronAPI.sendToDevScreen('select-card', {
        card: { ...card },
        categoryName: catName,
      });
    }
  }, [cardsData.categories, pushUndo]);

  const handleCardDoubleClick = useCallback((card) => {
    if (frozenCardRef.current) return;
    if (!card.enabled) return;
    log('card:doubleClick', { row: card.row, col: card.col, label: card.label });
    // Send to dev screen (opens it if not already open)
    const catName = cardsData.categories[card.col]?.name || '';
    if (window.electronAPI) {
      window.electronAPI.sendToDevScreen('select-card', {
        card: { ...card },
        categoryName: catName,
      });
      // Ensure dev screen is open
      window.electronAPI.devScreenStatus().then(isOpen => {
        if (!isOpen) {
          window.electronAPI.openDevScreen(subScreen).then(() => {
            setDevScreenOpen(true);
            // Resend after open
            window.electronAPI.sendToDevScreen('select-card', {
              card: { ...card },
              categoryName: catName,
            });
          });
        }
      });
    }
  }, [cardsData.categories, subScreen]);

  const handleCardRightClick = useCallback((card) => {
    if (frozenCardRef.current) return;
    if (!card.enabled) return;
    log('card:rightClick-disable', { row: card.row, col: card.col, label: card.label });
    pushUndo({ type: 'disable', row: card.row, col: card.col });
    setCardsData(prev => ({ ...prev, cards: prev.cards.map(c =>
      c.row === card.row && c.col === card.col
        ? { ...c, enabled: false }
        : c
    ) }));
    setSelectedCard(prev => {
      if (prev?.row === card.row && prev?.col === card.col) return null;
      return prev;
    });
  }, [pushUndo]);

  const handleReset = useCallback(() => {
    log('action:reset');
    setCardsData(defaultCards);
    setSelectedCard(null);
    setFrozenCard(null);
    setRoundComplete(false);
    setUndoStack([]);
    setLastClicked('—');
    setActivePresetName('');
    setAudioIndicator(null);
    setAnswerOverlay(null);
    stopAudio();
  }, []);

  // Check dev screen status on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.devScreenStatus().then(setDevScreenOpen);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">{appTitle}</h1>
      </header>

      {/* ---- Column titles ---- */}
      <div className="column-titles">
        {cardsData.categories.map((cat) => (
          <div key={cat.id} className="column-title" title={cat.name}>
            <span className="cat-icon">{cat.icon}</span>
            <span className="cat-name">{cat.name}</span>
          </div>
        ))}
      </div>

      {frozenCard && (
        <div className="main-freeze-banner" role="status" aria-live="polite">
          <span className="main-freeze-banner__dot" />
          Frozen on {frozenCard.label} — use the dev screen to continue.
        </div>
      )}

      {roundComplete && (
        <div className="main-freeze-banner main-freeze-banner--complete" role="status" aria-live="polite">
          <span className="main-freeze-banner__dot" />
          Round complete. You can reset, load a preset, or start a new round.
        </div>
      )}

      {/* ---- Audio playing indicator (triggered by dev screen Play buttons) ---- */}
      {audioIndicator?.visible && (
        <div className={`audio-indicator ${audioIndicator.mode === 'hard' ? 'audio-indicator--hard' : 'audio-indicator--easy'}`} role="status" aria-live="polite">
          <span className="audio-indicator__icon">🎵</span>
          <span className="audio-indicator__label">{audioIndicator.mode === 'hard' ? 'HARD' : 'EASY'}</span>
          <span className="audio-indicator__bars">
            <span className="audio-indicator__bar" />
            <span className="audio-indicator__bar" />
            <span className="audio-indicator__bar" />
            <span className="audio-indicator__bar" />
          </span>
        </div>
      )}

      {/* ---- Answer overlay (triggered by dev screen Reveal Answer) ---- */}
      {answerOverlay && (
        <div className="answer-overlay" onClick={() => setAnswerOverlay(null)}>
          <div className="answer-overlay__content" onClick={e => e.stopPropagation()}>
            <div className="answer-overlay__badge">💡 Answer</div>
            <div className="answer-overlay__text">{answerOverlay.text}</div>
            {answerOverlay.image && (
              <img
                src={answerOverlay.image}
                alt="Answer"
                className="answer-overlay__image"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div className="answer-overlay__meta">{answerOverlay.label} pont — {answerOverlay.categoryName}</div>
            <button className="btn btn--secondary btn--large" onClick={() => setAnswerOverlay(null)}>
              ✕ Close
            </button>
          </div>
        </div>
      )}

      <Grid
        cards={cardsData.cards}
        categories={cardsData.categories}
        points={cardsData.points}
        selectedCard={selectedCard}
        onCardClick={handleCardClick}
        onCardDoubleClick={handleCardDoubleClick}
        onCardRightClick={handleCardRightClick}
      />



      {/* ---- Fullscreen media overlay (triggered by dev screen Show buttons) ---- */}
      {showMedia && (
        <div className="subpage-overlay" onClick={() => { stopAudio(); setShowMedia(null); }}>
          <div className="subpage-content" onClick={e => e.stopPropagation()}>
            <div className={`ds-show-badge ${showMedia.mode === 'hard' ? 'ds-show-badge--hard' : 'ds-show-badge--easy'}`} style={{ position: 'static', fontSize: '2vmin', padding: '0.6vmin 1.6vmin' }}>
              {showMedia.mode === 'hard' ? '🔴 HARD (1×)' : '🟢 EASY (0.5×)'}
            </div>

            {showMedia.image ? (
              <img
                src={showMedia.image}
                alt="Card media"
                className="subpage-image"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : showMedia.audio ? (
              <div className="subpage-audio-only">
                <div className="subpage-audio-icon">🎵</div>
                <p className="subpage-audio-label">{showMedia.mode === 'hard' ? '🔴 HARD' : '🟢 EASY'} Sound</p>
                <p className="subpage-meta">{showMedia.card.label} pont — {showMedia.categoryName}</p>
              </div>
            ) : (
              <div className="subpage-no-image">
                <div className="subpage-placeholder-icon">🖼️</div>
                <p>No media for {showMedia.mode} mode</p>
                <p className="subpage-meta">{showMedia.card.label} pont — {showMedia.categoryName}</p>
              </div>
            )}

            {showMedia.audio && (
              <div className="subpage-actions">
                {!showMedia.image && (
                  <p className="subpage-audio-hint">Press play to start the sound</p>
                )}
                <button
                  className={`btn btn--large ${audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                  onClick={toggleMainAudio}
                  style={!showMedia.image ? { fontSize: '3vmin', padding: '2vmin 5vmin' } : {}}
                >
                  {audioPlaying ? '⏹ Stop' : '🎵 Play Sound'}
                </button>
              </div>
            )}

            <button className="btn btn--secondary btn--large" onClick={() => { stopAudio(); setShowMedia(null); }}>
              ✕ Close
            </button>

            {showMedia.audio && (
              <audio
                ref={audioRef}
                src={showMedia.audio}
                onEnded={() => setAudioPlaying(false)}
                style={{ display: 'none' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
