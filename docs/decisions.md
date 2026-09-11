# Registro de decisiones

**Todas las decisiones son provisionales.** Se tomaron con lo que se sabía en ese momento y se
revisan cuando aparezca una necesidad que no encaje. Si vas a contradecir una, no la ignores:
cámbiala aquí, explica por qué y marca la anterior como sustituida.

Formato de cada entrada: contexto, decisión, alternativas descartadas y cuándo revisarla.
Estados posibles: `provisional`, `sustituida por Dnn` o `descartada`.

---

## D01 · Empezar por Magic, con un modelo genérico — 2026-09-11 · provisional

- **Contexto:** la app debe cubrir Magic, Pokémon, fútbol y otros juegos. Magic es el que tiene
  mejores datos abiertos (Scryfall).
- **Decisión:** el MVP es solo de Magic, pero el esquema lleva `game` desde el principio y lo
  propio de cada juego vive en `src/lib/games.ts`.
- **Revisar cuando:** se integre el segundo juego. Si su modelo (acabados, rarezas, idiomas)
  no encaja, habrá que ampliar el esquema.

## D02 · Precio de referencia: Cardmarket en € vía Scryfall — 2026-09-11 · provisional

- **Contexto:** el usuario está en España; Cardmarket es el mercado europeo de referencia. La API
  de Cardmarket está cerrada a apps nuevas.
- **Decisión:** se usan `prices.eur` y `prices.eur_foil` del bulk de Scryfall. En USD solo se
  guarda como dato informativo.
- **Descartado:** TCGplayer (USD, API cerrada a desarrolladores nuevos) y scraping de Cardmarket.
- **Revisar cuando:** hagan falta precios por estado o idioma, o Scryfall deje de dar precios en €.

## D03 · Web y móvil con una sola app Next.js (PWA) — 2026-09-11 · provisional

- **Decisión:** una PWA instalable en vez de una app nativa. La cámara se usa con `getUserMedia`,
  que exige HTTPS.
- **Descartado:** Expo/React Native, que duplicaría la base de código.
- **Revisar cuando:** el escáner en el navegador sea demasiado lento o impreciso comparado con
  las apps nativas (ManaBox).

## D04 · Stack: Next.js 16 + TypeScript + Postgres + Drizzle + Better Auth — 2026-09-11 · provisional

- **Contexto:** el usuario domina React, Node y Postgres (Cocopool) y prefiere Next.js.
- **Decisión:**
  - Drizzle, por ser ligero y cercano a SQL.
  - Better Auth, porque Auth.js lo mantiene ahora el mismo equipo y recomienda Better Auth para
    proyectos nuevos.
  - shadcn/ui en su variante Base UI, que es la que instala por defecto.
- **Revisar cuando:** algo del stack frene de forma evidente.

## D05 · Hosting: Vercel + Neon; sincronizaciones en GitHub Actions — 2026-09-11 · provisional

- **Decisión:** los planes gratuitos de Vercel y Neon. Las sincronizaciones con Scryfall corren
  en GitHub Actions y no en el cron de Vercel, porque las funciones tienen límite de tiempo y el
  fichero de nombres pesa ~393 MB comprimido.
- **Descartado:**
  - Render (web + Postgres + cron, ~14 $/mes). Es lo que se usa en Cocopool.
  - Solo en local, que no permite usar el escáner desde el móvil.
- **Límites a vigilar:**
  - Neon da 0,5 GB de almacenamiento.
  - Vercel Hobby es solo para uso no comercial.
- **Revisar cuando:** se abra a más usuarios o se acerque el límite de 0,5 GB.

## D06 · Escáner: solo OCR en el dispositivo, sin IA — 2026-09-11 · provisional

- **Contexto:** hay que dar de alta miles de cartas. El usuario prefirió coste cero antes que
  comodidad.
