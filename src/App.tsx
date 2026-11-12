import { useEffect, useState } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { DesignPanel } from './components/DesignPanel';
import { RealismPanel } from './components/RealismPanel';
import { ExportPanel } from './components/ExportPanel';
import { useEditorStore } from './store/useEditorStore';
import type { Side } from './config/shirt';
import { useImageUpload } from './hooks/useImageUpload';

const palette = [
  { label: 'Blanco', color: '#F4F3EF' },
  { label: 'Negro', color: '#111111' },
  { label: 'Gris', color: '#858A88' },
  { label: 'Rojo', color: '#C94137' },
  { label: 'Azul', color: '#3157D5' },
  { label: 'Verde', color: '#3E7657' },
  { label: 'Amarillo', color: '#E7C943' },
  { label: 'Rosa', color: '#D9889D' },
];

const sideNames: Record<Side, string> = { front: 'Frente', back: 'Espalda' };

export default function App() {
  const color = useEditorStore((state) => state.color);
  const activeSide = useEditorStore((state) => state.activeSide);
  const designs = useEditorStore((state) => state.designs[state.activeSide]);
  const selectedDesignId = useEditorStore((state) => state.selectedDesignId);
  const realism = useEditorStore((state) => state.realism);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const setColor = useEditorStore((state) => state.setColor);
  const setActiveSide = useEditorStore((state) => state.setActiveSide);
  const selectDesign = useEditorStore((state) => state.selectDesign);
  const updateDesign = useEditorStore((state) => state.updateDesign);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setRealism = useEditorStore((state) => state.setRealism);
  const resetRealism = useEditorStore((state) => state.resetRealism);
  const { uploadFiles, uploading, errors, clearErrors } = useImageUpload();
  const [hexDraft, setHexDraft] = useState(color);
  const [hexError, setHexError] = useState(false);
  const [realismEnabled, setRealismEnabled] = useState(true);
  const selectedDesign = designs.find((design) => design.id === selectedDesignId) ?? null;

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = useEditorStore.getState();
      const selected = state.designs[state.activeSide].find((design) => design.id === state.selectedDesignId);
      const command = event.ctrlKey || event.metaKey;

      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (command && event.key.toLowerCase() === 'd' && selected && !selected.locked) {
        event.preventDefault();
        state.duplicateSelected();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected && !selected.locked) {
        event.preventDefault();
        state.deleteSelected();
        return;
      }
      if (event.key === 'Escape') {
        state.selectDesign(null);
        return;
      }
      if (!selected || selected.locked) return;
      const step = event.shiftKey ? 10 : 1;
      const movement: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const delta = movement[event.key];
      if (!delta) return;
      event.preventDefault();
      state.updateDesign(selected.id, { x: selected.x + delta.x, y: selected.y + delta.y });
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const applyHex = () => {
    const normalized = hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      setHexError(true);
      return;
    }
    const nextColor = normalized.toUpperCase();
    setColor(nextColor);
    setHexDraft(nextColor);
    setHexError(false);
  };

  const chooseColor = (nextColor: string) => {
    setColor(nextColor);
    setHexDraft(nextColor);
    setHexError(false);
  };

  const uploadToSide = (files: FileList, side: Side) => {
    void uploadFiles(files, side);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Personalizador de camisetas, inicio">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">Tinta<span> / </span>tela</span>
        </a>
        <nav className="side-tabs" aria-label="Lado de la camiseta">
          {(['front', 'back'] as const).map((side) => (
            <button
              key={side}
              className={`side-tab${activeSide === side ? ' is-active' : ''}`}
              type="button"
              aria-pressed={activeSide === side}
              onClick={() => setActiveSide(side)}
            >
              {sideNames[side]}
            </button>
          ))}
        </nav>
        <div className="topbar-status"><span /> Editor de camiseta</div>
      </header>

      <div className="editor-layout">
        <div className="canvas-column">
          <div className="page-title">
            <div>
              <h1>Personaliza tu camiseta</h1>
              <p>El color se aplica por ambos lados; cada lado conserva sus estampados.</p>
            </div>
            <div className="page-actions">
              <div className="history-actions" aria-label="Historial de cambios">
                <button type="button" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">Deshacer</button>
                <button type="button" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)">Rehacer</button>
              </div>
              <span className="side-indicator">{sideNames[activeSide]}</span>
            </div>
          </div>
          <EditorCanvas
            side={activeSide}
            color={color}
            realism={realism}
            realismEnabled={realismEnabled}
            designs={designs}
            selectedDesignId={selectedDesignId}
            onSelectDesign={selectDesign}
            onUpdateDesign={updateDesign}
            onDropFiles={uploadToSide}
            onUploadClick={() => document.querySelector<HTMLInputElement>('.visually-hidden-file')?.click()}
          />
        </div>

        <aside className="control-panel" aria-label="Controles de color">
          <div className="panel-section color-section">
            <div className="section-title-row">
              <h2>Color de tela</h2>
              <span className="color-preview" style={{ backgroundColor: color }} aria-label={`Color actual ${color}`} />
            </div>
            <label className="field-label" htmlFor="shirt-color">Elige cualquier tono</label>
            <div className="picker-row">
              <input
                id="shirt-color"
                className="native-color-picker"
                type="color"
                value={color}
                onChange={(event) => chooseColor(event.target.value.toUpperCase())}
                aria-label="Selector libre de color"
              />
              <span>Abre el selector de color</span>
            </div>

            <label className="field-label hex-label" htmlFor="hex-color">Código HEX</label>
            <div className={`hex-field${hexError ? ' has-error' : ''}`}>
              <span>#</span>
              <input
                id="hex-color"
                value={hexDraft.replace(/^#/, '')}
                maxLength={6}
                spellCheck={false}
                aria-invalid={hexError}
                aria-describedby={hexError ? 'hex-error' : undefined}
                onChange={(event) => setHexDraft(`#${event.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase()}`)}
                onBlur={applyHex}
                onKeyDown={(event) => { if (event.key === 'Enter') applyHex(); }}
              />
              <span className="hex-swatch" style={{ backgroundColor: color }} />
            </div>
            {hexError && <p className="field-error" id="hex-error">Escribe seis caracteres HEX, por ejemplo 3157D5.</p>}
          </div>

          <div className="panel-section palette-section">
            <div className="section-title-row">
              <h2>Colores básicos</h2>
              <span className="small-count">{palette.length} tonos</span>
            </div>
            <div className="swatch-grid">
              {palette.map((item) => (
                <button
                  className={`swatch-button${color.toUpperCase() === item.color ? ' is-selected' : ''}`}
                  key={item.label}
                  type="button"
                  aria-label={`Elegir color ${item.label}`}
                  aria-pressed={color.toUpperCase() === item.color}
                  onClick={() => chooseColor(item.color)}
                >
                  <span className="swatch" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <DesignPanel
            side={activeSide}
            designs={designs}
            selectedDesign={selectedDesign}
            uploading={uploading}
            errors={errors}
            onUpload={(files) => uploadToSide(files, activeSide)}
            onClearErrors={clearErrors}
            onSelect={selectDesign}
            onUpdate={updateDesign}
            onLock={toggleLock}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onMoveLayer={moveLayer}
          />

          <RealismPanel
            value={realism}
            onChange={setRealism}
            onReset={resetRealism}
            enabled={realismEnabled}
            onToggle={setRealismEnabled}
          />

          <ExportPanel realismEnabled={realismEnabled} />

          <div className="panel-note">
            <span className="note-icon" aria-hidden="true">✳</span>
            <p>Las sombras y los pliegues de la tela se ajustan al color que elijas.</p>
          </div>
          <div className="panel-bottom">
            <span className="panel-bottom-rule" />
            <p>Tu color se mantiene igual por ambos lados.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
