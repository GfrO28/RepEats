# RepEats — Especificación

## 1. Objetivo
Registrar rutinas y sesiones de entrenamiento (orientado a hipertrofia) y llevar un plan de nutrición con objetivos de calorías y macros por fase. Uso personal, sincronizado entre iPhone y Android, con funcionamiento sin conexión en el gimnasio.

Referencias estudiadas:
- Entrenamiento: Hevy (registro rápido, interfaz limpia, mapa muscular) y Strong (registro en pocos toques, temporizadores de descanso flexibles).
- Nutrición: MacroFactor (gasto adaptativo según tendencia de peso e ingesta, sin mensajes de reproche), Cronometer (precisión de datos) y MyFitnessPal (amplitud de base de alimentos).

## 2. Módulo de entrenamiento

### 2.1 Biblioteca de ejercicios
- Nombre, músculos primarios y secundarios, equipo, notas (p. ej. ajuste de máquina).
- Ejercicios personalizados ilimitados.
- Figura o animación por ejercicio: evaluado y descartado por ahora (sin imágenes). Fotos/GIF de bancos como Strength Level no tienen licencia libre; wger (CC-BY-SA, buena calidad, gratis) no convenció por el estilo de sus ilustraciones; dibujar algo propio a mano no salió lo bastante claro. Si se retoma más adelante, revisar de nuevo las opciones (no hay solución de Firebase Storage sin pasar a plan Blaze).

#### Taxonomía muscular (3 niveles)
Basada en Delavier, con ajustes propios frente a Hevy/Fitbod (ver `src/domain/muscleGroups.ts`):

- **Región** (6): Pecho, Espalda, Hombros, Brazos, Core, Piernas. Solo informativa/agrupadora.
- **Grupo muscular** (17 + 1 auxiliar): el nivel que cuenta para el volumen semanal (Fase 3). Ej. Pectorales, Dorsales, Espalda alta, Trapecios, Lumbares, Cuádriceps, Isquiotibiales, Abductores, Aductores, etc.
- **Músculo específico** (51): el nivel que realmente se guarda en el ejercicio (como slug estable, ej. `pectoral_superior`), con su etiqueta en español para mostrar en la UI.

Reglas:
- Un ejercicio tiene 1 o 2 músculos primarios (`primaryMuscles`), y ambos deben pertenecer al mismo grupo muscular.
- Puede tener hasta 4-5 músculos secundarios (`secondaryMuscles`), de cualquier grupo.
- La región y el grupo **nunca se guardan** en el ejercicio — se derivan del músculo específico (`getMuscleGroup`, `getMuscleRegion`).
- Grupo auxiliar especial **"Flexores de cadera"** (psoas-ilíaco): solo válido como músculo secundario (`primaryEligible: false`), y no cuenta para el volumen semanal (`countsTowardVolume: false`).
- Si una variante de un ejercicio cambia el músculo primario, se registra como un ejercicio distinto, no como variante del mismo.

### 2.2 Rutinas (plantillas)
- Nombre, día sugerido y hora sugerida (opcional): con ambos, el Diario los usa para sugerir cuándo comer antes y después de entrenar (ver 3.5).
- Lista ordenada de ejercicios; cada uno con series objetivo: repeticiones (o rango), peso y descanso en segundos. El tipo de serie (normal, calentamiento, al fallo, drop set) no se planea aquí: toda serie objetivo nace "Normal" y se ajusta por serie durante la sesión en vivo (tocando su badge N/C/F/DS), que es más flexible que fijar un solo tipo para todo el ejercicio.
- Reordenar ejercicios dentro de una rutina (asa de arrastre aparte del resto de la fila) y quitar un ejercicio deslizando la fila hacia la izquierda, sin confirmar (es un borrador: no se guarda hasta "Guardar cambios"). Cada ejercicio ya agregado tiene un botón de opciones (⋮) a la derecha de la fila, con un menú (por ahora una sola opción, "Reemplazar ejercicio") que abre el mismo buscador con filtros de grupo muscular/equipo; al elegir el reemplazo, cambia el ejercicio de ese puesto conservando sus series/reps/peso/descanso y su posición en la lista (no se puede reemplazar por uno que ya esté en la rutina). Duplicar rutina, superseries (opcional, fase posterior).
- Orden de la lista de rutinas: a gusto del usuario, no alfabético ni el de creación. Cada rutina guarda su posición (`order`); se reordena arrastrando con la misma asa, y al soltar se guarda de inmediato (sin un botón de guardar aparte, a diferencia del orden de ejercicios dentro de una rutina). Una rutina nueva se crea al final de la lista. Las rutinas de antes de existir este campo se muestran al final, ordenadas por nombre, hasta que el usuario reordene algo (momento en el que todas quedan renumeradas).
- Franja de días arriba de la lista (`getDayOfWeek`, `getRoutinesForDay`): 7 botones L-M-X-J-V-S-D, el día de hoy resaltado con un anillo. La lista de abajo (con arrastrar para reordenar) muestra solo las rutinas con ese "día sugerido"; al arrastrar, solo se reordenan entre sí las del día elegido, sin afectar la posición relativa de las de otros días. Un día sin ninguna rutina asignada se muestra como "Descanso" en vez de la lista (no hace falta marcarlo aparte: se calcula solo). Es una ayuda de consulta, no un calendario con fechas reales: no hay agenda ni notificaciones asociadas.

