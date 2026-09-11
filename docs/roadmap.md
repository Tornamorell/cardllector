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
  - Resumen con el valor total, las cartas más valiosas y el desglose por colección.
- **Catálogo navegable:** juego → expansiones → cartas, con filtros por rareza y por
  "tengo" o "me faltan", y un botón **+** para añadir (D16).
- **Pokémon** (D17–D19):
  - Catálogo, precios de Cardmarket y nombres en español desde TCGdex.
  - Pestañas por serie.
  - Acabados «Estándar» y «Reverse holo».
  - La búsqueda y el alta rápida cubren los dos juegos.
- **Ubicaciones físicas** (D20):
  - Páginas `/locations`, con el valor de cada ubicación y su reparto por colección.
  - Selector con «+ Nueva ubicación…» en todos los formularios de alta.
  - "Ubicación de sesión" recordada: a partir de ahora, todo va a la Caja 1.
  - Filtro por ubicación en cada colección.

Verificado por HTTP y SQL. **Falta probar en el navegador con la sesión iniciada** el alta rápida,
los diálogos y el botón +.

## Pendiente del usuario

- Crear el repo en GitHub y hacer el primer commit.
- Crear los proyectos de Neon y Vercel y definir las variables de entorno y secretos (ver
  "Despliegue" en `docs/architecture.md`).
- Revisar la app.

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
6. **La sesión empieza eligiendo colección y ubicación** ("voy a escanear la Caja 1", D20).
   Además se fijan foil, estado e idioma, reutilizando `useStickyDefaults` y `LocationPicker`.
   Lo escaneado se puede deshacer o corregir desde la lista de la sesión.
7. **Cola de revisión** (`/review`, tabla `pending_scans`, sin crear todavía): guarda una miniatura
   y el texto leído de lo que no se reconoce. Luego se resuelve buscando a mano.
8. Manifest y service worker (Serwist) para instalar la app en el móvil.
9. Medir la tasa de acierto con unas 20 cartas variadas y ajustar los recortes. Si falla mucho,
   revisar D06.

### Fase 4 · Evolución del valor

- Gráfica del valor en el tiempo, total y por colección (`collection_value_snapshots`). Cargar la
  skill `dataviz` antes de hacerla.
- Las cartas que más suben y bajan en 7 y 30 días (`price_snapshots`).
- Histórico de precio en la ficha de carta.
- Beneficio o pérdida frente al precio de compra.

## Más adelante / ideas

- **Pokémon, cartas antiguas:** 1ª edición y shadowless con precio propio (hueco de D18).
- **Pokémon en el escáner:** las cartas modernas llevan impresos el código de expansión
  (`abbreviation.official`, por ejemplo "MEW") y el número. Encaja con el mismo enfoque de OCR.
- **Fútbol y deporte**, a mano.
- Importar CSV de ManaBox y otras apps.
- Filtro por expansión dentro de una colección.
- Detección automática del contorno de la carta en el escáner (OpenCV.js).
- Abrir la app a otros usuarios (D14).

## Preguntas abiertas


- ¿Afecta el estado (NM, LP…) al valor? Hoy no.
- ¿Debe haber un precio por idioma para las cartas antiguas? (D07)
- ¿Se agrupan en la navegación las expansiones hijas (tokens, promos) con su expansión padre?