- **Decisión:**
  - Tesseract.js lee el código de edición y el número de colección de la esquina inferior
    izquierda.
  - Lo que no se reconozca va a una cola de revisión manual.
  - Hay un modo "edición fija" para las cartas de 2003 a 2014, que traen número pero no código.
- **Descartado:** Claude con visión como respaldo, a ~1 céntimo por carta, solo en las que falle
  el OCR.
- **Revisar cuando:** se mida la tasa de acierto con cartas reales. Si la cola de revisión crece
  demasiado, volver a plantear la IA como respaldo.
- **Actualización (implementado, 2026-09-11):**
  - La expansión se identifica por el código impreso o, si no lo hay, por el **total impreso**
    ("001/195" → la expansión Pokémon de 195 cartas). Para ello, `sets` guarda `print_code` y
    `printed_total`.
  - En vez de la cola de revisión con miniaturas prevista, el primer respaldo es la búsqueda
    manual dentro de la propia pantalla del escáner, y la elección entre candidatos cuando la
    lectura es ambigua. La cola queda pendiente, por si hace falta.
  - Detalles y mediciones en `docs/scanner.md`.
- **Actualización (tras la primera prueba real, «bastante regular»):**
  - Votación en vez de exigir lecturas consecutivas.
  - **El título como segunda vía**, que cubre Magic antiguo y parte de las full art.
  - Corrección de confusiones del OCR.
  - Pantalla completa con panel de acabado y cantidad.
  - Sigue siendo gratis y en el dispositivo. Si aun así no basta, las opciones siguientes son
    reconocimiento por imagen o IA como respaldo, y las dos requieren decisión del usuario.

## D07 · Idioma por copia; precio de la edición inglesa — 2026-09-11 · provisional

- **Contexto:** las cartas del usuario están en español y en inglés.
- **Decisión:**
  - El catálogo es el inglés (`default_cards`). El idioma es un atributo de cada copia
    (`items.language`).
  - Los nombres en español se importan aparte (`card_names`) para poder buscarlos.
  - Cardmarket da un precio por producto (edición), así que una copia en español usa el precio de
    su edición inglesa.
- **Revisar cuando:** haga falta el precio por idioma (en algunas cartas antiguas la diferencia
  es grande).

## D08 · Postgres local con PGlite — 2026-09-11 · provisional

- **Contexto:** el Mac del usuario no tiene Docker.
- **Decisión:** `npm run db:dev` levanta PGlite (Postgres compilado a WASM) como servidor en el
  puerto 5433. El código usa el driver `pg` igual que en producción.
- **Descartado:** instalar Postgres con Homebrew, o usar una rama de Neon también en desarrollo.
- **Revisar cuando:** aparezcan diferencias con Postgres real. PGlite reparte las conexiones
  entre muchos clientes y "no todos los casos están garantizados".

## D09 · Búsqueda sin tildes con una columna `search_name` — 2026-09-11 · provisional

- **Decisión:** se guarda el nombre normalizado (minúsculas, sin diacríticos) con índice trigram,
  y la consulta se normaliza igual (`normalizeForSearch()`).
- **Descartado:** la extensión `unaccent`, que no es IMMUTABLE y no se puede indexar sin un
  wrapper.

## D10 · Montones con cantidad, no una fila por copia — 2026-09-11 · provisional

- **Decisión:** `items` es un montón de copias idénticas con `quantity`. Al añadir una copia
  idéntica, sube la cantidad (la regla está en `docs/data-model.md`). "Dividir montón" separa
  copias.
- **Descartado:** una fila por copia física, que multiplicaría las filas con miles de comunes.
- **Revisar cuando:** haga falta seguir copias individuales (gradeadas con número de
  certificado, compras concretas).

## D11 · Histórico de precios solo de lo que tienes — 2026-09-11 · provisional

- **Decisión:** `price_snapshots` guarda cada día solo las ediciones de las que tienes alguna
  copia. El valor de todas tus cartas se guarda aparte, cada día (`inventory_value_snapshots`;
  hasta D23 era por colección).