### 2.3 Sesión en vivo
- Iniciar desde una rutina o vacía.
- La fila activa de cada serie muestra, justo debajo de cada campo, lo que se cargó en esa misma serie (por posición) la última vez que se completó ese ejercicio: "Antes 60" debajo del peso y "Antes 8" debajo de las reps, en `text-primary` y negrita (no en gris chico: es el dato que de verdad se usa para decidir cuánto subir, no una nota al pie). Reemplaza al texto de "Objetivo: X reps" de la fila activa, que ya es redundante con lo que muestran las filas bloqueadas de más abajo. Usa `getExerciseHistory` (ya usado para récords; sin lecturas nuevas a Firestore, `LiveSessionPage` ya tiene las sesiones pasadas suscritas). Es solo texto de referencia: no precarga el peso del input, para no asumir que quieres repetir exactamente lo mismo. Sin historial de ese ejercicio, o sin una serie en esa posición la vez pasada (hiciste menos series o es una "serie extra"), no se muestra nada.
- **Unidad de peso por ejercicio (kg/lb)**: junto al nombre de cada ejercicio en la sesión en vivo hay un botón "KG"/"LB" (mismo estilo que el badge de tipo de serie) que cambia en qué unidad se muestra e ingresa el peso de ESE ejercicio en ESTA sesión — pensado para gimnasios donde una máquina marca en libras y otra, para el mismo ejercicio, en kilos. Es por ejercicio (no global ni por serie) y no se guarda: empieza en kg cada vez que se abre la sesión. Todo se sigue guardando en kg (`weightUnit.ts`: `kgToLb`/`lbToKg`, conversión solo en la UI): el resto de la app (volumen, 1RM, récords, el "Antes" de arriba) no se entera de la unidad en que se ingresó.
- Marcar serie completada con un toque → guarda peso, reps, RIR opcional y hora; inicia descanso automáticamente.
- Tres tiempos: total de sesión, por ejercicio y cuenta regresiva de descanso (±15 s, saltar).
- Fin del descanso: el recuadro se pone verde durante 3 s ("¡Descanso terminado!") y se oculta solo; suenan tres pitidos (Web Audio, sin archivos de audio; el audio se desbloquea con el toque en ✓ porque iOS lo exige). Solo suena con la app abierta: iOS suspende la PWA en segundo plano y no permite avisos programados. Mientras hay una sesión abierta se mantiene la pantalla encendida (Wake Lock API, donde exista, y se vuelve a pedir al regresar a la app). Ambas opciones se pueden desactivar en Ajustes y se guardan por dispositivo.
- Agregar/quitar series o ejercicios durante la sesión; notas por ejercicio.
- Al finalizar: resumen (duración, volumen total, récords nuevos) con dos botones — "Guardar sesión" (la marca como completada) o "Descartar sesión" (pide confirmar y la elimina por completo, sin guardar nada; para sesiones iniciadas por error o solo de prueba).
- La sesión en curso debe sobrevivir a cerrar la app (estado persistido en Firestore/caché).

### 2.4 Progreso
- Historial por ejercicio, récords personales, 1RM estimado (Epley: peso × (1 + reps/30)).
- Gráfica por ejercicio (peso máximo, 1RM estimado, volumen).
- Series efectivas y volumen semanal por grupo muscular.
- Calendario/lista de sesiones.
- Pestaña **Ejercicios**: elige un ejercicio (primero los ya hechos, el más reciente arriba, que es el que se propone al abrir) y muestra su mejor 1RM estimado y su peso máximo con fecha, cuántas sesiones lleva, el cambio del 1RM desde la primera sesión, una gráfica (1RM estimado, peso máximo o volumen) y sus últimas sesiones con las series agrupadas.
- Pestaña **Historial** (`src/domain/sessionHistory.ts`): sesiones completadas agrupadas por mes, la más reciente primero. Cada tarjeta muestra el día ("mié 4 mar"), la rutina (o "Sesión libre"), duración, volumen, ejercicios y series efectivas, y una marca 🏆 si en ella se logró un récord; al tocarla se despliegan las series por ejercicio agrupadas ("3 × 8 @ 60 kg", con el calentamiento aparte), los récords y las notas. Permite eliminar una sesión con confirmación (desaparece también de estadísticas y récords).
- Pestaña **Resumen** (la primera de Progreso, `src/domain/progressSummary.ts`): semana actual (lunes a domingo) contra la anterior en sesiones, volumen (sin calentamiento), tiempo entrenando y récords nuevos, con diferencias en tono neutral; los días que entrenó la semana; sesiones y volumen de las últimas 8 semanas; mapa corporal de calor con las series efectivas por grupo muscular de la semana (cortes en 1, 5, 10 y 16 series) y su lista en texto; y los récords recientes. Un récord es superar el mejor 1RM estimado anterior en un ejercicio ya hecho: la primera vez que se hace un ejercicio no cuenta. Todas las cifras agrupan las sesiones por el día en que terminaron, igual que el volumen semanal por grupo muscular, que tampoco cuenta el calentamiento.

