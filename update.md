# ChessSynth — Registro de actualización

Fecha: 28 de agosto de 2026  
Alcance: revisión y actualización integral del instrumento web.

## Resumen

Esta actualización transforma ChessSynth de un prototipo con sonidos independientes y una interfaz de paneles genéricos en un instrumento audiovisual coherente. La nueva versión comparte un único reloj musical, una única tonalidad y una mezcla protegida; explica visualmente qué sonido produce cada movimiento; permite configurar y guardar el carácter sonoro; y presenta una identidad editorial propia tanto en escritorio como en móvil.

El proyecto conserva su arquitectura liviana: HTML, CSS y módulos ES nativos, sin framework ni proceso de compilación obligatorio.

## Diagnóstico del estado anterior

La revisión de punta a punta detectó los siguientes problemas:

- Los movimientos de la partida se programaban con `setTimeout`, mientras el secuenciador de peones usaba `Tone.Transport`. Como resultado, ambas capas podían desincronizarse o derivar con el tiempo.
- El secuenciador de peones calculaba frecuencias mediante multiplicadores propios y no respetaba la tónica ni la escala elegida en la interfaz.
- La capa de peones salía directamente al destino de audio, por fuera de la mezcla maestra y sus controles.
- El mapa vertical del tablero recorría demasiadas octavas y aplicaba el mismo registro a todas las piezas, generando saltos extremos y poca continuidad tonal.
- La dama utilizaba un sintetizador polifónico pero normalmente recibía una sola nota.
- El efecto de jaque mate creaba un sintetizador nuevo en cada evento y no liberaba explícitamente ese recurso.
- Las capturas utilizaban ruido blanco directo, demasiado presente respecto de la composición.
- La tensión armónica dependía únicamente de cuatro casillas centrales y no consideraba desarrollo, pérdida de material ni fase de la partida.
- La escala visible por defecto y la escala efectiva del motor no coincidían.
- La interfaz no mostraba de forma suficientemente clara la relación entre casilla, pieza, timbre, movimiento, secuencia y tensión.
- No había persistencia de configuración ni escenas sonoras completas.
- La composición visual no tenía una adaptación responsive completa y mantenía la apariencia de un dashboard genérico.

## Nuevo modelo musical

### Tonalidad compartida

Todas las capas usan ahora la misma tónica y el mismo modo. Se mantienen seis opciones intencionalmente musicales:

- Mayor.
- Menor.
- Dórico.
- Frigio.
- Pentatónica mayor.
- Pentatónica menor.

La escala cromática se retiró de la interfaz principal porque producía resultados menos consistentes con el objetivo de música generativa tonal.

### Mapeo del tablero

- Los archivos `a–h` avanzan por grados de la escala activa.
- Los grados que superan la longitud de la escala continúan en la octava siguiente.
- Las filas `1–4` y `5–8` forman dos zonas de registro, evitando los saltos de cuatro o cinco octavas del modelo anterior.
- Cada tipo de pieza tiene además un registro base propio. Una torre permanece en el grave, mientras alfiles y caballos ocupan una zona media más legible.

### Identidad de cada pieza

- **Rey:** gesto de dos notas con voz de campana FM y ataque deliberado.
- **Dama:** acorde diatónico de tres voces cuando utiliza la voz polifónica.
- **Torre:** voz monofónica grave con filtro, pensada como fundamento.
- **Alfil:** gesto diagonal de origen a destino con síntesis AM aireada.
- **Caballo:** dos ataques breves que hacen audible el salto.
- **Peón:** impulso corto y de registro controlado.

Cada voz tiene duración, registro y dinámica propios. El usuario puede cambiar el timbre de cada pieza sin romper la organización tonal.

### Gestos de movimiento

El sonido ya no representa solamente la casilla de destino:

- Rey, alfil y caballo articulan origen y destino como un pequeño intervalo.
- La dama construye un acorde desde el grado de la casilla final.
- El enroque interpreta al rey y luego a la torre en la casilla que realmente ocupa.
- Una captura agrega un acento corto de ruido rosa filtrado.
- Jaque y promoción agregan una señal tonal aguda perteneciente al mismo universo sonoro.
- Jaque mate utiliza un acorde final persistente y un sintetizador reutilizable.

### Dinámica musical

