# Personalizador de camisetas — Especificación del proyecto (v2)

> Renombra este archivo según tu herramienta: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex y otros), `.cursor/rules/proyecto.md` (Cursor). Léelo completo antes de escribir código.

## 1. Objetivo

Web app 100 % en el navegador (sin backend, sin base de datos, sin cuentas, sin pagos) con **una camiseta base fija** (la misma para todos los usuarios, frente y espalda). El usuario:

1. Elige **cualquier color** para la camiseta (selector libre + HEX).
2. Sube sus estampados (PNG/SVG/JPG) y los coloca, escala, rota y ordena a su gusto **por delante y por detrás**.
3. Descarga una **imagen profesional de producto**: fondo blanco, camiseta centrada, lista para tiendas tipo Mercado Libre.

**El usuario NO sube la camiseta.** La calidad visual del resultado depende sobre todo de la calidad de la foto base (ver sección 5), no del código.

Fuera de alcance (no construir): login, carrito, pagos, servidor, guardado en la nube, mockups 3D, subida de camisetas por el usuario.

## 2. Stack

- **Vite + React + TypeScript** (modo estricto).
- **Tailwind CSS** para la interfaz.
- **Konva + react-konva** para el lienzo (mover/escalar/rotar con `Transformer`). Alternativa válida: Fabric.js. Elegir una y no mezclar.
- **Zustand** para el estado.
- **JSZip** para descargar frente + espalda en un ZIP.
- **sharp** (solo en Node, como script de desarrollo) para preparar los assets de la camiseta.
- Todo se procesa en el cliente. Ninguna imagen del usuario sale del navegador.

## 3. Modelo de datos (Zustand)

```ts
type Side = 'front' | 'back';

interface Design {
  id: string;
  src: string;                  // objectURL o dataURL del estampado
  x: number; y: number;
  scaleX: number; scaleY: number;
  rotation: number;
  opacity: number;              // 0–1
  locked: boolean;
}

interface AppState {
  color: string;                // HEX, p. ej. '#1f6feb'
  activeSide: Side;
  designs: Record<Side, Design[]>;   // orden de apilado: último = encima
  selectedDesignId: string | null;
  realism: {
    shadowStrength: number;     // 0–1, sombras sobre la camiseta y el estampado
    highlightStrength: number;  // 0–1 (auto según color, ajustable)
    textureStrength: number;    // 0–1, textura de tela sobre el estampado
  };
}
```

Configuración fija de la camiseta (no es estado del usuario), en `src/config/shirt.ts`:

```ts
interface ShirtSideAssets {
  base: string;        // foto original (RGBA, fondo transparente)
  mask: string;        // silueta (alfa) en blanco sobre negro
  shade: string;       // mapa de sombras (gris, normalizado)
  highlight: string;   // mapa de luces
  texture: string;     // detalle de alta frecuencia (tela), centrado en gris 50 %
  printArea: { x: number; y: number; w: number; h: number }; // zona imprimible, coordenadas normalizadas 0–1
  size: { w: number; h: number };
}
```

## 4. Funcionalidades

### 4.1 Color
- Selector de color libre + campo HEX + colores recientes + una paleta de básicos (blanco, negro, gris, rojo, azul, verde, amarillo, etc.).
- El color se aplica a frente y espalda a la vez.
- Slider de "Realismo" (sombras, luces, textura) en un panel avanzado plegable.

### 4.2 Estampados
- Subir varios archivos por lado (arrastrar y soltar o botón). Validar tipo y tamaño (máx. ~15 MB) con errores claros.
- Mover, escalar proporcionalmente, rotar, centrar, voltear, duplicar, eliminar, subir/bajar capa, opacidad, bloquear.
- Atajos: `Supr` elimina, `Ctrl/Cmd+D` duplica, flechas mueven 1 px (Shift = 10 px), `Ctrl/Cmd+Z / Y` deshacer/rehacer (al menos 30 pasos).
- Los estampados se **recortan a la silueta de la camiseta** y se muestra la **zona imprimible** (`printArea`) como guía punteada que no aparece en la exportación. Aviso visual si un estampado sale de la zona.
- Guías inteligentes de centrado respecto al eje de la camiseta.
- Al subir un estampado, colocarlo centrado en la zona imprimible a un tamaño razonable (~40 % del ancho de la zona).

### 4.3 Frente / espalda
- Pestañas **Frente | Espalda**. Cada lado tiene sus propios estampados y la misma camiseta/color.

### 4.4 Exportación
Ver sección 7.

## 5. Assets de la camiseta (lo más importante para el realismo)