## 3. Módulo de nutrición

### 3.1 Perfil
Peso, estatura, edad, sexo, nivel de actividad. Unidades métricas.

### 3.2 Cálculo inicial
- TMB (Mifflin-St Jeor):
  - Hombre: 10·peso_kg + 6.25·altura_cm − 5·edad + 5
  - Mujer: 10·peso_kg + 6.25·altura_cm − 5·edad − 161
- TDEE = TMB × factor de actividad (1.2 sedentario, 1.375 ligero, 1.55 moderado, 1.725 alto, 1.9 muy alto).
- En Plan (Nutrición), la tarjeta "Tu gasto energético" explica en texto simple qué representa cada cifra (TMB = gasto en reposo total, sin moverte; TDEE = TMB por el nivel de actividad, con el entrenamiento ya promediado ahí dentro — por eso el ejercicio no se suma aparte al objetivo del día) y cómo el objetivo de kcal de la fase activa sale de ese TDEE.

### 3.3 Fases
| Fase | Ritmo semanal orientativo |
|---|---|
| Déficit | −0.5 % a −1 % del peso corporal |
| Mantenimiento | 0 |
| Superávit | +0.25 % a +0.5 % |
| Transición | Ajuste gradual de calorías hacia mantenimiento |

- kcal objetivo = TDEE + (ritmo_kg_semana × 7700) / 7.
- **Transición** (`nutritionGoals.ts`): solo se puede empezar si ya hay una fase en curso. Parte del objetivo de esa fase y llega al gasto de mantenimiento (TDEE, el ajustado si lo hay) en N semanas (2 a 12, por defecto 4), cambiando una vez por semana en partes iguales; sube si venía de un déficit y baja si venía de un superávit, y nunca baja del piso de calorías. La fase guarda su calendario (`transition`) y el objetivo de cada día se calcula con `resolvePhaseTargets`: proteína y grasa se mantienen y los carbohidratos siguen a las calorías. Si el ajuste adaptativo cambia el gasto, cambia la meta final de la transición.
- Macros: proteína 1.6–2.2 g/kg; grasa 0.6–1 g/kg; resto carbohidratos (proteína y carbohidratos 4 kcal/g, grasa 9 kcal/g).
- Límites de seguridad: piso mínimo de calorías configurable con valor por defecto conservador y ritmo de déficit máximo de 1 %/semana. La app nunca sugiere valores fuera de esos límites.

### 3.4 Ajuste adaptativo (semanal)
- Peso de tendencia: media móvil exponencial de los pesajes diarios.
- TDEE observado ≈ ingesta_promedio − (Δpeso_tendencia_kg × 7700) / días (ventana de 2–3 semanas).
- TDEE nuevo = mezcla suavizada entre estimado previo y observado; limitar el cambio semanal del objetivo.
- Requiere datos mínimos (p. ej. ≥ 10 días con registro en la ventana); si faltan, mantener el objetivo.
- Implementación (`src/domain/weightTrend.ts` y `adaptiveTdee.ts`): tendencia = media móvil exponencial con factor 0.1 por día (ajustado por los días sin pesar); ventana de 21 días; se exigen ≥ 10 días de diario completo (un día con menos de 800 kcal se considera a medias y no cuenta), ≥ 5 pesajes y ≥ 14 días entre el primero y el último; un resultado fuera de 1000-6000 kcal se descarta como dato erróneo. Nuevo TDEE = estimado + 30 % de la diferencia con lo observado, con tope de ±150 kcal por ajuste y como máximo un ajuste cada 7 días.
- El ajuste **se propone y el usuario lo confirma** (Plan → Ajuste semanal); no se aplica solo. Al aplicarlo se guarda `adaptiveTdee { kcal, updatedAt }` en el perfil (el Plan y las fases nuevas usan ese gasto en lugar de la estimación por nivel de actividad) y se recalcula el objetivo de la fase activa (mismo ritmo, misma proteína y grasa; cambian los carbohidratos). Se puede volver a la estimación por actividad.

