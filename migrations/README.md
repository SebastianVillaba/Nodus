# Migraciones de base de datos

Cambios de **estructura** de la base (tablas, columnas, vistas, funciones, stored procedures) en el orden en que se aplican.
Acá no van datos personales ni credenciales: los datos base de una instalación nueva están en `database/` (local, no versionado).

## Convenciones

- Un archivo por cambio: `NNN_descripcion.sql` (`001_timbrados.sql`, `002_credito_clientes.sql`, ...). Nunca se edita una migración ya aplicada en otra base; si hay que corregir algo, va en una nueva.
- Se aplican **en orden**. Cada script es **re-ejecutable**: verifica si la columna/tabla existe antes de crearla y recrea los SPs/vistas con `IF OBJECT_ID(...) IS NOT NULL DROP ...`.
- Como cada migración recrea sus SPs, no re-ejecutar una migración vieja después de una nueva que modifica el mismo SP (volvería a la versión anterior). Si hace falta, re-aplicar todas desde ese número en adelante.
- Tablas nuevas con cabecera y detalle: prefijo `cab` y `det` (`cabCobroCredito` / `detCobroCredito`). Tablas planas sin prefijo (`cuotaVenta`, `tipo`, ...).
- Los permisos nuevos que usa el código (`server/src/Middlewares/permisos.middleware.ts`) se crean en la migración que los introduce.

## Aplicar

```
sqlcmd -S localhost -E -I -f 65001 -d Nodus -b -i migrations/NNN_descripcion.sql
```

`-I` (QUOTED_IDENTIFIER ON) y `-f 65001` (UTF-8) son necesarios.

## Volver atrás

Antes de la Fase 1 se hizo un backup completo:
`D:\Microsoft SQL Server\MSSQL\Data\MSSQL10_50.MSSQLSERVER\MSSQL\Backup\Nodus_antes_fase1_2026-10-05.bak`

```sql
RESTORE DATABASE Nodus FROM DISK = N'...\Nodus_antes_fase1_2026-10-05.bak' WITH REPLACE
```
