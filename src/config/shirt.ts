export type Side = 'front' | 'back';

export interface ShirtSideAssets {
  base: string;
  mask: string;
  shade: string;
  highlight: string;
  shadeDark: string;
  highlightDark: string;
  texture: string;
  printArea: { x: number; y: number; w: number; h: number };
  size: { w: number; h: number };
}

const assetRoot = '/assets/shirt';

export const shirtAssets: Record<Side, ShirtSideAssets> = {
  front: {
    base: `${assetRoot}/front/preview/base.png`,
    mask: `${assetRoot}/front/preview/mask.png`,
    shade: `${assetRoot}/front/preview/shade.png`,
    highlight: `${assetRoot}/front/preview/highlight.png`,
    shadeDark: `${assetRoot}/front/preview/shade-dark.png`,
    highlightDark: `${assetRoot}/front/preview/highlight-dark.png`,
    texture: `${assetRoot}/front/preview/texture.png`,
    printArea: { x: 0.29, y: 0.28, w: 0.42, h: 0.3 },
    size: { w: 1200, h: 1177 },
  },
  back: {
    base: `${assetRoot}/back/preview/base.png`,
    mask: `${assetRoot}/back/preview/mask.png`,
    shade: `${assetRoot}/back/preview/shade.png`,
    highlight: `${assetRoot}/back/preview/highlight.png`,
    shadeDark: `${assetRoot}/back/preview/shade-dark.png`,
    highlightDark: `${assetRoot}/back/preview/highlight-dark.png`,
    texture: `${assetRoot}/back/preview/texture.png`,
    printArea: { x: 0.29, y: 0.28, w: 0.42, h: 0.3 },
    size: { w: 1200, h: 1178 },
  },
};