### 3.5 Diario de comidas
- Comidas del día (desayuno, almuerzo, cena, snacks; configurables).
- Buscar alimento (sin distinguir mayúsculas ni tildes); porción en gramos o unidades. Al abrir el selector se ofrecen primero los favoritos (⭐) y los recientes; en la búsqueda, favoritos y más usados van arriba. Cada alimento guarda `isFavorite`, `useCount` y `lastUsedAt`.
- Reutilización: favoritos y recientes; **copiar de otro día** (solo esa comida o el día completo, con vista previa); **comidas guardadas** (un conjunto de alimentos, p. ej. "mi desayuno", que se agrega de una vez y queda como varias líneas editables); y **recetas** (ingredientes + peso final cocido, guardadas como un alimento más con sus macros por 100 g). Una comida guardada no es una receta: no se cocina ni tiene peso final, cada alimento sigue siendo una línea aparte en el diario.
- Al agregar un alimento, sin escribir nada, la lista se organiza por categorías, en una barra vertical a la izquierda (no en una fila de chips horizontal, para no competir por ancho con la lista de resultados ni partirse en varias líneas con 5 categorías): **Favoritos**, **Frecuentes**, **Guardados** —elegir una usa esa comida guardada entera, de una vez, igual que antes—, **Recetas** y **Todos**; escribir en el buscador ignora la categoría elegida y busca en toda la biblioteca. "Guardados" reemplaza al botón aparte "Comida guardada" que había en cada comida (mismo resultado, ahora dentro del mismo buscador).
- **Editar una comida guardada**: en la categoría "Guardados", cada fila tiene un botón ✏️ aparte (no activa la comida) que abre el mismo formulario de guardar, precargado — permite cambiarle el nombre, tocar un alimento para cambiar su cantidad (recalcula kcal/macros en la misma proporción, sin volver a buscar el alimento original) y quitarlo deslizando (como el resto de listas), antes de guardar los cambios. Un alimento sin gramos (registro rápido histórico) no se puede tocar para cambiar su cantidad, solo quitar. No permite agregar alimentos nuevos ahí mismo: para eso, se vuelve a guardar como comida desde el diario con la lista que se quiera.
- **Frecuentes es por comida** (`useCountByMeal`, desglosado por tipo de comida): un alimento que se usa seguido en el desayuno (p. ej. "Leche Gloria") aparece en "Frecuentes" al agregar al desayuno, pero no al agregar al almuerzo o la cena si ahí no se usó. `useCount` (el total, sin desglosar) se sigue guardando aparte para el orden general de la búsqueda.
- Editar un alimento ya registrado: tocarlo abre el mismo formulario de agregar, precargado con su alimento y cantidad (si su alimento ya no existe en la biblioteca, se abre en blanco para elegir de nuevo). Deslizarlo a la izquierda lo quita, como el resto de listas de la app.
- Objetivo por comida (`distributeMealTargets`): el objetivo del día (kcal y macros) se reparte entre las comidas visibles ese día, con más peso en las tres principales (25/35/25 %) que en las opcionales (5 % cada una); junto al nombre de cada comida se ve "consumido / objetivo" de kcal y de cada macro. Si una comida no se usa ese día (opcional desactivada, o quitada), su parte se reparte entre las demás automáticamente — es un cálculo al vuelo según cuáles comidas estén visibles, no algo que haya que guardar ni recalcular a mano. Es un reparto fijo (no configurable por el usuario) pensado como una ayuda de referencia, no una meta estricta por comida.
- Cada alimento registrado muestra, de forma resumida, sus propios macros junto a las kcal (p. ej. "100 g · 150 kcal · P 5.4 · G 3.1 · C 20").
- Hora de cada comida (`mealSchedule.ts`, `resolveMealTimes`): cada comida tiene su propia hora, elegida a mano o tentativa. No depende de una hora de despertar/dormir configurada aparte (se evaluó y se descartó: es más natural que la hora de una comida salga de cuándo se hizo la anterior, no de un horario de sueño declarado por separado).
  - **Elegirla a mano**: al agregar un alimento, arriba del buscador aparece un chip con la comida y su hora ("Desayuno 08:00 ▾" — `AddItemForm`); tocarlo abre "Hora de {comida}" (`MealTimePicker`), con la rueda de esa comida únicamente (hora y minuto) — no la de todo el día. Cada rueda se puede deslizar con el dedo o el mouse para moverse rápido (se engancha al número más cercano), y también tiene botones ▲/▼ para subir o bajar de uno en uno: la rueda del mouse sola salta de a varios números a la vez y no es precisa para elegir un minuto exacto. "Aceptar" guarda esa comida en `DiaryDay.mealTimes` (por tipo de comida, solo ese día).
  - **Tentativa** (comida sin hora elegida todavía): el "día" para repartir arranca en la **primera comida** (elegida a mano, o `DEFAULT_FIRST_MEAL_TIME` = 07:30 si todavía no se eligió ninguna) y dura un bloque fijo de **14 horas** (`ASSUMED_DAY_SPAN_MINUTES`) — no se pide hora de dormir, se asume un día activo típico (desayuno 7-8am → última comida 9-10pm). Dentro de ese bloque, las comidas sin hora elegida se reparten **parejo** (no encadenadas con un margen fijo desde la anterior), para que la última caiga cerca del final del bloque en vez de apelmazarse todas temprano. Cualquier comida que SÍ se elija a mano es también una **ancla**: parte el día en tramos, y las comidas tentativas entre dos anclas se reparten parejo solo en ESE tramo (no en todo el día) — así, corregir una comida a mano reacomoda sensatamente las de alrededor. Si la hora de entreno de la rutina sugerida ese día de la semana (`getTrainingTimeForDay`) cae dentro de alguno de esos tramos, se reserva ahí una comida ~2 h antes y otra después de entrenar (rutina + volver a casa, `POST_WORKOUT_MINUTES`) — pero solo si de verdad hay hueco para eso aparte de la comida que ya abre el tramo. Es solo un punto de partida: se corrige tocando la comida, igual que cualquier otra.
  - Es solo informativo: no bloquea ni exige registrar a esa hora.
