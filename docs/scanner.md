# Escáner

Estado: implementado y probado con imágenes de muestra. La primera prueba del usuario con el
móvil y cartas reales (2026-09-11) fue «bastante regular», y con eso se rehicieron la votación,
la búsqueda por título y la pantalla completa. **Falta volver a medirlo con cartas reales.**
Decisiones: D06 y D20 en `docs/decisions.md`.

## Cómo funciona

```
cámara trasera (getUserMedia, se piden 3840×2160; el móvil da lo que puede)
  → a pantalla completa, con el recuadro guía 63×88 entre la barra de arriba y el panel de abajo
  → el recuadro, pasado de coordenadas de pantalla a píxeles de vídeo      src/lib/scan/geometry.ts
    (object-fit: cover recorta el vídeo: coverTransform + toVideo)
  → 1. franja de datos (abajo a la izquierda: x 2–50 %, y 89,5–99 %), escalada a 140 px de alto,
       en gris con el contraste estirado → Tesseract (A–Z 0–9 / • ., PSM 6)
       → parseCollectorLine(): número, total, códigos, idioma           src/lib/scan/parse.ts
       → POST /api/scan/lookup → lookupScan()                           src/lib/queries/scan.ts
  → 2. si no hay línea de datos (una de cada dos lecturas): franja del título (x 4–76 %,
       y 2,5–10 %), 90 px → Tesseract (letras, PSM 7) → parseTitle()
       → POST /api/scan/name → lookupByName()
  → votación: la lectura tiene que salir 2 veces entre las últimas 6 (no hace falta que sean
    seguidas) y dar UNA carta → addItem(source: "scan") al destino de la sesión
```

- **Qué se lee de cada tipo de carta:**

  | Carta | Franja de datos | Si falla |
  | --- | --- | --- |
  | Magic 2023+ | `U 0001` / `MKM • EN`: código y número | Título |
  | Magic 2014–2022 | `001/280 C` / `M20 • EN`: código y número | Título |
  | Magic 2003–2013 | `146/249` junto al copyright, **ilegible** | **Título**. Con la expansión fija sale una sola carta. |
  | Pokémon Escarlata y Púrpura en adelante | `G [PAL EN] 001/193`: código (`sets.print_code`) o total | Título |
  | Pokémon Espada y Escudo y anteriores | `F 001/195`: total (`sets.printed_total`) y número | Título |
  | Full art / ilustraciones especiales | Texto sobre la ilustración, suele fallar | Título; si no, búsqueda manual |

- **Correcciones del OCR** en `parseCollectorLine`:
  - Letras en lugar de dígitos dentro de números (`0O1/I93` → `001/193`) y un símbolo pegado
    delante (`L001` → `001`).
  - Códigos pegados a un símbolo (`BPAL` → `PAL`) y O/0 intercambiadas (`M2O` → `M20`). Se prueban
    todas las variantes y el catálogo decide cuál existe.
- **Búsqueda por título** (`lookupByName`):
  - Similitud de trigramas contra los nombres en inglés y en español. Se prueba también el texto
    sin la primera palabra, porque el OCR suele meter ahí basura del marco o de la insignia de
    fase.
  - Se acepta un nombre si la similitud es alta (≥ 0,6), o si pasa de 0,45 y además supera a la
    segunda candidata en al menos 0,1. Así, "aerial ee" no se da por "Erial" (Wasteland en
    español, 0,45), que casi empata con cuatro cartas "Aerial …" (0,44).
  - En los empates gana el nombre más corto: la carta de la serie de arte "Lightning Bolt //
    Lightning Bolt" empata con "Lightning Bolt".
  - Devuelve las ediciones de esa carta. Sin expansión fija suelen ser varias y se elige por la
    imagen; con expansión fija, normalmente una.
- **Lecturas ambiguas:** si caben varias cartas, se muestran hasta 24 candidatas, las más
  recientes primero, para elegir por la imagen.
- **Añadir la misma carta dos veces:** tras añadir una, no se vuelve a añadir hasta que se lean 3
  fotogramas sin nada (la carta ha salido del encuadre). Para otra copia está el **+**.
