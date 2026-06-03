import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import CardEditor from './CardEditor';
import Preferences from './Preferences';
import Scoreboard from './Scoreboard';
import { resolveMediaPath } from './imagePlaceholder';

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
  const [showMode, setShowMode] = useState(null); // 'easy' | 'hard' | null
  const audioRef = useRef(null);
  const fadeRef = useRef(null); // tracks current fade animation frame
  const playIdRef = useRef(0); // increments on each play/stop to cancel stale ops
  const [audioSrc, setAudioSrc] = useState(''); // actual file loaded in <audio>, separate from mode
  const [playTrigger, setPlayTrigger] = useState(0); // incremented to force replay of same track

  // Modal states
  const [showPreferences, setShowPreferences] = useState(false);
  const [activeScreen, setActiveScreen] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  const [appTitle, setAppTitle] = useState('Mindent vagy semmit!');
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState('9kny');

  // Done confirmation dialog state
  const [doneConfirm, setDoneConfirm] = useState(null);
  // { card, step: 'gotAnswer' | 'steal' | 'modeSelect' | 'customPoints',
  //   hasBoth: bool, stealTeamId: string|null, customValue: string }

  // Reset confirmation state
  const [resetConfirm, setResetConfirm] = useState(null); // 'reset-all' | 'reset-scores' | null

  // Activity log
  const [activityLog, setActivityLog] = useState([]); // [{ id, time, teamName, cardLabel, categoryName, points, action }]
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Cancel any in-progress fade animation
  const cancelFade = useCallback(() => {
    if (fadeRef.current) {
      cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  // Immediate stop — no fade, just cut and reset
  const stopAudioImmediate = useCallback(() => {
    playIdRef.current++; // abort any pending play/fade
    cancelFade();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    }
  }, [cancelFade]);

  // Stop audio + reset all audio state
  const stopAudioFull = useCallback(() => {
    stopAudioImmediate();
    setAudioPlaying(false);
    setActiveAudioMode(null);
    setAudioSrc('');
  }, [stopAudioImmediate]);

  const notifyMainAudio = useCallback((mode, playing) => {
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('audio-playing', { mode, playing });
    }
  }, []);

  // Single toggle: if same mode is active → stop; otherwise → play that mode
  const handleAudioToggle = useCallback((mode) => {
    const audioPath = mode === 'hard'
      ? selected?.hardAudio
      : (selected?.easyAudio || selected?.audio);

    if (!audioPath) return;

    if (activeAudioMode === mode) {
      // Same mode is active → stop
      stopAudioFull();
      notifyMainAudio(mode, false);
    } else {
      // Different mode (or nothing playing) → cut current, start new with fade-in
      stopAudioImmediate();
      setAudioPlaying(false);
      setActiveAudioMode(mode);
      setAudioSrc(audioPath);
      setPlayTrigger(n => n + 1);
      notifyMainAudio(mode, true);
    }
  }, [selected?.easyAudio, selected?.audio, selected?.hardAudio, activeAudioMode, stopAudioFull, stopAudioImmediate, notifyMainAudio]);

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
          if (data.teams) setTeams(data.teams);
          if (data.activeTeamId !== undefined) setActiveTeamId(data.activeTeamId);
          setConnected(true);
          break;
        case 'select-card':
          setSelected(prev => {
            const incoming = data.card || null;
            // Preserve answerImage from current selection if incoming card lacks it
            // (prevents race condition where sync arrives before save propagates)
            if (incoming && prev && incoming.row === prev.row && incoming.col === prev.col) {
              if (!incoming.answerImage && prev.answerImage) {
                return { ...incoming, answerImage: prev.answerImage };
              }
            }
            return incoming;
          });
          setShowAnswer(false);
          stopAudioFull();
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
  }, [stopAudioImmediate]);

  useEffect(() => {
    stopAudioFull();
    setActiveAudioMode(null);
  }, [selected, stopAudioFull]);

  // Reload + auto-play audio with fade-in when play is triggered
  useEffect(() => {
    if (!audioRef.current) return;
    if (!audioSrc || !activeAudioMode) return;
    
    cancelFade();
    const audio = audioRef.current;
    const playId = ++playIdRef.current;
    
    audio.volume = 0;
    audio.load();
    audio.play().then(() => {
      // Guard: abort if a newer play/stop was triggered
      if (playId !== playIdRef.current) return;
      setAudioPlaying(true);
      const startTime = performance.now();
      const duration = 350;
      const fadeIn = (now) => {
        if (playId !== playIdRef.current) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        audio.volume = progress;
        if (progress < 1) {
          fadeRef.current = requestAnimationFrame(fadeIn);
        } else {
          audio.volume = 1;
          fadeRef.current = null;
        }
      };
      fadeRef.current = requestAnimationFrame(fadeIn);
    }).catch((err) => {
      if (playId !== playIdRef.current) return;
      console.log('Audio play failed:', err);
      setAudioPlaying(false);
    });
  }, [playTrigger, activeAudioMode, cancelFade]);

  useEffect(() => {
    setShowMode(null);
  }, [selected?.easyImage, selected?.image]);

  const handleSelectCard = useCallback((card) => {
    log('card:select', { row: card.row, col: card.col, label: card.label });
    setSelected(card);
    setShowAnswer(false);
    stopAudioFull();
    setShowMode(null);

    if (window.electronAPI) {
      window.electronAPI.selectOnMain('select-card', {
        card,
        categoryName: categories[card.col]?.name || '',
      });
    }
  }, [categories, stopAudioFull]);

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
    stopAudioFull();
    const mode = 'easy';
    setShowMode(mode);
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
  }, [selected, showMode, stopAudioFull, categories]);

  const handleShowHard = useCallback(() => {
    if (!selected) return;
    const image = selected.hardImage || '';
    const audio = selected.hardAudio || '';
    if (!image && !audio) return; // nothing to show
    if (showMode === 'hard') {
      handleHideMedia();
      return;
    }
    stopAudioFull();
    const mode = 'hard';
    setShowMode(mode);
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
  }, [selected, showMode, stopAudioFull, categories]);

  const handleRevealAnswer = useCallback(() => {
    log('action:reveal-answer', selected ? { row: selected.row, col: selected.col, label: selected.label } : null);
    // Hide any active media before revealing the answer
    if (showMode) {
      handleHideMedia();
    }
    stopAudioFull();
    setShowAnswer(true);
    if (window.electronAPI && selected) {
      window.electronAPI.selectOnMain('show-answer', {
        answer: selected.answer || '',
        answerImage: selected.answerImage || '',
        categoryName: categories[selected.col]?.name || '',
        label: selected.label,
      });
    }
  }, [selected, categories, showMode, stopAudioFull, handleHideMedia]);

  const handleHideAnswer = useCallback(() => {
    log('action:hide-answer', selected ? { row: selected.row, col: selected.col, label: selected.label } : null);
    setShowAnswer(false);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('hide-answer', {});
    }
  }, [selected]);

  // ── Done flow: gotAnswer → steal? → modeSelect → customPoints? → disable ──
  const addLogEntry = useCallback((teamName, cardLabel, categoryName, points, action) => {
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      teamName,
      cardLabel,
      categoryName,
      points,
      action,
    };
    setActivityLog(prev => [entry, ...prev.slice(0, 99)]);
  }, []);

  const finishDone = useCallback((card, gotAnswer, mode, stealTeamId, customPoints) => {
    const teamId = stealTeamId || activeTeamId;
    const teamName = teams.find(t => t.id === teamId)?.name || teamId;
    const catName = categories[card.col]?.name || '';
    const basePts = points[card.row] || 0;

    let pts = 0;
    if (gotAnswer) {
      if (customPoints !== undefined && customPoints !== null) {
        pts = Number(customPoints);
      } else {
        pts = Math.round(basePts * (mode === 'hard' ? 1 : 0.5));
      }
    }

    if (window.electronAPI) {
      window.electronAPI.selectOnMain('disable-card', {
        card,
        gotAnswer,
        mode: mode || 'easy',
        teamId,
        customPoints: customPoints !== undefined ? pts : undefined,
      });
    }

    // Log entry
    const actionLabel = !gotAnswer ? 'No answer' : customPoints !== undefined ? `Custom: ${pts}` : mode === 'hard' ? `Hard (1×): ${pts}` : `Easy (0.5×): ${pts}`;
    addLogEntry(teamName, card.label, catName, pts, actionLabel);

    setDoneConfirm(null);
    setSelected(null);
    setShowAnswer(false);
    stopAudioFull();

    if (window.electronAPI) {
      window.electronAPI.selectOnMain('select-card', { card: null });
    }

    // Auto-step: advance to next team
    if (teams.length > 1) {
      const currentIdx = teams.findIndex(t => t.id === activeTeamId);
      const nextIdx = (currentIdx + 1) % teams.length;
      const nextTeamId = teams[nextIdx].id;
      setTimeout(() => {
        setActiveTeamId(nextTeamId);
        if (window.electronAPI) {
          window.electronAPI.selectOnMain('set-active-team', { teamId: nextTeamId });
        }
      }, 150);
    }
  }, [activeTeamId, teams, categories, points, cards, stopAudioFull, addLogEntry]);

  const handleMarkDone = useCallback(() => {
    if (!selected) return;
    log('action:done-confirm', { row: selected.row, col: selected.col, label: selected.label });

    const hasEasy = !!(selected.easyImage || selected.image || selected.easyAudio || selected.audio);
    const hasHard = !!(selected.hardImage || selected.hardAudio);
    const hasBoth = hasEasy && hasHard;

    setShowAnswer(false);
    stopAudioFull();
    setDoneConfirm({ card: selected, step: 'gotAnswer', hasBoth, stealTeamId: null, customValue: '' });
  }, [selected, stopAudioFull]);

  // Step 1: Got answer?
  const handleDoneGotAnswer = useCallback((got) => {
    if (!doneConfirm) return;
    if (got) {
      // Team got it → go to mode select
      setDoneConfirm(prev => ({ ...prev, step: 'modeSelect' }));
    } else {
      // Didn't get it → ask about stealing
      setDoneConfirm(prev => ({ ...prev, step: 'steal' }));
    }
  }, [doneConfirm]);

  // Step 1b: Steal?
  const handleDoneSteal = useCallback((stealTeamId) => {
    if (!doneConfirm) return;
    if (stealTeamId) {
      setDoneConfirm(prev => ({ ...prev, step: 'modeSelect', stealTeamId }));
    } else {
      // Nobody got it
      finishDone(doneConfirm.card, false, 'easy', null, null);
    }
  }, [doneConfirm, finishDone]);

  // Step 2: Mode select
  const handleDoneMode = useCallback((mode) => {
    if (!doneConfirm) return;
    if (mode === 'custom') {
      setDoneConfirm(prev => ({ ...prev, step: 'customPoints', customValue: '' }));
    } else {
      finishDone(doneConfirm.card, true, mode, doneConfirm.stealTeamId, null);
    }
  }, [doneConfirm, finishDone]);

  // Step 2b: Custom points input
  const handleDoneCustom = useCallback(() => {
    if (!doneConfirm) return;
    const val = parseInt(doneConfirm.customValue, 10);
    if (isNaN(val) || val < 0) return;
    finishDone(doneConfirm.card, true, 'custom', doneConfirm.stealTeamId, val);
  }, [doneConfirm, finishDone]);

  const handleCancelDoneConfirm = useCallback(() => {
    setDoneConfirm(null);
  }, []);

  const handleUnselect = useCallback(() => {
    log('action:unselect');
    setSelected(null);
    setShowAnswer(false);
    stopAudioFull();
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('select-card', { card: null });
    }
  }, [stopAudioFull]);

  const handleReenableCard = useCallback((card) => {
    if (!card || card.enabled) return;
    log('action:reenable', { row: card.row, col: card.col, label: card.label });
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('enable-card', { card });
    }
  }, []);

  // ---- Controls ----
  const handleReset = useCallback(() => {
    setResetConfirm('reset-all');
  }, []);

  const handleResetConfirm = useCallback(() => {
    if (resetConfirm === 'reset-all') {
      log('action:reset-confirmed');
      if (window.electronAPI) {
        window.electronAPI.selectOnMain('request-reset', {});
      }
      addLogEntry('All', '—', '—', 0, 'Game reset');
      setActivityLog([]);
    } else if (resetConfirm === 'reset-scores') {
      log('action:reset-scores-confirmed');
      if (window.electronAPI) {
        window.electronAPI.selectOnMain('reset-team-scores', {});
      }
      addLogEntry('All', '—', '—', 0, 'Scores reset');
    }
    setResetConfirm(null);
  }, [resetConfirm, addLogEntry]);

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

  const handleSelectTeam = useCallback((teamId) => {
    setActiveTeamId(teamId);
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('set-active-team', { teamId });
    }
  }, []);

  const handleAdjustTeamScore = useCallback((teamId, delta) => {
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('adjust-team-score', { teamId, delta });
    }
    const teamName = teams.find(t => t.id === teamId)?.name || teamId;
    const sign = delta > 0 ? '+' : '';
    addLogEntry(teamName, '—', 'Manual', delta, `Manual ${sign}${delta}`);
  }, [teams, addLogEntry]);

  const handleResetTeamScores = useCallback(() => {
    setResetConfirm('reset-scores');
  }, []);

  const handleExportLog = useCallback(() => {
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const rows = [];

    // Header
    rows.push(['Activity Log Export', now].join(','));
    rows.push('');
    rows.push(['Time', 'Team', 'Card', 'Category', 'Points', 'Action'].join(','));

    // Log entries (oldest first for chronological order)
    const sorted = [...activityLog].reverse();
    for (const e of sorted) {
      rows.push([e.time, e.teamName, e.cardLabel, e.categoryName, e.points, e.action].map(c => `"${c}"`).join(','));
    }

    // Final scores section
    rows.push('');
    rows.push(['', '', '', '', '', ''].join(','));
    rows.push(['FINAL SCORES', '', '', '', '', ''].join(','));
    rows.push(['Team', 'Score', '', '', '', ''].join(','));
    for (const t of teams) {
      rows.push([t.name, t.score, '', '', '', ''].join(','));
    }

    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `score-log-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activityLog, teams]);

  const handleRenameTeam = useCallback((teamId, name) => {
    if (window.electronAPI) {
      window.electronAPI.selectOnMain('rename-team', { teamId, name });
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

        {teams.length > 0 && (
          <div className="ds-scoreboard-section">
            <div className="ds-scoreboard-header">
              <span>Teams</span>
              <button className="controls-btn" onClick={handleResetTeamScores} title="Reset all team scores">↺ Reset Scores</button>
            </div>
            <Scoreboard
              teams={teams}
              activeTeamId={activeTeamId}
              onSelectTeam={handleSelectTeam}
              onAdjustScore={handleAdjustTeamScore}
              onRenameTeam={handleRenameTeam}
            />
          </div>
        )}
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

      {/* ---- Team Scoreboard ---- */}
      {teams.length > 0 && (
        <div className="ds-scoreboard-section">
          <div className="ds-scoreboard-header">
            <span>Teams</span>
            <button className="controls-btn" onClick={handleResetTeamScores} title="Reset all team scores">↺ Reset Scores</button>
          </div>
          <Scoreboard
            teams={teams}
            activeTeamId={activeTeamId}
            onSelectTeam={handleSelectTeam}
            onAdjustScore={handleAdjustTeamScore}
            onRenameTeam={handleRenameTeam}
          />
        </div>
      )}

      {/* ---- Activity Log ---- */}
      <div className="ds-log-section">
        <div className="ds-log-header" onClick={() => setShowActivityLog(prev => !prev)}>
          <span>📋 Activity Log ({activityLog.length})</span>
          <span className="ds-log-toggle">{showActivityLog ? '▲' : '▼'}</span>
        </div>
        {showActivityLog && (
          <div className="ds-log-body">
            {activityLog.length === 0 ? (
              <p className="ds-log-empty">No actions yet. Mark cards as done to see entries.</p>
            ) : (
              <div className="ds-log-entries">
                {activityLog.map(entry => (
                  <div key={entry.id} className="ds-log-entry">
                    <span className="ds-log-entry__time">{entry.time}</span>
                    <span className="ds-log-entry__team">{entry.teamName}</span>
                    <span className="ds-log-entry__card">{entry.cardLabel} — {entry.categoryName}</span>
                    <span className={`ds-log-entry__points ${entry.points > 0 ? 'ds-log-entry__points--positive' : 'ds-log-entry__points--zero'}`}>
                      {entry.points > 0 ? `+${entry.points}` : '0'}
                    </span>
                    <span className="ds-log-entry__action">{entry.action}</span>
                  </div>
                ))}
              </div>
            )}
            {activityLog.length > 0 && (
              <div className="ds-log-actions">
                <button className="controls-btn" onClick={() => setActivityLog([])}>
                  Clear Log
                </button>
                <button className="controls-btn" onClick={() => handleExportLog()}>
                  📥 Export CSV
                </button>
              </div>
            )}
          </div>
        )}
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
                  <span className="ds-mini-header-icon">{cat.icon}</span>
                  <span className="ds-mini-header-name">{cat.name}</span>
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
                      className={`ds-mini-cell ${!card.enabled ? 'ds-mini-cell--disabled' : ''} ${sel ? 'ds-mini-cell--selected' : ''} ${(card.easyImage || card.image) ? 'ds-mini-cell--has-easy' : ''} ${card.hardImage ? 'ds-mini-cell--has-hard' : ''} ${(card.easyAudio || card.audio) ? 'ds-mini-cell--has-easy-audio' : ''} ${card.hardAudio ? 'ds-mini-cell--has-hard-audio' : ''}`}
                      onClick={() => card.enabled && handleSelectCard(card)}
                      onDoubleClick={() => handleReenableCard(card)}
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

              <div className="ds-detail-images-stack">
                {/* ── Hard image (top) ── */}
                <div className="ds-detail-image-row">
                  <span className="ds-detail-image-label ds-detail-image-label--hard">🔴 Hard</span>
                  {selected.hardImage ? (
                    <img
                      key={selected.hardImage}
                      src={resolveMediaPath(selected.hardImage)}
                      alt="Hard"
                      className="ds-detail-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="ds-detail-no-image">No hard image</div>
                  )}
                </div>

                {/* ── Easy image (bottom) ── */}
                <div className="ds-detail-image-row">
                  <span className="ds-detail-image-label ds-detail-image-label--easy">🟢 Easy</span>
                  {(selected.easyImage || selected.image) ? (
                    <img
                      key={selected.easyImage || selected.image}
                      src={resolveMediaPath(selected.easyImage || selected.image)}
                      alt="Easy"
                      className="ds-detail-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="ds-detail-no-image">No easy image</div>
                  )}
                </div>
              </div>

              <div className="ds-detail-answer">
                <span className="ds-detail-image-label ds-detail-image-label--answer">💡 Answer</span>
                <div className="ds-detail-answer-text">{selected.answer || '(No answer)'}</div>
                {selected.answerImage && (
                  <img
                    key={selected.answerImage}
                    src={resolveMediaPath(selected.answerImage)}
                    alt="Answer"
                    className="ds-detail-answer-image"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>

              <div className="ds-detail-controls">
                <button className="btn btn--sm btn--secondary" onClick={handleOpenEditor}>
                  ✏️ Edit
                </button>
                <button className="btn btn--sm btn--danger" onClick={handleMarkDone}>
                  ✅ Done
                </button>
                <button className="btn btn--sm btn--secondary" onClick={handleUnselect}>
                  ❌ Unselect
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
                      className={`btn btn--sm ${activeAudioMode === 'hard' ? 'btn--danger' : 'btn--primary'}`}
                      onClick={(e) => { e.stopPropagation(); handleAudioToggle('hard'); }}
                    >
                      {activeAudioMode === 'hard' ? '⏹ Stop Hard' : '🎵 Play Hard'}
                    </button>
                  )}
                  {(selected.easyAudio || selected.audio) && (
                    <button
                      className={`btn btn--sm ${activeAudioMode === 'easy' ? 'btn--danger' : 'btn--primary'}`}
                      onClick={(e) => { e.stopPropagation(); handleAudioToggle('easy'); }}
                    >
                      {activeAudioMode === 'easy' ? '⏹ Stop Easy' : '🎵 Play Easy'}
                    </button>
                  )}
                </div>
              )}

              {/* ── Reveal text answer ── */}
              <div className="ds-detail-controls">
                <button
                  className={`btn btn--sm ${showAnswer ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={showAnswer ? handleHideAnswer : handleRevealAnswer}
                >
                  {showAnswer ? '🙈 Hide Answer' : '👁 Reveal Answer'}
                </button>
              </div>

              <audio ref={audioRef} src={resolveMediaPath(audioSrc)} onEnded={handleAudioEnded} style={{ display: 'none' }} />
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

      {/* ── Reset confirmation modal ── */}
      {resetConfirm && createPortal(
        <div className="ds-modal-overlay" onClick={() => setResetConfirm(null)}>
          <div className="ds-modal ds-modal--done" onClick={e => e.stopPropagation()}>
            <h2 className="ds-modal__title">
              {resetConfirm === 'reset-all' ? '⚠️ Reset everything?' : '⚠️ Reset all scores?'}
            </h2>
            <p className="ds-modal__subtitle">
              {resetConfirm === 'reset-all'
                ? 'This will reset ALL cards, scores, and undo history. This cannot be undone.'
                : 'This will reset all team scores to 0. Card progress will NOT be affected.'}
            </p>
            <div className="ds-modal__actions">
              <button className="btn btn--danger btn--large" onClick={handleResetConfirm}>
                {resetConfirm === 'reset-all' ? '🔄 Yes, Reset All' : '↺ Yes, Reset Scores'}
              </button>
              <button className="btn btn--secondary" onClick={() => setResetConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Done confirmation modal ── */}
      {doneConfirm && createPortal(
        <div className="ds-modal-overlay" onClick={handleCancelDoneConfirm}>
          <div className="ds-modal ds-modal--done" onClick={e => e.stopPropagation()}>
            <h2 className="ds-modal__title">
              {doneConfirm.step === 'gotAnswer' && 'Did the team get the answer?'}
              {doneConfirm.step === 'steal' && 'Did another team steal it?'}
              {doneConfirm.step === 'modeSelect' && 'Select score mode'}
              {doneConfirm.step === 'customPoints' && 'Enter custom points'}
            </h2>
            <p className="ds-modal__subtitle">
              {doneConfirm.card.label} pts — {categories[doneConfirm.card.col]?.name}
              {doneConfirm.stealTeamId && (
                <span className="ds-modal__steal-badge">
                  {' '}→ {teams.find(t => t.id === doneConfirm.stealTeamId)?.name || doneConfirm.stealTeamId}
                </span>
              )}
            </p>

            {/* Step 1: Got answer? */}
            {doneConfirm.step === 'gotAnswer' && (
              <div className="ds-modal__actions">
                <button className="btn btn--success btn--large" onClick={() => handleDoneGotAnswer(true)}>✅ Yes</button>
                <button className="btn btn--danger btn--large" onClick={() => handleDoneGotAnswer(false)}>❌ No</button>
                <button className="btn btn--secondary" onClick={handleCancelDoneConfirm}>Cancel</button>
              </div>
            )}

            {/* Step 1b: Steal? */}
            {doneConfirm.step === 'steal' && (
              <div className="ds-modal__actions ds-modal__actions--steal">
                <p className="ds-modal__steal-prompt">Select the team that stole:</p>
                <div className="ds-modal__steal-teams">
                  {teams.map(t => (
                    <button
                      key={t.id}
                      className={`btn btn--small ${t.id === activeTeamId ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => handleDoneSteal(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <button className="btn btn--danger" onClick={() => handleDoneSteal(null)}>Nobody got it</button>
                <button className="btn btn--secondary" onClick={handleCancelDoneConfirm}>Cancel</button>
              </div>
            )}

            {/* Step 2: Mode select (Easy / Hard / Custom) */}
            {doneConfirm.step === 'modeSelect' && (
              <div className="ds-modal__actions">
                <button className="btn btn--primary btn--large" onClick={() => handleDoneMode('easy')}>🟢 Easy (0.5×)</button>
                <button className="btn btn--danger btn--large" onClick={() => handleDoneMode('hard')}>🔴 Hard (1×)</button>
                <button className="btn btn--accent btn--large" onClick={() => handleDoneMode('custom')}>✏️ Custom</button>
                <button className="btn btn--secondary" onClick={handleCancelDoneConfirm}>Cancel</button>
              </div>
            )}

            {/* Step 2b: Custom points */}
            {doneConfirm.step === 'customPoints' && (
              <div className="ds-modal__actions ds-modal__actions--custom">
                <div className="ds-modal__custom-row">
                  <input
                    className="ds-modal__custom-input"
                    type="number"
                    min="0"
                    value={doneConfirm.customValue}
                    onChange={(e) => setDoneConfirm(prev => ({ ...prev, customValue: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDoneCustom(); }}
                    placeholder="Points..."
                    autoFocus
                  />
                  <span className="ds-modal__custom-label">pts</span>
                </div>
                <button className="btn btn--success btn--large" onClick={handleDoneCustom}>✅ Award</button>
                <button className="btn btn--secondary" onClick={handleCancelDoneConfirm}>Cancel</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Preferences modal ── */}
      {showPreferences && createPortal(
        <Preferences
          appTitle={appTitle}
          categories={categories}
          points={points}
          cards={cards}
          teams={teams}
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