- Comidas guardadas y recetas (ingredientes + porciones).
- Sin registro rápido de solo kcal/macros: se evaluó y se descartó por confuso (mezclaba "anotar algo puntual" con "crear un alimento nuevo"). Todo registro pasa por un alimento de la biblioteca (buscado, o creado antes en la pestaña Alimentos o al escanear).
- Totales vs objetivo con barras; sin colores de alarma al superar (proteína, grasa, carbohidratos). Las calorías sí llevan un medidor de margen con semáforo neutro (ver más abajo), pensado como "cuánto te queda hoy", no como reproche.
- Calorías de ejercicio: estimadas con MET (kcal = MET × peso_kg × horas) y mostradas como información; **nunca se suman al objetivo del día** (el ajuste adaptativo del TDEE ya refleja la actividad real semana a semana; sumarlas aparte sería contarlas dos veces). Se usa MET 3,5 (entrenamiento de fuerza, esfuerzo ligero a moderado del Compendio de Actividades Físicas) y el peso del perfil (`exerciseCalories.ts`). **Corrección manual**: como el dueño mide sus kcal reales con un smartwatch, el resumen al terminar la sesión (`LiveSessionPage`) trae un campo editable precargado con la estimación, y cada sesión del Historial (`SessionHistoryPage`) tiene un botón ✏️ para corregirla después; `Session.manualExerciseKcal` (si no es null, reemplaza a la estimación — `resolveSessionKcal`/`resolveDayExerciseKcal`). Dejar el campo igual a la estimación o vacío vuelve a lo automático, para que siga recalculándose solo si cambia el peso del perfil.
- Medidor de margen de calorías (`calorieMargin.ts`): calcula `objetivo - consumido` con una zona neutra — verde ("onTrack"), ámbar ("close") o rojo ("over"), ver el techo del rojo más abajo. No usa las kcal de ejercicio (evita el doble conteo ya explicado) ni depende de la fase activa (mismo cálculo en déficit, superávit o mantenimiento): es solo "cuánto margen queda", sin mensaje de alarma ni reproche. En el total del día (`DayTotals.tsx`) se probaron varias visualizaciones (barra gruesa, anillo, termómetro vertical solo o combinado con los macros al costado, barra segmentada, texto minimal, velocímetro con 3 bandas de color planas) antes de quedarse con un velocímetro semicircular con **escala numerada** (marcas cada 200/400/500/1000 kcal según el tamaño de la escala, como un velocímetro real) y **degradado continuo** de color (un solo arco con gradiente, no 3 tramos planos pegados a mano). El número grande del centro es el **margen del día** (objetivo − consumido, con signo: "+360" o "-300"), no lo consumido; debajo, dos tarjetas pequeñas "🎯 Objetivo" (con el TDEE como referencia) y "🍽️ Consumido" (con el objetivo como referencia).

  El rojo no empieza en un porcentaje arbitrario del objetivo, sino en el **TDEE** (el mayor entre objetivo y TDEE, para que funcione en cualquier tipo de fase):
  - En déficit o mantenimiento (objetivo ≤ TDEE): verde hasta el objetivo, ámbar entre el objetivo y el TDEE (ya te pasaste del plan, pero sigues sin estar en superávit real), rojo recién por encima del TDEE.
  - En volumen (objetivo > TDEE): el TDEE queda dentro del verde (el superávit ya es intencional) y el rojo empieza directamente en el objetivo.

  El último ~13 % del arco es siempre la franja roja, sea cual sea el objetivo o el TDEE (es una proporción fija de la escala, no de las kcal). Es la única visualización de la tarjeta cuyo color cambia según el resultado (verde/ámbar/rojo, `calorieMargin.ts`); los 3 macros, debajo en sus barras horizontales de siempre, mantienen su mismo color fijo (proteína rojo, grasa ámbar, carbohidratos cian) se pase o no del objetivo — coherente con "sin colores de alarma al superar" para los macros, y con el semáforo neutro solo para las kcal. Los colores del velocímetro (arco, aguja, marcas) usan las variables CSS del tema (`var(--emerald-400)`, etc.), no valores fijos, para funcionar igual en modo oscuro y claro. El arco se dibuja como un solo `<path>` con 2 tramos de 90° (no un semicírculo de 180° en un solo tramo, un caso límite ambiguo en SVG), coloreado con un `<linearGradient>` cuyos topes de color se calculan según dónde caen el objetivo y el TDEE en la escala.

