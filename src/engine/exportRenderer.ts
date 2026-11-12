import type { Design } from '../store/useEditorStore';
import { shirtAssets, type Side } from '../config/shirt';
import { buildRealismPipeline, realismAssetName, type RealismSettings } from './realismPipeline';
import { isDarkColor, tintShirtPixels } from './tintShirt';

export type ExportFormat = 'png' | 'jpg';

export interface ProductExportOptions {
  side: Side;
  color: string;
  designs: Design[];
  realism: RealismSettings;
  realismEnabled: boolean;
  size: 1200 | 2000 | 2500;
  format: ExportFormat;
  transparent: boolean;
  floorShadow: boolean;
}

export interface ProductExportResult {
  blob: Blob;
  lowResolutionDesigns: string[];
}

function fullAssetUrl(side: Side, name: string): string {
  return `/assets/shirt/${side}/full/${name}.png`;
}

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const result = new Image();
    result.onload = () => resolve(result);
    result.onerror = () => reject(new Error(`No se pudo cargar el recurso: ${src}`));
    result.src = src;
  });
}

function pixels(src: string): Promise<ImageData> {
  return image(src).then((loaded) => {
    const scratch = document.createElement('canvas');
    scratch.width = loaded.naturalWidth;
    scratch.height = loaded.naturalHeight;
    const context = scratch.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('El navegador no pudo preparar los mapas de exportación.');
    context.drawImage(loaded, 0, 0);
    const data = context.getImageData(0, 0, scratch.width, scratch.height);
    scratch.width = 0;
    scratch.height = 0;
    return data;
  });
}

function canvasFromPixels(data: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  const context = result.getContext('2d');
  if (!context) throw new Error('El navegador no pudo crear la imagen de la camiseta.');
  const imageData = context.createImageData(width, height);
  imageData.data.set(data);
  context.putImageData(imageData, 0, 0);
  return result;
}

function bounds(mask: ImageData) {
  let left = mask.width;
  let top = mask.height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if ((mask.data[(y * mask.width + x) * 4 + 3] ?? 0) > 4) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right <= left || bottom <= top) throw new Error('La máscara de la camiseta está vacía.');
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

function loadDesign(src: string): Promise<HTMLImageElement> {
  return image(src).catch(() => { throw new Error('No se pudo cargar uno de los estampados para exportar.'); });
}

function encode(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('El navegador no pudo codificar la imagen.')), format === 'jpg' ? 'image/jpeg' : 'image/png', format === 'jpg' ? 0.92 : undefined);
  });
}

