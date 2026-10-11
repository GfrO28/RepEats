# RepEats — Lista de comprobación en el teléfono

Para revisar en un teléfono real todo lo construido desde la Fase 6. Las pruebas automáticas (495) cubren la lógica, pero **no** la cámara, el audio, la pantalla encendida, los colores ni cómo se siente al tocar. Eso es lo que hay que ver aquí.

Tiempo estimado: 60 a 90 minutos. Marca cada casilla con `[x]`. Si algo falla, no lo arregles a mano: anótalo con el formato del final.

**Leyenda:** **Crítico** = puede afectar datos o bloquear el uso. Los que dicen *(iPhone)* o *(Android)* conviene probarlos en ambos si tienes los dos.

---

## 0. Antes de empezar

- [ ] **Crítico.** Ajustes → **Exportar respaldo** y guarda el archivo fuera del teléfono (Drive, correo). Es tu seguro antes de probar cosas que borran o crean datos.
- [ ] Desplegar una versión de prueba con HTTPS (la cámara no funciona sin HTTPS): `npm run build` y luego `firebase hosting:channel:deploy prueba`. Abre la URL que te da en el teléfono.
- [ ] Cerrar la app por completo (deslizarla de las apps recientes) y abrirla de nuevo, una o dos veces, para que cargue la versión nueva y no la guardada. Comprueba que en Progreso aparece la pestaña **Resumen**: si no aparece, sigue la versión vieja.
- [ ] Opcional pero recomendado: para no ensuciar tus datos reales, usa una **segunda cuenta de prueba** (se crea en la consola de Firebase → Authentication). Si usas tu cuenta real, borra al final lo que crees para probar.
- [ ] Anota el modelo del teléfono y la versión de iOS o Android.

## 1. Sesión en vivo (Entrenar)

Necesitas una rutina con al menos un ejercicio y un descanso de 3 minutos.

- [ ] **Crítico.** Marca ✓ en una serie: el descanso debe empezar en **exactamente 3:00**, no en 3:01, 3:07 ni 3:10. Repite 3 veces esperando distintos tiempos antes de marcar (5 s, 20 s, 1 minuto).
- [ ] Debe bajar 2:59, 2:58… sin saltos. La barra azul del recuadro avanza de izquierda a derecha.
- [ ] **+15s** y **−15s**: el tiempo cambia al instante y la barra se ajusta sin retroceder de golpe.
- [ ] **Saltar** cierra el recuadro.
- [ ] Deja que termine solo: el recuadro se pone verde con "¡Descanso terminado!" unos 3 segundos y **desaparece solo**.
- [ ] Marca la siguiente serie con el recuadro todavía visible: la barra vuelve a vacío de golpe (no se vacía con animación).
- [ ] **Crítico.** Toca ✓ dos veces muy rápido sobre la misma serie: debe quedar **una sola** serie registrada.
- [ ] Sonido *(iPhone y Android)*: al terminar el descanso suenan tres pitidos. Con el teléfono en silencio en iPhone no sonará: es normal.
- [ ] Pantalla encendida: deja la sesión abierta sin tocar la pantalla durante más de un minuto (más que tu tiempo de bloqueo). No debe apagarse.
- [ ] Bloquea el teléfono a mitad de un descanso y desbloquéalo después de que terminó: **no** debe sonar fuera de tiempo, y el recuadro ya no debe estar.
- [ ] Toca el tipo de serie (N, C, F, DS): abre la ventana para cambiarlo.
- [ ] Los botones ✓ y el tipo de serie se pueden tocar con el pulgar sin equivocarte de fila.
- [ ] Termina la sesión: el resumen muestra duración, volumen, récords (si hubo) y "Gasto estimado: unas … kcal (solo informativo)".

## 2. Ventanas emergentes

Prueba con "Agregar alimento" en el Diario, con el formulario de una rutina y con "Editar perfil".

