import React, { useState, useCallback, useEffect, useRef } from 'react';
import Grid from './components/Grid';
import Controls from './components/Controls';
import ScreenSelector from './components/ScreenSelector';
import PresetManager, { loadActivePresetName } from './components/PresetManager';
import DevScreen from './components/DevScreen';
import CategoryEditor from './components/CategoryEditor';
import defaultCards from './data/cards.json';

const STORAGE_KEY = 'mindent-vagy-semmit-cards';

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
  const [selectedCard, setSelectedCard] = useState(null);
  const [frozenCard, setFrozenCard] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [showScreenSelector, setShowScreenSelector] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [lastClicked, setLastClicked] = useState('—');
  const [activeScreen, setActiveScreen] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  
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
  }, [cardsData.cards, cardsData.categories, cardsData.points, log]);

  const pushUndo = useCallback((action) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  // Persist card changes
  useEffect(() => {
    saveCards(cardsData);
  }, [cardsData]);

  useEffect(() => {
    syncDevScreen();
  }, [syncDevScreen, selectedCard, undoStack]);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    if (action.type === 'disable') {
      log('undo:disable', { row: action.row, col: action.col });
      setCardsData(cd => cd.map(c =>
        c.row === action.row && c.col === action.col
          ? { ...c, enabled: true }
          : c
      ));
      setFrozenCard(prev => prev?.row === action.row && prev?.col === action.col ? null : prev);
      setRoundComplete(false);
    } else if (action.type === 'select') {
      log('undo:select', { row: action.row, col: action.col });
      setSelectedCard(null);
    } else if (action.type === 'edit') {
      const previous = action.previous;
      if (!previous) return;
      log('undo:edit', { row: previous.row, col: previous.col, label: previous.label });
      setCardsData(cd => cd.map(c =>
        c.row === previous.row && c.col === previous.col ? previous : c
      ));
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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowScreenSelector(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPresetManager(v => !v);
      }
      if (e.key === 'Escape') {
        if (selectedCardRef.current) {
          setSelectedCard(null);
        } else if (setupMode) {
          setSetupMode(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, setupMode]);

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
        case 'show-answer':
          break;
        case 'hide-answer':
          break;
        case 'disable-card': {
          const c = data.card;
          if (!c) return;
          pushUndo({ type: 'disable', row: c.row, col: c.col });
          log('ipc:disable-card', { row: c.row, col: c.col, label: c.label });
          setCardsData(prev => prev.map(cd =>
            cd.row === c.row && cd.col === c.col ? { ...cd, enabled: false } : cd
          ));
          setSelectedCard(prev => prev?.row === c.row && prev?.col === c.col ? { ...prev, enabled: false } : prev);
          const remainingEnabled = cardsData.cards.some(cd =>
            !(cd.row === c.row && cd.col === c.col) && cd.enabled
          );
          if (remainingEnabled) {
            setFrozenCard({ ...c, enabled: false });
          } else {
            log('round-complete', { lastCard: { row: c.row, col: c.col, label: c.label } });
            setFrozenCard(null);
            setSelectedCard(prev => prev?.row === c.row && prev?.col === c.col ? { ...prev, enabled: false } : { ...c, enabled: false });
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
          setCardsData(prev => prev.map(cd =>
            cd.row === edited.row && cd.col === edited.col ? edited : cd
          ));
          setSelectedCard(prev => prev?.row === edited.row && prev?.col === edited.col ? edited : prev);
          const catName = cardsData.categories[edited.col]?.name || '';
          setLastClicked(`${edited.label} — ${catName}`);
          break;
        }
        case 'request-undo':
          log('ipc:request-undo');
          handleUndo();
          break;
        default:
          break;
      }
    });
    return cleanup;
  }, [cardsData, handleUndo, pushUndo, syncDevScreen]);

  const handleCardClick = useCallback((card) => {
    if (setupMode) return;
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
  }, [cardsData.categories, pushUndo, setupMode]);

  const handleCardDoubleClick = useCallback((card) => {
    if (setupMode) return;
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
  }, [setupMode, cardsData.categories, subScreen]);

  const handleCardRightClick = useCallback((card) => {
    if (setupMode) return;
    if (frozenCardRef.current) return;
    if (!card.enabled) return;
    log('card:rightClick-disable', { row: card.row, col: card.col, label: card.label });
    pushUndo({ type: 'disable', row: card.row, col: card.col });
    setCardsData(prev => prev.map(c =>
      c.row === card.row && c.col === card.col
        ? { ...c, enabled: false }
        : c
    ));
    setSelectedCard(prev => {
      if (prev?.row === card.row && prev?.col === card.col) return null;
      return prev;
    });
  }, [pushUndo, setupMode]);

  // ---- Setup mode: inline card field change ----
  const handleSetupCardChange = useCallback((changedCard) => {
    setCardsData(prev => ({
      ...prev,
      cards: prev.cards.map(c =>
        c.row === changedCard.row && c.col === changedCard.col ? changedCard : c
      ),
    }));
  }, []);

  // ---- Setup mode: category edit ----
  const handleCategoryChange = useCallback((idx, field, value) => {
    setCardsData(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) =>
        i === idx ? { ...cat, [field]: value } : cat
      ),
    }));
  }, []);

  // ---- Quick-fill row labels ----
  const handleQuickFillRow = useCallback((rowIdx, value) => {
    setCardsData(prev => ({
      ...prev,
      cards: prev.cards.map(c =>
        c.row === rowIdx ? { ...c, label: value } : c
      ),
    }));
  }, []);

  // ---- Bulk enable/disable ----
  const handleEnableAll = useCallback((enabled) => {
    setCardsData(prev => ({
      ...prev,
      cards: prev.cards.map(c => ({ ...c, enabled })),
    }));
  }, []);

  // ---- Bulk clear images/answers ----
  const handleClearAll = useCallback((field) => {
    setCardsData(prev => ({
      ...prev,
      cards: prev.cards.map(c => ({ ...c, [field]: '' })),
    }));
  }, []);

  // ---- Category editor save ----
  const handleSaveCategories = useCallback(({ categories, cards }) => {
    setCardsData(prev => ({
      ...prev,
      categories,
      cards,
    }));
    setShowCategoryEditor(false);
  }, []);

  // ---- Preset load ----
  const handlePresetLoad = useCallback((data) => {
    setCardsData(data);
    setSelectedCard(null);
    setUndoStack([]);
    setActivePresetName(loadActivePresetName());
  }, []);

  const handleReset = useCallback(() => {
    log('action:reset');
    setCardsData(defaultCards);
    setSelectedCard(null);
    setFrozenCard(null);
    setRoundComplete(false);
    setUndoStack([]);
    setLastClicked('—');
    setActivePresetName('');
  }, []);

  // ---- Dev Screen toggle ----
  const handleToggleDevScreen = useCallback(async () => {
    if (!window.electronAPI) return;
    log('action:toggle-dev-screen', { open: devScreenOpen, subScreen });
    if (devScreenOpen) {
      await window.electronAPI.closeDevScreen();
      setDevScreenOpen(false);
    } else {
      // Use the selected subScreen display, or let Electron auto-detect
      await window.electronAPI.openDevScreen(subScreen);
      setDevScreenOpen(true);
      syncDevScreen();
    }
  }, [devScreenOpen, subScreen, syncDevScreen]);

  // When subScreen changes and dev screen is open, recreate it on the new display
  const handleSubScreenChangeAndMove = useCallback(async (displayId) => {
    log('action:move-dev-screen', { displayId, devScreenOpen });
    setSubScreen(displayId);
    if (devScreenOpen && window.electronAPI) {
      await window.electronAPI.closeDevScreen();
      await window.electronAPI.openDevScreen(displayId);
      syncDevScreen();
    }
  }, [devScreenOpen, syncDevScreen]);

  // Check dev screen status on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.devScreenStatus().then(setDevScreenOpen);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Mindent vagy semmit!</h1>
        <Controls
          onReset={handleReset}
          onScreenSelect={() => setShowScreenSelector(true)}
          onPresets={() => setShowPresetManager(true)}
          onSetupMode={() => setSetupMode(v => !v)}
          setupMode={setupMode}
          onToggleDevScreen={handleToggleDevScreen}
          devScreenOpen={devScreenOpen}
          onEditCategories={() => setShowCategoryEditor(true)}
          activePresetName={activePresetName}
          lastClicked={lastClicked}
        />
      </header>

      {/* ---- Column titles (editable in setup mode) ---- */}
      <div className="column-titles">
        {cardsData.categories.map((cat, idx) => (
          <div key={cat.id} className="column-title" title={cat.name}>
            {setupMode ? (
              <div className="column-title-edit">
                <input
                  className="column-title-input"
                  type="text"
                  value={cat.icon}
                  onChange={e => handleCategoryChange(idx, 'icon', e.target.value)}
                  title="Icon (emoji)"
                />
                <input
                  className="column-title-input"
                  type="text"
                  value={cat.name}
                  onChange={e => handleCategoryChange(idx, 'name', e.target.value)}
                  title="Category name"
                />
              </div>
            ) : (
              <>
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {frozenCard && !setupMode && (
        <div className="main-freeze-banner" role="status" aria-live="polite">
          <span className="main-freeze-banner__dot" />
          Frozen on {frozenCard.label} — use the dev screen to continue.
        </div>
      )}

      {roundComplete && !setupMode && (
        <div className="main-freeze-banner main-freeze-banner--complete" role="status" aria-live="polite">
          <span className="main-freeze-banner__dot" />
          Round complete. You can reset, load a preset, or start a new round.
        </div>
      )}

      {/* ---- Setup toolbar ---- */}
      {setupMode && (
        <div className="setup-toolbar">
          <span className="setup-toolbar-title">⚙️ Setup Mode</span>
          <div className="setup-toolbar-actions">
            <button className="btn btn--secondary btn--sm" onClick={() => handleEnableAll(true)}>
              ✅ Enable All
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => handleEnableAll(false)}>
              🚫 Disable All
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => handleClearAll('image')}>
              🖼 Clear Images
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => handleClearAll('answer')}>
              📝 Clear Answers
            </button>
            <span className="setup-toolbar-hint">Quick row labels:</span>
            {cardsData.points.map((pts, i) => (
              <button
                key={pts}
                className="btn btn--secondary btn--sm"
                onClick={() => handleQuickFillRow(i, String(pts))}
              >
                Row {i + 1} → {pts}
              </button>
            ))}
          </div>
        </div>
      )}

      <Grid
        cards={cardsData.cards}
        categories={cardsData.categories}
        points={cardsData.points}
        selectedCard={selectedCard}
        setupMode={setupMode}
        onCardChange={handleSetupCardChange}
        onCardClick={handleCardClick}
        onCardDoubleClick={handleCardDoubleClick}
        onCardRightClick={handleCardRightClick}
      />

      {showScreenSelector && (
        <ScreenSelector
          activeScreen={activeScreen}
          subScreen={subScreen}
          onActiveScreenChange={setActiveScreen}
          onSubScreenChange={handleSubScreenChangeAndMove}
          onClose={() => setShowScreenSelector(false)}
        />
      )}

      {showPresetManager && (
        <PresetManager
          cardsData={cardsData}
          onLoad={handlePresetLoad}
          onClose={() => setShowPresetManager(false)}
        />
      )}

      {showCategoryEditor && (
        <CategoryEditor
          categories={cardsData.categories}
          points={cardsData.points}
          cards={cardsData.cards}
          onSave={handleSaveCategories}
          onCancel={() => setShowCategoryEditor(false)}
        />
      )}
    </div>
  );
}
