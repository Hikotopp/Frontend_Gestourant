# Desplegar con Docker en Oracle Cloud

Esta guía prepara Gestourant para una VM de Oracle Cloud Infrastructure (OCI). Docker Compose ejecuta el frontend, backend y MySQL en la misma VM; Caddy gestiona HTTPS automáticamente. No crea una VM, un dominio, una cuenta de Oracle ni recursos cloud.

OCI Always Free depende de la disponibilidad regional y de las condiciones vigentes de Oracle; no garantiza capacidad permanente ni sustituye copias de seguridad externas.

## Probar localmente primero (Windows con Docker Desktop)

Para iniciar Gestourant en el equipo local sin dominio, HTTPS ni cuenta de Oracle, usa el archivo separado `compose.local.yaml`. Abre PowerShell en `Frontend_Gestourant` y ejecuta:

```powershell
docker compose -f compose.local.yaml config -q
docker compose -f compose.local.yaml up -d --build
docker compose -f compose.local.yaml ps
```

Cuando frontend y backend estén saludables, abre `http://localhost:8080`. En la primera ejecución, registra una cuenta; al no haber usuarios, será administrador. Este entorno crea una **base nueva de pruebas** llamada `gestourant_local`, persistida en el volumen `gestourant-local_mysql_data`; no usa ni modifica una base de datos local existente. Las credenciales de la base y el secreto JWT de esta configuración son solo para el equipo local: nunca publiques este Compose ni expongas su puerto a una red.

Puedes verla desde MySQL Workbench creando una conexión con host `127.0.0.1`, puerto `3307`, usuario `gestourant_local` y contraseña `gestourant-local-only`; el esquema es `gestourant_local`. El puerto está enlazado únicamente a loopback (tu PC), no a la red local. Tras conectar, abre el esquema `gestourant_local` y consulta sus tablas.

Para apagarlo sin eliminar sus datos:

```powershell
docker compose -f compose.local.yaml down
```

Los contenedores reinician con `docker compose -f compose.local.yaml up -d`. Para ver su estado y registros usa `docker compose -f compose.local.yaml ps` y `docker compose -f compose.local.yaml logs --tail=100 backend`. **No uses `docker compose -f compose.local.yaml down -v`** si quieres conservar la base de pruebas.

La configuración local no activa OAuth, Turnstile ni respaldos S3 hasta que proporciones sus variables y callbacks locales válidos. El modo offline tampoco permite crear/restaurar respaldos: esos flujos requieren el backend. Para Oracle usa las instrucciones siguientes y no reutilices los secretos locales.

## Arquitectura

```text
Internet --HTTPS--> Caddy --HTTP interno--> Nginx/Vite --API/OAuth--> Spring Boot --privado--> MySQL
```

Solo Caddy publica los puertos 80 y 443. MySQL y el backend no publican puertos en el host. El frontend no comparte red con MySQL; solo el backend se conecta a la red privada de datos. Los datos de MySQL y los certificados de Caddy viven en volúmenes Docker persistentes.

## Requisitos

- Una VM Linux OCI con Docker Engine y Docker Compose v2 instalados. Para construir las dos imágenes con comodidad, asigna memoria suficiente; las imágenes se construyen en la propia VM y no se suben a un registro.
- Un dominio propio con un registro DNS `A` que apunte a la IP pública IPv4 de la VM.
- Los repositorios frontend y backend disponibles para clonar en la VM. Deben quedar como carpetas hermanas:

```text
gestourant/
  Frontend_Gestourant/
  Backend_Gestourant/
```

Configura la lista de seguridad de OCI y el firewall del sistema operativo para permitir TCP 80 y 443 desde Internet. Restringe SSH (TCP 22) a tu IP; no abras MySQL (3306) ni el backend (8081).

## Preparar la VM

Clona ambos repositorios usando sus URL reales:

```bash
mkdir -p ~/gestourant
cd ~/gestourant
git clone <URL-del-repositorio-frontend> Frontend_Gestourant
git clone <URL-del-repositorio-backend> Backend_Gestourant
cd Frontend_Gestourant
cp .env.example .env
```

Edita `.env` en la VM. No pegues sus secretos en chats, tickets, capturas ni en Git. El archivo está excluido por `.gitignore` y `.dockerignore`.

### Variables obligatorias

