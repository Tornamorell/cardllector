# Modelo de datos

El esquema está en `src/db/schema.ts` (Drizzle), y las migraciones en `drizzle/`. Las tablas
`user`, `session`, `account` y `verification` las genera Better Auth (`src/db/auth-schema.ts`, con
`npx auth@latest generate`).

## Catálogo (solo lo escribe la sincronización)

| Tabla | Una fila por | Notas |
| --- | --- | --- |
| `sets` | expansión física | Vienen de Scryfall (`GET /sets`) y de TCGdex. Las solo digitales (Arena, MTGO, Pokémon TCG Pocket) se descartan. `card_count` es nuestro: lo recalcula `refreshSetCounts()` tras cada sincronización, contando las ediciones en papel del catálogo. `print_code` y `printed_total` son lo que viene **impreso** en las cartas ("PAL" y el 193 de "001/193"); los usa el escáner para identificar la expansión (ver `docs/scanner.md`). |
| `catalog_cards` | edición física de una carta (printing) | `external_id` es el id en la fuente (Scryfall o TCGdex). `oracle_id` agrupa las ediciones de una misma carta: en Magic es el de Scryfall y en Pokémon es `pokemon:<nombre>` (D19). Los precios son los de la última sincronización. |
| `card_names` | (edición, idioma) | Nombre impreso traducido, apuntando a la edición inglesa equivalente. De momento solo `es`. |
| `catalog_card_photos` | edición sin imagen de su fuente | Foto compartida que aportó un usuario, al escanear o desde la ficha: JPEG de 300×419, quién la aportó y de dónde viene. `image_small` e `image_normal` de la carta apuntan a `/api/card-photos/<id>` (D30). |

- `game` (`mtg` \| `pokemon` \| `sports`) está desde el principio para no rehacer tablas al añadir
  otros juegos. Lo específico de cada juego (su slug en la URL, sus rarezas con nombre en
  español y cómo se agrupan sus tipos de expansión) vive en `src/lib/games.ts`. Añadir un juego
  al catálogo consiste en añadir su entrada allí y un script que llene `sets` y `catalog_cards`.
- Las columnas `search_name` guardan el nombre en minúsculas y sin tildes
  (`normalizeForSearch()`), con índice trigram (`pg_trgm`). La búsqueda aplica la misma
  normalización a la consulta. Así «relampago» encuentra «Relámpago» sin depender de la extensión
  `unaccent`, que no se puede usar en índices tal cual.
- La búsqueda (`src/lib/queries/search.ts`) agrupa por `oracle_id` y enseña una sola entrada por
  carta, con su edición más reciente como miniatura.

## Tus cartas y tus colecciones

| Tabla | Una fila por |
| --- | --- |
| `items` | **montón** de tus cartas: copias idénticas de una edición, con `owner_id`, `quantity` y, opcionalmente, `location_id` |
| `locations` | ubicación física del usuario ("Caja 1", "Carpeta roja"). El nombre es único por usuario, sin distinguir mayúsculas. `section_capacity` y `auto_advance` configuran sus separadores (D28). |
| `location_sections` | separador dentro de una ubicación ("Caja 1 › 3"): `position` (orden), `name` y `capacity` (vacía = sin límite). Un montón puede estar en uno con `items.section_id`. |
| `collections` | colección del usuario (`owner_id`): una lista con nombre, como «Pokédex de Hoenn» |
| `collection_cards` | (colección, edición): una entrada de la lista, con la `quantity` que quieres (1 por defecto) |

Tus cartas y tus colecciones son cosas distintas (D23). Un montón no pertenece a ninguna
colección, y una colección puede listar ediciones que no tienes. Lo que tienes de una colección
se calcula cruzando `collection_cards` con tus `items` por `catalog_card_id`
(`ownedByPrinting()` en `src/lib/queries/items.ts`): cuentan todas tus copias de esa edición,
tengan el acabado, el estado, el idioma o la ubicación que tengan. Una entrada está completa
cuando tienes al menos las copias que quieres.

La ubicación es independiente de todo lo demás (D20). Borrar una ubicación deja sus montones con
`location_id = null`. Borrar una colección borra sus entradas y deja tus cartas como estaban.

Qué hace idénticas dos copias: mismo dueño, edición, `finish`, `condition`, `language`,
`location_id` y `section_id`, y sin gradear ni valor estimado. Al añadir una copia idéntica a un montón existente, sube su
`quantity` en lugar de crearse otra fila (`addItem()` en `src/app/(app)/inventory/actions.ts`).
"Dividir montón" separa copias en una fila nueva, para poder cambiarles el estado o la ubicación.

- `finish` (`nonfoil` \| `foil` \| `etched`) es genérico, y cada juego le pone nombre en
  `finishLabels`:
  - Magic: normal, foil, etched.
  - Pokémon: `nonfoil` = estándar (la carta tal como se imprimió, holo incluida) y `foil` =
    reverse holo.

  Ver D18.
- `catalog_card_id` admite null, para cartas sin catálogo (deporte), que usan `attributes`
  (jsonb).
- `condition` sigue la escala de Cardmarket: MT, NM, EX, GD, LP, PL, PO. En el MVP no afecta al
  precio.
- `purchase_price_eur` es el precio unitario de compra, para calcular más adelante el
  beneficio o la pérdida.
- **Gradeadas** (D27): `grading_company`, `grade` (medios puntos, 1–10) y `cert_number`. Una
  copia gradeada es su propio montón, siempre de 1. Marcar como gradeada una copia de un montón
  de varias la separa.
- `estimated_value_eur` es el valor por copia que pones tú: gradeadas, firmadas, cartas
  especiales. Si existe, cuenta **en lugar del precio de mercado** en todos los totales
  (`itemValueEur()` / `itemValueEurSql` en `src/lib/collection/pricing.ts`). Una copia con
  valor propio no se mezcla con las nuevas iguales, y queda fuera de «lo que más sube y baja».

## Histórico

| Tabla | Clave | Qué guarda |
| --- | --- | --- |
| `price_snapshots` | (`catalog_card_id`, `date`) | Precios del día, **solo de las ediciones que tienes**. |
| `inventory_value_snapshots` | (`owner_id`, `date`) | Valor de todas tus cartas, número de copias y número de copias sin precio. |

El valor histórico de lo que tienes de una colección no se guarda: se puede reconstruir con
`price_snapshots` y las entradas de la lista.

## Cola de revisión del escáner

| Tabla | Una fila por | Notas |
| --- | --- | --- |
| `pending_scans` | carta guardada con «Para luego» en el escáner | Foto del recuadro (`image`, JPEG en `bytea`, 50–100 KB), lo que leyó el OCR (`read_text`), el nombre leído del título (`guess`, para rellenar la búsqueda) y los ajustes de la sesión (acabado, estado, idioma, ubicación y colección). Se borra al añadirla o descartarla en `/review` (D25). |

`date` es la fecha de los datos de precio (el `updated_at` del fichero de Scryfall), no la de la
ejecución. `snapshotPrices()` es idempotente: repetirla en la misma fecha sobrescribe ese día.
