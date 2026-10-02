# Publicar Gestourant en Railway

Railway despliega los proyectos mediante buildpacks; no necesitas crear ni administrar Dockerfiles. El frontend y el backend deben estar en repositorios GitHub conectados a Railway, y MySQL se crea como servicio de base de datos. Railway proporciona dominios HTTPS para los dos servicios.

## 1. Preparar los repositorios

Sube a GitHub los cambios de `Frontend_Gestourant` y `Backend_Gestourant` en sus repositorios correspondientes. Cada carpeta incluye su propio `railway.toml`. Si ambos proyectos están en un único repositorio, al crear cada servicio configura su directorio raíz (`Frontend_Gestourant` o `Backend_Gestourant`).

## 2. Crear servicios y dominios

1. Crea un proyecto en Railway.
2. Añade un servicio **MySQL**.
3. Añade el repositorio del backend y configura el directorio raíz si es necesario. Genera un dominio público para este servicio desde **Settings → Networking → Generate Domain**.
4. Añade el repositorio del frontend y genera también su dominio público.
5. Anota ambos dominios `*.up.railway.app`; Railway entrega HTTPS automáticamente. No compartas JWT, contraseñas ni secretos OAuth.

## 3. Variables del backend

En **Variables** del servicio backend, configura:

| Variable | Valor |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `JWT_SECRET` | Secreto aleatorio fuerte; genera al menos 48 bytes y guárdalo solo en Railway |
| `FRONTEND_URL` | Origen exacto HTTPS del frontend, sin `/` final |
| `DB_URL` | `jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?serverTimezone=America/Bogota&characterEncoding=UTF-8` |
| `DB_USERNAME` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |

Si el servicio de base de datos tiene otro nombre, sustituye `MySQL` en las referencias por el nombre exacto del servicio en Railway. Los usuarios y contraseñas deben ser referencias de variables, no texto copiado en archivos.

En Windows PowerShell puedes generar un secreto para pegar directamente en el campo privado de Railway con:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

No lo guardes en el repositorio ni lo envíes por chat. Si usas Google/Microsoft OAuth, añade también `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET`. En cada consola OAuth registra las redirecciones con el dominio HTTPS del backend:

```text
https://<dominio-backend>/login/oauth2/code/google
https://<dominio-backend>/login/oauth2/code/microsoft
```

## 4. Variable del frontend

En **Variables** del servicio frontend, establece:

```text
VITE_API_URL=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

Reemplaza `Backend` por el nombre exacto del servicio de backend en Railway. `VITE_API_URL` se incorpora al compilar, así que vuelve a desplegar el frontend si cambia el dominio o la variable.

## 5. Desplegar y comprobar

Railway usará los comandos definidos en cada `railway.toml`. El backend expone el puerto asignado por Railway y su healthcheck consulta `/api/auth/config`. El frontend compila Vite y publica `dist` con `npm start`.

Comprueba:

1. Abre el dominio HTTPS del frontend y confirma que carga sin advertencias de certificado.
2. Abre `https://<dominio-frontend>/manifest.webmanifest` y `https://<dominio-frontend>/sw.js`; ambos deben responder correctamente.
3. Inicia sesión y confirma que las solicitudes API llegan al backend sin errores CORS.
4. En Chrome/Edge DevTools → **Application**, verifica el manifiesto y el service worker activo.
5. Con la app cargada, activa **Network → Offline** y recarga: debe abrir el shell público y mostrar el aviso sin conexión. El inicio de sesión y los cambios de datos no funcionan offline por diseño.
6. Inicia sesión, no interactúes durante 2 minutos: debe bloquearse. El contador debe iniciar en `03:00` y cerrar la sesión al agotarse.

En este despliegue la base de datos se alcanza por la red privada de Railway. No habilites acceso público a MySQL salvo que tengas una necesidad específica y controles de red adecuados.
