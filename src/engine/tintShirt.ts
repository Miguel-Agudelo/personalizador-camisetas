export interface TintLayers {
  mask: Uint8ClampedArray;
  shade: Uint8ClampedArray;
  highlight: Uint8ClampedArray;
}

export interface TintOptions {
  color: string;
  shadowStrength: number;
}

export function isDarkColor(color: string): boolean {
  const channels = color.slice(1).match(/.{2}/g);
  if (!channels || channels.length !== 3) return false;
  const [red, green, blue] = channels.map((channel) => Number.parseInt(channel, 16));
  const luminance = ((red ?? 0) * 0.2126 + (green ?? 0) * 0.7152 + (blue ?? 0) * 0.0722) / 255;
  return luminance < 0.26;
}

export function tintShirtPixels(layers: TintLayers, options: TintOptions): Uint8ClampedArray {
  const output = new Uint8ClampedArray(layers.mask.length);
  const channels = options.color.slice(1).match(/.{2}/g);
  if (!channels || channels.length !== 3) throw new Error('El color debe estar en formato HEX #RRGGBB.');

  const rgb = channels.map((channel) => Number.parseInt(channel, 16));
  const colorLuminance = ((rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722) / 255;
  const darkColor = colorLuminance < 0.26;
  const autoHighlight = Math.max(0, Math.min(1, (0.65 - colorLuminance) / 0.65));
  const highlightStrength = darkColor
    ? 0.27 * Math.pow(Math.max(0, colorLuminance / 0.26), 1.5)
    : autoHighlight * 0.58;
  const shadowStrength = Math.max(0, Math.min(1, options.shadowStrength));

  for (let offset = 0; offset < layers.mask.length; offset += 4) {
    const alpha = layers.mask[offset] ?? 0;
    const shade = (layers.shade[offset] ?? 255) / 255;
    const mapHighlight = (layers.highlight[offset] ?? 0) / 255;
    const highlight = (darkColor ? Math.pow(mapHighlight, 2.5) : mapHighlight) * highlightStrength;
    const shadeMultiplier = 1 - shadowStrength + shade * shadowStrength;
    for (let channel = 0; channel < 3; channel += 1) {
      const colorChannel = rgb[channel] ?? 0;
      const multiplied = colorChannel * shadeMultiplier;
      const screened = 255 - (255 - multiplied) * (1 - highlight);
      const capped = darkColor ? Math.min(screened, colorChannel * 1.4) : screened;
      output[offset + channel] = Math.round(capped);
    }
    output[offset + 3] = alpha;
  }
  return output;
}