La velocidad de cada nota se calcula a partir de:

- La dinámica elegida por el usuario.
- El perfil de la pieza.
- La fase de la partida.
- La importancia del evento: movimiento, captura, jaque o mate.

Esto evita que todos los movimientos suenen con la misma intensidad.

### Campo estéreo

El paneo se deriva del archivo de destino. Las piezas que se mueven hacia el flanco de dama se perciben ligeramente a la izquierda y las que avanzan hacia el flanco de rey, a la derecha. El color aporta un desplazamiento mínimo adicional sin separar artificialmente ambos bandos.

## Centro armónico y tensión

El antiguo drone de cuatro casillas fue reemplazado por un centro armónico estable y graduado.

La tensión combina:

- Ocupación de las cuatro casillas centrales.
- Presión sobre un anillo ampliado de doce casillas.
- Pérdida de material respecto de las 32 piezas iniciales.
- Fase de la partida, con mayor actividad durante el desarrollo medio.

El acorde de fondo parte siempre de la tónica y la quinta. A medida que crece la tensión incorpora tercera, novena y quinta superior. La calidad mayor o menor responde al modo activo. El filtro del drone se abre progresivamente con la tensión, por lo que el tablero se vuelve más brillante sin abandonar el centro tonal.

El usuario puede regular o silenciar esta lectura del centro mediante el control **Centro**.

## Secuenciador de peones

El secuenciador fue reescrito para integrarse con el resto del instrumento:

- Mantiene dieciséis pasos entrelazados: ocho blancos y ocho negros.
- Cada archivo del tablero corresponde a un paso.
- La nota de cada peón se obtiene del motor tonal compartido.
- El avance del peón determina parte de su intensidad.
- Los peones blancos y negros tienen articulaciones relacionadas pero distinguibles.
- La densidad utiliza un patrón determinista; no depende de azar descontrolado.
- El swing se aplica desde `Tone.Transport` a toda la grilla.
- La salida del secuenciador pasa por su bus de mezcla y por el espacio acústico común.
- La ocupación de los pasos se actualiza inmediatamente al mover o capturar peones.

## Reloj y transporte

Los movimientos automáticos y el secuenciador comparten ahora `Tone.Transport`.

Cambios principales:

- Se eliminó la programación musical con `setTimeout`.
- La reproducción de movimientos usa `Tone.Loop`.
- El tempo puede cambiar sin reconstruir la partida.
- La interfaz se actualiza en el instante musical mediante `Tone.Draw`.
- Pausar conserva la posición del reloj.
- Detener libera el drone, vuelve al inicio y reinicia la posición del transporte.
- Playlist, repetición y detención al final de una partida conservan una lógica única.
- El avance puede configurarse como respirado, regular o ágil.

## Arquitectura de audio

La ruta de señal quedó organizada así:

1. Voces de piezas → bus de movimientos.
2. Centro armónico → bus de drone.
3. Capturas, jaques y mate → bus de eventos.
4. Secuenciador → bus de peones.
5. Buses → reverberación compartida.
6. Reverberación → master.
7. Master → limitador de seguridad a −1 dB.
8. Limitador → salida del navegador.

Beneficios:

- Ninguna capa evita ya el master.
- Cada capa puede ajustar volumen y mute de manera independiente.
- El master evita picos digitales al coincidir acordes, peones y eventos.
- Los sintetizadores de eventos se crean una vez y se reutilizan.
- Cambiar una voz reemplaza solamente el sintetizador correspondiente.
- La liberación del drone y la disposición de nodos están centralizadas.

## Configuración y escenas

Se incorporaron cuatro escenas completas:

- **Equilibrio:** escena por defecto en Re dórico, 92 BPM.
- **Nocturno:** lenta, espaciosa, de centro armónico más presente.
- **Cámara:** clara, contenida y con menor reverberación.
- **Pulso:** rápida, rítmica y de mayor densidad de peones.

Cada escena configura de forma coordinada:

- Tónica y modo.
- Tempo y velocidad de avance.
- Volumen master.
- Dinámica.
- Espacio/reverberación.
- Intensidad del centro armónico.
- Swing.
- Densidad del secuenciador.
- Volúmenes de capas.
- Timbres y volúmenes de piezas.