- [ ] **Crítico.** Con una ventana abierta, arrastra el dedo sobre el fondo: **el fondo no se mueve**.
- [ ] Al cerrar la ventana, la pantalla queda exactamente donde estaba (no salta arriba).
- [ ] Ventana dentro de ventana (formulario de ejercicio → elegir músculo): al cerrar la de encima, la de abajo sigue abierta y el fondo sigue bloqueado.
- [ ] El botón ✕ se toca fácil.
- [ ] Una ventana larga se desplaza por dentro sin mover el fondo.

## 3. Progreso

Necesitas varias sesiones completadas (idealmente de 2 semanas distintas).

**Resumen**
- [ ] Es la primera pestaña y abre sola.
- [ ] Las cuatro tarjetas (sesiones, volumen, tiempo, récords) coinciden con lo que hiciste esta semana. El volumen no cuenta el calentamiento.
- [ ] Los días entrenados (L M X J V S D) tienen ✓ y el de hoy tiene un aro.
- [ ] Las dos gráficas de barras se ven y no se cortan en el borde.
- [ ] El mapa corporal (frente y espalda) ilumina los músculos trabajados. **En modo claro y en oscuro** se distinguen los niveles de color. *(iPhone: si el mapa se ve negro, avísame: pasa en iOS anterior a 16.2.)*
- [ ] La lista de músculos coincide con la pestaña **Volumen**.
- [ ] "Récords recientes" muestra el nombre del ejercicio y "antes → ahora".

**Historial**
- [ ] Sesiones agrupadas por mes, la más reciente primero.
- [ ] Al tocar una sesión se despliegan las series agrupadas ("3 × 8 @ 60 kg"), con el calentamiento aparte.
- [ ] La marca 🏆 aparece solo en sesiones donde de verdad superaste tu mejor marca.
- [ ] **Eliminar sesión** (prueba con una que no importe): pide confirmar, y al aceptar desaparece también del Resumen.

**Ejercicios**
- [ ] Al abrir propone el último ejercicio que hiciste (no una pantalla vacía).
- [ ] Los botones **1RM estimado / Peso máximo / Volumen** cambian la gráfica.
- [ ] Las "Últimas sesiones" muestran las series agrupadas.

## 4. Nutrición

**Alimentos y escáner** *(la cámara solo funciona con HTTPS)*
- [ ] **Crítico.** 📷 **Escanear**: pide permiso de cámara, lo aceptas, y se ve la imagen.
- [ ] Escanea un producto peruano conocido (leche, yogurt de una marca): aparecen sus datos de Open Food Facts con "Guardar tal como está".
- [ ] Escanea uno que no aparezca: se abre el formulario con el código ya puesto.
- [ ] Vuelve a escanear un producto que ya guardaste: lo reconoce sin consultar internet.
- [ ] Sin cámara, o si niegas el permiso: aparece el mensaje y el campo para escribir el código a mano.
- [ ] Formulario de alimento con "Por porción": convierte a 100 g y muestra cómo se guardará.
- [ ] El buscador encuentra por marca ("gloria") y por nombre.

**Diario**
- [ ] Agregar un alimento, cambiar de día con ‹ ›, copiar de otro día.
- [ ] Un día con entrenamiento muestra "Entrenamiento de este día: unas … kcal. Es una estimación y no se suma a tu objetivo". Ese número **no** cambia la barra de calorías.

**Peso**
- [ ] Guardar el peso de hoy: aparece la tarjeta de tendencia y un punto en la gráfica.
- [ ] Guardar pesajes de días anteriores (cambiando la fecha): la línea de tendencia se dibuja y aparece el ritmo en kg por semana.
- [ ] Escribe 172 en vez de 72: avisa que se aleja de tu tendencia. Con 720 no deja guardar.
- [ ] Tocar un pesaje de la lista lo carga para corregirlo.

**Plan y fases**
- [ ] Perfil: al cambiar el **nivel de actividad** aparece su descripción debajo.
- [ ] Nueva fase → **Transición** aparece **desactivada** si no tienes una fase en curso.
- [ ] Con una fase en curso, Transición muestra el calendario semana a semana hacia mantenimiento. Prueba una duración de 1 y de 13 semanas: no deja guardar.
- [ ] Al guardar, el Plan muestra "semana 1 de N · llegas a … kcal" y el Diario usa ese objetivo.

