import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import type { Side } from '../config/shirt';
import { renderProductExport, type ExportFormat } from '../engine/exportRenderer';
import { useEditorStore } from '../store/useEditorStore';

interface ExportPanelProps { realismEnabled: boolean }
type ExportSize = 1200 | 2000 | 2500;

const labels: Record<Side, string> = { front: 'frente', back: 'espalda' };

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPanel({ realismEnabled }: ExportPanelProps) {
  const color = useEditorStore((state) => state.color);
  const designs = useEditorStore((state) => state.designs);
  const realism = useEditorStore((state) => state.realism);
  const [size, setSize] = useState<ExportSize>(2000);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [transparent, setTransparent] = useState(false);
  const [floorShadow, setFloorShadow] = useState(false);
  const [previewSide, setPreviewSide] = useState<Side>('front');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    setPreviewUrl(null);
    setWarning([]);
  }, [color, designs.front, designs.back, realism, realismEnabled, size, format, transparent, floorShadow]);

  const renderSide = async (side: Side) => {
    const result = await renderProductExport({
      side,
      color,
      designs: designs[side],
      realism,
      realismEnabled,
      size,
      format,
      transparent,
      floorShadow,
    });
    return result;
  };

  const showPreview = async (side: Side) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await renderSide(side);
      setPreviewSide(side);
      setWarning(result.lowResolutionDesigns);
      setPreviewUrl(URL.createObjectURL(result.blob));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo preparar la vista previa.');
    } finally {
      setBusy(false);
    }
  };

  const downloadSide = async (side: Side) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await renderSide(side);
      setWarning(result.lowResolutionDesigns);
      saveBlob(result.blob, `camiseta-${labels[side]}.${format}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar la descarga.');
    } finally {
      setBusy(false);
    }
  };

  const downloadBoth = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const zip = new JSZip();
      const front = await renderSide('front');
      const back = await renderSide('back');
      zip.file(`camiseta-frente.${format}`, front.blob);
      zip.file(`camiseta-espalda.${format}`, back.blob);
      const archive = await zip.generateAsync({ type: 'blob' });
      saveBlob(archive, 'camisetas-personalizadas.zip');
      const warnings = [...front.lowResolutionDesigns, ...back.lowResolutionDesigns];
      setWarning([...new Set(warnings)]);
      setNotice('El ZIP incluye el frente y la espalda.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el archivo ZIP.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel-section export-section" aria-label="Exportación de imágenes">
      <div className="section-title-row">
        <h2>Exportar producto</h2>
        <span className="small-count">PNG · JPG</span>
      </div>
      <p className="export-description">Prepara una imagen cuadrada con la camiseta centrada y el realismo actual.</p>

      <div className="export-options">
        <label className="field-label" htmlFor="export-size">Tamaño</label>
        <select id="export-size" value={size} onChange={(event) => setSize(Number(event.target.value) as ExportSize)}>
          <option value={1200}>1200 × 1200 px</option>
          <option value={2000}>2000 × 2000 px</option>
          <option value={2500}>2500 × 2500 px</option>
        </select>
        <label className="field-label" htmlFor="export-format">Formato</label>
        <select id="export-format" value={format} onChange={(event) => { const nextFormat = event.target.value as ExportFormat; setFormat(nextFormat); if (nextFormat === 'jpg') setTransparent(false); }}>
          <option value="png">PNG · máxima calidad</option>
          <option value="jpg">JPG · calidad 92</option>
        </select>
      </div>

      <label className="export-toggle"><input type="checkbox" checked={transparent} disabled={format === 'jpg'} onChange={(event) => setTransparent(event.target.checked)} /> Fondo transparente{format === 'jpg' && ' (JPG siempre usa blanco)'}</label>
      <label className="export-toggle"><input type="checkbox" checked={floorShadow} onChange={(event) => setFloorShadow(event.target.checked)} /> Sombra suave de suelo</label>

      <div className="export-preview-actions">
        <button type="button" disabled={busy} onClick={() => void showPreview('front')}>Vista previa frente</button>
        <button type="button" disabled={busy} onClick={() => void showPreview('back')}>Vista previa espalda</button>
      </div>
      <div className="export-download-actions">
        <button type="button" disabled={busy} onClick={() => void downloadSide('front')}>Descargar frente</button>
        <button type="button" disabled={busy} onClick={() => void downloadSide('back')}>Descargar espalda</button>
        <button type="button" className="export-zip-button" disabled={busy} onClick={() => void downloadBoth()}>Descargar ambas (ZIP)</button>
      </div>
      {busy && <p className="export-status" role="status">Preparando imagen a {size} px…</p>}
      {error && <p className="field-error export-message" role="alert">{error}</p>}
      {notice && <p className="export-status" role="status">{notice}</p>}
      {warning.length > 0 && <p className="export-warning" role="status">Resolución baja: {warning.join(', ')} podría verse pixelado a {size} px.</p>}

      {previewUrl && (
        <div className="preview-modal" role="dialog" aria-modal="true" aria-label={`Vista previa del ${labels[previewSide]}`}>
          <button type="button" className="preview-close" aria-label="Cerrar vista previa" onClick={() => { setPreviewUrl(null); setWarning([]); }}>×</button>
          <div className="preview-content">
            <p className="preview-title">Vista previa · {labels[previewSide]} · {size} px</p>
            <img src={previewUrl} alt={`Resultado final de la camiseta por ${labels[previewSide]}`} />
            {warning.length > 0 && <p className="export-warning">Resolución baja: {warning.join(', ')} puede verse pixelado.</p>}
            <div className="preview-switcher">
              <button type="button" disabled={busy || previewSide === 'front'} onClick={() => void showPreview('front')}>Frente</button>
              <button type="button" disabled={busy || previewSide === 'back'} onClick={() => void showPreview('back')}>Espalda</button>
              <button type="button" disabled={busy} onClick={() => void downloadSide(previewSide)}>Descargar {labels[previewSide]}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