| Variable | Valor |
| --- | --- |
| `DOMAIN` | Dominio público sin `https://`, por ejemplo `app.ejemplo.com`. |
| `MYSQL_DATABASE` | Nombre de la base nueva; por defecto `gestourant`. |
| `MYSQL_USER` | Usuario de aplicación de MySQL; por defecto `gestourant_app`. |
| `MYSQL_PASSWORD` | Contraseña aleatoria para el usuario de aplicación. |
| `MYSQL_ROOT_PASSWORD` | Contraseña aleatoria distinta para el administrador de MySQL. |
| `JWT_SECRET` | Secreto aleatorio largo para firmar tokens; usa un valor distinto por entorno. |
| `ADMIN_REGISTRATION_CODE` | Código privado para registrar administradores; no uses el valor de desarrollo ni lo compartas. |

En Windows PowerShell, genera cada secreto con un comando nuevo y copia su salida directamente al archivo privado `.env` de la VM:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Usa valores distintos para las cuatro contraseñas/códigos y `JWT_SECRET`. No almacenes los resultados en este repositorio. Los valores Base64 de este comando no contienen `$`, lo que evita interpolaciones accidentales de Compose.

### Integraciones opcionales

- **Google/Microsoft OAuth:** rellena el ID y secreto del proveedor. Registra como URL de callback `https://<DOMAIN>/login/oauth2/code/google` o `https://<DOMAIN>/login/oauth2/code/microsoft`, según el proveedor habilitado.
- **Cloudflare Turnstile:** configura juntas `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`, o deja ambas vacías.
- **Copias S3:** `BACKUP_S3_BUCKET` y las credenciales AWS están vacías por defecto. Sin un destino S3 configurado, las copias fuera de la VM no están disponibles; el volumen local de MySQL no es una copia de seguridad.

## Construir y arrancar

Antes de iniciar, comprueba que el DNS del dominio ya resuelve a la IP pública de la VM. Desde `Frontend_Gestourant` ejecuta:

```bash
docker compose config -q
docker compose up -d --build
docker compose ps
docker compose logs -f caddy backend
```

La imagen backend ejecuta `mvn package`, incluidas las pruebas, antes de crear la imagen de ejecución. Flyway aplica las migraciones al arrancar contra la base configurada. Caddy obtendrá el certificado TLS cuando el dominio sea accesible y los puertos estén abiertos.

Comprueba `https://<DOMAIN>` en el navegador y que el login, la API y los flujos requeridos funcionan. Para revisar estado y registros:

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=100 caddy
```

Para desplegar cambios posteriores:

```bash
git -C ../Backend_Gestourant pull
git pull
docker compose up -d --build
```

## Base de datos y persistencia

La primera ejecución crea una **base MySQL nueva y vacía** en el volumen `mysql_data`; no copia ni importa automáticamente una base local existente. Las migraciones Flyway crean el esquema, pero no trasladan los datos actuales. Si necesitas conservarlos, haz y verifica una copia de la base de origen y restaúrala en MySQL antes de exponer el servicio. Comprueba compatibilidad con las migraciones antes de restaurar una copia antigua.

Para trasladar una base MySQL existente, genera primero un volcado consistente desde el servidor de origen, transfiérelo de forma segura a la VM y verifica que corresponde a la versión esperada. Por ejemplo, desde un equipo con `mysqldump`:

```bash
mysqldump --host=<servidor-origen> --user=<usuario> --password \
  --single-transaction --routines --triggers --events \
  --result-file=gestourant.sql gestourant
```

`mysqldump` solicitará la contraseña sin incluirla en el comando. En la VM, con `.env` preparado, restaura el volcado **antes de iniciar el backend**:

```bash
docker compose up -d mysql
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --user=root "$MYSQL_DATABASE"' \
  < gestourant.sql
docker compose up -d --build
```

El destino debe estar vacío y la copia debe incluir `flyway_schema_history`; guarda una copia segura del origen y valida los datos/restauración antes de aceptar tráfico. No sobrescribas una base de producción sin un respaldo probado.

`docker compose down` conserva los volúmenes. **No ejecutes `docker compose down -v`** si quieres conservar la base y los certificados: `-v` elimina los volúmenes administrados por Compose. Mantén copias independientes de los datos y prueba periódicamente su restauración; el almacenamiento de una VM por sí solo no es una estrategia de backup.

## Actualizar y solucionar problemas

- Si Caddy no obtiene un certificado, confirma que `DOMAIN` resuelve a la VM y que TCP 80/443 llegan tanto a OCI como al firewall de Linux.
- Si el backend no queda saludable, revisa `docker compose logs backend mysql`. Comprueba las variables obligatorias y que MySQL esté saludable antes del backend.
- Si cambias `DOMAIN`, actualiza DNS, `.env` y los callback OAuth, y vuelve a crear los servicios con `docker compose up -d`.
- Para detener sin borrar datos: `docker compose down`.

La guía existente para Railway sigue disponible en [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md); este Compose no modifica ni despliega recursos de Railway.