**Ajuste semanal** *(necesita datos: ver nota al final)*
- [ ] Con pocos datos, la tarjeta dice qué falta ("faltan pesajes", "faltan días de diario").
- [ ] Con datos suficientes propone un ajuste (por ejemplo "2449 → 2500 kcal"). **Aplicar ajuste** cambia el TDEE y el objetivo de la fase; después bloquea nuevos ajustes 7 días.
- [ ] "Volver a la estimación por nivel de actividad" pide confirmar.

## 5. Ajustes

- [ ] **Tema** Automático / Claro / Oscuro: cambia al instante. Recorre Entrenar, Nutrición y Progreso en **claro** y en **oscuro**: nada ilegible, ningún texto que se pierda.
- [ ] Automático sigue el modo del teléfono al cambiarlo desde el sistema.
- [ ] **Sonido al terminar el descanso**: Desactivado = no suena; **Probar sonido** suena aunque esté desactivado.
- [ ] **Mantener la pantalla encendida**: Desactivado = la pantalla se apaga sola durante una sesión.
- [ ] Los ajustes se conservan al cerrar y abrir la app.

## 6. Respaldo

- [ ] **Crítico.** **Exportar respaldo** en el teléfono: se abre la hoja de compartir y puedes guardarlo en Archivos o Drive. Abre el archivo: es texto JSON con tus datos.
- [ ] Debajo aparece "Último respaldo desde este dispositivo: (hoy)".
- [ ] **Importar respaldo** con ese mismo archivo: muestra la vista previa con el conteo por sección y no cambia nada visible al confirmar.
- [ ] Importar algo que **no** es un respaldo (una foto, otro JSON): lo rechaza con un mensaje claro y no toca nada.
- [ ] Prueba de restauración real: crea un alimento de prueba, expórtalo en un respaldo, bórralo, importa el respaldo y comprueba que reaparece.

## 7. Sin conexión y sincronización

- [ ] **Crítico.** Modo avión: abre la app, registra una serie o un alimento. Debe funcionar y verse al instante. Al volver la conexión, los datos suben solos.
- [ ] Escanear un producto nuevo sin conexión: avisa que no hay conexión y ofrece reintentar o ingresar la etiqueta.
- [ ] Sincronización entre dispositivos: registra algo en el iPhone y compruébalo en el Android (o en otra pestaña del navegador).

## 8. Un vistazo de accesibilidad (opcional, 10 minutos)

- [ ] Activa **VoiceOver** (iPhone) o **TalkBack** (Android) y recorre el Diario y una sesión: los botones ✏️ 🗑️ ✕ dicen qué hacen ("Editar Lentejas grandes"), no solo "botón".
- [ ] Los campos dicen su nombre ("Peso", "Fecha") y en una serie dicen a cuál ejercicio y serie pertenecen.
- [ ] Una ventana emergente se anuncia con su título.

---

## Nota: probar el ajuste semanal sin esperar 3 semanas

Necesita, dentro de los últimos 21 días: **5 pesajes o más** que abarquen **14 días o más**, y **10 días o más** de diario con más de 800 kcal cada uno.
- Los pesajes con fecha pasada se cargan en Nutrición → Peso cambiando la fecha.
- Para llenar el diario rápido: registra un día completo y usa **copiar de otro día** en los demás.

Hazlo con la cuenta de prueba, o bórralo después.

## Cómo reportar un problema

Por cada fallo, anota:
1. **Pantalla** y qué hacías (los pasos, en orden).
2. **Esperado** contra **obtenido**.
3. **Teléfono y versión** (iPhone 13, iOS 17.4 / Pixel 7, Android 14).
4. **Captura o video** si se puede. Para el temporizador, un video corto sirve mucho.
5. Si pasa **siempre** o solo a veces.

Con eso lo puedo reproducir y arreglar sin adivinar.

## Al terminar

- [ ] Borrar los datos de prueba (alimentos, pesajes, fases, sesiones) o descartar la cuenta de prueba.
- [ ] Si todo está bien, desplegar a producción con `firebase deploy` (te pediré confirmación antes de hacerlo).
