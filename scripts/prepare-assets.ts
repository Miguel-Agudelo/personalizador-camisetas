import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Side = 'front' | 'back';
type Rgba = { data: Buffer; info: sharp.OutputInfo };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sides: Side[] = ['front', 'back'];
const outputNames = ['base', 'mask', 'shade', 'highlight', 'texture'] as const;

function percentile(histogram: Uint32Array, count: number, fraction: number): number {
  const target = Math.floor(count * fraction);
  let total = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    total += histogram[value] ?? 0;
    if (total > target) return value;
  }
  return histogram.length - 1;
}

function gaussianBlur(input: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 3);
  const kernel = new Float32Array(radius * 2 + 1);
  let total = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    kernel[offset + radius] = weight;
    total += weight;
  }
  for (let index = 0; index < kernel.length; index += 1) kernel[index] = (kernel[index] ?? 0) / total;

  const horizontal = new Float32Array(input.length);
  const output = new Float32Array(input.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleX = Math.max(0, Math.min(width - 1, x + offset));
        value += (input[y * width + sampleX] ?? 0) * (kernel[offset + radius] ?? 0);
      }
      horizontal[y * width + x] = value;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + offset));
        value += (horizontal[sampleY * width + x] ?? 0) * (kernel[offset + radius] ?? 0);
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

async function rawRgba(file: string): Promise<Rgba> {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function prepareSide(side: Side): Promise<void> {
  const source = path.join(root, 'raw', `${side}.png`);
  try {
    await access(source);
  } catch {
    throw new Error(`No se encontró ${path.relative(root, source)}. Coloca allí el PNG original.`);
  }

  const metadata = await sharp(source).metadata();
  if (metadata.format !== 'png' || !metadata.width || !metadata.height || !metadata.hasAlpha) {
    throw new Error(`${path.relative(root, source)} debe ser PNG con canal alfa/transparencia.`);
  }
  const { data, info } = await rawRgba(source);
  const pixelCount = info.width * info.height;
  const luminance = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);
  let opaqueCount = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] ?? 0;
    if (alpha < 16) continue;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const value = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[pixel] = value;
    histogram[Math.round(value)] = (histogram[Math.round(value)] ?? 0) + 1;
    opaqueCount += 1;
  }
  if (opaqueCount === 0) throw new Error(`${path.relative(root, source)} no contiene píxeles opacos.`);

  const low = percentile(histogram, opaqueCount, 0.02);
  const high = percentile(histogram, opaqueCount, 0.98);
  const range = Math.max(1, high - low);
  const normalized = new Float32Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    normalized[pixel] = Math.max(0, Math.min(1, ((luminance[pixel] ?? 0) - low) / range));
  }

  const alphaPlane = new Float32Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) alphaPlane[pixel] = data[pixel * 4 + 3] ?? 0;
  const textureBlur = gaussianBlur(luminance, info.width, info.height, 4);
  const hemBlur = side === 'back' ? gaussianBlur(normalized, info.width, info.height, 64) : normalized;
  const featheredAlpha = gaussianBlur(alphaPlane, info.width, info.height, 1.25);
  const maskData = Buffer.alloc(pixelCount * 4);
  const shadeData = Buffer.alloc(pixelCount * 4);
  const highlightData = Buffer.alloc(pixelCount * 4);
  const textureData = Buffer.alloc(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const alpha = data[offset + 3] ?? 0;
    const row = Math.floor(pixel / info.width);
    const localHemBlend = side === 'back' ? Math.max(0, Math.min(0.82, (row / info.height - 0.72) * 4)) : 0;
    const smoothShade = normalized[pixel] ?? 0;
    const shade = smoothShade * (1 - localHemBlend) + (hemBlur[pixel] ?? smoothShade) * localHemBlend;
    const shadeValue = Math.round(shade * 255);
    const highlightValue = Math.round(Math.max(0, ((normalized[pixel] ?? 0) - 0.6) / 0.4) * 255);
    const textureDetail = (luminance[pixel] - (textureBlur[pixel] ?? 0)) * 5;
    const hemTextureStrength = side === 'back'
      ? Math.max(0, Math.min(1, 1 - (row / info.height - 0.72) * 4))
      : 1;
    const textureValue = Math.round(Math.max(0, Math.min(255, 127.5 + textureDetail * hemTextureStrength)));
    for (let channel = 0; channel < 3; channel += 1) {
      maskData[offset + channel] = Math.round(featheredAlpha[pixel] ?? alpha);
      shadeData[offset + channel] = shadeValue;
      highlightData[offset + channel] = highlightValue;
      textureData[offset + channel] = textureValue;
    }
    maskData[offset + 3] = 255;
    shadeData[offset + 3] = alpha;
    highlightData[offset + 3] = alpha;
    textureData[offset + 3] = alpha;
  }

  const sideRoot = path.join(root, 'public', 'assets', 'shirt', side);
  for (const variant of ['full', 'preview'] as const) await mkdir(path.join(sideRoot, variant), { recursive: true });
  const mapData: Record<(typeof outputNames)[number], Buffer> = {
    base: data,
    mask: maskData,
    shade: shadeData,
    highlight: highlightData,
    texture: textureData,
  };
  for (const name of outputNames) {
    const raw = mapData[name];
    const fullPath = path.join(sideRoot, 'full', `${name}.png`);
    await sharp(raw, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(fullPath);
    await sharp(fullPath).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(path.join(sideRoot, 'preview', `${name}.png`));
  }
  console.log(`${side}: ${info.width}×${info.height}; percentiles ${low}–${high}; mapas full y preview generados.`);
}

for (const side of sides) await prepareSide(side);
