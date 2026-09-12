# Hoja de ruta

Estado del proyecto y lo que viene. **Es orientativo:** el orden y el alcance cambian según lo
que se vaya necesitando (ver `docs/decisions.md`). Actualízalo al terminar o replantear algo.

Última actualización: 2026-09-11.

## Hecho

- **Fase 0 · Esqueleto:**
  - Next.js 16, Drizzle, PGlite en local y Better Auth con registro cerrado.
  - Tests con Vitest, ESLint y Prettier.
- **Fase 1 · Catálogo de Magic:**
  - Sincronización diaria con Scryfall (catálogo, precios y snapshot) y semanal (nombres en
    español), con sus workflows de GitHub Actions.
  - Búsqueda por nombre en inglés o español, sin tildes.
  - Ficha de carta con todas sus ediciones.
- **Fase 2 · Colecciones:**
  - Crear, renombrar y borrar colecciones.
  - Alta rápida con teclado y valores que se recuerdan de una carta a otra.
  - Editar, dividir y eliminar montones; ±1 de cantidad.
  - Resumen con el valor total, las cartas más valiosas y el progreso de cada colección.
- **Catálogo navegable:** juego → expansiones → cartas, con filtros por rareza y por
  "tengo" o "me faltan", y un botón **+** para añadir (D16).
- **Pokémon** (D17–D19):
  - Catálogo, precios de Cardmarket y nombres en español desde TCGdex.
  - Pestañas por serie.
  - Acabados «Estándar» y «Reverse holo».
  - La búsqueda y el alta rápida cubren los dos juegos.
- **Ubicaciones físicas** (D20):
  - Páginas `/locations`, con el valor de cada ubicación.
  - Selector con «+ Nueva ubicación…» en todos los formularios de alta.
  - "Ubicación de sesión" recordada: a partir de ahora, todo va a la Caja 1.
  - Filtro por ubicación en Mis cartas.
- **Tus cartas y colecciones como listas** (D23):
  - «Mis cartas» (`/inventory`) es el inventario. Escanear y dar de alta ya no piden colección
    ni ubicación.
  - Las colecciones son listas de ediciones con la cantidad que quieres, las tengas o no, con
    su progreso, lo que vale lo que tienes y lo que falta.
  - Al dar de alta, colección opcional. Lo ya dado de alta se añade a una colección en bloque
    desde Mis cartas, desde una ubicación o desde la sesión del escáner.
  - Migraciones `0006`–`0008`, que convierten los datos existentes. Probadas en local; en
    producción se aplican con el siguiente despliegue.
- **Evolución del valor** (D24):
  - En el resumen: la gráfica del valor de tus cartas por días, con periodo de 7, 30 o 90 días
    o todo.
  - Cuánto ha cambiado tu valor solo por los precios.
  - Las cinco cartas que más han subido y bajado.
  - En la ficha de carta, el histórico de precio de cada acabado.
  - Aparecen cuando hay al menos dos días de precios guardados.
- **Fútbol** (D29):
  - Juego «Fútbol» en el catálogo, sin precios de mercado.
  - Liga 2025-26 Megacracks (717 fichas), importado de la lista de CromosRepes con
    `npm run import:album`.
  - Series como rarezas y marcador con el número en lugar de imagen.
  - **Fotos compartidas** (D30): el escáner guarda la foto de las cartas sin imagen para
    todos, y en la ficha se puede añadir o cambiar.
  - **El escáner lee las Megacracks por delante:** con el álbum como expansión fija, lee el
    nombre de la franja vertical (solo el diseño de la base).
  - **Identificar con IA** (D31): botón en el escáner que manda la foto a Claude Sonnet 5 y
    cruza lo que lee con el catálogo. Sirve para cualquier diseño y juego.
  - **Fotos enderezadas** (D32): las fotos compartidas, la de «Para luego» y la que va a la IA
    salen con la carta recortada a sus bordes y recta, como un escaneo.
