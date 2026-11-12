# Personalizador de camisetas

Aplicación web para previsualizar estampados en una camiseta básica fija antes de fabricarlos o comprarlos. Permite personalizar el color, trabajar los lados delantero y trasero, y descargar imágenes de producto.

## Sobre este proyecto

Hice este proyecto haciendo vibecoding con IA. La idea surgió de una necesidad real: quería previsualizar estampados en camisetas básicas antes de fabricarlos o comprarlos.

## Funcionalidades

- Elegir libremente el color de la camiseta.
- Añadir y editar estampados por delante y por detrás.
- Integrar los estampados con las sombras y la textura de la tela.
- Exportar imágenes profesionales del producto con fondo blanco, o con fondo transparente si se elige esa opción.

## Tecnologías

Vite, React, TypeScript, Tailwind CSS, Konva, Zustand y JSZip.

## Instalar y ejecutar

Se necesita Node.js 20 o posterior y npm. Desde la carpeta del proyecto:

```bash
npm install
npm run dev
```

Abre en el navegador la dirección local que indique Vite, normalmente `http://localhost:5173`.

Para crear el build de producción:

```bash
npm run build
```

El resultado se genera en `dist/`.

## Cambiar la foto base

1. Sustituye `raw/front.png` y `raw/back.png` por las nuevas fotos. Ambas deben ser PNG con transparencia y compartir el mismo encuadre y tamaño.
2. Regenera las máscaras y mapas de tela:

   ```bash
   npm run prepare-assets
   ```

3. Los assets actualizados aparecerán en `public/assets/shirt/`. Reinicia el servidor de desarrollo para verlos.

El script comprueba que los PNG tengan transparencia y muestra un error si falta.

## Transparencia sobre las imágenes base

Las fotos base de las camisetas se generaron con una herramienta de IA y después se editaron para recortar el fondo. Su origen es distinto al del código; conviene tenerlo en cuenta si se reutilizan o se distribuyen los assets.

## Privacidad

Todo el procesamiento se hace en el navegador. Las imágenes que sube cada usuario no se envían a ningún servidor.

## Créditos y licencias

La skill `frontend-design`, ubicada en `.agents/skills/frontend-design/`, es de Anthropic. Se conserva junto con su licencia original en `LICENSE.txt`. Esa licencia corresponde a la skill y es independiente de la licencia que se elija para el código de este proyecto.