- **El idioma impreso** ("EN", "ES"…) manda sobre el idioma por defecto de la sesión.

## Pantalla (`/scan`)

- **Antes de empezar:**
  - Ubicación y colección, las dos opcionales (`EntryTarget`, D23). Sin ninguna, lo escaneado
    entra en Mis cartas sin ubicación.
  - Si la ubicación tiene separadores (D28), también el separador. En modo automático, cuando
    se llena, lo siguiente va al separador siguiente, con aviso y vibración para que pongas el
    separador físico. En la parte de arriba se ve «Caja 1 › 3 (87/100)», y en el panel de abajo
    está el botón «Siguiente separador».
  - Acabado, estado e idioma por defecto.
  - Expansión fija (opcional), con un buscador por nombre o código (`SetPicker`). Los álbumes
    de fútbol salen primero, y dentro de cada juego, las expansiones más recientes. También se
    entra con ella desde la página de la expansión: «Escanear esta expansión»,
    `/scan?set=mtg:m10`.
  - Botón **Foto**, para probar sin cámara.
  - La lista de la sesión, con «Añadir la sesión a una colección», y «¿No la reconoce? Búscala a
    mano», que abre el alta rápida.
- **Escaneando, a pantalla completa** (capa fija, con los márgenes de seguridad de iOS gracias a
  `viewportFit: cover`):
  - Como en ManaBox, la cámara ocupa toda la pantalla y los controles flotan sobre ella: nada le
    quita sitio al recuadro ni lo mueve.
  - **Arriba**, sobre la imagen: cerrar, destino (ubicación, colección y «solo XXX» si hay
    expansión fija) y el contador de la sesión.
  - **A la derecha**, una columna de botones:
    - linterna, si el móvil la ofrece en `getCapabilities().torch`;
    - «Identificar con IA»;
    - «Para luego», con las que hay por revisar;
    - ajustes: el tamaño del recuadro y «Ver lo que lee».
  - **En medio:** el recuadro guía, con la franja de datos marcada en amarillo y el estado de la
    lectura.
    - Va centrado en la pantalla, donde mira la cámara, y no cambia de tamaño ni de sitio. Antes
      el panel de abajo crecía y encogía con lo que enseñaba y lo movía; con un card slinger, que
      deja la carta siempre en el mismo sitio, eso lo desencajaba.
    - El recuadro ocupa el 94 % de la pantalla, menos una franja arriba y otra abajo para las
      barras flotantes. Con «Recuadro − +», en los ajustes de la derecha,
      se hace más pequeño, hasta el 60 %, y el tamaño se recuerda en el dispositivo. Sirve para un
      card slinger, donde la carta se ve más pequeña y no se puede acercar: se ajusta una vez hasta
      que la carta llene el recuadro, para que la franja amarilla caiga en el número.
  - **Abajo, flotando, la última carta añadida** en una línea: imagen, nombre, expansión, precio para su acabado y
    - **cantidad** −/+: `changeQuantity(-1)` o un `addItem` más;
    - **acabado** con un toque, que pasa al siguiente (Normal/Foil/Etched en Magic, Estándar/Reverse holo en
      Pokémon): `changeFinish()` mueve esas copias al montón con el acabado nuevo, fusionándolas
      si ya existe.
  - Si la lectura es ambigua, encima aparece la tira de candidatas.
  - **«Para luego»** (el reloj de la columna de la derecha, D25) guarda en la cola de revisión,
    sin parar la sesión:
    - una foto del recuadro (JPEG de 560 px de alto);
    - lo último que ha leído y el nombre que ha sacado del título, si lo hay;
    - los ajustes de la sesión.

    La cola se resuelve en `/review`, a la que se llega con el enlace «N por revisar» del
    escáner y de Mis cartas. Cada foto sale con la búsqueda rellenada con ese nombre, y la carta
    se añade con los ajustes guardados.
  - **Historial y total de la sesión:**
    - Arriba a la derecha, «12 · 34,50 €»: cartas y valor de la sesión, con el precio de cada
      acabado en el momento de leerla. Las copias sin precio se cuentan aparte.
    - Al tocarlo se abre el historial: hora, carta, expansión, acabado, valor y −/+. Mientras
      está abierto, la lectura se pausa.
    - La sesión se guarda en el dispositivo (`scan-session.ts`, localStorage), así que no se
      pierde si recargas, se bloquea el móvil o cierras la cámara.
    - Lo escaneado ya está en Mis cartas. Al acabar, en la página del escáner o al pie del
      historial, hay tres opciones:
      - **A una colección:** lista esas ediciones en una colección.
      - **A una ubicación:** mueve solo las copias de la sesión, no las que ya tenía un montón
        al que se sumó una lectura, a la ubicación y separador que elijas (`moveItems` con
        cantidades por montón).
      - **Terminar sesión:** pone el historial y el total a cero, y las cartas se quedan donde
        se añadieron. Se puede deshacer.
  - **Álbumes de fútbol** (D29):
    - Las Megacracks no llevan número por delante, y el nombre del jugador va en vertical, en
      blanco sobre una franja negra a la derecha.
    - Con el álbum como **expansión fija**, el escáner lee esa franja en lugar de la esquina,
      que es la zona marcada en amarillo: la gira, la pasa a grises e invierte los colores
      (`NAME_LAYOUTS` por línea de producto, en `src/lib/scan/geometry.ts`).
    - Busca el nombre solo en el álbum (`lookupInAlbum`) y ofrece todas las fichas del
      jugador (base, Élite, Power, Special One…), la más sencilla primero, para tocar la tuya.
      Solo se escanea por delante, que es también la foto compartida.
    - Medido con una base de 2025-26: «LAMINE YAMAL», con un 78 % de confianza. Falta
      probarlo con cartas reales de las series especiales, que pueden llevar el nombre en otro
      sitio.
  - **Foto compartida:** al añadir una carta sin imagen de catálogo (fútbol, algunas de
    Pokémon), el escáner guarda en segundo plano la foto del recuadro (300×419) como imagen de
    esa carta para todos, si aún no tiene ninguna (D30).
    - La carta se busca alrededor del recuadro, se endereza y se recorta a sus bordes, con los
      niveles ajustados (D32). Lo mismo con la foto de «Para luego» y la de «Identificar con
      IA». Si no encuentra los bordes, usa el recorte del recuadro.
  - **Reconocer por la foto** (D33):
    - Al empezar se descargan las huellas perceptuales de las fotos compartidas del álbum fijado,
      o de todas.
    - Una de cada tres lecturas endereza la carta del recuadro, calcula su huella (63 bits) y la
      compara en el propio dispositivo. Cuenta si está a 12 bits o menos y claramente más cerca
      que la siguiente, y la misma carta tiene que salir en 2 de las últimas 6 lecturas.
    - Así, una Élite o una Flashback se identifican con la IA la primera vez y, desde que tienen
      foto, se reconocen solas.
    - «Ver lo que lee» muestra «foto: a N bits» cuando reconoce una.
  - **Identificar con IA** (D31), en la columna de la derecha, solo si está configurada
    `ANTHROPIC_API_KEY`:
    - Manda la foto del recuadro (JPEG de 560 px) a `POST /api/scan/identify`, que se la pasa a
      Claude Sonnet 5 y le pide un JSON con un formato cerrado (`src/lib/scan/identify.ts`):
      - en los álbumes de fútbol: nombre, equipo, número y serie, elegida de las series del
        álbum;
      - en el resto: nombre, número y código de expansión.
    - La respuesta se cruza con el catálogo (`lookupReading`). La IA nunca decide sola qué
      carta es:
      - en fútbol, las fichas del jugador en el álbum, con la serie que ha visto primero;
      - en Magic y Pokémon, la edición con ese número y ese nombre, o las ediciones de ese
        nombre.
    - Si sale una carta, se añade. Si salen varias, se elige, con la más probable primero.
    - La lectura se pausa mientras identifica.
    - Unos 3 s y 0,003 $ por carta. Cada llamada se apunta en `ai_identifications`, con un
      límite de 150 cada 24 horas (`AI_IDENTIFY_DAILY_LIMIT`).
    - Medido el 2026-09-12 con dos Megacracks (una base y una Élite Power): Sonnet 5 acertó el
      jugador y la serie en las dos; Haiku 4.5 y Opus 5 fallaron alguna serie.
  - «Ver lo que lee», en los ajustes, muestra la última franja procesada y el texto de Tesseract.
