import React, { useState, useRef, useCallback } from 'react';
import { PLACEHOLDER_IMAGE } from './imagePlaceholder';

export default function CardEditor({ card, categories, onSave, onCancel }) {
  const [label, setLabel] = useState(card.label);
  const [image, setImage] = useState(card.image || '');
  const [answer, setAnswer] = useState(card.answer || '');
  const [audio, setAudio] = useState(card.audio || '');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(card.image || PLACEHOLDER_IMAGE);
  const audioRef = useRef(null);

  const handleImageChange = (value) => {
    setImage(value);
    setPreviewSrc(value || PLACEHOLDER_IMAGE);
  };

  const handleImageError = useCallback(() => {
    setPreviewSrc(PLACEHOLDER_IMAGE);
  }, []);

  const handleSave = () => {
    onSave({
      ...card,
      label,
      image,
      answer,
      audio: audio || '',
    });
  };

  const handlePlayAudio = useCallback(() => {
    if (!audio) return;
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setAudioPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setAudioPlaying(true);
      }
    }
  }, [audio, audioPlaying]);

  const handleAudioEnded = useCallback(() => {
    setAudioPlaying(false);
  }, []);

  const catName = categories[card.col]?.name || `Column ${card.col + 1}`;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal card-editor" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Card</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <div className="editor-info">
            <span className="editor-badge">{catName}</span>
            <span className="editor-badge">{card.label} pont</span>
          </div>

          <label className="editor-field">
            <span>Label:</span>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. 100"
            />
          </label>

          <label className="editor-field">
            <span>Image path:</span>
            <input
              type="text"
              value={image}
              onChange={e => handleImageChange(e.target.value)}
              placeholder="Paste an image URL or local path"
            />
          </label>

          <label className="editor-field">
            <span>Answer text:</span>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="The answer to show..."
              rows={3}
            />
          </label>

          <label className="editor-field">
            <span>Audio path (music snippet):</span>
            <div className="editor-audio-row">
              <input
                type="text"
                value={audio}
                onChange={e => setAudio(e.target.value)}
                placeholder="e.g. music/song.mp3"
              />
              {audio && (
                <button
                  type="button"
                  className={`btn btn--sm ${audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                  onClick={handlePlayAudio}
                >
                  {audioPlaying ? '⏹ Stop' : '▶ Play'}
                </button>
              )}
            </div>
            {audio && <audio ref={audioRef} src={audio} onEnded={handleAudioEnded} style={{ display: 'none' }} />}
          </label>

          <div className="editor-preview">
            <span>Image preview:</span>
            <img
              src={previewSrc}
              alt={image ? 'Preview' : 'Placeholder preview'}
              className={!image ? 'editor-preview__placeholder' : ''}
              onError={handleImageError}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}