- **Colecciones desde una expansión:**
  - Se crean llenas con una expansión entera, o con una de sus rarezas.
  - Se hace desde `/collections` o con «Guardar como colección…» en la expansión.
  - En las gradeadas se ve el precio raw junto al estimado.
- **Historial y total de la sesión en el escáner:**
  - «12 · 34,50 €» arriba, y el historial de lo añadido al tocarlo.
  - Se guarda en el dispositivo hasta que terminas la sesión.
  - Al acabar, la sesión se puede añadir a una colección o guardar en una ubicación (solo sus
    copias), o terminar sin más.
- **Separadores y mover cartas** (D28):
  - Ubicaciones con separadores de N cartas, con nombre y capacidad editables.
  - Modo automático, que pasa al siguiente y avisa, o manual, con «Siguiente separador».
  - Selección múltiple en las tablas y «Mover a…» ubicación y separador. «Mover…» en el menú
    de una carta permite mover solo algunas copias.
- **Cartas gradeadas** (D27):
  - Empresa, nota y certificado en «Editar». Se muestran como la etiqueta «PSA 10».
  - Valor estimado por copia, que cuenta en lugar del precio de Cardmarket.
- **Entrada manual mejorada** (D26):
  - Arreglado: las cartas de Pokémon no se podían añadir a mano.
  - Las ediciones se eligen viendo las cartas.
  - Se busca también por expansión y número («OBF 125», «125/197»).
  - Cantidades con −/+.
- **Cola de revisión del escáner** (D25):
  - «Para luego» en el escáner guarda una foto de la carta que no reconoce y sigues escaneando.
  - En `/review` («N por revisar» desde el escáner y Mis cartas) la buscas, con el nombre leído
    ya escrito, y la añades con los ajustes de la sesión.

Verificado por HTTP y SQL. **Falta probar en el navegador con la sesión iniciada** el alta rápida,
los diálogos y el botón +.

## Despliegue (2026-09-11)

- En producción en **https://cardllector.vercel.app**. El repo es `Tornamorell/cardllector` y
  la base de datos es Neon (Postgres 17, Frankfurt).
- Neon cargado: 129 564 cartas (Magic y Pokémon), 56 886 nombres en español y 1 191
  expansiones, en 109 MB. Las cadenas de conexión están en `.env.neon.local` (no se commitea).

## Pendiente del usuario

- Crear su usuario en producción (`npm run seed:user` contra Neon).
- Añadir el secreto `DATABASE_URL` (conexión directa) en GitHub Actions para las
  sincronizaciones diarias.
- Probar el escáner en el móvil con cartas reales.
- Poner `ANTHROPIC_API_KEY` en Vercel para «Identificar con IA», y mandar fotos de otras series
  (Élite, Special One, Vértigo, Zona VIP…) para medir cuántas acierta (D31).
- Opcional: cambiar la contraseña de Neon, que ha pasado por el chat de la sesión.

## Siguiente

### Fase 3 · Escáner (PWA)

**Implementado el 2026-09-11 y probado con imágenes de muestra**. Falta probarlo en el móvil con
cartas reales (necesita el despliegue con HTTPS). Estado real, mediciones y pendientes en
`docs/scanner.md`; la lista siguiente es el diseño original, para contexto:

1. `/scan` abre la cámara trasera (`getUserMedia`) con una guía superpuesta en proporción 63×88.
2. **Lectura continua, sin botón de disparo:**
   - Cada ~400 ms se recorta la esquina inferior izquierda y se pasa por Tesseract.js en un Web
     Worker, con lista blanca de caracteres.
   - Se prueban varios recortes (óptimo, más ancho, desplazado).
3. `parseCollectorLine()` es una función pura con tests. Extrae el número (`0123`, `123/280`), el
   código de edición (3–5 caracteres) y el idioma (`EN`, `ES`…).
