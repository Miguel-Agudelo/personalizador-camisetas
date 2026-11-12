import { isDarkColor } from './tintShirt';

export interface RealismSettings {
  shadows: number;
  highlights: number;
  texture: number;
}

export const DEFAULT_REALISM: RealismSettings = {
  shadows: 0.72,
  highlights: 0.24,
  texture: 0.22,
};

export interface RealismLayer {
  map: 'shade' | 'highlight' | 'texture';
  blend: 'multiply' | 'screen' | 'soft-light';
  opacity: number;
  variant: 'standard' | 'dark';
}

export function realismAssetName(layer: RealismLayer): 'shade' | 'shade-dark' | 'highlight' | 'highlight-dark' | 'texture' {
  if (layer.map === 'shade') return layer.variant === 'dark' ? 'shade-dark' : 'shade';
  if (layer.map === 'highlight') return layer.variant === 'dark' ? 'highlight-dark' : 'highlight';
  return 'texture';
}

export function buildRealismPipeline(
  color: string,
  settings: RealismSettings,
  enabled: boolean,
): RealismLayer[] {
  if (!enabled) return [];
  const dark = isDarkColor(color);
  const layers: RealismLayer[] = [];
  if (settings.shadows > 0) {
    layers.push({ map: 'shade', blend: 'multiply', opacity: Math.min(0.6, settings.shadows * 0.6), variant: dark ? 'dark' : 'standard' });
  }
  if (settings.highlights > 0) {
    layers.push({ map: 'highlight', blend: 'screen', opacity: settings.highlights * (dark ? 0.16 : 1), variant: dark ? 'dark' : 'standard' });
  }
  if (settings.texture > 0) {
    layers.push({ map: 'texture', blend: 'soft-light', opacity: settings.texture, variant: 'standard' });
  }
  return layers;
}