Cuando se modifica un parámetro, la escena pasa a **Personalizada**. Todos los ajustes, la partida elegida y el modo de continuación se guardan en `localStorage` con escritura diferida para no bloquear cada movimiento del slider.

El botón **Restablecer** recupera la escena Equilibrio.

## Conexión visual entre componentes

Cada movimiento produce ahora una cadena visual única y simultánea:

| Evento | Tablero | Lectura central | Voces | Partitura inferior | Secuenciador |
| --- | --- | --- | --- | --- | --- |
| Movimiento | Ilumina origen y destino | Muestra SAN, pieza, recorrido y nota | Ilumina la fila de la pieza y nombra su timbre | Marca el movimiento y su pareja de jugadas | Actualiza peones presentes |
| Captura | Destino en rojo | Indica “captura” | Señala la voz que capturó | Mantiene el movimiento activo | Apaga el paso si cayó un peón |
| Jaque | Ilumina el rey atacado | Indica “jaque” y actualiza tensión | Mantiene visible la voz responsable | Conserva la notación con `+` | Continúa sincronizado |
| Momento histórico | Conserva el movimiento normal | Muestra la descripción del momento clave | Señala la voz activa | El hito está marcado con un punto de latón | Sin cambios artificiales |

Detalles agregados:

- El panel cerrado **Voces de las piezas** muestra la última combinación, por ejemplo `Peón · Pulso`.
- La fila de la pieza se ilumina durante cada ataque aunque el detalle esté abierto.
- El movimiento activo de la lista inferior se desplaza al centro y su par recibe una marca lateral.
- Las casillas, la lectura de sonido y el medidor de tensión se actualizan en el mismo evento de dibujo.
- Los pasos de peones muestran por separado presencia y paso actual.
- Los movimientos históricos destacados tienen un marcador permanente en la partitura y despliegan su explicación al alcanzarlos.

## Nueva dirección visual

La interfaz fue reconstruida como un instrumento editorial oscuro, no como un dashboard de tarjetas.

### Identidad

- Paleta de tinta, hueso, verde tablero y latón.
- Tipografía editorial `Newsreader` para títulos.
- Tipografía funcional `Manrope` para lectura.
- Tipografía monoespaciada `IBM Plex Mono` para datos musicales.
- Bordes finos, jerarquía tipográfica y ausencia de tarjetas redondeadas repetitivas.
- Tablero integrado con ejes que explican registro y grado tonal.

### Pantalla inicial

- Nuevo encabezado `ChessSynth` con contraste tipográfico.
- Descripción simplificada a: **“Partidas de ajedrez como sonido.”**
- Tres reglas del sistema visibles antes de activar el audio.
- Estado de preparación y mensaje claro sobre el gesto requerido por el navegador.

### Espacio principal

- Cabecera compacta con escena y master.
- Información de partida, jugadores, archivo histórico y resultado.
- Tablero enmarcado como superficie central.
- Lectura de movimiento y sonido directamente bajo el tablero.
- Medidor de tensión integrado.
- Mesa de composición lateral con controles progresivos.
- Timeline inferior continuo para transporte, PGN y peones.

## Responsive y accesibilidad

- Escritorio: tablero, mesa de control y timeline permanecen visibles como una única superficie.
- Tablet: la mesa de control pasa debajo del tablero y el secuenciador ocupa una fila propia.
- Móvil: la lectura se vuelve vertical, el tablero conserva proporción y los controles mantienen áreas utilizables.
- El documento puede desplazarse en pantallas pequeñas; ya no queda bloqueado por `overflow: hidden`.
- Se agregaron nombres accesibles a botones, sliders, selectores, tablero y regiones.
- Los botones de mute usan `aria-pressed`.
- El estado de reproducción se anuncia como pausa o interpretación.
- Los movimientos de la lista son botones navegables por teclado.
- Se incorporaron estados `focus-visible`.
- Se respeta `prefers-reduced-motion`.
- Atajos: espacio reproduce/pausa; flechas izquierda/derecha navegan movimientos cuando el foco no está dentro de un control.

## Rendimiento y mantenimiento