4. **Validación contra la base de datos** (`POST /api/scan/lookup`):
   - Una lectura solo cuenta si ese `set` + `collector_number` existe en el catálogo.
   - Se exige la misma lectura en 2 fotogramas seguidos; entonces la carta se añade con sonido y
     vibración.
   - La misma carta no puede volver a añadirse hasta que salga del encuadre; para otra copia hay
     un botón "+1".
5. **Modo "edición fija":** eliges la expansión y basta con leer el número. Cubre las cartas de
   2003 a 2014, que no traen código de edición. Se puede lanzar desde la página de la expansión.
6. **La sesión puede empezar eligiendo ubicación** ("voy a escanear la Caja 1", D20) **y
   colección**, las dos opcionales (D23). Además se fijan foil, estado e idioma, reutilizando
   `useStickyDefaults`. Lo escaneado se puede deshacer o corregir desde la lista de la sesión, y
   la sesión entera se puede añadir a una colección al terminar.
7. **Cola de revisión** (`/review`, tabla `pending_scans`): hecha el 2026-09-11 con un botón
   «Para luego» en lugar de guardar sola lo que no reconoce (D25).
8. Manifest y service worker (Serwist) para instalar la app en el móvil.
9. Medir la tasa de acierto con unas 20 cartas variadas y ajustar los recortes. Si falla mucho,
   revisar D06.

### Fase 4 · Evolución del valor

Lo principal está hecho (ver "Hecho", D24). Falta:

- Beneficio o pérdida frente al precio de compra.
- El valor en el tiempo de lo que tienes de cada colección. Se puede reconstruir con
  `price_snapshots` (D23).

## Más adelante / ideas

- **Pokémon, cartas antiguas:** 1ª edición y shadowless con precio propio (hueco de D18).
- **Pokémon en el escáner:** las cartas modernas llevan impresos el código de expansión
  (`abbreviation.official`, por ejemplo "MEW") y el número. Encaja con el mismo enfoque de OCR.
- **Fútbol (cromos y cartas)**: empezado el 2026-09-12 (D29). Ya está el catálogo con Liga
  2025-26 Megacracks, importado de CromosRepes. Queda pendiente de lo planteado:
  - Un álbum es una expansión (`game = sports`) y cada cromo es una carta con número, jugador y
    equipo.
  - **Listas:** crear el álbum pegando su listado («1 Courtois – Real Madrid»), o solo con el
    total («1 a 441») y completar los nombres después.
    - CromosRepes enseña en abierto el total y la editorial de cada colección, pero la lista
      pide iniciar sesión. No se extrae de forma automática.
  - **Marcar por números:** una cuadrícula del álbum para tocar lo que tienes, o escribir «1,
    5, 23-30, 45x2».
  - **Faltas y repes** como texto para compartir en CromosRepes o WhatsApp.
  - **Imágenes:**
    - una foto propia opcional, reutilizando «Para luego», y si no, un marcador con número y
      nombre;
    - un botón «Buscar imagen» que abre la búsqueda en otra pestaña;
    - sin búsqueda automática: lo impiden los derechos de Panini y Topps y las condiciones de
      los buscadores.
  - **Precio:** no hay fuente. Para las piezas buenas, valor estimado (D27).
  - **Escáner:** en los cromos adhesivos el número va detrás, y en las cartas tipo Adrenalyn
    delante. Probar el modo «expansión fija».
  - Antes de empezar, preguntar qué álbum concreto tiene el usuario y si son cromos o cartas.
- Importar CSV de ManaBox y otras apps.
- Filtro por expansión dentro de una colección y de Mis cartas.
- Colecciones con entradas de "cualquier edición" o por acabado, o creadas pegando una lista de
  nombres (D23).
- Detección automática del contorno de la carta en el escáner (OpenCV.js).
- Abrir la app a otros usuarios (D14).

## Preguntas abiertas


- ¿Afecta el estado (NM, LP…) al valor? Hoy no.
- ¿Debe haber un precio por idioma para las cartas antiguas? (D07)
- ¿Se agrupan en la navegación las expansiones hijas (tokens, promos) con su expansión padre?