### 3.6 Base de alimentos
- Tablas Peruanas de Composición de Alimentos (INS/CENAN, 11.ª ed. digital 2023), cargadas una vez. Se generan desde el PDF oficial con `scripts/tpca-to-json.py` (grupos A-U, 1123 alimentos, valores por 100 g) y se importan con el importador JSON. El grupo S (567 platos preparados, archivo `tpca-2023-platos.json`) se importa aparte: un registro por plato, promedio de los estratos socioeconómicos A-E, con el sufijo " (restaurante)" en el nombre; la tabla no trae ingredientes ni el peso del plato, así que sirven como referencia al comer fuera y no como recetas. Llevan la marca `"prepared": true` (campo `isPreparedDish` del alimento): se pueden registrar en el diario, pero el buscador de ingredientes de las recetas no los ofrece, porque ya son un plato terminado. Fuente a citar: Instituto Nacional de Salud / CENAN, Ministerio de Salud del Perú (reproducción permitida citando la fuente).
- Open Food Facts para productos envasados por código de barras (API pública, JSON); cachear en la colección propia.
- Alimentos y recetas propios.
- Productos envasados por marca: cada alimento puede llevar `brand` (marca), `barcode` (código GTIN validado con su dígito de control) y `source` (`manual`, `label`, `openFoodFacts` o `import`) para saber qué tan fiable es el dato. La fuente prioritaria es la **etiqueta copiada por el usuario** (formulario de alimento, con valores "por 100 g" o "por porción" y conversión automática); Open Food Facts es un apoyo con confirmación del usuario, y ante un conflicto gana la etiqueta. El buscador también encuentra por marca y por código.
- Importación masiva desde JSON en Alimentos (`{ "foods": [ ... ] }`, ejemplo en `docs/seed-data/alimentos-ejemplo.json`): valida cada alimento, omite los repetidos por nombre y avisa si las kcal no cuadran con los macros. Es la vía prevista para cargar las Tablas Peruanas.

### 3.7 Pesajes
Registro diario de peso (Nutrición → Peso); gráfica de peso real vs tendencia (30 días, 90 días o 6 meses) y ritmo en kg/semana. Se rechazan pesos fuera de 20-400 kg y se avisa (sin bloquear) si un pesaje se aleja más de 3 kg de la tendencia.

## 4. Modelo de datos (Firestore)
Todo bajo `users/{uid}/`:

| Colección | Contenido |
|---|---|
| `profile` (doc único `main`) | Datos del perfil y preferencias; `adaptiveTdee` (gasto ajustado, o null) |
| `exercises/{id}` | Nombre, músculos primarios/secundarios (slugs, ver 2.1), equipo, notas |
| `routines/{id}` | Nombre, día, ejercicios ordenados con series objetivo (embebido) |
| `sessions/{id}` | routineId, startedAt, endedAt, estado, ejercicios con series realizadas (embebido), `manualExerciseKcal` (corrección manual de kcal quemadas, o null si se usa la estimación) |
| `weighIns/{YYYY-MM-DD}` | Peso del día (`date`, `weightKg`); la app carga los últimos 180 |
| `phases/{id}` | Tipo, fecha de inicio/fin, ritmo, kcal y macros objetivo |
| `savedMeals/{id}` | Comidas guardadas: nombre y lista de ítems con sus valores ya calculados (mismo formato que los ítems del diario) |
| `diary/{YYYY-MM-DD}` | Comidas con ítems (alimento, porción, kcal y macros calculados), totales, kcal de ejercicio, hora elegida de cada comida (`mealTimes`) |
| `foods/{id}` | Alimentos propios, importados, cacheados y recetas. Campos: nombre, `brand`, `barcode`, `source`, `per100g`, `unit`, `isFavorite`, `useCount`, `lastUsedAt` y `recipe` (solo recetas: ingredientes con valores ya calculados, `cookedGrams` = peso final cocido, `servings`) |

Reglas:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Cuota gratuita (Spark): 1 GiB almacenado, 50 000 lecturas, 20 000 escrituras y 20 000 borrados por día.

### 4.1 Respaldo (y llevar datos a otra cuenta)
Los datos son por cuenta: cada `uid` solo ve lo suyo (regla de arriba), así que dos cuentas de Firebase Auth distintas (p. ej. la real y una para hacer pruebas) empiezan cada una en cero, sin nada compartido entre ellas.

Ajustes → "Respaldo de tus datos" (`BackupSection.tsx`, dominio en `src/domain/backup.ts`) exporta/importa un archivo JSON con las 9 colecciones de arriba. Sirve tanto para tener una copia (el plan Spark no incluye backups) como para pasar datos de una cuenta a otra: exportar desde una cuenta e importar el archivo estando conectado con la otra.