- **Descartado:** guardar las ~110 000 ediciones cada día (~40 M de filas al año), que no cabe
  en Neon gratis.
- **Consecuencia:** una carta añadida hoy no tiene histórico anterior a hoy.

## D12 · Foil *etched* sin precio — 2026-09-11 · provisional

- **Decisión:** Scryfall no da `eur` para etched, así que cuentan como "sin precio" en vez de
  tomar el de foil.
- **Revisar cuando:** Scryfall lo ofrezca o el usuario tenga muchas cartas etched.

## D13 · Migraciones solo en los despliegues de producción — 2026-09-11 · provisional

- **Decisión:** `vercel-build` solo migra con `VERCEL_ENV=production`, para que un preview no
  cambie el esquema de la base de datos compartida.
- **Revisar cuando:** se configure una rama de Neon por preview.

## D14 · Un solo usuario, registro cerrado, `owner_id` en todo — 2026-09-11 · provisional

- **Decisión:** el usuario se crea con `npm run seed:user`. Todos los datos de colección cuelgan
  de `owner_id`, y las acciones comprueban la propiedad.
- **Revisar cuando:** se abra a otros. Hará falta un registro con límites y revisar las
  condiciones de Scryfall (no se puede cobrar por sus datos).
- **Aislamiento entre usuarios (revisado el 2026-09-11):**
  - Cada consulta de datos de usuario filtra por `owner_id`: colecciones, montones,
    ubicaciones, resumen, progreso por expansión y "en tus colecciones".
  - Cada acción comprueba que la colección, el montón o la ubicación son del usuario.
  - El catálogo (cartas, expansiones, precios, búsqueda y lecturas del escáner) es común y de
    solo lectura.
  - Un segundo usuario se crea con otra ejecución de `npm run seed:user`.
  - Los valores recordados (`useStickyDefaults`) se guardan por dispositivo, no por usuario. Si
    dos personas comparten navegador, los ids ajenos se descartan porque no aparecen entre sus
    opciones.

## D15 · Se excluye todo lo digital — 2026-09-11 · provisional

- **Decisión:** las ediciones y expansiones con `digital: true` (Arena, MTGO) no entran en el
  catálogo. `sets.card_count` se recalcula con las ediciones en papel.

## D16 · Navegación por juego → expansión → cartas — 2026-09-11 · provisional

- **Contexto:** el usuario quiere "entrar en un TCG y ver por expansiones, rarezas…".
- **Decisión:**
  - Rutas `/catalog/[juego]/[expansión]`.
  - Las expansiones se agrupan por tipo (principales, Commander, especiales, promos y tokens).
  - En cada expansión, las cartas que tienes se ven en color y las que no, en gris, con filtros
    por rareza y por "tengo" o "me faltan".
  - La configuración de cada juego está en `src/lib/games.ts`.
- **Revisar cuando:** entre el segundo juego o se quieran otras vistas (por ejemplo, rareza en
  todo el juego, o bloques de expansiones).
- **Actualización (D17–D19):** con Pokémon, la pestaña por defecto es la primera de cada juego
  (Principales en Magic, Megaevolución en Pokémon). Las rarezas que se muestran como filtro salen
  de los datos, así que aparecen aunque no estén en la configuración.

## D17 · Pokémon desde TCGdex: catálogo semanal y precios diarios de lo que tienes — 2026-09-11 · provisional

- **Contexto:** TCGdex es abierta y gratuita, tiene nombres en español y trae precios de
  Cardmarket en €. Pero no ofrece descarga masiva, y solo la petición de una carta concreta
  incluye precios (GraphQL no los expone). Un catálogo completo son ~21 000 peticiones, unos 20
  minutos con 6 en paralelo.