- **PWA:** manifest, iconos y `appleWebApp`. Añadida a la pantalla de inicio, se abre sin la barra
  del navegador. Aún no hay service worker.

## Requisitos

- **HTTPS** (o `localhost`), porque el navegador solo da la cámara en contextos seguros.
- Tesseract.js descarga su *worker*, su *core* (WASM) y el idioma `eng` desde jsDelivr la
  primera vez (unos MB).

## Mediciones (2026-09-11, escaneos de Scryfall y TCGdex)

**Franja de datos:**

| Muestra | Lectura | Resultado |
| --- | --- | --- |
| DMU 107 | `107/281 M ⏎ DMU EN CHRIS RAHN` | ✅ Sheoldred, the Apocalypse |
| MKM 1, WOE 1, ELD 1, M20 1 | Correctas | ✅ |
| Pokémon PAL 001 | `BPAL 001/193` | ✅ |
| Pokémon SIT 001 | `F 001/195` | ✅ por el total |
| Pokémon PBL 001 | `001/084` | ✅ |
| M10 146 (marco antiguo) | Ruido | ❌ |
| Pokémon 151 #199 (ilustración especial) | Ruido | ❌ |

Una franja de ancho completo (y 93,5–99 %) no mejoraba el conjunto y se descartó.

**Título** (resuelto con `lookupByName`, sin expansión fija):

