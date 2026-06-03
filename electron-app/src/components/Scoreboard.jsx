import React, { memo, useState, useCallback, useRef, useEffect } from 'react';

const Scoreboard = memo(function Scoreboard({
  teams,
  activeTeamId,
  onSelectTeam,
  onAdjustScore,
  onRenameTeam,
}) {
  const selectTeam = onSelectTeam || (() => {});
  const adjustScore = onAdjustScore || (() => {});
  const renameTeam = onRenameTeam || (() => {});
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const startRename = useCallback((team) => {
    setEditingId(team.id);
    setEditValue(team.name);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      renameTeam(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, renameTeam]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  return (
    <div className="scoreboard" role="region" aria-label="Team scores">
      {teams.map((team) => {
        const isActive = team.id === activeTeamId;
        const isEditing = team.id === editingId;
        return (
          <div
            key={team.id}
            className={`scoreboard__team ${isActive ? 'scoreboard__team--active' : ''} ${isEditing ? 'scoreboard__team--editing' : ''}`}
            onClick={() => !isEditing && selectTeam(team.id)}
            title={`${team.name} — ${team.score} points`}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="scoreboard__team-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="scoreboard__team-name"
                onDoubleClick={(e) => { e.stopPropagation(); startRename(team); }}
                title="Double-click to rename"
              >
                {team.name}
              </div>
            )}
            <div className="scoreboard__team-score">{team.score}</div>
            {!isEditing && (
              <div className="scoreboard__team-actions">
                <button
                  className="scoreboard__btn scoreboard__btn--minus"
                  onClick={(e) => { e.stopPropagation(); adjustScore(team.id, -25); }}
                  title="-25"
                >
                  −
                </button>
                <button
                  className="scoreboard__btn scoreboard__btn--plus"
                  onClick={(e) => { e.stopPropagation(); adjustScore(team.id, +25); }}
                  title="+25"
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default Scoreboard;
