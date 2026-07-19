# Gestor de Cuentas

Web app para gestionar las cuentas de streaming que revendés (plataformas, perfiles,
clientes y vencimientos). React + Vite en el frontend, Firebase (Firestore + Auth +
Hosting) como backend.

## Requisitos

- Node.js instalado (`node -v` para chequear).
- Tener el archivo `.env.local` completado con las credenciales de Firebase (ver
  sección "Variables de entorno" más abajo). Sin este archivo, la app no puede
  conectarse a la base de datos.

## Comandos del día a día

Todos los comandos se corren **desde la carpeta `gestor-cuentas/`** (donde está este
`README.md`).

### Prender la app en tu compu para probar cambios (modo desarrollo)

```bash
npm run dev
```

Deja un servidor corriendo en **http://localhost:5173** — abrilo en el navegador.
Los cambios que hagas en el código se reflejan solos, sin reiniciar nada. Para
apagarlo, `Ctrl + C` en la terminal donde lo corriste.

> Esto es solo para probar mientras programás. No es necesario para que la app
> publicada (la URL de Firebase Hosting) funcione — esa vive en la nube,
> independiente de esto.

### Publicar los cambios en la web real (producción)

Cada vez que quieras que la URL pública (`https://gestor-de-cuentas-c4a53.web.app`)
refleje los últimos cambios:

```bash
npm run build
npx firebase-tools deploy --only hosting
```

- `npm run build` empaqueta la app en la carpeta `dist/`.
- `npx firebase-tools deploy --only hosting` sube esa carpeta a Firebase.
  (Usamos `npx` porque en esta compu el comando `firebase` no está instalado
  global; `npx` descarga/usa la herramienta sin instalarla a mano.)

### Publicar cambios en las reglas de seguridad de Firestore

Solo si modificaste el archivo `firestore.rules`:

```bash
npx firebase-tools deploy --only firestore:rules
```

### Subir cambios a GitHub

```bash
git add -A
git commit -m "Descripción corta del cambio"
git push
```

(Ya está todo configurado para que esto funcione solo, usando la cuenta
`BenjaAquino128`, sin afectar otras cuentas de git que uses en esta compu.)

## Variables de entorno (`.env.local`)

Este archivo **no se sube a GitHub** (está en `.gitignore`) porque tiene las
credenciales de conexión a tu proyecto de Firebase. Si lo perdés o cambiás de
compu, se recupera así:

1. [console.firebase.google.com](https://console.firebase.google.com) → tu proyecto
2. Ícono de engranaje ⚙️ → "Configuración del proyecto" → pestaña "General"
3. Sección "Tus apps" → tu app web → ahí está el bloque `firebaseConfig` de nuevo

Estructura del archivo (ver `.env.example` como plantilla):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Login de la app

El login usa Firebase Authentication (correo/contraseña). El usuario se crea y se
edita manualmente desde la consola de Firebase:

- **Ver/agregar usuarios:** Firebase Console → tu proyecto → Authentication → pestaña
  "Users"
- **Cambiar la contraseña si te la olvidás:** en esa misma pestaña, en la fila del
  usuario, menú de tres puntos → "Reset password"

## Estructura del proyecto

```
src/
├── App.jsx                  # rutas + barra superior + login guard
├── firebase.js              # conexión a Firestore/Auth
├── styles.css                # estilos globales
├── lib/
│   ├── fechas.js             # cálculo de vencimientos
│   ├── parser.js             # detección de correo/contraseña/pin/plataforma
│   └── firestore.js           # todo el acceso a la base de datos (CRUD)
├── login/Login.jsx
├── cuentas/
│   ├── ListaCuentas.jsx      # pantalla principal
│   ├── AgregarCuenta.jsx     # alta de cuenta nueva
│   └── DetalleCuenta.jsx      # ver/editar perfiles de una cuenta
└── vencimientos/Vencimientos.jsx
```

## Primera vez en una compu nueva

Si clonás el proyecto en otra máquina, además de `npm install` necesitás:

1. Crear tu `.env.local` (ver sección de arriba).
2. Loguearte en Firebase (solo la primera vez en esa compu):

   ```bash
   npx firebase-tools login
   npx firebase-tools use --add
   ```

   Elegís el proyecto `gestor-de-cuentas-c4a53` y le ponés un alias, ej: `default`.

## Problemas comunes

- **`firebase: no se encontró la orden`:** usá `npx firebase-tools ...` en vez de
  `firebase ...` (está documentado arriba). No hace falta instalar nada global.
- **La app se queda "Cargando..." para siempre:** revisá la consola del navegador
  (F12 → "Console"). Si dice `permission-denied` o similar, las reglas de Firestore
  no están publicadas — revisá `firestore.rules` y publicalas desde la consola de
  Firebase (Firestore Database → pestaña "Reglas") o con
  `npx firebase-tools deploy --only firestore:rules`.
- **`localhost:5173` no responde:** el servidor de desarrollo no está corriendo —
  volvé a ejecutar `npm run dev`.
- **Cambié algo y no se ve en la URL pública:** te faltó el paso de
  `npm run build` + `npx firebase-tools deploy --only hosting` — los cambios
  locales no se suben solos, hay que publicarlos a mano cada vez.