| Muestra | OCR del título | Resultado |
| --- | --- | --- |
| ELD 1, WOE 1 | Correcto | ✅ |
| MKM 1 | `Case of he Shattered Pact` | ✅ |
| M10 146 | `fi Lightning Bolt` | ✅ Lightning Bolt (tras el desempate por longitud) |
| Pokémon Tropius, Hoppip, Venonat | `oastc, Tropius`, `and Hoppip`, `esd Venonat` | ✅ quitando la primera palabra |
| M20 1 | `Aerial EE` | Sin coincidencia, que es lo correcto: con el umbral antiguo daba Wasteland ("Erial") |
| DMU 107 | `I Shdlired ic gncaljiie` | ❌ (el número sí se lee) |
| Pokémon 151 #199 | `BES Charizard GX` | ⚠️ da Charizard GX, que es otra carta |

## Parámetros de ajuste

En `scanner.tsx`:
- `INFO_HEIGHT` (140) y `TITLE_HEIGHT` (90).
- `TICK_MS` (250).
- `VOTES_NEEDED` (2) de `VOTE_WINDOW` (6).
- `EMPTY_READS_TO_RELEASE` (3).

En `geometry.ts`:
- `INFO_STRIP` y `TITLE_STRIP`.
- El relleno del recuadro guía, `GUIDE_FILL` (0,94), por el tamaño que elija cada uno (del 60 al
  100 %, `guideScale` en los valores recordados del dispositivo).

En `queries/scan.ts`:
- `NAME_SIMILARITY_SURE` (0,6).
- `NAME_SIMILARITY_MIN` (0,45).
- `NAME_MARGIN` (0,1).

## Pendiente

- **Volver a medir con el móvil y cartas reales.** «Ver lo que lee» enseña lo que falla.
- Recordar el acabado elegido en el panel para las siguientes cartas, si el uso lo pide. Hoy
  cambia solo la carta actual; el valor por defecto se fija antes de empezar.
- **Cola de revisión** con miniatura (`pending_scans`), si la búsqueda manual se queda corta.
- **Service worker** (Serwist), para uso sin conexión.
- Si con el OCR no basta: reconocimiento por imagen (hash perceptual de la ilustración, que
  necesita detectar la carta y corregir la perspectiva) o respaldo con IA (descartado de momento
  por coste, D06).
