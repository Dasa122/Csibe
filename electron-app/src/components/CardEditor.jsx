import React, { useState, useRef, useCallback } from 'react';
import { PLACEHOLDER_IMAGE } from './imagePlaceholder';

export default function CardEditor({ card, categories, onSave, onCancel }) {
  const [label, setLabel] = useState(card.label);
  const [easyImage, setEasyImage] = useState(card.easyImage || card.image || '');
  const [hardImage, setHardImage] = useState(card.hardImage || '');
  const [answer, setAnswer] = useState(card.answer || '');
  const [easyAudio, setEasyAudio] = useState(card.easyAudio || card.audio || '');
  const [hardAudio, setHardAudio] = useState(card.hardAudio || '');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(card.easyImage || card.image || PLACEHOLDER_IMAGE);
  const [audioSrc, setAudioSrc] = useState(card.easyAudio || card.audio || '');
  const audioRef = useRef(null);

  const handleSave = () => {
    onSave({
      ...card,
      label,
      easyImage,
      hardImage,
      answer,
      easyAudio: easyAudio || '',
      hardAudio: hardAudio || '',
    });
  };

  const handlePlayAudio = useCallback(() => {
    if (!audioSrc || !audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    } else {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
      setAudioPlaying(true);
    }
  }, [audioSrc, audioPlaying]);

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
            <span>🟢 Easy image path:</span>
            <input
              type="text"
              value={easyImage}
              onChange={e => { setEasyImage(e.target.value); setPreviewSrc(e.target.value || PLACEHOLDER_IMAGE); }}
              placeholder="Easy image URL or path"
            />
          </label>

          <label className="editor-field">
            <span>🔴 Hard image path:</span>
            <input
              type="text"
              value={hardImage}
              onChange={e => setHardImage(e.target.value)}
              placeholder="Hard image URL or path"
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
            <span>🟢 Easy audio path:</span>
            <div className="editor-audio-row">
              <input
                type="text"
                value={easyAudio}
                onChange={e => { setEasyAudio(e.target.value); setAudioSrc(e.target.value); }}
                placeholder="Easy music/sound path"
              />
            </div>
          </label>

          <label className="editor-field">
            <span>🔴 Hard audio path:</span>
            <div className="editor-audio-row">
              <input
                type="text"
                value={hardAudio}
                onChange={e => setHardAudio(e.target.value)}
                placeholder="Hard music/sound path"
              />
              {(easyAudio || hardAudio) && (
                <button
                  type="button"
                  className={`btn btn--sm ${audioPlaying ? 'btn--danger' : 'btn--primary'}`}
                  onClick={() => { setAudioSrc(hardAudio || easyAudio); handlePlayAudio(); }}
                >
                  {audioPlaying ? '⏹ Stop' : '▶ Test'}
                </button>
              )}
            </div>
            {(easyAudio || hardAudio) && <audio ref={audioRef} src={audioSrc} onEnded={handleAudioEnded} style={{ display: 'none' }} />}
          </label>

          <div className="editor-preview">
            <span>Image preview:</span>
            <img
              src={previewSrc}
              alt={easyImage ? 'Preview' : 'Placeholder preview'}
              className={!easyImage ? 'editor-preview__placeholder' : ''}
              onError={() => setPreviewSrc(PLACEHOLDER_IMAGE)}
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