export async function renderProductExport(options: ProductExportOptions): Promise<ProductExportResult> {
  const { side, color, designs, realism, realismEnabled, size, format, transparent, floorShadow } = options;
  const assets = shirtAssets[side];
  const dark = isDarkColor(color);
  const shadeName = dark ? 'shade-dark' : 'shade';
  const highlightName = dark ? 'highlight-dark' : 'highlight';
  const pipeline = buildRealismPipeline(color, realism, realismEnabled);
  const requiredMaps = [...new Set(pipeline.map(realismAssetName))];
  const [maskData, shadeData, highlightData, ...loadedAssets] = await Promise.all([
    pixels(fullAssetUrl(side, 'mask')),
    pixels(fullAssetUrl(side, shadeName)),
    pixels(fullAssetUrl(side, highlightName)),
    ...requiredMaps.map((name) => image(fullAssetUrl(side, name))),
    ...designs.map((design) => loadDesign(design.src)),
  ]);
  const mapImages = new Map(requiredMaps.map((name, index) => [name, loadedAssets[index] as HTMLImageElement]));
  const artwork = loadedAssets.slice(requiredMaps.length);
  const width = maskData.width;
  const height = maskData.height;
  const tinted = canvasFromPixels(tintShirtPixels({ mask: maskData.data, shade: shadeData.data, highlight: highlightData.data }, { color, shadowStrength: realism.shadows }), width, height);
  const maskCanvas = canvasFromPixels(Uint8ClampedArray.from(maskData.data, (value, index) => index % 4 === 3 ? value : 255), width, height);
  const box = bounds(maskData);
  const marginFit = size * 0.88 / Math.max(box.right - box.left, box.bottom - box.top);
  const scale = marginFit;
  const originX = size / 2 - ((box.left + box.right) / 2) * scale;
  const originY = size / 2 - ((box.top + box.bottom) / 2) * scale;
  const output = document.createElement('canvas');
  output.width = size;
  output.height = size;
  const context = output.getContext('2d');
  if (!context) throw new Error('Este navegador no pudo crear el lienzo de exportación. Prueba con un tamaño menor.');
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const layer = scratch.getContext('2d');
  if (!layer) throw new Error('Este navegador no pudo crear las capas auxiliares de exportación.');
  const lowResolutionDesigns: string[] = [];

  try {
    if (!transparent) {
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, size, size);
    }
    if (floorShadow) {
      const shadowY = originY + (box.bottom - box.top) * scale * 0.965;
      context.save();
      context.filter = `blur(${Math.max(6, size * 0.012)}px)`;
      context.fillStyle = 'rgba(35, 38, 34, 0.20)';
      context.beginPath();
      context.ellipse(size / 2, shadowY, (box.right - box.left) * scale * 0.28, size * 0.012, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    layer.globalCompositeOperation = 'source-over';
    layer.drawImage(tinted, 0, 0);
    const previewScaleX = width / assets.size.w;
    const previewScaleY = height / assets.size.h;
    designs.forEach((design, index) => {
      const loaded = artwork[index] as HTMLImageElement;
      const x = design.x * previewScaleX;
      const y = design.y * previewScaleY;
      const designWidth = design.width * previewScaleX;
      const designHeight = design.height * previewScaleY;
      const printWidth = Math.abs(designWidth * design.scaleX * scale);
      const printHeight = Math.abs(designHeight * design.scaleY * scale);
      if (printWidth > loaded.naturalWidth * 1.05 || printHeight > loaded.naturalHeight * 1.05) lowResolutionDesigns.push(design.name);
      layer.save();
      layer.translate(x, y);
      layer.rotate((design.rotation * Math.PI) / 180);
      layer.scale(design.scaleX * (design.flipX ? -1 : 1), design.scaleY * (design.flipY ? -1 : 1));
      layer.globalAlpha = design.opacity;
      layer.drawImage(loaded, -designWidth / 2, -designHeight / 2, designWidth, designHeight);
      layer.restore();
    });
    layer.globalAlpha = 1;
    layer.globalCompositeOperation = 'destination-in';
    layer.drawImage(maskCanvas, 0, 0);
    layer.globalCompositeOperation = 'source-over';
    context.save();
    context.translate(originX, originY);
    context.scale(scale, scale);
    context.drawImage(scratch, 0, 0);
    context.restore();

    // The editor and export use the same ordered blend/opacity description from buildRealismPipeline.
    for (const item of pipeline) {
      const map = mapImages.get(realismAssetName(item));
      if (!map) continue;
      context.save();
      context.globalCompositeOperation = item.blend;
      context.globalAlpha = item.opacity;
      context.drawImage(map, originX, originY, width * scale, height * scale);
      context.restore();
    }

    const blob = await encode(output, format);
    return { blob, lowResolutionDesigns: [...new Set(lowResolutionDesigns)] };
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'IndexSizeError' || error.name === 'InvalidStateError' || error.name === 'SecurityError')) {
      throw new Error('El navegador no tiene memoria suficiente para este tamaño. Prueba 1200 px o cierra otras pestañas.');
    }
    throw error;
  } finally {
    tinted.width = 0;
    tinted.height = 0;
    maskCanvas.width = 0;
    maskCanvas.height = 0;
    scratch.width = 0;
    scratch.height = 0;
    output.width = 0;
    output.height = 0;
  }
}
