import type { RealismSettings } from '../engine/realismPipeline';

interface RealismPanelProps {
  value: RealismSettings;
  onChange: (patch: Partial<RealismSettings>) => void;
  onReset: () => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function RealismPanel({ value, onChange, onReset, enabled, onToggle }: RealismPanelProps) {
  return (
    <details className="realism-panel">
      <summary>
        <span>Realismo de impresión</span>
        <span className="advanced-tag">Avanzado</span>
      </summary>
      <div className="realism-content">
        <p className="realism-description">Ajusta cómo los pliegues y la trama atraviesan la tinta.</p>
        <label className="range-control">
          <span><span>Sombras</span><output>{Math.round(value.shadows * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={value.shadows} onChange={(event) => onChange({ shadows: Number(event.target.value) })} />
        </label>
        <label className="range-control">
          <span><span>Luces</span><output>{Math.round(value.highlights * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={value.highlights} onChange={(event) => onChange({ highlights: Number(event.target.value) })} />
        </label>
        <label className="range-control">
          <span><span>Textura de tela</span><output>{Math.round(value.texture * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={value.texture} onChange={(event) => onChange({ texture: Number(event.target.value) })} />
        </label>
        <label className="realism-toggle">
          <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
          <span><strong>Con realismo</strong><small>Actívalo y desactívalo para comparar</small></span>
        </label>
        <button className="reset-realism" type="button" onClick={onReset}>Restablecer valores</button>
      </div>
    </details>
  );
}
