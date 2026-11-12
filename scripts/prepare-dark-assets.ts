import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Side = 'front' | 'back';
type Variant = 'full' | 'preview';
type RawImage = { data: Buffer; info: sharp.OutputInfo };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function boxBlur(input: Float32Array<ArrayBufferLike>, width: number, height: number, radius: number): Float32Array<ArrayBuffer> {
  const windowSize = radius * 2 + 1;
  const horizontal = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const x = Math.max(0, Math.min(width - 1, offset));
      sum += input[row + x] ?? 0;
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / windowSize;
      const leaving = Math.max(0, x - radius);
      const entering = Math.min(width - 1, x + radius + 1);
      sum += (input[row + entering] ?? 0) - (input[row + leaving] ?? 0);
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const y = Math.max(0, Math.min(height - 1, offset));
      sum += horizontal[y * width + x] ?? 0;
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / windowSize;
      const leaving = Math.max(0, y - radius);
      const entering = Math.min(height - 1, y + radius + 1);
      sum += (horizontal[entering * width + x] ?? 0) - (horizontal[leaving * width + x] ?? 0);
    }
  }
  return output;
}

function softenMap(map: RawImage, mask: RawImage, radii: number[]): Buffer {
  const { width, height } = map.info;
  const mapChannels = map.info.channels;
  const maskChannels = mask.info.channels;
  const pixelCount = width * height;
  let weights = new Float32Array(pixelCount);
  let weightedValues = new Float32Array(pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const weight = (mask.data[pixel * maskChannels] ?? 0) / 255;
    weights[pixel] = weight;
    weightedValues[pixel] = ((map.data[pixel * mapChannels] ?? 0) / 255) * weight;
  }

  for (const radius of radii) {
    weights = boxBlur(weights, width, height, radius);
    weightedValues = boxBlur(weightedValues, width, height, radius);
  }

  const output = Buffer.alloc(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const denominator = weights[pixel] ?? 0;
    const value = denominator > 0.0001 ? (weightedValues[pixel] ?? 0) / denominator : 0;
    const channelValue = Math.round(Math.max(0, Math.min(255, value * 255)));
    const sourceOffset = pixel * mapChannels;
    const outputOffset = pixel * 4;
    output[outputOffset] = channelValue;
    output[outputOffset + 1] = channelValue;
    output[outputOffset + 2] = channelValue;
    output[outputOffset + 3] = mapChannels === 4 ? (map.data[sourceOffset + 3] ?? 0) : 255;
  }
  return output;
}

async function readRaw(file: string): Promise<RawImage> {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

for (const side of ['front', 'back'] satisfies Side[]) {
  for (const variant of ['full', 'preview'] satisfies Variant[]) {
    const directory = path.join(root, 'public', 'assets', 'shirt', side, variant);
    const [mask, shade, highlight] = await Promise.all([
      readRaw(path.join(directory, 'mask.png')),
      readRaw(path.join(directory, 'shade.png')),
      readRaw(path.join(directory, 'highlight.png')),
    ]);
    if (mask.info.width !== shade.info.width || mask.info.height !== shade.info.height ||
        mask.info.width !== highlight.info.width || mask.info.height !== highlight.info.height) {
      throw new Error(`Los mapas de ${side}/${variant} no tienen las mismas dimensiones.`);
    }

    const scale = mask.info.width / 1200;
    const radii = [3, 3, 3].map((radius) => Math.max(1, Math.round(radius * scale)));
    for (const [name, source] of [['shade-dark', shade], ['highlight-dark', highlight]] as const) {
      const output = softenMap(source, mask, radii);
      await sharp(output, {
        raw: { width: mask.info.width, height: mask.info.height, channels: 4 },
      }).png({ compressionLevel: 9 }).toFile(path.join(directory, `${name}.png`));
    }
    console.log(`${side}/${variant}: mapas oscuros suavizados (${radii.join(', ')} px).`);
  }
}
