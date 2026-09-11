# Escáner

Estado: **implementado y probado con imágenes de muestra. Falta probarlo con la cámara del
móvil y cartas reales.** Decisiones: D06 y D20 en `docs/decisions.md`.

## Cómo funciona

```
cámara (getUserMedia, trasera)
  → recuadro guía 63×88 (86 % del encuadre)            src/lib/scan/geometry.ts
  → recorte de la franja inferior izquierda de la carta
    (x 2–50 %, y 89,5–99 %), escalada a 140 px de alto,
    en gris con el contraste estirado                    captureStrip() en scanner.tsx
  → Tesseract.js (inglés, lista blanca A–Z 0–9 / • .,
    PSM 6 = bloque único), cada ~300 ms                   scanner.tsx
  → parseCollectorLine(): número, total, códigos, idioma src/lib/scan/parse.ts
  → POST /api/scan/lookup → lookupScan()                 src/lib/queries/scan.ts
  → si la misma lectura se repite 2 veces seguidas y da UNA carta:
    addItem(source: "scan") al destino de la sesión (colección + ubicación), pitido y vibración
```

- **Qué se lee de cada tipo de carta:**

  | Carta | Franja | Identificación |
  | --- | --- | --- |
  | Magic 2023+ | `U 0001` / `MKM • EN` | Código + número (y el idioma impreso) |
  | Magic 2014–2022 | `001/280 C` / `M20 • EN` | Código + número |
  | Magic 2003–2013 | `146/249` en la línea del copyright, **no legible** a esta resolución | Búsqueda manual (ver pendientes) |
  | Pokémon Escarlata y Púrpura en adelante | `G [PAL EN] 001/193` | Código (`sets.print_code`) o total |
  | Pokémon Espada y Escudo y anteriores | `F 001/195` | Total impreso (`sets.printed_total`) + número |
  | Full art / ilustraciones especiales | Texto sobre la ilustración | Suele fallar: búsqueda manual |

- **Orden de pruebas en `lookupScan`:**
  1. La expansión fija elegida por el usuario.
  2. El código leído, que se contrasta con `sets.code` y `sets.print_code`. Si hay varios
     resultados, se filtra por el total.
  3. El total impreso.

  Solo cuenta lo que existe en el catálogo, y eso descarta casi todo el ruido del OCR.
- **Lecturas ambiguas:** si un número y total encaja en varias expansiones (una docena de
  expansiones de Magic tienen 249 cartas), se muestran hasta 24 candidatas, las más recientes
  primero, para elegir por la imagen.
- **Añadir la misma carta dos veces:** tras añadir una carta, no se vuelve a añadir hasta que se
  lean 3 fotogramas sin texto (la carta ha salido del encuadre). Para otra copia de la misma
  carta, está el botón «+» de la lista de la sesión.
- **El idioma impreso** ("EN", "ES"…) manda sobre el idioma por defecto de la sesión.

## Pantalla (`/scan`)

- **Sesión:** colección y ubicación (`AddTargetPicker`), y el acabado, el estado y el idioma por
  defecto. Todo se recuerda en el dispositivo.
- **Expansión fija:** opcional, para cartas sin código o para escanear una caja de la misma
  expansión. Se puede entrar ya con ella desde la página de la expansión («Escanear esta
  expansión», `/scan?set=mtg:m10`).
- **Foto:** analiza una imagen de una sola carta, recortada a la carta. Sirve para probar sin
  cámara; siempre pide confirmar la carta.
- **Ver lo que lee:** muestra la franja procesada y el texto de Tesseract, para ajustar el recorte.
- **Lista de la sesión:** cada carta con «−» (deshacer una copia, con `changeQuantity(-1)`) y «+».
- **¿No la reconoce?:** el alta rápida de siempre, dentro del escáner.
- **PWA:** `src/app/manifest.ts`, `icon.tsx` y `apple-icon.tsx`, y `appleWebApp` en el layout.
  Desde el móvil, "Añadir a pantalla de inicio" abre la app a pantalla completa. Aún no hay
  service worker (no funciona sin conexión).

## Requisitos

- **HTTPS** (o `localhost`), porque el navegador solo da la cámara en contextos seguros.
- Tesseract.js descarga su *worker*, su *core* (WASM) y el idioma `eng` desde jsDelivr la
  primera vez (unos MB) y luego los guarda en la caché del navegador.

## Mediciones (2026-09-11)

Hechas con escaneos de Scryfall (745×1040) y TCGdex (600×825), recortados con `sips` y leídos
con Tesseract.js en Node. Scripts de prueba en el historial de la sesión: `ocr-test.mjs`
recorta y lee, `lookup-check.mts` resuelve contra el catálogo.

| Muestra | Lectura de la franja | Resultado |
| --- | --- | --- |
| DMU 107 | `107/281 M ⏎ DMU EN CHRIS RAHN` | ✅ Sheoldred, the Apocalypse |
| MKM 1 | `U 0001 ⏎ MKM EN PETER POLACH` | ✅ |
| WOE 1, ELD 1, M20 1 | Correctas | ✅ |
| Pokémon PAL 001 | `BPAL 001/193` (el código pegado a un símbolo) | ✅ por el código "PAL" o por el total |
| Pokémon SIT 001 | `F 001/195` | ✅ solo por el total |
| Pokémon PBL 001 | `001/084` (en PSM 11: `007/084`, mal leído) | ✅ con PSM 6 |
| M10 146 (marco antiguo) | Ruido | ❌ ilegible; con expansión fija tampoco, porque no se lee el número |
| Pokémon 151 #199 (ilustración especial) | Ruido | ❌ |

También se probó una franja de ancho completo (y 93,5–99 %). Ayudó con `PBL 001/084`, pero perdió
Espada y Escudo y no rescató el marco antiguo, así que se descartó.

## Parámetros de ajuste

En `scanner.tsx`:
- `STRIP_HEIGHT` (140 px).
- `TICK_MS` (300).
- `CONFIRMATIONS` (2).
- `EMPTY_READS_TO_RELEASE` (3).

En `geometry.ts`:
- `INFO_STRIP`, la franja relativa a la carta.
- El relleno del recuadro guía (0,86).

## Pendiente

- **Probar con la cámara del móvil y cartas reales**, medir el acierto y ajustar la franja, el
  preprocesado y la PSM.
- **Magic anterior a 2014:** probar primeros planos (acercar la cámara a la esquina) o un modo
  "expansión fija + teclear el número" en el alta rápida.
- **Cola de revisión** con miniatura (`pending_scans`), si la búsqueda manual se queda corta.
- **Service worker** (Serwist), para uso sin conexión y una instalación más completa en Android.
- Leer el acabado (foil) no es viable con OCR: se fija por sesión.
