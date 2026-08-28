import React, { memo } from 'react';
import Card from './Card';

const Grid = memo(function Grid({
  cards,
  categories,
  points,
  selectedCard,
  onCardClick,
  onCardDoubleClick,
  onCardRightClick,
}) {
  const getCard = (r, c) => cards.find(card => card.row === r && card.col === c);
  const click = onCardClick || (() => {});
  const dblClick = onCardDoubleClick || (() => {});
  const rightClick = onCardRightClick || (() => {});

  const maxTiles = Math.max(...categories.map(c => c.tiles ?? points.length), 1);

  return (
    <div className="grid" role="grid" aria-label={`${categories.length}×${maxTiles} game board`}>
      {categories.map((cat, colIdx) => {
        const colTiles = cat.tiles ?? points.length;
        return (
          <div className="grid-col" key={colIdx} role="row">
            {Array.from({ length: colTiles }, (_, rowIdx) => {
              const card = getCard(rowIdx, colIdx);
              if (!card) return <div key={rowIdx} className="card-placeholder" />;
              const isSelected = selectedCard?.row === rowIdx && selectedCard?.col === colIdx;
              return (
                <Card
                  key={`${rowIdx}-${colIdx}`}
                  card={card}
                  category={cat}
                  isSelected={isSelected}
                  onClick={() => click(card)}
                  onDoubleClick={() => dblClick(card)}
                  onContextMenu={(e) => { e.preventDefault(); rightClick(card); }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

export default Grid;
