# Arquitectura

Cardllector es una aplicación personal para registrar colecciones de cartas (de momento, Magic)
con su precio de mercado y la evolución de su valor. Un solo usuario, aunque los datos llevan
`owner_id` para poder abrirla a más gente sin rehacer el modelo.

## Piezas

| Pieza | Qué es |
| --- | --- |
| App | Next.js 16 (App Router) + React 19, desplegada en Vercel. Web y móvil (PWA en la fase 3). |
| Base de datos | Postgres: Neon en producción, PGlite en local. Esquema y migraciones con Drizzle. |
| Auth | Better Auth, email + contraseña, registro cerrado (`ALLOW_SIGNUP` solo lo abre el script de alta). |
| Catálogo y precios | Magic: ficheros bulk diarios de Scryfall. Pokémon: API de TCGdex. Los dos se importan con GitHub Actions (ver `docs/data-sources.md`). |

```
Scryfall bulk (data.scryfall.io)
   │  default_cards.jsonl.gz — diario, ~78 MB
   │  all_cards.jsonl.gz     — semanal, ~393 MB (solo nombres en español)
   ▼
GitHub Actions ── scripts/sync-scryfall.ts ──► catalog_cards, sets  (game = mtg)      ┐
               ── scripts/sync-names.ts   ──► card_names                               │
               ── scripts/sync-pokemon.ts ──► catalog_cards, sets, card_names         ├─ Postgres
                  ▲  (game = pokemon; completo los miércoles, precios propios a diario) │
                  │                                                                    │
TCGdex API (api.tcgdex.net) — una petición por carta                                   │
               └─ snapshotPrices()        ──► price_snapshots,                         │
                                             inventory_value_snapshots                ┘
                                                        ▲
Navegador ── páginas (Server Components) + Server Actions ┘
```

## Navegación

| Ruta | Qué muestra |
| --- | --- |
| `/` | Resumen: lo que valen tus cartas, su evolución (`?period=7`, `30` —por defecto—, `90` o `all`), cuánto ha cambiado el valor por los precios y lo que más ha subido y bajado, el progreso de tus colecciones y tus cartas más valiosas. |
| `/catalog` | Los juegos (TCG). Los que aún no tienen fuente de datos salen como "Próximamente". |
| `/catalog/[juego]` | Las expansiones del juego, agrupadas por tipo (principales, Commander, especiales, promos), con cuántas cartas tienes de cada una y lo que valen. |
| `/catalog/[juego]/[expansión]` | Todas las cartas de la expansión en orden de número. Las que no tienes salen en gris. Se filtra por rareza y por "tengo" o "me faltan", y cada carta tiene un botón **+** para añadirla. |
| `/cards/[id]` | Una edición concreta: precio, histórico de precio (si la tienes) y el resto de sus ediciones. Desde aquí se añaden copias a tus cartas y se apunta la edición en una colección, la tengas o no. Enseña dónde tienes cada copia y en qué colecciones está. |
| `/inventory` | **Mis cartas:** todas tus copias, con alta rápida desde el teclado, filtro por ubicación (`?loc=<id>` o `?loc=none`) y búsqueda. «Añadir a una colección» mete en una lista todo lo que se ve con esos filtros. |
| `/collections`, `/collections/[id]` | Tus colecciones: listas de ediciones con la cantidad que quieres de cada una. Se ve lo que tienes y lo que te falta, lo que vale lo que tienes y lo que costaría completarla. Filtros: todas, tengo y me faltan. |
| `/locations`, `/locations/[id]` | Ubicaciones físicas: qué hay en cada una y cuánto vale. `/locations/none` muestra las copias sin ubicación. |
| `/search` | Búsqueda por nombre, en inglés o en español. |
| `/scan` | Escáner con la cámara: lee el número y el código de expansión de la carta y la añade a tus cartas, en la ubicación y la colección de la sesión si las has elegido. `?set=mtg:m10` arranca en modo expansión fija. Detalles en `docs/scanner.md`. |
| `/review` | **Por revisar:** las cartas que guardaste con «Para luego» en el escáner, con su foto (servida por `/api/pending-scans/[id]`, solo para su dueño) y una búsqueda para identificarlas y añadirlas (D25). |

