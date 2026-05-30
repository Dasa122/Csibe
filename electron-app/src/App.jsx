import React, { useState, useCallback, useEffect, useRef } from 'react';
import Grid from './components/Grid';
import Controls from './components/Controls';
import CardEditor from './components/CardEditor';
import SubPage from './components/SubPage';
import ScreenSelector from './components/ScreenSelector';
import PresetManager, { loadActivePresetName } from './components/PresetManager';
import defaultCards from './data/cards.json';

const STORAGE_KEY = 'mindent-vagy-semmit-cards';

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
  const [cardsData, setCardsData] = useState(loadCards);
  const [selectedCard, setSelectedCard] = useState(null);
  const [subPageCard, setSubPageCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [showScreenSelector, setShowScreenSelector] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showCardButtons, setShowCardButtons] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [lastClicked, setLastClicked] = useState('—');
  const [activeScreen, setActiveScreen] = useState(0);
  const [subScreen, setSubScreen] = useState(1);
  const [activePresetName, setActivePresetName] = useState(loadActivePresetName);

  // Refs for stable access in event listeners
  const undoStackRef = useRef(undoStack);
  undoStackRef.current = undoStack;
  const subPageCardRef = useRef(subPageCard);
  subPageCardRef.current = subPageCard;
  const editingCardRef = useRef(editingCard);
  editingCardRef.current = editingCard;
  const selectedCardRef = useRef(selectedCard);
  selectedCardRef.current = selectedCard;

  // Persist card changes
  useEffect(() => {
    saveCards(cardsData);
  }, [cardsData]);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const action = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    if (action.type === 'disable') {
      setCardsData(cd => cd.map(c =>
        c.row === action.row && c.col === action.col
          ? { ...c, enabled: true }
          : c
      ));
    } else if (action.type === 'select') {
      setSelectedCard(null);
    }
  }, []);

  const handleCloseSubPage = useCallback(() => {
    setSubPageCard(null);
    if (window.electronAPI) {
      window.electronAPI.closeSubpage();
    }
  }, []);

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
        if (subPageCardRef.current) {
          handleCloseSubPage();
        } else if (editingCardRef.current) {
          setEditingCard(null);
        } else if (selectedCardRef.current) {
          setSelectedCard(null);
        } else if (setupMode) {
          setSetupMode(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleCloseSubPage, setupMode]);

  const pushUndo = useCallback((action) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  const handleCardClick = useCallback((card) => {
    if (setupMode) return;
    if (!card.enabled) return;
    setSelectedCard(card);
    setLastClicked(`${card.label} — ${cardsData.categories[card.col]?.name || ''}`);
    pushUndo({ type: 'select', row: card.row, col: card.col });
  }, [cardsData.categories, pushUndo, setupMode]);

  const handleCardDoubleClick = useCallback((card) => {
    if (setupMode) return;
    if (!card.enabled) return;
    setSubPageCard(card);
  }, [setupMode]);

  const handleCardRightClick = useCallback((card) => {
    if (setupMode) return;
    if (!card.enabled) return;
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

  const handleEditCard = useCallback((card) => {
    setEditingCard({ ...card });
  }, []);

  const handleSaveCard = useCallback((edited) => {
    setCardsData(prev => prev.map(c =>
      c.row === edited.row && c.col === edited.col ? edited : c
    ));
    setEditingCard(null);
  }, []);

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

  // ---- Preset load ----
  const handlePresetLoad = useCallback((data) => {
    setCardsData(data);
    setSelectedCard(null);
    setUndoStack([]);
    setActivePresetName(loadActivePresetName());
  }, []);

  const handleReset = useCallback(() => {
    setCardsData(defaultCards);
    setSelectedCard(null);
    setUndoStack([]);
    setLastClicked('—');
    setActivePresetName('');
  }, []);

  const handleOpenSubOnOtherScreen = useCallback((card) => {
    if (window.electronAPI) {
      window.electronAPI.openSubpage(
        `/sub/${card.row}/${card.col}`,
        subScreen
      );
    }
  }, [subScreen]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Mindent vagy semmit!</h1>
        <Controls
          undoStack={undoStack}
          onUndo={handleUndo}
          onReset={handleReset}
          onToggleEditButtons={() => setShowCardButtons(v => !v)}
          showEditButtons={showCardButtons}
          onScreenSelect={() => setShowScreenSelector(true)}
          onPresets={() => setShowPresetManager(true)}
          onSetupMode={() => setSetupMode(v => !v)}
          setupMode={setupMode}
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
        showButtons={showCardButtons}
        setupMode={setupMode}
        onCardChange={handleSetupCardChange}
        onCardClick={handleCardClick}
        onCardDoubleClick={handleCardDoubleClick}
        onCardRightClick={handleCardRightClick}
        onEditCard={handleEditCard}
        onOpenSubOnOtherScreen={handleOpenSubOnOtherScreen}
      />

      {editingCard && (
        <CardEditor
          card={editingCard}
          categories={cardsData.categories}
          onSave={handleSaveCard}
          onCancel={() => setEditingCard(null)}
        />
      )}

      {subPageCard && (
        <SubPage
          card={subPageCard}
          category={cardsData.categories[subPageCard.col]}
          onClose={handleCloseSubPage}
        />
      )}

      {showScreenSelector && (
        <ScreenSelector
          activeScreen={activeScreen}
          subScreen={subScreen}
          onActiveScreenChange={setActiveScreen}
          onSubScreenChange={setSubScreen}
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
    </div>
  );
}