### 5.1 Foto base requerida (la entrega el dueño del proyecto)
Dos fotos, frente y espalda, de **la misma camiseta**:
- Camiseta **blanca o gris muy claro** (nunca negra ni de color): el recoloreado funciona multiplicando, y una base clara conserva todo el detalle.
- Luz suave y uniforme, sin flash duro, sin sombras proyectadas, **sin zonas quemadas** (blanco puro #FFFFFF sin información). Ideal: base en gris muy claro con detalle visible en pliegues.
- Mismo encuadre, misma distancia y mismo tamaño en frente y espalda. Foto tipo "ghost mannequin" o maniquí invisible, o plana sobre superficie lisa. Poca arruga fuerte, pero con pliegues suaves naturales (dan realismo).
- Resolución mínima **3000 px de alto**. Formato PNG con **fondo transparente** (recortado con precisión, sin halo blanco en los bordes).
- Guardar originales en `raw/front.png` y `raw/back.png`.

Si todavía no existe la foto base, el proyecto debe funcionar con **placeholders** (camiseta genérica) y poder reemplazarlos solo cambiando los archivos de `raw/` y ejecutando el script de la sección 5.2.

### 5.2 Script de preparación: `scripts/prepare-assets.ts`
Usa `sharp` para generar, por cada lado, a partir de `raw/<lado>.png`:

1. `mask.png`: silueta a partir del canal alfa, con borde suave (1–2 px de feather).
2. `shade.png`: luminancia en gris con **normalización de niveles** (percentil 2 → 0, percentil 98 → 1) calculada solo sobre píxeles opacos. Es el mapa de sombras y pliegues.
3. `highlight.png`: zonas luminosas, `max(0, L_norm - 0.6) / 0.4`.
4. `texture.png`: pasa-altos de la luminancia: `L - blur(L, radio ≈ 4 px) + 0.5`. Captura el tejido sin las sombras grandes. Centrado en gris 50 % para usarlo con `soft-light`.
5. `base.png`: copia optimizada del original.
6. Una versión reducida (ancho 1200 px) de cada uno para la vista del editor, y la versión completa (≥ 3000 px) para exportar.

Salida en `public/assets/shirt/front/` y `public/assets/shirt/back/`. Comando: `npm run prepare-assets`. Debe fallar con un mensaje claro si el PNG no tiene transparencia.

### 5.3 Zona imprimible
`printArea` por lado, definida a mano en `src/config/shirt.ts` (por ejemplo pecho: caja centrada bajo el cuello; espalda: caja entre hombros y cintura). Debe ser fácil de ajustar y de visualizar en modo desarrollo.

## 6. Motor de render y realismo

Pila de capas por lado, de abajo hacia arriba (mismo pipeline en pantalla y en exportación):

1. **Camiseta teñida.** `color × shade`: rellenar el color elegido recortado por `mask` y aplicar `shade` con `multiply`. Controlado por `shadowStrength`.
2. **Luces para colores oscuros.** Con colores oscuros (negro, azul marino) el `multiply` casi no deja ver pliegues. Añadir `highlight` con `screen` o `soft-light`; su intensidad sube automáticamente cuanto más oscuro es el color (calcular con luminancia del color elegido) y puede ajustarse a mano.
3. **Estampados del usuario,** dentro de un grupo recortado por `mask` (modo `source-atop` o clip) y por la zona de seguridad si se activa.
4. **Sombras sobre el estampado.** `shade` encima con `multiply` y opacidad ~0.35–0.6, para que los pliegues atraviesen la tinta.
5. **Luces sobre el estampado.** `highlight` con `soft-light`/`screen`, opacidad baja (~0.2–0.4).
6. **Textura de tela.** `texture` con `soft-light` sobre camiseta **y** estampado, para que el estampado parezca impreso en la tela y no pegado encima. Controlado por `textureStrength`.
7. (Opcional, fase avanzada) **Desplazamiento:** usar `shade` como mapa de desplazamiento muy sutil sobre los estampados para que sigan las ondulaciones (por ejemplo con WebGL/PixiJS `DisplacementFilter`). Solo si el rendimiento lo permite; debe poder desactivarse.

Rendimiento: precalcular y cachear las capas fijas; el color se recalcula con debounce (~50 ms) al mover el selector. Mantener 60 fps al arrastrar estampados (cachear la camiseta teñida como bitmap mientras se edita). Todo estampado con `globalCompositeOperation` debe verificarse también en Safari.

## 7. Exportación profesional

- **Fondo blanco puro `#FFFFFF`** (toggle opcional de fondo transparente).
- Lienzo **cuadrado 1:1**, por defecto **2000 × 2000 px** (selector: 1200 / 2000 / 3000). Marketplaces suelen pedir fondo blanco y mínimo ~500 px por lado; apuntar a ≥ 1200 px. Verificar los requisitos vigentes de Mercado Libre antes de darlos por definitivos.
- Camiseta recortada al bounding box del alfa, centrada y ocupando ~85–90 % del lienzo con margen uniforme.
- Sombra de suelo suave opcional (toggle, desactivada por defecto). Sin degradados, marcos, textos ni marcas de agua.
- Renderizar usando los assets de resolución completa; ocultar guías, zona imprimible y `Transformer` antes de exportar.
- Formato PNG (por defecto) o JPG calidad 92.
- Botones: "Descargar frente", "Descargar espalda", "Descargar ambas (ZIP)". Nombres: `camiseta-frente.png`, `camiseta-espalda.png`.
- Vista previa del resultado final antes de descargar.
- Avisar si un estampado subido tiene resolución baja para el tamaño al que se está usando (se verá pixelado).

## 8. Interfaz y UX

- Diseño limpio, moderno, **responsive** (escritorio prioritario, móvil usable).
- Escritorio: lienzo grande al centro, panel derecho (color, estampados, capas, realismo, exportar), barra superior con **Frente | Espalda**, deshacer/rehacer y zoom.
- Estado vacío claro: camiseta visible desde el primer segundo, con un mensaje "Arrastra tu estampado aquí".
- Textos de la interfaz en **español**.
- Accesibilidad: contraste suficiente, foco visible, etiquetas en controles, uso con teclado.
- Estados de carga y error visibles (nunca fallar en silencio).
- Antes de diseñar la interfaz, aplicar la skill `frontend-design` para evitar un aspecto genérico.

## 9. Estructura de carpetas sugerida

```
raw/                 front.png, back.png (originales)
scripts/             prepare-assets.ts
public/assets/shirt/ front/, back/  (generados)
src/
  config/        shirt.ts
  components/    Canvas/, Toolbar/, SidePanel/, ColorPicker/, ExportDialog/
  engine/        tintShirt.ts, layers.ts, exportImage.ts, alphaBounds.ts
  store/         useEditorStore.ts, history.ts
  hooks/         useImageUpload.ts, useShortcuts.ts
  utils/         file.ts, color.ts
```

La lógica de imagen (`engine/`) debe ser pura y testeable, sin depender de React.

## 10. Reglas de código

- TypeScript estricto, sin `any`. Componentes pequeños y de una sola responsabilidad.
- Cero dependencias innecesarias; justificar cada librería nueva.
- No usar `localStorage` para imágenes grandes. Si se persiste algo, IndexedDB y opcional.
- Liberar memoria: revocar `objectURL`; guardar imágenes en una caché aparte, no como `dataURL` enormes dentro del estado.
- Manejar errores de carga de imagen.
- Comentarios solo donde el *porqué* no sea obvio.

## 11. Plan por fases (una a la vez, esperar confirmación)

0. **Assets:** proyecto base, script `prepare-assets` y camiseta placeholder (o la foto real si ya existe). Mostrar los 4 mapas generados para validarlos visualmente.
1. **Visor:** lienzo con la camiseta teñida con el color elegido (capas 1 y 2), selector de color, pestañas frente/espalda.
2. **Estampados:** subir, mover/escalar/rotar, capas, recorte a la silueta, zona imprimible, atajos, deshacer/rehacer.
3. **Realismo:** capas 4, 5 y 6 sobre los estampados, sliders de realismo, ajuste fino con la foto real.
4. **Exportación profesional:** bounding box, fondo blanco, tamaños, PNG/JPG, ZIP, vista previa.
5. **Pulido:** responsive móvil, accesibilidad, rendimiento, README. Opcional: desplazamiento (capa 7).

Al terminar cada fase: ejecutar la app, comprobar que compila sin errores ni warnings y **explicar qué se puede probar** antes de seguir.

## 12. Criterios de aceptación

- [ ] Cambio la camiseta a cualquier color (incluido negro y blanco) y se ven pliegues, sombras y textura de tela reales, sin aspecto de relleno plano.
- [ ] Un estampado se ve integrado en la tela: las sombras y la textura lo atraviesan.
- [ ] Añado varios estampados por delante y por detrás, cada uno editable de forma independiente.
- [ ] Ningún estampado se ve fuera de la silueta de la camiseta.
- [ ] La imagen exportada tiene fondo `#FFFFFF`, camiseta centrada, sin elementos de interfaz y sin pixelado.
- [ ] Lo que veo en pantalla coincide con lo que descargo.
- [ ] Cambiar la foto base en `raw/` y ejecutar `npm run prepare-assets` basta para actualizar toda la web, sin tocar código.
- [ ] Funciona en Chrome, Firefox y Safari recientes y es usable en móvil.
- [ ] `npm run build` termina sin errores de TypeScript ni de lint.

## 13. Cómo trabajar conmigo

- Si algo es ambiguo, **pregunta antes de asumir** (máximo 3 preguntas a la vez).
- Explica los cambios de forma sencilla: soy principiante.
- No saltes de fase sin que yo lo confirme.
- Si una decisión técnica tiene alternativas relevantes, dame 2 opciones con ventajas y desventajas y recomienda una.