"Tienes X de Y" en una expansión cuenta las ediciones distintas de tus cartas.

Los formularios de alta comparten el selector `EntryTarget` (`src/components/entry-target.tsx`),
que tiene dos partes:

- **Guardar en:** la ubicación.
- **Y en la colección:** la colección, opcional.

Las dos se recuerdan en el dispositivo (`useStickyDefaults`).

La búsqueda de los formularios de alta (`useCardPicker`, `/api/search`) acepta dos cosas:

- un nombre, en inglés o en español;
- una expansión y un número, como «OBF 125», «125/197» o «charizard 125».

Tras elegir la carta, sus ediciones salen como imágenes para tocar la tuya (`CardPickerRow`,
D26).

En el móvil (por debajo de `md`), la navegación es una barra de pestañas fija abajo: Resumen,
Catálogo, **Escanear** en el centro, Mis cartas y Colecciones. A las ubicaciones se llega desde
Mis cartas. La búsqueda y el botón de salir van como iconos en la barra superior. Desde `md`
hacia arriba se ven todos los enlaces en texto en la barra superior
(`src/app/(app)/nav-links.tsx`).

## Reglas que no hay que romper

- **Nunca se llama a la API de Scryfall desde una petición del usuario.** La API tiene límites
  duros (2 peticiones/s en `/cards/search`, `/cards/named` y `/cards/collection`; un 429 supone un
  bloqueo) y Scryfall exige usar los ficheros bulk para búsquedas rápidas. Toda búsqueda y todo
  escaneo van contra nuestra base de datos.
- Las peticiones a `api.scryfall.com` llevan `User-Agent: Cardllector/0.1` y `Accept`
  (`src/lib/scryfall/client.ts`).
- Los datos de Scryfall no se pueden cobrar. Si la app se abre algún día, el catálogo tiene que
  seguir siendo accesible gratis.
- Cada página y cada Server Action comprueba la sesión con `requireUser()`. `src/proxy.ts` solo
  hace una comprobación optimista de la cookie, y las rutas `/api/*` responden 401 por su cuenta.
- Las acciones comprueban además que el montón, la colección o la ubicación pertenecen al
  usuario.

## Precios

- La referencia es **Cardmarket en €**:
  - Magic: `prices.eur` y `prices.eur_foil` de Scryfall.
  - Pokémon: `trend` y `trend-holo` (reverse) de TCGdex.
  - Cómo se llama cada acabado en cada juego: D18 en `docs/decisions.md`.
- Una copia en otro idioma se asocia a la edición inglesa (mismo `set` y `collector_number`): en
  Cardmarket el producto es la edición, y el idioma es un atributo de la copia.
- Los foil *etched* no tienen precio en € en Scryfall, así que cuentan como "sin precio".
- El valor de tus cartas, y el de lo que tienes de una colección, no cuenta las copias sin
  precio: se muestran aparte. "Te falta ~X €" suma el precio normal de las copias que faltan.
- Si una copia tiene **valor estimado** (gradeadas, firmadas…), ese valor cuenta en todos los
  totales en lugar del de Cardmarket (D27).
- El precio unitario de mercado está implementado dos veces, en `unitPriceEur()` (TypeScript) y
  en `unitPriceEurSql` (SQL). El valor de una copia, estimación incluida, también: en
  `itemValueEur()` y en `itemValueEurSql`. Están en `src/lib/collection/pricing.ts`. Si cambias
  uno, cambia su gemelo.

## Desarrollo local

Hace falta Node 24 o superior. No hace falta Docker: `npm run db:dev` levanta un Postgres real
(PGlite) en el puerto 5433 y guarda los datos en `.pglite/`.