- Un solo reloj evita drift entre capas.
- Los nodos de audio de jaque y mate se reutilizan.
- El tablero reutiliza nodos SVG de piezas en vez de destruir y recrear todo el árbol en cada movimiento.
- Los clics del tablero se delegan a un único listener.
- El cursor visual del secuenciador reutiliza un rectángulo SVG.
- La lista de movimientos y las opciones de partida se insertan mediante `DocumentFragment`.
- La persistencia de sliders usa debounce de 120 ms.
- Los indicadores visuales se programan con `Tone.Draw` para coincidir con el audio.
- Tone.js quedó fijado en la versión `14.8.49` para evitar cambios silenciosos del CDN.
- Se añadieron descripción de página y color de tema.

## Contenido

- Las seis descripciones de partidas y sus momentos clave se tradujeron al español.
- La terminología visible se unificó: escena, modo, avance, centro, voces, mezcla y partitura.
- La notación SAN original se conserva sin traducción para respetar el estándar ajedrecístico.

## Archivos modificados

### `README.md`

- Reescritura para reflejar el modelo tonal, las escenas, los controles y la arquitectura actuales.
- Enlace directo a este registro detallado.

### `index.html`

- Nueva estructura completa de apertura, cabecera, superficie de tablero, mesa de composición y timeline.
- Nuevos controles de escenas, expresión, mezcla y transporte.
- Etiquetas accesibles y outputs asociados a sliders.
- Dependencia de Tone.js fijada en `14.8.49`.
- Nuevo mensaje inicial.

### `css/style.css`

- Sistema visual completo con variables de color y tipografía.
- Layout de escritorio, tablet y móvil.
- Estilos del tablero, controles, disclosures, timeline y secuenciador.
- Estados conectados de pieza activa, movimiento actual, hito histórico, reproducción y mute.
- Focus visible y reducción de movimiento.

### `js/sound-engine.js`

- Reescritura del grafo de audio.
- Nuevo mapeo tonal y registros por pieza.
- Acordes de dama y drone tonal.
- Dinámica por contexto.
- Paneo por archivo.
- Eventos persistentes de captura, jaque y mate.
- Cálculo de tensión.
- Master protegido por limitador.

### `js/pawn-sequencer.js`

- Reescritura de secuencia, voces, densidad, swing y enrutamiento.
- Integración con la escala principal.
- Dinámica dependiente del avance del peón.

### `js/main.js`

- Transporte basado en `Tone.Loop`.
- Gestión de escenas y persistencia.
- Sincronización audiovisual mediante `Tone.Draw`.
- Coordinación de tablero, voz activa, PGN, tensión y peones.
- Navegación por teclado y estados accesibles.

### `js/board-ui.js`

- Reutilización de nodos SVG.
- Clases visuales compartidas con CSS.
- Delegación de eventos.
- Cursor de peón reutilizable.
- Etiqueta accesible del tablero.

### `js/games.js`

- Traducción al español de descripciones y momentos clave.

### `update.md`

- Nuevo documento con el detalle integral de esta actualización.

## Validación realizada

- Comprobación sintáctica de todos los módulos JavaScript con `node --check`.
- Parseo del HTML y verificación de 103 identificadores sin duplicados.
- Comparación de identificadores usados en JavaScript contra los disponibles en HTML: sin referencias faltantes.
- Respuesta HTTP local correcta en `http://127.0.0.1:8080/`.
- Inicio completo después del gesto de activación de audio.
- Verificación visual en escritorio de 1440 × 1000.
- Verificación visual en móvil de 390 × 844.
- Revisión de consola tras inicialización y navegación manual: sin errores ni advertencias.
- Prueba manual del primer movimiento `e2 → e4`:
  - notación `e4` visible;
  - dos casillas iluminadas;
  - fila de peón iluminada;
  - cabecera `Peón · Pulso` activa;
  - un movimiento activo en la lista;
  - una pareja de jugadas marcada;
  - medidor de tensión actualizado.

## Dependencias y límites actuales

- Tone.js, chess.js y las fuentes se cargan desde CDN; la primera carga requiere conexión a internet.
- El navegador exige un gesto explícito para iniciar Web Audio.
- El instrumento interpreta las partidas incluidas en `js/games.js`; todavía no importa PGN externos.
- La configuración se guarda por dispositivo en `localStorage`; no se sincroniza entre navegadores.
- La calidad sonora final también depende de parlantes, auriculares y procesamiento del sistema operativo.

## Ejecución local

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080`, pulsar **Activar instrumento** y usar el transporte inferior.
