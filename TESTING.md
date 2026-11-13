# Pruebas automáticas

GitHub Actions ejecuta las pruebas en cada cambio a `main`, en cada pull request hacia `main` y cuando se inicia manualmente el workflow.

## Comprobaciones del frontend

El workflow de frontend ejecuta, en paralelo:

- Pruebas y compilación de Vite.
- Pruebas y compilación de Angular.
- Una prueba de humo del sistema con Docker Compose, MySQL aislado y un backend obtenido de `Hikotopp/Backend_Gestourant`.

La prueba de humo verifica que el frontend sirva su endpoint de salud y que el endpoint público de configuración del backend responda JSON válido. No crea cuentas ni envía pedidos.

## Comprobaciones del backend

El workflow del backend ejecuta `mvn -B -ntp verify` con Java 17 y también construye el sistema con Docker Compose, usando la versión actual del frontend.

## Ejecutar localmente

Desde la raíz del repositorio frontend:

```powershell
npm ci
npm ci --prefix .\angular-client
npm test
npm run build
npm --prefix .\angular-client test
npm --prefix .\angular-client run build
```

Desde la raíz del repositorio backend:

```powershell
mvn -B -ntp verify
```

La prueba integrada usa Docker Compose y una base MySQL aislada. El workflow limpia sus contenedores y volúmenes al terminar. No conectes esa prueba a una base de datos de producción.
