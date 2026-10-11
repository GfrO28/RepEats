# RepEats

App personal (PWA) para registrar entrenamientos de gimnasio y llevar un plan de
nutrición. Ver [docs/especificacion.md](docs/especificacion.md) para el alcance completo.

## Requisitos

- Node.js 20+
- Un proyecto de Firebase (plan Spark) con Auth de correo/contraseña y Cloud Firestore habilitados.
- Java (solo para `firebase emulators:start`).

## Primera vez

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/), habilita:
   - Authentication → Sign-in method → Correo electrónico/contraseña.
   - Firestore Database (modo producción, edición Standard).

3. Copia `.env.example` a `.env` y completa las credenciales web del proyecto
   (Configuración del proyecto → General → Tus apps → SDK setup):

   ```bash
   cp .env.example .env
   ```

4. Reemplaza el ID de proyecto en `.firebaserc`.

5. Crea tu usuario (correo/contraseña) desde Firebase Console → Authentication → Users,
   ya que la app no tiene registro público.

## Comandos

- `npm run dev` — desarrollo local (`npm run dev -- --host` para probar desde el teléfono en la misma red).
- `npm run build` — build de producción en `dist/`.
- `npm test` — pruebas con Vitest.
- `npm run lint` — lint con Oxlint.
- `firebase emulators:start` — Auth y Firestore locales (requiere Java).
- `firebase hosting:channel:deploy prueba` — vista previa con HTTPS para instalar en teléfonos.
- `firebase deploy` — producción (pide confirmación antes de ejecutarlo).

## Arquitectura

Capas: `ui` (`src/features`, `src/app`) → `domain` (lógica pura) → `repositories`
(interfaces) → `data/firestore` (única carpeta que importa `firebase/*`).