- **Decisión:**
  - `npm run sync:pokemon` hace la sincronización completa (expansiones, cartas, precios y nombres
    en español) **una vez por semana**.
  - `--owned-only` refresca a diario solo los precios de las ediciones que tienes.
  - Se excluye la serie `tcgp` (Pokémon TCG Pocket, que es digital).
  - Workflow: `.github/workflows/sync-pokemon.yml`.
- **Descartado:**
  - Scrydex, porque es de pago.
  - Hacer la sincronización completa a diario: ~700 000 peticiones al mes a una API comunitaria
    que declara unos 10 millones al mes en total.
- **Consecuencia:** los precios de las cartas que no tienes pueden tener hasta una semana de
  antigüedad.
- **Revisar cuando:** TCGdex publique un fichero bulk o un endpoint de precios en bloque, o marque
  límites de uso.

## D18 · Acabados genéricos con nombre por juego; la 1ª edición aún no — 2026-09-11 · provisional

- **Contexto:**
  - Magic tiene normal, foil y etched.
  - En Pokémon hay normal, holo y reverse holo, y en las cartas antiguas, 1ª edición y shadowless.
  - En Cardmarket, el precio base de una carta Pokémon es el de la carta tal como se imprimió
    (normal, u holo si es una rara holo), y el precio "holo" es el de su reverse.
- **Decisión:**
  - No se cambia el enum `finish`. En Pokémon, `nonfoil` significa "estándar" (la carta tal como
    se imprimió) y `foil` significa "reverse holo".
  - Los nombres de cada acabado están en `finishLabels` (`src/lib/games.ts`).
  - Los precios siguen la misma lógica que en Magic: `trend` → `price_eur` y `trend-holo` →
    `price_eur_foil`.
- **Hueco conocido:** la 1ª edición y la shadowless son productos distintos en Cardmarket, con
  precios muy diferentes (un Charizard de Base Set: ~590 € la ilimitada y ~3 500 € la 1ª edición
  shadowless). TCGdex los da en `variants_detailed`, pero hoy **no** se modelan: una 1ª edición se
  valora como ilimitada.
- **Revisar cuando:** el usuario tenga cartas antiguas de Pokémon. Probablemente haga falta una
  fila de catálogo por variante con producto propio, o un campo `edition` en `items` con su precio.

## D20 · Ubicaciones físicas, independientes de las colecciones — 2026-09-11 · provisional

- **Contexto:** el usuario quiere saber dónde está cada carta ("Caja 1") y escanear por sesiones:
  "voy a empezar a escanear la Caja 1", y todo lo que entre desde ese momento va ahí.
- **Decisión:**
  - Tabla `locations` (nombre único por usuario, sin distinguir mayúsculas) e
    `items.location_id` (null = sin ubicación). Sustituye al texto libre `items.location`, que se
    convirtió en filas de `locations` con la migración `0003_backfill_locations`.
  - La colección es cómo agrupas las cartas (Pokémon 151, Para vender) y la ubicación es dónde
    están. Son dos ejes independientes: una colección puede estar en varias cajas y una caja puede
    tener varias colecciones.
  - La ubicación forma parte de la identidad del montón: la misma carta en dos cajas son dos
    montones.
  - **Ubicación de sesión:** el último destino elegido (`lastLocationId`) se recuerda en el
    dispositivo y lo usan todos los formularios de alta. El escáner lo usará igual.
  - Se puede crear una ubicación desde cualquier selector («+ Nueva ubicación…»). Si ya existe
    una con el mismo nombre, se reutiliza.
  - Borrar una ubicación deja sus cartas sin ubicación; no borra cartas.
  - Si la ubicación recordada ya no existe, `addItem` responde `location_not_found` y el
    cliente la olvida.
- **Descartado:** que la caja *sea* la colección. Es más simple, pero impide agrupar las mismas
  cartas de dos formas.
- **Revisar cuando:** hagan falta ubicaciones anidadas (estantería → caja → separador) o una
  posición dentro de la caja (página de la carpeta, orden).
