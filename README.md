# ChesSound — Partidas de ajedrez como sonido

ChesSound es un instrumento web que interpreta partidas clásicas como composiciones electrónicas generativas. Cada archivo del tablero corresponde a un grado tonal, cada zona vertical define un registro y cada tipo de pieza tiene una voz y un gesto propios.

La interfaz conecta en tiempo real tablero, movimiento SAN, voz activa, partitura, secuenciador de peones y tensión armónica.

## Modelo musical

- **Archivos `a–h`:** grados del modo elegido.
- **Filas `1–4` / `5–8`:** dos zonas de registro controladas.
- **Rey:** campana FM con gesto de origen y destino.
- **Dama:** acordes diatónicos.
- **Torre:** fundamento monofónico grave.
- **Alfil:** voz AM aireada.
- **Caballo:** cuerda pulsada de dos ataques.
- **Peón:** impulso tonal corto.
- **Captura:** acento breve de ruido rosa filtrado.
- **Jaque:** señal tonal aguda.
- **Jaque mate:** acorde final extendido.

El centro armónico responde a ocupación central, pérdida de material y fase de la partida. A mayor tensión incorpora más voces y abre su filtro sin abandonar la tónica.

## Secuenciador de peones

Los peones forman una grilla entrelazada de dieciséis pasos. El archivo define el paso, la fila define la altura dentro de la escala y el avance modifica su intensidad. Densidad y swing son configurables.

## Escenas

- **Equilibrio:** Re dórico, balance general.
- **Nocturno:** lento, espacioso y profundo.
- **Cámara:** claro y contenido.
- **Pulso:** rápido y rítmico.

También se pueden cambiar tónica, modo, tempo, avance, dinámica, espacio, centro, swing, densidad, master, mezcla por capas y timbre/volumen de cada pieza. La configuración se guarda en el dispositivo.

## Ejecución local

El proyecto usa módulos ES nativos y debe servirse por HTTP.

```bash
cd /Users/vladimirobellini/Documents/REPOS/chessynth
python3 -m http.server 8080
```

Abrir [http://localhost:8080](http://localhost:8080) y pulsar **Activar instrumento**.

Tone.js, chess.js y las fuentes se obtienen por CDN, por lo que la primera carga requiere conexión.

## Controles

- `Espacio`: reproducir o pausar.
- `←` / `→`: navegar movimientos cuando el foco no está dentro de un control.
- Timeline inferior: elegir directamente cualquier movimiento.
- Selectores superiores y mesa lateral: configurar la composición.

## Estructura

- `index.html`: estructura y controles del instrumento.
- `css/style.css`: sistema visual y layouts responsive.
- `js/main.js`: transporte, estado, escenas y sincronización audiovisual.
- `js/chess-engine.js`: carga PGN y navegación de partidas.
- `js/sound-engine.js`: síntesis, armonía, dinámica, tensión y mezcla.
- `js/pawn-sequencer.js`: secuencia tonal de peones.
- `js/board-ui.js`: tablero SVG y estados visuales.
- `js/games.js`: archivo de partidas clásicas.
- `update.md`: registro detallado de la actualización integral.

## Detalle de la actualización

El diagnóstico, las decisiones musicales, los cambios por archivo y las validaciones están documentados en [update.md](update.md).
