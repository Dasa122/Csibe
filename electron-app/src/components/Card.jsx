import React, { memo, useState, useCallback } from 'react';

const Card = memo(function Card({
  card,
  category,
  isSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
}) {
  const [ripple, setRipple] = useState(null);

  const handleClick = useCallback((e) => {
    if (!card.enabled) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    setRipple({ x: x - size / 2, y: y - size / 2, size });
    setTimeout(() => setRipple(null), 700);

    onClick();
  }, [card.enabled, onClick]);

  const classNames = [
    'card',
    !card.enabled && 'card--disabled',
    isSelected && 'card--selected',
    (card.easyImage || card.image) && 'card--has-image',
    (card.easyAudio || card.audio || card.hardAudio) && 'card--has-audio',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      role="gridcell"
      tabIndex={card.enabled ? 0 : -1}
      aria-disabled={!card.enabled}
      aria-label={`${card.label} pont — ${category.name}`}
    >
      <span className="card-label">{card.label}</span>

      {ripple && (
        <span
          className="card-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      )}
    </div>
  );
});

export default Card;
