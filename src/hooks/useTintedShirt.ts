import { useEffect, useState } from 'react';
import { shirtAssets, type Side } from '../config/shirt';
import { isDarkColor, tintShirtPixels } from '../engine/tintShirt';

type ShirtStatus = 'loading' | 'ready' | 'error';
interface TintedShirtState {
  canvas: HTMLCanvasElement | null;
  clipMask: HTMLCanvasElement | null;
  maps: RealismMapCanvases | null;
  status: ShirtStatus;
  error: string | null;
}

export interface RealismMapCanvases {
  shade: HTMLCanvasElement;
  highlight: HTMLCanvasElement;
  shadeDark: HTMLCanvasElement;
  highlightDark: HTMLCanvasElement;
  texture: HTMLCanvasElement;
}

type LayerPixels = [ImageData, ImageData, ImageData, ImageData, ImageData, ImageData];
const layerCache = new Map<Side, Promise<LayerPixels>>();
const clipMaskCache = new Map<Side, HTMLCanvasElement>();
const realismMapCache = new Map<Side, RealismMapCanvases>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}

async function readPixels(src: string): Promise<ImageData> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('El navegador no pudo crear el lienzo de imagen.');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function loadLayers(side: Side): Promise<LayerPixels> {
  const cached = layerCache.get(side);
  if (cached) return cached;
  const assets = shirtAssets[side];
  const request = Promise.all([
    readPixels(assets.mask),
    readPixels(assets.shade),
    readPixels(assets.highlight),
    readPixels(assets.shadeDark),
    readPixels(assets.highlightDark),
    readPixels(assets.texture),
  ]).catch((error: unknown) => {
    layerCache.delete(side);
    throw error;
  });
  layerCache.set(side, request);
  return request;
}

function pixelsToCanvas(pixels: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar los mapas de realismo.');
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function useTintedShirt(side: Side, color: string, shadowStrength: number): TintedShirtState {
  const [result, setResult] = useState<TintedShirtState>({ canvas: null, clipMask: null, maps: null, status: 'loading', error: null });

  useEffect(() => {
    let cancelled = false;
    setResult((current) => ({ ...current, status: 'loading', error: null }));
    const debounce = window.setTimeout(() => {
      void loadLayers(side)
      .then(([mask, shade, highlight, shadeDark, highlightDark, texture]) => {
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = mask.width;
        canvas.height = mask.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('El navegador no pudo preparar la camiseta.');
        const useDarkMaps = isDarkColor(color);
        const pixels = tintShirtPixels(
          {
            mask: mask.data,
            shade: useDarkMaps ? shadeDark.data : shade.data,
            highlight: useDarkMaps ? highlightDark.data : highlight.data,
          },
          { color, shadowStrength },
        );
        const imageData = context.createImageData(mask.width, mask.height);
        imageData.data.set(pixels);
        context.putImageData(imageData, 0, 0);
        let clipMask = clipMaskCache.get(side);
        if (!clipMask) {
          clipMask = document.createElement('canvas');
          clipMask.width = mask.width;
          clipMask.height = mask.height;
          const maskContext = clipMask.getContext('2d');
          if (!maskContext) throw new Error('El navegador no pudo preparar la máscara de recorte.');
          const alphaMask = maskContext.createImageData(mask.width, mask.height);
          for (let offset = 0; offset < mask.data.length; offset += 4) {
            const alpha = mask.data[offset] ?? 0;
            alphaMask.data[offset] = 255;
            alphaMask.data[offset + 1] = 255;
            alphaMask.data[offset + 2] = 255;
            alphaMask.data[offset + 3] = alpha;
          }
          maskContext.putImageData(alphaMask, 0, 0);
          clipMaskCache.set(side, clipMask);
        }
        let maps = realismMapCache.get(side);
        if (!maps) {
          maps = {
            shade: pixelsToCanvas(shade),
            highlight: pixelsToCanvas(highlight),
            shadeDark: pixelsToCanvas(shadeDark),
            highlightDark: pixelsToCanvas(highlightDark),
            texture: pixelsToCanvas(texture),
          };
          realismMapCache.set(side, maps);
        }
        setResult({ canvas, clipMask, maps, status: 'ready', error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          canvas: null,
          clipMask: null,
          maps: null,
          status: 'error',
          error: error instanceof Error ? error.message : 'No se pudieron preparar los mapas de la camiseta.',
        });
      });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [side, color, shadowStrength]);

  return result;
}
