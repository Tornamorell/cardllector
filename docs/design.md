# Diseño visual

Dirección elegida el 2026-09-11, cuando el usuario pidió modo oscuro y un aspecto «más chulo»
porque lo veía plano e impersonal. Es provisional como todo lo demás (ver D22 en
`docs/decisions.md`).

## Concepto: la mesa de juego por la noche

- **Las cartas ponen el color.** La interfaz son superficies oscuras en índigo, como un tapete y
  fundas, y deja que las ilustraciones sean lo que se ve.
- **Cada color significa algo:**
  - **Oro** = dinero (valores, precios, total) y acciones principales.
  - **Iridiscente** = foil. Solo sale en copias foil (`<CardThumb foil>`), nunca de adorno.
  - **Colores de rareza** = los de los símbolos de expansión.
- **Las cartas son objetos:** proporción 63×88, esquinas elípticas como las reales y sombra
  debajo (`.card-frame`).
- **El elemento memorable:**
  - Tus cartas más valiosas en abanico en el resumen (`<CardFan>`).
  - En el catálogo, las más valiosas de cada juego.
  - En la ficha de una carta, la imagen se inclina hacia el puntero y refleja la luz
    (`<HoloCard>`). Todo lo demás, sobrio.

## Paleta (modo oscuro, `globals.css`)

| Token | Hex | Uso |
| --- | --- | --- |
| `--background` (tapete) | `#16142B` | Fondo |
| `--card` (funda) | `#201D3A` | Paneles, tablas, fichas |
| `--border` | `#322E55` | Bordes |
| `--foreground` (cartulina) | `#ECE8F7` | Texto |
| `--muted-foreground` | `#9C96BF` | Texto secundario |
| `--primary` / `--gold` | `#E9B949` | Dinero, acciones principales, pestaña activa, foco |
| `--foil` | Degradado cian → violeta → rosa → oro | Película foil |
| `--rarity-*` | common `#A9A4C7`, uncommon `#A8C8DC`, rare `#E9B949`, mythic `#F0703C`, special `#B98BF0` | `<RarityMark>` |

### Gráficas

Siguen las especificaciones de la skill `dataviz`. Los colores se validan con su script
(`validate_palette.js --mode dark --surface "#201d3a"`).

| Token | Hex | Uso |
| --- | --- | --- |
| `--chart-1` | `#BC8A26` | Línea del valor y del precio normal: el oro, un paso más oscuro que el del texto |
| `--chart-2` | `#9379D7` | Línea del precio foil: el violeta del foil, un paso más oscuro |
| `--gain` / `--loss` | `#5FD39A` / `#F07167` | Subidas y bajadas. Siempre con flecha y signo (`<Delta>`), nunca solo con el color |

Los oros del texto (`#E9B949`) y el violeta del foil son demasiado claros para una línea sobre
`--card`: el validador pide una luminosidad OKLCH entre 0,48 y 0,67 en oscuro.

- La gráfica es `<ValueChart>` (`src/components/value-chart.tsx`), en SVG y sin librerías:
  - Líneas de 2 px. Con una sola serie, un velo del 10 % bajo la línea y el valor al final.
  - Con dos series, leyenda.
  - Cruz que salta al día más cercano, con el puntero o con las flechas del teclado.
  - «Ver los datos» abre la tabla equivalente.

La app va **siempre en oscuro** (`<html class="dark">`). Los tokens claros de `:root` siguen
siendo los de shadcn por si algún día se añade un selector de tema.

## Tipografía

- **Una sola familia: Archivo** (`next/font`, eje `wdth`).
- **Titulares** (`h1`–`h3` y `.display`) en anchura 125 y negrita, con aire de caja de sobres.
- **Texto** en anchura normal.
- Precios en columnas con `tabular-nums`. Los números grandes sueltos (el valor total), con
  cifras proporcionales.

## Cosas a evitar

- Etiquetas en MAYÚSCULAS sobre los títulos, degradados de fondo decorativos y animaciones que
  se disparan solas. El foil solo se mueve al pasar el ratón, y la inclinación se desactiva con
  `prefers-reduced-motion`.
- Usar el oro o el iridiscente para cosas que no son dinero o foil.
- Las rarezas se escriben en inglés (D21); el color lo pone la marca, no el texto.

## Piezas

- `src/components/card-attributes.tsx`:
  - `<ConditionBadge>` pinta el estado con los colores de Cardmarket: MT turquesa, NM verde, EX
    verde lima, GD amarillo, LP naranja, PL rojo claro y PO rojo. El nombre completo sale al
    pasar el ratón.
  - `<LanguageFlag>` muestra el idioma con su bandera; el inglés lleva la del Reino Unido, como
    en Cardmarket.
  - Los selectores de estado e idioma también muestran el nombre y la bandera.
- `src/components/owned-card-tile.tsx`: la carta en la cuadrícula de una expansión o una
  colección. El **+** cuenta al instante (`useOptimistic`): la carta pierde el gris y el número
  sube antes de que conteste el servidor, y vuelve atrás si falla.
- `src/components/submit-button.tsx`: botón de envío que dice «Creando…» y no se puede pulsar
  dos veces. Los selectores con «+ Nueva…» hacen lo mismo. Además, el servidor reutiliza una
  colección con el mismo nombre creada hace menos de 15 segundos.
- `src/components/card-thumb.tsx`: carta con sombra; `foil` añade la película.
  - El marco no encoge en filas flexibles (`flex: none`), y la imagen lo llena en posición
    absoluta. Así se evita el recorte que hacía Safari en iOS.
- `src/components/items-table-view.tsx`: las cartas de Mis cartas y de las ubicaciones.
  - En el móvil es una lista de fichas: miniatura, nombre, etiquetas, cantidad, total y el menú
    ⋯, todo a la vista.
  - Desde `md` es una tabla.
  - Una tabla ancha en el móvil escondía los detalles tras un desplazamiento lateral que no se
    veía.
- `src/components/card-fan.tsx`: cartas en abanico.
- `src/components/holo-card.tsx`: la carta grande que se inclina.
- `src/components/rarity-mark.tsx` y `rarityTier()` en `src/lib/games.ts`: rombo del color de la
  rareza.
- `src/app/app-icon.tsx`: el icono de la app, una carta dorada inclinada sobre el tapete.
