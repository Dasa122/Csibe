import React, { memo } from 'react';
import Card from './Card';

const Grid = memo(function Grid({
  cards,
  categories,
  points,
  selectedCard,
  showButtons,
  setupMode,
  onCardChange,
  onCardClick,
  onCardDoubleClick,
  onCardRightClick,
  onEditCard,
  onOpenSubOnOtherScreen,
}) {
  const getCard = (r, c) => cards.find(card => card.row === r && card.col === c);

  return (
    <div className={`grid ${setupMode ? 'grid--setup' : ''}`} role="grid" aria-label="7×7 game board">
      {points.map((pts, rowIdx) => (
        <div className="grid-row" key={rowIdx}>
          {categories.map((cat, colIdx) => {
            const card = getCard(rowIdx, colIdx);
            if (!card) return <div key={colIdx} className="card-placeholder" />;
            const isSelected = selectedCard?.row === rowIdx && selectedCard?.col === colIdx;
            return (
              <Card
                key={`${rowIdx}-${colIdx}`}
                card={card}
                row={rowIdx}
                col={colIdx}
                category={cat}
                isSelected={isSelected}
                showButtons={showButtons}
                setupMode={setupMode}
                onCardChange={onCardChange}
                onClick={() => onCardClick(card)}
                onDoubleClick={() => onCardDoubleClick(card)}
                onContextMenu={(e) => { e.preventDefault(); onCardRightClick(card); }}
                onEdit={() => onEditCard(card)}
                onOpenOther={() => onOpenSubOnOtherScreen(card)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

export default Grid;
