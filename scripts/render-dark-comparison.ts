import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tintShirtPixels } from '../src/engine/tintShirt';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(root, 'public', 'assets', 'shirt', 'front', 'preview');

async function readPixels(name: string) {
  return sharp(path.join(assetRoot, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

const [mask, shade, highlight, shadeDark, highlightDark] = await Promise.all([
  readPixels('mask.png'),
  readPixels('shade.png'),
  readPixels('highlight.png'),
  readPixels('shade-dark.png'),
  readPixels('highlight-dark.png'),
]);

const oldColor = '#171918';
const luminance = (23 * 0.2126 + 25 * 0.7152 + 24 * 0.0722) / 255;
const oldLightStrength = ((0.65 - luminance) / 0.65) * 0.58;
const oldPixels = new Uint8ClampedArray(
  tintShirtPixels(
    { mask: Uint8ClampedArray.from(mask.data), shade: Uint8ClampedArray.from(shade.data), highlight: Uint8ClampedArray.from(highlight.data) },
    { color: oldColor, shadowStrength: 0.72 },
  ),
);
const newColor = '#111111';
const newLuminance = (17 * 0.2126 + 17 * 0.7152 + 17 * 0.0722) / 255;
const newLightStrength = 0.27 * Math.pow(newLuminance / 0.26, 1.5);
const newPixels = tintShirtPixels(
  { mask: Uint8ClampedArray.from(mask.data), shade: Uint8ClampedArray.from(shadeDark.data), highlight: Uint8ClampedArray.from(highlightDark.data) },
  { color: newColor, shadowStrength: 0.72 },
);

const width = mask.info.width;
const height = mask.info.height;
const beforeImage = await sharp(Buffer.from(oldPixels), { raw: { width, height, channels: 4 } })
  .resize({ width: 520 }).png().toBuffer();
const afterImage = await sharp(Buffer.from(newPixels), { raw: { width, height, channels: 4 } })
  .resize({ width: 520 }).png().toBuffer();

function label(title: string, detail: string): Buffer {
  return Buffer.from(`<svg width="560" height="108" xmlns="http://www.w3.org/2000/svg"><text x="0" y="34" fill="#202421" font-family="Arial, sans-serif" font-size="25" font-weight="700">${title}</text><text x="0" y="67" fill="#626a64" font-family="Arial, sans-serif" font-size="17">${detail}</text></svg>`);
}

const output = await sharp({
  create: { width: 1200, height: 760, channels: 4, background: '#F1F2EF' },
})
  .composite([
    { input: label('Antes · #171918', `Luces auto: ${oldLightStrength.toFixed(2)} · sombras: 0,72`), left: 45, top: 32 },
    { input: label('Después · #111111', `Luces auto: ${newLightStrength.toFixed(2)} · límite: 1,4× · sombras: 0,72`), left: 635, top: 32 },
    { input: beforeImage, left: 35, top: 145 },
    { input: afterImage, left: 625, top: 145 },
  ])
  .png()
  .toBuffer();

await writeFile(path.join(root, 'public', 'assets', 'shirt', 'black-comparison.png'), output);
console.log('Comparación guardada en public/assets/shirt/black-comparison.png');

function legacyTint(color: string): Uint8ClampedArray {
  const channels = color.slice(1).match(/.{2}/g) ?? [];
  const rgb = channels.map((channel) => Number.parseInt(channel, 16));
  const colorLuminance = ((rgb[0] ?? 0) * 0.2126 + (rgb[1] ?? 0) * 0.7152 + (rgb[2] ?? 0) * 0.0722) / 255;
  const strength = Math.max(0, Math.min(1, (0.65 - colorLuminance) / 0.65)) * 0.58;
  const pixels = new Uint8ClampedArray(mask.data.length);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const shadeMultiplier = 1 - 0.72 + ((shade.data[offset] ?? 255) / 255) * 0.72;
    const lightValue = ((highlight.data[offset] ?? 0) / 255) * strength;
    for (let channel = 0; channel < 3; channel += 1) {
      const base = (rgb[channel] ?? 0) * shadeMultiplier;
      pixels[offset + channel] = Math.round(255 - (255 - base) * (1 - lightValue));
    }
    pixels[offset + 3] = mask.data[offset] ?? 0;
  }
  return pixels;
}

const darkSamples = [
  { name: 'Negro', color: '#111111' },
  { name: 'Azul marino', color: '#0B1F4A' },
  { name: 'Gris oscuro', color: '#333333' },
  { name: 'Rojo oscuro', color: '#651717' },
];
const tiles: { input: Buffer; left: number; top: number }[] = [];
for (const [index, sample] of darkSamples.entries()) {
  const pixels = tintShirtPixels(
    { mask: Uint8ClampedArray.from(mask.data), shade: Uint8ClampedArray.from(shadeDark.data), highlight: Uint8ClampedArray.from(highlightDark.data) },
    { color: sample.color, shadowStrength: 0.72 },
  );
  let total = 0;
  let count = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if ((mask.data[offset] ?? 0) < 128) continue;
    total += (pixels[offset] ?? 0) * 0.2126 + (pixels[offset + 1] ?? 0) * 0.7152 + (pixels[offset + 2] ?? 0) * 0.0722;
    count += 1;
  }
  console.log(`${sample.name} ${sample.color}: luminancia media renderizada ${(total / Math.max(count, 1)).toFixed(1)}/255.`);

  const preview = await sharp(Buffer.from(pixels), { raw: { width, height, channels: 4 } })
    .resize({ width: 500 }).png().toBuffer();
  const column = index % 2;
  const row = Math.floor(index / 2);
  const left = 55 + column * 590;
  const top = 115 + row * 590;
  const title = Buffer.from(`<svg width="540" height="54" xmlns="http://www.w3.org/2000/svg"><text x="0" y="33" fill="#202421" font-family="Arial, sans-serif" font-size="22" font-weight="700">${sample.name} · ${sample.color}</text></svg>`);
  tiles.push({ input: title, left, top: top - 50 }, { input: preview, left, top });
}

const darkTones = await sharp({
  create: { width: 1200, height: 1260, channels: 4, background: '#F1F2EF' },
}).composite(tiles).png().toBuffer();
await writeFile(path.join(root, 'public', 'assets', 'shirt', 'dark-tones-validation.png'), darkTones);

for (const sample of [
  { name: 'Blanco', color: '#F4F3EF' },
  { name: 'Amarillo', color: '#E7C943' },
  { name: 'Celeste', color: '#D7E8F4' },
  { name: 'Azul saturado', color: '#3157D5' },
]) {
  const original = legacyTint(sample.color);
  const current = tintShirtPixels(
    { mask: Uint8ClampedArray.from(mask.data), shade: Uint8ClampedArray.from(shade.data), highlight: Uint8ClampedArray.from(highlight.data) },
    { color: sample.color, shadowStrength: 0.72 },
  );
  let differences = 0;
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== original[index]) differences += 1;
  }
  console.log(`${sample.name} ${sample.color}: ${differences} canales distintos frente al algoritmo anterior.`);
}