- **Exportar**: casillas para elegir qué colecciones incluir (por defecto, todas). Por ejemplo, para armar una cuenta de pruebas solo con Ejercicios y Alimentos, sin llevarse rutinas ni datos personales del diario/pesajes, se destildan las demás antes de exportar (`filterBackupCollections`). Con "Alimentos y recetas" incluida, un casillero aparte ("Solo alimentos favoritos ⭐") deja fuera todo lo que no esté marcado como favorito (`filterFavoriteFoods`) — para llevar una biblioteca más chica y curada en vez de las Tablas Peruanas completas.
- **Importar**: vista previa con cuántos registros trae cada colección y avisos si algo no calza, antes de confirmar. Importar combina: los registros con el mismo id se reemplazan y no se borra nada de lo que ya había en la cuenta destino.
- Las fechas exactas (`Timestamp`) viajan como `{ "__timestamp": "2026-03-10T15:00:00.000Z" }` dentro del JSON.

## 5. Experiencia de usuario
- Móvil primero, uso con una mano, botones grandes, acciones principales abajo.
- Navegación inferior: Entrenar · Nutrición · Progreso · Ajustes, cada una con su ícono de línea propio (`src/app/icons.tsx`: pesa, tenedor, barras, controles deslizantes) encima del texto. Los íconos son `currentColor`, así que toman el mismo color que ya distinguía la pestaña activa (azul) de las demás (gris) — no un color fijo aparte.
- Tema: **Automático** (sigue el modo claro u oscuro del teléfono), **Claro** u **Oscuro**, elegible en Ajustes y guardado por dispositivo. Paleta en `src/index.css` (variables por tema): oscuro grafito y claro, con contrastes mínimos de 4,5:1 en texto. Un color de **acción** (azul) distinto del de **éxito/completado** (verde); tipos de serie con abreviatura y color propios (N gris, C ámbar, F rojo, DS violeta).
- Datos nutricionales (`src/app/macroStyles.ts`): en cualquier lugar donde se muestren kcal y macros juntos (totales del día, cada comida y cada alimento del diario, vista previa al agregar/escanear/crear un alimento o receta, objetivo de la fase), proteína en rojo, grasa en ámbar/amarillo y carbohidratos en celeste (`--cyan-400`/`500`, nuevo en la paleta); las calorías no llevan color propio, van en negrita.
- Mínimos toques durante la sesión; valores prellenados.
- Botones (`src/app/buttonStyles.ts`): un solo conjunto de estilos: principal, secundario, píldora de selección, icono, enlace y botón flotante. El área para tocar mide al menos 44 px (40 px en las píldoras); el azul es el único color de acción y el rojo solo para borrar. Los botones que son solo un icono llevan siempre `aria-label`. Las pestañas de cada sección usan el mismo componente (`TabBar`). El foco de teclado se ve con un anillo azul (`:focus-visible`).
- Capas (`z-index`): el contenido de una página no lleva capa propia; una fila deslizable (`SwipeToDeleteRow`) usa z-10 para taparse su propio botón de eliminar mientras está cerrada, igual que el recuadro fijo del descanso en la sesión en vivo; lo que debe quedar siempre por encima del contenido aunque haya scroll (la barra de navegación inferior, el botón flotante "+") usa z-20; el fondo de una ventana modal usa z-50, por encima de todo.
- Listas editables (Ejercicios, Rutinas, Alimentos, Comidas guardadas, Pesajes, sesiones del Historial, comidas y alimentos del Diario): sin botón de editar visible. Tocar la fila (o, en Rutinas, la información: nombre, día y grupos musculares; en el Historial, el resumen que expande el detalle) hace su acción normal (editar, usar, cargar en el formulario, expandir…); un botón aparte que no forma parte de esa fila (▶ de iniciar sesión de una rutina, ⭐ de favorito de un alimento) no la activa. Deslizar la fila hacia la izquierda revela un botón rojo con un ícono de línea (no emoji) para eliminar, con confirmación cuando corresponde (`SwipeToDeleteRow`, geometría en `src/domain/swipeAction.ts`); mientras una fila queda abierta, tocar cualquier parte de ella (incluidos esos botones aparte) la cierra en vez de activarla. El botón de eliminar y esos botones aparte son alcanzables con teclado/lector de pantalla en todo momento, sin necesidad del gesto. El ícono de iniciar sesión (▶) también es de línea/relleno simple, no emoji. Admite filas dentro de filas (una comida del diario y, dentro, cada alimento): cada nivel deslizable detiene el gesto y el clic para que no le lleguen al de más afuera, así se puede deslizar el alimento sin mover también la comida. El ingrediente de una receta en construcción (formulario, antes de guardar) es la única excepción: mantiene el botón ✕ de siempre, sin deslizar.
- Accesibilidad de formularios y diálogos: cada campo tiene un nombre accesible (su `<label htmlFor>` o un `aria-label`); los diálogos (`Modal`) bloquean el desplazamiento de la página de fondo mientras están abiertos (`scrollLock.ts`, con `position: fixed` porque `overflow: hidden` no basta en Safari de iPhone), son `role="dialog"` con título, llevan el foco adentro al abrir, lo mantienen dentro con Tab, se cierran con Escape (solo el de encima si hay uno dentro de otro) y devuelven el foco al botón que los abrió; la página tiene `<main>` y la barra inferior está etiquetada. Los contrastes de texto se verificaron a 4,5:1 al definir la paleta.
- Mensajes neutrales, sin reproches.
- Respaldo: exportar/importar JSON desde Ajustes (`src/domain/backup.ts`). El archivo lleva `app`, `version` y `exportedAt`, y una sección por colección de `users/{uid}` (perfil, ejercicios, rutinas, sesiones, pesajes, fases, comidas guardadas, diario, alimentos); las fechas exactas (Timestamp) van como `{ "__timestamp": "ISO" }`. Exportar usa la hoja de compartir del teléfono (o descarga). Importar valida todo el archivo antes de escribir (un registro mal formado lo rechaza completo), muestra una vista previa con el conteo por sección y **combina**: reemplaza los registros con el mismo id y no borra nada. La app recuerda en el dispositivo la fecha del último respaldo.