```bash
npm install
cp .env.example .env.local        # y rellena BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:dev                    # déjalo corriendo en otra terminal
npm run db:migrate
npm run seed:user -- tu@email.com una-contraseña Marc
npm run sync:scryfall             # ~40 s: catálogo, precios y snapshot del día
npm run sync:names                # ~2,5 min: nombres en español
npm run sync:pokemon              # ~20 min: catálogo de Pokémon desde TCGdex
npm run dev
```

Otros comandos:

- `npm run sql -- "select …"`: consulta a la base de datos local, que no tiene psql.
- `npm run snapshot:prices -- 2026-09-10`: guarda el snapshot de una fecha.
- `npm run db:generate`: genera una migración tras cambiar `src/db/schema.ts`.
- `npm test`, `npm run typecheck`, `npm run lint`.

## Despliegue

Vercel (app) + Neon (Postgres) + GitHub (código y Actions). Todo en los planes gratuitos (D05).

### 1. GitHub

Crea un repositorio **privado** y vacío (sin README) y sube el código:

```bash
git remote add origin git@github.com:<usuario>/cardllector.git
git push -u origin main
```

### 2. Neon

Crea un proyecto con Postgres 17 en la región **Frankfurt** (`eu-central-1`), cerca de España y
de la región `fra1` de Vercel. Neon da dos cadenas de conexión:

- **Pooled** (el host lleva `-pooler`): para la app en Vercel, que abre muchas conexiones cortas.
- **Direct:** para migraciones y sincronizaciones (scripts y GitHub Actions).

### 3. Cargar la base de datos desde tu Mac

Node no sobrescribe variables que ya estén definidas en el entorno, así que exportar
`DATABASE_URL` basta para que los scripts apunten a Neon en lugar de a `.env.local`:

```bash
export DATABASE_URL='postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require'  # direct
npm run db:migrate
npm run sync:scryfall      # ~1 min
npm run sync:names         # ~3 min
npm run sync:pokemon       # ~8 min
npm run seed:user -- tu@email.com 'una-contraseña-larga'
unset DATABASE_URL
```

### 4. Vercel

Importa el repo desde vercel.com. Detecta Next.js solo. Variables de entorno (Production):

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | La cadena **pooled** de Neon |
| `BETTER_AUTH_SECRET` | Uno nuevo, distinto del local: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | La URL de producción, por ejemplo `https://cardllector.vercel.app` |

En *Settings → Functions*, pon la región `fra1`, la misma zona que Neon.

- El script `vercel-build` aplica las migraciones **solo** en producción (`VERCEL_ENV=production`),
  para que un preview no cambie el esquema de la base de datos compartida (D13). Un cambio de
  esquema se prueba en local o en una rama de Neon.
- En los previews **no funciona el login**, porque `BETTER_AUTH_URL` apunta a producción. Sirven
  para ver que el build pasa.
- `src/db/client.ts` llama a `attachDatabasePool()` en Vercel, para que las instancias
  suspendidas no dejen conexiones abiertas en Neon.

### 5. GitHub Actions

En el repo, *Settings → Secrets and variables → Actions*, crea `DATABASE_URL` con la cadena
**direct**. Los workflows también se pueden lanzar a mano con *Run workflow*:

- `sync-scryfall.yml`: diario, 10:00 UTC.
- `sync-names.yml`: los lunes.
- `sync-pokemon.yml`: precios de lo que tienes a diario a las 11:15 UTC, y catálogo completo los
  miércoles.

### SSL

`pg` avisa de que en su próxima versión mayor `sslmode=require` pasará a la semántica de libpq,
que comprueba menos el certificado. Neon admite `sslmode=verify-full`: conviene usarlo en las
cadenas de conexión antes de actualizar a `pg` 9.

### Tamaño

Los dos catálogos ocupan ~109 MB en Neon (2026-09-11). Los snapshots solo se guardan para las
ediciones que tienes, así que crecen poco. Hay que vigilar el límite de 0,5 GB del plan gratuito
de Neon.
