import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Design } from '../store/useEditorStore';
import { shirtAssets, type Side } from '../config/shirt';

interface DesignPanelProps {
  side: Side;
  designs: Design[];
  selectedDesign: Design | null;
  uploading: boolean;
  errors: string[];
  onUpload: (files: FileList) => void;
  onClearErrors: () => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Design>) => void;
  onLock: (id: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
}

export function DesignPanel({
  side,
  designs,
  selectedDesign,
  uploading,
  errors,
  onUpload,
  onClearErrors,
  onSelect,
  onUpdate,
  onLock,
  onDuplicate,
  onDelete,
  onMoveLayer,
}: DesignPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [opacityDraft, setOpacityDraft] = useState(selectedDesign?.opacity ?? 1);
  const [rotationDraft, setRotationDraft] = useState(selectedDesign?.rotation ?? 0);
  const selectedIndex = designs.findIndex((design) => design.id === selectedDesign?.id);

  useEffect(() => {
    setOpacityDraft(selectedDesign?.opacity ?? 1);
    setRotationDraft(selectedDesign?.rotation ?? 0);
  }, [selectedDesign?.id, selectedDesign?.opacity, selectedDesign?.rotation]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) onUpload(event.currentTarget.files);
    event.currentTarget.value = '';
  };

  const saveOpacity = () => {
    if (selectedDesign && !selectedDesign.locked && opacityDraft !== selectedDesign.opacity) {
      onUpdate(selectedDesign.id, { opacity: opacityDraft });
    }
  };

  const saveRotation = () => {
    if (selectedDesign && !selectedDesign.locked && rotationDraft !== selectedDesign.rotation) {
      onUpdate(selectedDesign.id, { rotation: rotationDraft });
    }
  };

  const currentLayer = selectedDesign ? selectedIndex : -1;

  return (
    <section className="panel-section designs-section" aria-label="Estampados y capas">
      <input
        ref={inputRef}
        className="visually-hidden-file"
        type="file"
        accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
        multiple
        aria-label="Seleccionar estampados para subir"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <div className="section-title-row design-section-title">
        <div>
          <h2>Estampados</h2>
          <p className="section-caption">{side === 'front' ? 'Frente' : 'Espalda'} · {designs.length} {designs.length === 1 ? 'elemento' : 'elementos'}</p>
        </div>
        <button
          className="upload-icon-button"
          type="button"
          aria-label="Subir estampados"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '…' : '+'}
        </button>
      </div>

      <button
        type="button"
        className="upload-well"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <span className="upload-mark" aria-hidden="true">↑</span>
        <span className="upload-copy"><strong>{uploading ? 'Cargando estampado…' : 'Añadir estampado'}</strong><small>PNG, JPG o SVG · hasta 15 MB</small></span>
      </button>

      {errors.length > 0 && (
        <div className="upload-errors" role="alert">
          <button className="error-dismiss" type="button" aria-label="Cerrar errores" onClick={onClearErrors}>×</button>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      {designs.length > 0 ? (
        <div className="layer-list" aria-label="Capas del estampado">
          {[...designs].reverse().map((design) => (
            <button
              className={`layer-row${selectedDesign?.id === design.id ? ' is-selected' : ''}`}
              type="button"
              key={design.id}
              aria-pressed={selectedDesign?.id === design.id}
              onClick={() => onSelect(design.id)}
              title={design.name}
            >
              <span className="layer-thumb" aria-hidden="true"><span /></span>
              <span className="layer-name">{design.name}</span>
              {design.locked && <span className="layer-lock" aria-label="Bloqueado">●</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-layer-copy">Tus estampados aparecerán aquí. Puedes colocar varios en cada lado.</p>
      )}

      {selectedDesign ? (
        <div className="design-editor">
          <div className="selected-design-name" title={selectedDesign.name}>
            <span className="selection-indicator" />
            <span>{selectedDesign.name}</span>
          </div>
          <div className="design-actions" aria-label="Acciones del estampado">
            <button type="button" onClick={() => onUpdate(selectedDesign.id, {
              x: (shirtAssets[side].printArea.x + shirtAssets[side].printArea.w / 2) * shirtAssets[side].size.w,
              y: (shirtAssets[side].printArea.y + shirtAssets[side].printArea.h / 2) * shirtAssets[side].size.h,
            })} disabled={selectedDesign.locked} title="Centrar en la zona imprimible">Centrar</button>
            <button type="button" onClick={() => onUpdate(selectedDesign.id, { flipX: !selectedDesign.flipX })} disabled={selectedDesign.locked} title="Voltear horizontalmente">Voltear ↔</button>
            <button type="button" onClick={() => onUpdate(selectedDesign.id, { flipY: !selectedDesign.flipY })} disabled={selectedDesign.locked} title="Voltear verticalmente">Voltear ↕</button>
            <button type="button" onClick={onDuplicate} disabled={selectedDesign.locked} title="Duplicar estampado">Duplicar</button>
            <button type="button" onClick={() => onLock(selectedDesign.id)} title={selectedDesign.locked ? 'Desbloquear' : 'Bloquear'}>
              {selectedDesign.locked ? 'Desbloquear' : 'Bloquear'}
            </button>
          </div>
          <div className="design-actions layer-actions">
            <button type="button" onClick={() => onMoveLayer(selectedDesign.id, 1)} disabled={selectedDesign.locked || currentLayer === designs.length - 1}>Subir capa</button>
            <button type="button" onClick={() => onMoveLayer(selectedDesign.id, -1)} disabled={selectedDesign.locked || currentLayer <= 0}>Bajar capa</button>
            <button type="button" onClick={onDelete} disabled={selectedDesign.locked} className="delete-design">Eliminar</button>
          </div>
          <label className="range-control">
            <span><span>Opacidad</span><output>{Math.round(opacityDraft * 100)}%</output></span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={opacityDraft}
              disabled={selectedDesign.locked}
              onChange={(event) => setOpacityDraft(Number(event.target.value))}
              onPointerUp={saveOpacity}
              onKeyUp={saveOpacity}
              onBlur={saveOpacity}
            />
          </label>
          <label className="range-control">
            <span><span>Rotación</span><output>{Math.round(rotationDraft)}°</output></span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={rotationDraft}
              disabled={selectedDesign.locked}
              onChange={(event) => setRotationDraft(Number(event.target.value))}
              onPointerUp={saveRotation}
              onKeyUp={saveRotation}
              onBlur={saveRotation}
            />
          </label>
          {selectedDesign.locked && <p className="locked-note">Desbloquea este estampado para editarlo.</p>}
        </div>
      ) : (
        <p className="selection-hint">Selecciona un estampado para moverlo, girarlo o ajustar su opacidad.</p>
      )}
    </section>
  );
}