- **Actualización (D23):** las copias ya no pertenecen a ninguna colección. La ubicación sigue
  igual: es un dato opcional de cada montón de tus cartas.

## D21 · Las rarezas se muestran en inglés — 2026-09-11 · provisional

- **Contexto:** al principio las rarezas se tradujeron ("Rara doble", "Mítica"). El usuario
  prefiere los términos en inglés, que son los que usan los coleccionistas.
- **Decisión:** las etiquetas de rareza de `src/lib/games.ts` van en inglés, con la grafía oficial
  ("Double Rare", "ACE SPEC Rare", "Mythic"), en todos los juegos. El resto de la interfaz sigue
  en español.
- **Pendiente de confirmar:** si lo mismo aplica a otros términos de juego que hoy salen en
  español, como el tipo de las cartas de Pokémon ("Pokémon · Fase 2 · Fuego") o los acabados
  ("Estándar").

## D22 · Identidad visual: modo oscuro "mesa de juego por la noche" — 2026-09-11 · provisional

- **Contexto:** el usuario veía la app "algo impersonal, estilos muy planos" y pidió modo oscuro.
- **Decisión:** solo modo oscuro, en índigo de tapete. El oro marca el dinero y las acciones; el
  iridiscente, solo el foil; los colores de rareza son los de los símbolos. Tipografía Archivo
  (ancha en los titulares). Las cartas se tratan como objetos físicos: abanico en el resumen y
  el catálogo, e inclinación con reflejo en la ficha. Detalle en `docs/design.md`.
- **Descartado:** el gris neutro de shadcn tal cual, y los tópicos de las interfaces generadas
  (negro con un único color ácido, degradados decorativos, etiquetas en mayúsculas).
- **Revisar cuando:** el usuario quiera modo claro o un selector de tema.

## D19 · "Otras ediciones" de Pokémon agrupadas por nombre — 2026-09-11 · provisional

- **Contexto:** Scryfall tiene `oracle_id`, que agrupa las ediciones de la misma carta. TCGdex no
  tiene nada equivalente.
- **Decisión:** en Pokémon, `oracle_id = "pokemon:" + nombre normalizado`. La búsqueda y "Otras
  ediciones" agrupan por nombre (todos los "Charizard ex"), aunque sean cartas con ataques
  distintos.
- **Revisar cuando:** moleste que se mezclen cartas diferentes con el mismo nombre.

## D23 · Tus cartas por un lado; las colecciones, listas de lo que quieres — 2026-09-11 · provisional

- **Contexto:** probándolo, el usuario vio que para escanear no debería hacer falta ni colección
  ni ubicación, y que una colección (por ejemplo, «Pokédex de Hoenn») es una lista de cartas que
  quiere, las tenga o no: la app le dice cuáles tiene. Sustituye la parte de D10 y D20 en la que
  cada montón pertenecía a una colección.
- **Decisión:**
  - `items` es **tu inventario**: cada montón lleva `owner_id` y, si quieres, `location_id`. Dar
    de alta o escanear solo necesita la carta.
  - `collection_cards` (colección, edición, `quantity` deseada, 1 por defecto) es **la lista**.
    Lo que tienes de ella se calcula cruzando con tus cartas por edición: cuenta cualquier
    acabado, estado, idioma o ubicación.
  - Al dar de alta puedes elegir, **opcionalmente**, una colección (`entryCollectionId`, que se
    recuerda en el dispositivo como la ubicación). La copia entra en tus cartas y, si la edición
    no estaba en la lista, también en la lista.
  - Lo ya dado de alta se añade a una colección en bloque (`addInventoryToCollection`): desde
    «Mis cartas» (con la búsqueda y la ubicación filtradas), desde una ubicación y desde la sesión
    del escáner. Si la edición ya estaba, se queda la cantidad deseada mayor; no se suman.
  - Borrar una colección borra la lista, no tus cartas.
  - El valor diario se guarda por usuario (`inventory_value_snapshots`), no por colección.
