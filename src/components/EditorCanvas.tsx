import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import Konva from 'konva';
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from 'react-konva';
import type { Design } from '../store/useEditorStore';
import { shirtAssets, type Side } from '../config/shirt';
import { useTintedShirt } from '../hooks/useTintedShirt';
import { buildRealismPipeline, realismAssetName, type RealismSettings } from '../engine/realismPipeline';

interface EditorCanvasProps {
  side: Side;
  color: string;
  realism: RealismSettings;
  realismEnabled: boolean;
  designs: Design[];
  selectedDesignId: string | null;
  onSelectDesign: (id: string | null) => void;
  onUpdateDesign: (id: string, patch: Partial<Design>) => void;
  onDropFiles: (files: FileList, side: Side) => void;
  onUploadClick: () => void;
}

interface DesignImageProps {
  design: Design;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragMove: (node: Konva.Image) => void;
  onDragEnd: (design: Design, node: Konva.Image) => void;
  onTransformEnd: (design: Design, node: Konva.Image) => void;
}

function useDesignImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const next = new Image();
    next.onload = () => { if (!cancelled) setImage(next); };
    next.onerror = () => { if (!cancelled) setImage(null); };
    next.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return image;
}

function DesignImage({ design, selected, onSelect, onDragMove, onDragEnd, onTransformEnd }: DesignImageProps) {
  const image = useDesignImage(design.src);
  if (!image) return null;

  return (
    <KonvaImage
      id={`design-${design.id}`}
      name="shirt-design"
      image={image}
      x={design.x}
      y={design.y}
      offsetX={design.width / 2}
      offsetY={design.height / 2}
      width={design.width}
      height={design.height}
      scaleX={design.scaleX * (design.flipX ? -1 : 1)}
      scaleY={design.scaleY * (design.flipY ? -1 : 1)}
      rotation={design.rotation}
      opacity={design.opacity}
      draggable={!design.locked}
      listening
      perfectDrawEnabled={false}
      onClick={() => onSelect(design.id)}
      onTap={() => onSelect(design.id)}
      onDragStart={() => onSelect(design.id)}
      onDragMove={(event) => onDragMove(event.target as Konva.Image)}
      onDragEnd={(event) => onDragEnd(design, event.target as Konva.Image)}
      onTransformEnd={(event) => onTransformEnd(design, event.target as Konva.Image)}
      stroke={selected ? '#3157D5' : undefined}
      strokeWidth={selected ? 1.5 : 0}
    />
  );
}

