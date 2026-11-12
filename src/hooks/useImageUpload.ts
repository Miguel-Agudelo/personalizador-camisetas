import { useState } from 'react';
import { shirtAssets, type Side } from '../config/shirt';
import { useEditorStore, type Design } from '../store/useEditorStore';
import { revokeObjectUrl, trackObjectUrl } from '../utils/objectUrls';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'svg']);
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

function extensionOf(fileName: string): string {
  return fileName.split('.').at(-1)?.toLowerCase() ?? '';
}

function loadUploadedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen. Guarda una copia PNG, JPG o SVG válida e inténtalo de nuevo.'));
    image.src = src;
  });
}

export function useImageUpload() {
  const addDesign = useEditorStore((state) => state.addDesign);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const uploadFiles = async (fileList: FileList | File[], side: Side): Promise<void> => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setErrors([]);
    const nextErrors: string[] = [];
    const area = shirtAssets[side].printArea;
    const size = shirtAssets[side].size;

    for (const file of files) {
      const extension = extensionOf(file.name);
      if (!allowedExtensions.has(extension) || (file.type && !allowedMimeTypes.has(file.type))) {
        nextErrors.push(`${file.name}: usa un archivo PNG, JPG o SVG.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        nextErrors.push(`${file.name}: supera el máximo de 15 MB.`);
        continue;
      }
      if (file.size === 0) {
        nextErrors.push(`${file.name}: el archivo está vacío.`);
        continue;
      }

      const src = URL.createObjectURL(file);
      trackObjectUrl(src);
      try {
        const image = await loadUploadedImage(src);
        if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('La imagen no tiene dimensiones válidas.');
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const targetWidth = area.w * size.w * 0.4;
        const initialScale = targetWidth / width;
        const design: Design = {
          id: crypto.randomUUID(),
          src,
          name: file.name,
          width,
          height,
          x: (area.x + area.w / 2) * size.w,
          y: (area.y + area.h / 2) * size.h,
          scaleX: initialScale,
          scaleY: initialScale,
          rotation: 0,
          opacity: 1,
          locked: false,
          flipX: false,
          flipY: false,
        };
        addDesign(side, design);
      } catch (error) {
        revokeObjectUrl(src);
        const reason = error instanceof Error ? error.message : 'No se pudo abrir el archivo.';
        nextErrors.push(`${file.name}: ${reason}`);
      }
    }
    setErrors(nextErrors);
    setUploading(false);
  };

  return { uploadFiles, uploading, errors, clearErrors: () => setErrors([]) };
}