## 6. Fases de desarrollo
1. Esqueleto: Vite + PWA + Tailwind + Firebase (Auth, Firestore con caché persistente) + capas + navegación + login.
2. Entrenamiento: biblioteca, rutinas, sesión en vivo con cronómetros.
3. Progreso: historial, récords, gráficas, volumen semanal.
4. Nutrición: perfil, fases, cálculo inicial, diario, alimentos propios.
5. Base de alimentos: importación de Tablas Peruanas, Open Food Facts con escáner.
6. Pesajes y ajuste adaptativo.
7. Pulido: exportar/importar JSON, Wake Lock, sonidos, accesibilidad.

## 7. Limitaciones conocidas
- iOS PWA: sin notificaciones locales programadas ni vibración; se suspende en segundo plano.
- Iniciar sesión con Google puede fallar en PWA instalada en iOS; se usa correo/contraseña.
- Sin backups gestionados en plan gratuito → exportación JSON manual.

## 8. Pendientes por evaluar
- Foto de referencia en el perfil (progreso visual). Requiere definir dónde se almacena: el stack actual (sección "Stack") no incluye Firebase Storage; a evaluar si se agrega o se busca otra alternativa dentro del plan Spark antes de implementarlo.

### Backlog: "Deploy for many users" (pasar de un solo dueño a multi-cuenta)
No implementar hasta que el dueño lo confirme explícitamente — cambia la premisa "un solo usuario" de este documento y toca reglas de seguridad. Decisiones ya conversadas y confirmadas para cuando se retome:

- **Registro abierto**: agregar `signUp(email, password)` a `AuthRepository` y un modo "Crear cuenta" en `LoginPage.tsx` (Firebase Auth ya lo soporta; falta la UI).
- **Biblioteca genérica con copia al registrarse** (no catálogo "en vivo" compartido — se evaluó y se prefirió esta opción por más simple y más barata en cuota): dos colecciones nuevas fuera de `users/{uid}` — `catalogFoods/{id}` y `catalogExercises/{id}` (mismos campos que `Food`/`Exercise`, sin los campos por-cuenta: `isFavorite`, `useCount`, `useCountByMeal`, `lastUsedAt`). Al crear una cuenta, justo después del registro, se copian en lote (mismo patrón de lotes de 400 que `addFoods`) a `users/{uid}/foods` y `users/{uid}/exercises` de esa cuenta — una sola vez. De ahí en adelante cada cuenta es independiente: lo que agregue, edite o borre no toca el catálogo ni a otras cuentas, y cambios posteriores al catálogo no se propagan solos (se podría agregar más adelante un "sincronizar" manual, pero no es parte de este alcance).
- **Reglas de Firestore nuevas** para esas dos colecciones: lectura para cualquier cuenta autenticada, escritura solo para el uid del dueño (fijo en la regla: `request.auth.uid == 'uid-del-dueño'`). Sin roles de verdad (Custom Claims) salvo que en el futuro haya más de un admin — ahí sí conviene migrar a Custom Claims (requiere un script local con el Admin SDK, no Cloud Functions).
- **Migración inicial**: copiar la biblioteca actual del dueño (Tablas Peruanas + ejercicios reales) a `catalogFoods`/`catalogExercises` una vez, con el mismo mecanismo de lotes.
- **Cuota Spark**: es por proyecto, no por cuenta (50 000 lecturas/20 000 escrituras/borrados por día); con el modelo de copia puntual el costo por cuenta nueva es acotado y predecible (no hay lecturas repetidas de un catálogo compartido en cada apertura de la app).
- Fuera de alcance por ahora: catálogo compartido "en vivo" (se conversó y se descartó por el costo de tocar todos los buscadores de alimentos/ejercicios y por el gasto de cuota); moderación de contenido (solo el dueño escribe el catálogo).