- **Migración (`0006`–`0008`):**
  - Las copias de cada colección pasan a su dueño.
  - Cada colección se convierte en una lista con sus ediciones, con cantidad deseada igual a las
    copias que había (máximo 999).
  - Los snapshots por colección se suman en snapshots por usuario.
  - Los montones que quedan repetidos al quitar la colección (misma edición, acabado, estado,
    idioma y ubicación) se fusionan si no tienen notas, precio de compra ni gradeo. Si tienen
    alguno de esos datos, se dejan separados.
- **Descartado:**
  - `items.collection_id` opcional: mezcla "lo que tengo" con "lo que quiero" y no permite
    listas con cartas que no tienes.
  - Entradas de "cualquier edición" ("quiero un Treecko, el que sea"). De momento cada entrada
    es una edición concreta.
- **Revisar cuando:** se quieran entradas por carta en lugar de por edición, por acabado ("lo
  quiero en foil") o colecciones generadas (una expansión entera).

## D24 · Evolución del valor: la gráfica incluye tus altas; "cambio por precios", no — 2026-09-11 · provisional

- **Contexto:** el valor diario (`inventory_value_snapshots`) sube tanto si suben los precios
  como si añades cartas. Una sola cifra de "has ganado X €" mezclaría las dos cosas.
- **Decisión:**
  - La gráfica del resumen enseña el valor de tus cartas cada día, tal cual, y lo dice
    ("también sube cuando añades cartas"). El tooltip incluye cuántas cartas tenías ese día.
  - **"Por cambios de precio"** y la lista de lo que más sube y baja comparan, para cada
    edición y acabado que tienes **hoy**, el último precio guardado con el de hace N días
    (`priceMoves()` en `src/lib/queries/value.ts`). El impacto de cada carta es cantidad ×
    diferencia. Si no hay precio tan antiguo, la carta no entra, así que la cifra refleja solo
    precios.
  - Un periodo (7, 30 o 90 días, o todo) manda sobre la gráfica y sobre las listas (`?period=`).
  - En la ficha de carta, el histórico de cada acabado, que solo existe para las cartas que
    tienes (D11).
  - Gráfica propia en SVG (`<ValueChart>`) en lugar de Recharts: es una línea con tooltip y
    tabla, y no justifica una dependencia.
- **Consecuencia:** hasta que no haya N días de precios guardados, el periodo de N días sale
  vacío. Con «Todo» se compara con el primer día guardado.
- **Revisar cuando:** se apunten precios de compra (beneficio real) o se quiera separar en la
  gráfica lo que es precio de lo que son altas.

## D25 · Cola de revisión con un botón «Para luego», con fotos en Postgres — 2026-09-11 · provisional

- **Contexto:** el plan original guardaba sola cualquier carta que el escáner no reconociera en
  unos 3 segundos. Pero el escáner no sabe si hay una carta en el recuadro o la mesa, así que
  la cola se llenaría de fotos inútiles.
- **Decisión:**
  - Un botón **«¿No la reconoce? Para luego»** en el panel del escáner. Guarda una foto de lo que
    hay en el recuadro, JPEG de 560 px de alto (50–100 KB).
  - Con la foto se guardan lo último leído, el nombre sacado del título (para rellenar la
    búsqueda) y los ajustes de la sesión: acabado, estado, idioma, ubicación y colección.
  - La foto va en Postgres (`pending_scans.image`, `bytea`) y la sirve
    `/api/pending-scans/[id]`, que comprueba el dueño.
  - En `/review` se busca la carta y se añade con los ajustes guardados. Al añadirla o
    descartarla, la fila y la foto se borran.
  - Límites: 400 KB por foto y 500 fotos pendientes por usuario, para no llenar el medio GB de
    Neon.
- **Descartado:**
  - Guardar solas las lecturas fallidas: llenan la cola de fotos de la mesa o de cartas
    movidas.
  - Vercel Blob u otro almacén de ficheros: otro servicio más, para unas pocas decenas de
    fotos que viven poco.
- **Revisar cuando:** la cola crezca mucho, o haga falta guardar fotos para siempre (por
  ejemplo, del estado de cada copia).

## D26 · Entrada manual: la edición se elige viendo la carta, y se busca también por número — 2026-09-11 · provisional

- **Contexto:** el usuario no conseguía añadir a mano un «Charizard ex» desde el móvil: al tocar
  el resultado no pasaba nada.
  - La causa: `/api/printings` solo aceptaba `oracle_id` con forma de UUID, y en Pokémon es
    `pokemon:<nombre>` (D19).
  - Consecuencia: **ninguna carta de Pokémon se podía añadir a mano**.
  - Además, pidió mejorar la entrada manual en general.
- **Decisión:**
  - `/api/printings` acepta cualquier `oracle_id`. Si las ediciones no cargan, el selector lo dice
    en lugar de quedarse en blanco.
  - Tras elegir la carta, sus ediciones salen como **imágenes**: una tira horizontal, de más
    nueva a más antigua, con filtro por expansión o número si hay más de 8. Sustituyen al
    desplegable de texto, porque la edición se reconoce por la ilustración y el símbolo. Sigue
    marcada por defecto la de la última expansión usada.
  - La búsqueda entiende **número más expansión, total impreso o parte del nombre**:
    - por ejemplo, «OBF 125», «125/197», «charizard 125» o «m10 146» (`parsePrintingQuery()`,
      `searchPrintings()`);
    - esos resultados salen primero y van directos a esa edición.
  - Cantidades con −/+ (`QuantityStepper`).
  - Los resultados se eligen con `click`, que dispara igual el dedo. Antes era `mousedown`.
- **Revisar cuando:** haya expansiones con cientos de ediciones de una misma carta (tokens,
  tierras básicas), por si la tira necesita agrupar por expansión.

## D27 · Gradeadas: una fila por copia, y un valor estimado que manda sobre el mercado — 2026-09-12 · provisional

- **Contexto:** el usuario tiene cartas gradeadas y quiere marcar la empresa, la nota y su
  precio potencial. Los precios de Cardmarket que tenemos son de cartas sin gradear, y no hay
  una fuente gratuita de precios de gradeadas.
- **Decisión:**
  - En "Editar", una sección **«Está gradeada»** con la empresa (PSA, BGS, CGC, SGC, TAG, Ace,
    Cardmarket Grading u otra), la nota (medios puntos) y el nº de certificado.
  - **Una copia gradeada es su propia fila**, con cantidad 1: cada funda es una carta
    distinta. Marcar una copia de un montón de varias la separa, y las demás quedan igual.
    Revisa D10, que ya preveía este caso.
  - **Valor estimado por copia** (`estimated_value_eur`), puesto a mano. Si existe, cuenta en
    lugar del precio de mercado en todos los totales: resumen, histórico diario, colecciones y
    expansiones. No es solo para gradeadas: sirve también para firmadas o errores de impresión.
  - Sin valor estimado, una gradeada cuenta con el precio de Cardmarket sin gradear, que es
    más bajo pero no cero.
  - Las copias con valor estimado no se juntan con copias nuevas iguales, y quedan fuera de
    «lo que más sube y baja», porque no siguen al mercado.
- **Descartado:**
  - Precios automáticos de gradeadas (PriceCharting, eBay, 130point): son de pago o solo se
    pueden sacar raspando webs.
  - Subnotas de BGS (centrado, esquinas…) como campos propios: de momento van en las notas.
- **Revisar cuando:** aparezca una fuente gratuita de precios de gradeadas, o haga falta ver
  el histórico de valor de una copia concreta.
