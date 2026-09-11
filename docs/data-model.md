# Modelo de datos

El esquema está en `src/db/schema.ts` (Drizzle), y las migraciones en `drizzle/`. Las tablas
`user`, `session`, `account` y `verification` las genera Better Auth (`src/db/auth-schema.ts`, con
`npx auth@latest generate`).

## Catálogo (solo lo escribe la sincronización)

| Tabla | Una fila por | Notas |
| --- | --- | --- |
| `sets` | expansión física | Vienen de `GET /sets` de Scryfall. Las solo digitales (Arena, MTGO) se descartan. `card_count` no es el de Scryfall: lo recalcula `refreshSetCounts()` tras cada sincronización, contando las ediciones en papel del catálogo. |
| `catalog_cards` | edición física de una carta (printing) | `external_id` es el id en la fuente (Scryfall o TCGdex). `oracle_id` agrupa las ediciones de una misma carta: en Magic es el de Scryfall y en Pokémon es `pokemon:<nombre>` (D19). Los precios son los de la última sincronización. |
| `card_names` | (edición, idioma) | Nombre impreso traducido, apuntando a la edición inglesa equivalente. De momento solo `es`. |

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

## Colección

| Tabla | Una fila por |
| --- | --- |
| `collections` | colección del usuario (`owner_id`): cómo agrupa sus cartas |
| `locations` | ubicación física del usuario ("Caja 1", "Carpeta roja"). El nombre es único por usuario, sin distinguir mayúsculas. |
| `items` | **montón**: copias idénticas de una edición dentro de una colección, con `quantity` y, opcionalmente, `location_id` |

Colección y ubicación son ejes independientes (D20): una colección puede repartirse entre varias
ubicaciones y una ubicación puede tener cartas de varias colecciones. Borrar una ubicación deja
sus montones con `location_id = null`.

Qué hace idénticas dos copias: misma edición, `finish`, `condition`, `language` y
`location_id`, y sin gradear. Al añadir una copia idéntica a un montón existente, sube su `quantity` en lugar de
crearse otra fila (`addItem()` en `src/app/(app)/collections/actions.ts`). "Dividir montón"
separa copias en una fila nueva, para poder cambiarles el estado o la ubicación.

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

## Histórico

| Tabla | Clave | Qué guarda |
| --- | --- | --- |
| `price_snapshots` | (`catalog_card_id`, `date`) | Precios del día, **solo de las ediciones que tienes**. |
| `collection_value_snapshots` | (`collection_id`, `date`) | Valor, número de cartas y número de copias sin precio. |

`date` es la fecha de los datos de precio (el `updated_at` del fichero de Scryfall), no la de la
ejecución. `snapshotPrices()` es idempotente: repetirla en la misma fecha sobrescribe ese día.