export function EditorCanvas({
  side,
  color,
  realism,
  realismEnabled,
  designs,
  selectedDesignId,
  onSelectDesign,
  onUpdateDesign,
  onDropFiles,
  onUploadClick,
}: EditorCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [viewport, setViewport] = useState({ width: 640, height: 640 });
  const [zoom, setZoom] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCenterGuide, setShowCenterGuide] = useState(false);
  const { canvas, clipMask, maps, status, error } = useTintedShirt(side, color, realism.shadows);
  const sideAsset = shirtAssets[side];
  const selectedDesign = designs.find((design) => design.id === selectedDesignId) ?? null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const transformer = transformerRef.current;
    if (!stage || !transformer) return;
    const node = selectedDesign && !selectedDesign.locked
      ? stage.findOne(`#design-${selectedDesign.id}`)
      : null;
    transformer.nodes(node ? [node as Konva.Image] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedDesign, canvas, viewport]);

  const fit = canvas
    ? Math.min((viewport.width * 0.9) / canvas.width, (viewport.height * 0.9) / canvas.height) * zoom
    : 1;
  const imageWidth = canvas ? canvas.width * fit : 0;
  const imageHeight = canvas ? canvas.height * fit : 0;
  const layerX = (viewport.width - imageWidth) / 2;
  const layerY = (viewport.height - imageHeight) / 2;
  const area = sideAsset.printArea;
  const realismLayers = buildRealismPipeline(color, realism, realismEnabled);
  const stageMask = useMemo(() => {
    if (!clipMask || fit <= 0) return null;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = Math.ceil(viewport.width / fit);
    maskCanvas.height = Math.ceil(viewport.height / fit);
    const context = maskCanvas.getContext('2d');
    if (!context) return null;
    context.drawImage(clipMask, layerX / fit, layerY / fit, sideAsset.size.w, sideAsset.size.h);
    return maskCanvas;
  }, [clipMask, fit, layerX, layerY, sideAsset.size.h, sideAsset.size.w, viewport.height, viewport.width]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (event.dataTransfer.files.length > 0) onDropFiles(event.dataTransfer.files, side);
  };

  const handleDragMove = (node: Konva.Image) => {
    const centerX = sideAsset.size.w / 2;
    const distance = Math.abs(node.x() - centerX);
    if (distance <= 12) {
      node.x(centerX);
      setShowCenterGuide(true);
    } else {
      setShowCenterGuide(false);
    }
  };

  const handleDragEnd = (design: Design, node: Konva.Image) => {
    setShowCenterGuide(false);
    onUpdateDesign(design.id, { x: node.x(), y: node.y() });
  };

  const handleTransformEnd = (design: Design, node: Konva.Image) => {
    const scaleX = Math.max(0.02, Math.abs(node.scaleX()));
    const scaleY = Math.max(0.02, Math.abs(node.scaleY()));
    onUpdateDesign(design.id, {
      x: node.x(),
      y: node.y(),
      scaleX,
      scaleY,
      rotation: node.rotation(),
    });
  };

  return (
    <section className="work-area" aria-label={side === 'front' ? 'Vista del frente' : 'Vista de la espalda'}>
      <div className="canvas-heading">
        <span>{side === 'front' ? 'Frente de la camiseta' : 'Espalda de la camiseta'}</span>
        <span className="canvas-resolution">Vista de edición · 1200 px</span>
      </div>
      <div
        className={`canvas-stage${isDragOver ? ' is-drag-over' : ''}`}
        ref={hostRef}
        onDragEnter={(event) => { event.preventDefault(); setIsDragOver(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragOver(false); }}
        onDrop={handleDrop}
      >
        <Stage
          ref={stageRef}
          width={viewport.width}
          height={viewport.height}
          onMouseDown={(event) => { if (event.target === event.target.getStage()) onSelectDesign(null); }}
          onTouchStart={(event) => { if (event.target === event.target.getStage()) onSelectDesign(null); }}
        >
          <Layer x={layerX} y={layerY} scaleX={fit} scaleY={fit}>
            {canvas && (
              <KonvaImage
                image={canvas}
                width={canvas.width}
                height={canvas.height}
                listening={false}
                perfectDrawEnabled={false}
              />
            )}
            {designs.map((design) => (
              <DesignImage
                key={design.id}
                design={design}
                selected={selectedDesignId === design.id}
                onSelect={onSelectDesign}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
              />
            ))}
            {stageMask && (
              <KonvaImage
                image={stageMask}
                x={-layerX / fit}
                y={-layerY / fit}
                width={stageMask.width}
                height={stageMask.height}
                globalCompositeOperation="destination-in"
                listening={false}
                perfectDrawEnabled={false}
              />
            )}
            {maps && realismLayers.map((layer) => {
              const assetName = realismAssetName(layer);
              const image = assetName === 'shade-dark' ? maps.shadeDark
                : assetName === 'highlight-dark' ? maps.highlightDark
                  : assetName === 'shade' ? maps.shade
                    : assetName === 'highlight' ? maps.highlight
                      : maps.texture;
              return (
                <KonvaImage
                  key={`${layer.map}-${layer.variant}`}
                  image={image}
                  width={sideAsset.size.w}
                  height={sideAsset.size.h}
                  opacity={layer.opacity}
                  globalCompositeOperation={layer.blend}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            })}
            <Rect
              x={area.x * sideAsset.size.w}
              y={area.y * sideAsset.size.h}
              width={area.w * sideAsset.size.w}
              height={area.h * sideAsset.size.h}
              stroke="#3157D5"
              strokeWidth={1.2 / fit}
              dash={[6 / fit, 5 / fit]}
              listening={false}
              perfectDrawEnabled={false}
            />
            {showCenterGuide && (
              <Line
                points={[sideAsset.size.w / 2, 0, sideAsset.size.w / 2, sideAsset.size.h]}
                stroke="#3157D5"
                strokeWidth={1.2 / fit}
                dash={[5 / fit, 4 / fit]}
                listening={false}
              />
            )}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio
              flipEnabled={false}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotateAnchorOffset={24 / fit}
              anchorSize={8 / fit}
              borderStroke="#3157D5"
              anchorStroke="#3157D5"
              anchorFill="#FFFFFF"
              anchorCornerRadius={2 / fit}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 / fit || newBox.height < 12 / fit ? oldBox : newBox)}
              onTransformStart={() => setShowCenterGuide(false)}
            />
          </Layer>
        </Stage>
        {status === 'loading' && <p className="canvas-message">Preparando los detalles de la tela…</p>}
        {status === 'error' && <p className="canvas-message canvas-error">{error}</p>}
        {isDragOver && <div className="drop-overlay">Suelta aquí tus estampados</div>}
        {designs.length === 0 && status === 'ready' && !isDragOver && (
          <button className="canvas-empty-prompt" type="button" onClick={onUploadClick}>
            Arrastra tu estampado aquí o selecciónalo
          </button>
        )}
      </div>
      <div className="canvas-footer">
        <span className="fabric-note"><span className="fabric-dot" /> Sombras y pliegues activos</span>
        <div className="zoom-controls" aria-label="Controles de zoom">
          <button type="button" aria-label="Alejar" onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Acercar" onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}>+</button>
        </div>
      </div>
    </section>
  );
}
