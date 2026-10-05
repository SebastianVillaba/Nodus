/*
  001 - Gestión de timbrados
    - factura.nroHasta: último número autorizado del rango (factura.nroFactura es el primero).
    - funValidarTimbrado: vigencia y rango; la usa sp_guardarVenta antes de tomar el número.
    - sp_estadoTimbrado: estado y alertas del timbrado de una terminal (para Facturación).
    - sp_listarTimbrados / sp_guardarTimbrado: ABM de timbrados.
    - Permiso ACCESO_TIMBRADOS (rol ADMINISTRADOR).
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.factura', 'nroHasta') IS NULL
    ALTER TABLE dbo.factura ADD nroHasta NUMERIC(7,0) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.permiso WHERE nombreSistema = 'ACCESO_TIMBRADOS')
    INSERT INTO dbo.permiso (modulo, descripcion, nombreSistema)
    VALUES ('VENTAS', 'Gestionar Timbrados', 'ACCESO_TIMBRADOS');

INSERT INTO dbo.rolPermiso (idRol, idPermiso)
SELECT 1, p.idPermiso FROM dbo.permiso p
WHERE p.nombreSistema = 'ACCESO_TIMBRADOS'
  AND NOT EXISTS (SELECT 1 FROM dbo.rolPermiso rp WHERE rp.idRol = 1 AND rp.idPermiso = p.idPermiso);
GO

IF OBJECT_ID('dbo.funValidarTimbrado') IS NOT NULL DROP FUNCTION dbo.funValidarTimbrado
GO
/*
  Devuelve NULL si se puede emitir el número @numero con el timbrado @idFactura en la fecha @fecha;
  si no, el motivo.
*/
CREATE FUNCTION dbo.funValidarTimbrado (@idFactura INT, @numero NUMERIC(7,0), @fecha DATETIME)
RETURNS VARCHAR(255)
AS
BEGIN
    DECLARE @timbrado NCHAR(20), @inicio DATE, @caduca DATE, @desde NUMERIC(7,0), @hasta NUMERIC(7,0), @activo BIT;
    DECLARE @hoy DATE = CAST(@fecha AS DATE);

    SELECT @timbrado = timbrado, @inicio = fechaInicio, @caduca = fechaCaduca,
           @desde = nroFactura, @hasta = nroHasta, @activo = activo
    FROM dbo.factura WHERE idFactura = @idFactura;

    IF @timbrado IS NULL OR @activo = 0
        RETURN 'El timbrado asignado a la terminal no existe o está inactivo.';
    IF @inicio IS NOT NULL AND @hoy < @inicio
        RETURN 'El timbrado ' + RTRIM(@timbrado) + ' recién es válido desde el ' + CONVERT(VARCHAR(10), @inicio, 103) + '.';
    IF @hoy > @caduca
        RETURN 'El timbrado ' + RTRIM(@timbrado) + ' venció el ' + CONVERT(VARCHAR(10), @caduca, 103) + '. Cargue el nuevo timbrado.';
    IF @numero < @desde
        RETURN 'El número de factura ' + CAST(@numero AS VARCHAR(10)) + ' está antes del rango autorizado del timbrado.';
    IF @hasta IS NOT NULL AND @numero > @hasta
        RETURN 'Se agotó el rango autorizado del timbrado ' + RTRIM(@timbrado) + ' (último número: ' + CAST(@hasta AS VARCHAR(10)) + ').';

    RETURN NULL;
END
GO

IF OBJECT_ID('dbo.sp_estadoTimbrado') IS NOT NULL DROP PROCEDURE dbo.sp_estadoTimbrado
GO
/*
  Estado del timbrado asignado a una terminal, para mostrar alertas en Facturación.
  estado: VIGENTE | POR_VENCER | POR_AGOTARSE | NO_INICIADO | VENCIDO | AGOTADO | SIN_TIMBRADO
  bloquea = 1 cuando no se puede emitir factura.
*/
CREATE PROCEDURE dbo.sp_estadoTimbrado
    @idTerminalWeb INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @diasAviso INT = 30, @numerosAviso INT = 50;
    DECLARE @idFactura INT = (SELECT idFactura FROM dbo.TerminalWeb WHERE idTerminalWeb = @idTerminalWeb AND activo = 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.factura WHERE idFactura = @idFactura AND activo = 1)
    BEGIN
        SELECT CAST(NULL AS INT) AS idFactura, CAST(NULL AS NCHAR(20)) AS timbrado, 'SIN_TIMBRADO' AS estado, CAST(1 AS BIT) AS bloquea,
               'La terminal no tiene un timbrado activo asignado.' AS mensaje,
               CAST(NULL AS DATE) AS fechaCaduca, CAST(NULL AS INT) AS diasParaVencer, CAST(NULL AS INT) AS numerosRestantes;
        RETURN;
    END

    DECLARE @proximo NUMERIC(7,0), @hasta NUMERIC(7,0), @caduca DATE, @timbrado NCHAR(20);
    SELECT @proximo = ISNULL(nroActual, nroFactura - 1) + 1, @hasta = nroHasta, @caduca = fechaCaduca, @timbrado = timbrado
    FROM dbo.factura WHERE idFactura = @idFactura;

    DECLARE @error VARCHAR(255) = dbo.funValidarTimbrado(@idFactura, @proximo, GETDATE());
    DECLARE @dias INT = DATEDIFF(DAY, CAST(GETDATE() AS DATE), @caduca);
    DECLARE @restantes INT = CASE WHEN @hasta IS NULL THEN NULL ELSE CAST(@hasta - @proximo + 1 AS INT) END;

    SELECT
        @idFactura AS idFactura,
        RTRIM(@timbrado) AS timbrado,
        CASE
            WHEN @error IS NOT NULL AND @dias < 0 THEN 'VENCIDO'
            WHEN @error IS NOT NULL AND @restantes IS NOT NULL AND @restantes <= 0 THEN 'AGOTADO'
            WHEN @error IS NOT NULL THEN 'NO_INICIADO'
            WHEN @dias <= @diasAviso THEN 'POR_VENCER'
            WHEN @restantes IS NOT NULL AND @restantes <= @numerosAviso THEN 'POR_AGOTARSE'
            ELSE 'VIGENTE'
        END AS estado,
        CAST(CASE WHEN @error IS NULL THEN 0 ELSE 1 END AS BIT) AS bloquea,
        CASE
            WHEN @error IS NOT NULL THEN @error
            WHEN @dias <= @diasAviso THEN 'El timbrado ' + RTRIM(@timbrado) + ' vence en ' + CAST(@dias AS VARCHAR(5)) + ' día(s) (' + CONVERT(VARCHAR(10), @caduca, 103) + ').'
            WHEN @restantes IS NOT NULL AND @restantes <= @numerosAviso THEN 'Quedan ' + CAST(@restantes AS VARCHAR(10)) + ' número(s) de factura en el rango del timbrado ' + RTRIM(@timbrado) + '.'
            ELSE NULL
        END AS mensaje,
        @caduca AS fechaCaduca,
        @dias AS diasParaVencer,
        @restantes AS numerosRestantes;
END
GO

IF OBJECT_ID('dbo.sp_listarTimbrados') IS NOT NULL DROP PROCEDURE dbo.sp_listarTimbrados
GO
CREATE PROCEDURE dbo.sp_listarTimbrados
    @soloActivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        f.idFactura,
        f.idSucursal,
        s.nombreSucursal,
        RTRIM(f.dsuc) AS dsuc,
        RTRIM(f.dcaja) AS dcaja,
        RTRIM(f.dsuc) + '-' + RTRIM(f.dcaja) AS puntoExpedicion,
        RTRIM(f.timbrado) AS timbrado,
        f.fechaInicio,
        f.fechaCaduca,
        f.nroFactura AS nroDesde,
        f.nroHasta,
        ISNULL(f.nroActual, f.nroFactura - 1) + 1 AS proximoNumero,
        CAST(ISNULL((SELECT MAX(v.dfactu) FROM dbo.venta v WHERE v.idFactura = f.idFactura), 0) AS NUMERIC(7,0)) AS ultimoEmitido,
        f.preImpreso,
        f.activo,
        (SELECT COUNT(*) FROM dbo.TerminalWeb tw WHERE tw.idFactura = f.idFactura AND tw.activo = 1) AS terminalesAsignadas,
        CASE
            WHEN f.activo = 0 THEN 'INACTIVO'
            WHEN dbo.funValidarTimbrado(f.idFactura, ISNULL(f.nroActual, f.nroFactura - 1) + 1, GETDATE()) IS NOT NULL THEN 'NO_VALIDO'
            WHEN DATEDIFF(DAY, CAST(GETDATE() AS DATE), f.fechaCaduca) <= 30 THEN 'POR_VENCER'
            ELSE 'VIGENTE'
        END AS estado
    FROM dbo.factura f
    INNER JOIN dbo.sucursal s ON s.idSucursal = f.idSucursal
    WHERE @soloActivos = 0 OR f.activo = 1
    ORDER BY f.activo DESC, f.fechaCaduca DESC;
END
GO

IF OBJECT_ID('dbo.sp_guardarTimbrado') IS NOT NULL DROP PROCEDURE dbo.sp_guardarTimbrado
GO
/*
  Alta (@idFactura = 0) o modificación de un timbrado / punto de expedición.
  @proximoNumero: próximo número a emitir; no puede volver a números ya usados.
*/
CREATE PROCEDURE dbo.sp_guardarTimbrado
    @idFactura      INT,
    @idSucursal     INT,
    @dsuc           VARCHAR(3),
    @dcaja          VARCHAR(3),
    @timbrado       VARCHAR(20),
    @fechaInicio    DATE,
    @fechaCaduca    DATE,
    @nroDesde       NUMERIC(7,0),
    @nroHasta       NUMERIC(7,0) = NULL,
    @proximoNumero  NUMERIC(7,0),
    @preImpreso     BIT,
    @activo         BIT,
    @idUsuario      INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @verrmsg VARCHAR(255);
    DECLARE @ultimoEmitido NUMERIC(7,0) = ISNULL((SELECT MAX(dfactu) FROM dbo.venta WHERE idFactura = @idFactura), 0);

    SET @timbrado = LTRIM(RTRIM(@timbrado));
    SET @dsuc = RIGHT('000' + LTRIM(RTRIM(@dsuc)), 3);
    SET @dcaja = RIGHT('000' + LTRIM(RTRIM(@dcaja)), 3);

    IF @timbrado = '' OR @timbrado LIKE '%[^0-9]%'
        SET @verrmsg = 'El timbrado debe contener solo números.';
    ELSE IF @dsuc LIKE '%[^0-9]%' OR @dcaja LIKE '%[^0-9]%' OR @dsuc = '000' OR @dcaja = '000'
        SET @verrmsg = 'El establecimiento y el punto de expedición deben ser números de 1 a 999.';
    ELSE IF NOT EXISTS (SELECT 1 FROM dbo.sucursal WHERE idSucursal = @idSucursal)
        SET @verrmsg = 'La sucursal no existe.';
    ELSE IF @fechaInicio IS NULL OR @fechaCaduca IS NULL OR @fechaCaduca < @fechaInicio
        SET @verrmsg = 'La fecha de fin de vigencia debe ser posterior a la de inicio.';
    ELSE IF @nroDesde IS NULL OR @nroDesde < 1
        SET @verrmsg = 'El número inicial del rango debe ser mayor a cero.';
    ELSE IF @nroHasta IS NOT NULL AND @nroHasta < @nroDesde
        SET @verrmsg = 'El número final del rango no puede ser menor al inicial.';
    ELSE IF @proximoNumero IS NULL OR @proximoNumero < @nroDesde OR (@nroHasta IS NOT NULL AND @proximoNumero > @nroHasta + 1)
        SET @verrmsg = 'El próximo número a emitir debe estar dentro del rango autorizado.';
    ELSE IF @idFactura <> 0 AND NOT EXISTS (SELECT 1 FROM dbo.factura WHERE idFactura = @idFactura)
        SET @verrmsg = 'El timbrado a modificar no existe.';
    ELSE IF @proximoNumero <= @ultimoEmitido
        SET @verrmsg = 'El próximo número no puede ser menor o igual a la última factura emitida (' + CAST(@ultimoEmitido AS VARCHAR(10)) + ').';
    ELSE IF @activo = 0 AND EXISTS (SELECT 1 FROM dbo.TerminalWeb WHERE idFactura = @idFactura AND activo = 1)
        SET @verrmsg = 'No se puede desactivar: hay terminales activas usando este timbrado. Asígneles otro primero.';
    ELSE IF @activo = 1 AND EXISTS (SELECT 1 FROM dbo.factura WHERE idFactura <> @idFactura AND activo = 1
                    AND RTRIM(timbrado) = @timbrado AND dsuc = @dsuc AND dcaja = @dcaja)
        SET @verrmsg = 'Ya existe un timbrado activo con el mismo número y punto de expedición.';

    IF @verrmsg IS NOT NULL
    BEGIN
        RAISERROR(@verrmsg, 16, 1);
        RETURN -1;
    END

    BEGIN TRAN;

    IF @idFactura = 0
    BEGIN
        SELECT @idFactura = ISNULL(MAX(idFactura), 0) + 1 FROM dbo.factura WITH (UPDLOCK, HOLDLOCK);

        INSERT INTO dbo.factura (idFactura, idSucursal, dsuc, dcaja, nroFactura, nroActual, nroHasta, timbrado,
                                 fechaInicio, fechaCaduca, preImpreso, activo, idUsuarioAlta, fechaAlta)
        VALUES (@idFactura, @idSucursal, @dsuc, @dcaja, @nroDesde, @proximoNumero - 1, @nroHasta, @timbrado,
                @fechaInicio, @fechaCaduca, @preImpreso, @activo, @idUsuario, GETDATE());
    END
    ELSE
    BEGIN
        UPDATE dbo.factura
        SET idSucursal = @idSucursal, dsuc = @dsuc, dcaja = @dcaja, nroFactura = @nroDesde,
            nroActual = @proximoNumero - 1, nroHasta = @nroHasta, timbrado = @timbrado,
            fechaInicio = @fechaInicio, fechaCaduca = @fechaCaduca, preImpreso = @preImpreso,
            activo = @activo, idUsuarioMod = @idUsuario, fechaMod = GETDATE()
        WHERE idFactura = @idFactura;
    END

    COMMIT TRAN;

    SELECT @idFactura AS idFactura;
END
GO

IF OBJECT_ID('dbo.sp_guardarVenta') IS NOT NULL DROP PROCEDURE dbo.sp_guardarVenta
GO
CREATE PROCEDURE [dbo].[sp_guardarVenta]
    @idUsuarioAlta INT,              -- Usuario que realiza la venta (sesión)
    @idTerminalWeb INT,              -- Clave de sesión
    -- Datos de Cabecera (Entrada de la Aplicación)
    @idPersonaJur INT,
    @idMovimientoCaja INT,
    @idTipoPago INT,
    @idTipoVenta INT,
    @idCliente INT,
    @ruc VARCHAR(15),
    @nombreCliente VARCHAR(60),
    @totalVenta MONEY,
    @totalDescuento MONEY,
    @ticket BIT,                     -- 0: Venta Fiscal/Factura | 1: Venta Ticket
    @idVendedor int
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @verrno INT, @verrmsg VARCHAR(255);

    DECLARE @idSucursalVenta INT;
    DECLARE @idFacturaControl INT;

    -- Variables Fiscales: Se inicializan a NULL por si es una venta tipo TICKET (@ticket = 1)
    DECLARE @nroCorrelativo NUMERIC(7,0) = NULL,
            @dsuc CHAR(3) = NULL,
            @dcaja CHAR(3) = NULL;

    DECLARE @idVenta INT;
    DECLARE @detalleCount INT;

    BEGIN TRAN

        -- 1. OBTENCIÓN DE CONFIGURACIÓN DE TERMINAL
        SELECT
            @idSucursalVenta = TW.idSucursal,
            @idFacturaControl = TW.idFactura
        FROM dbo.TerminalWeb TW
        WHERE TW.idTerminalWeb = @idTerminalWeb AND TW.activo = 1;

        IF @idSucursalVenta IS NULL OR @idFacturaControl IS NULL
        BEGIN
            SELECT @verrno = 50004, @verrmsg = 'Error: La Terminal Web no está activa o no tiene Sucursal/Rango Fiscal asignado.';
            GOTO error;
        END

        SELECT @detalleCount = COUNT(*) FROM dbo.detVentaTmp WHERE idTerminalWeb = @idTerminalWeb;
        IF @detalleCount = 0 BEGIN SELECT @verrno = 50002, @verrmsg = 'Error: No hay ítems en la venta para guardar.'; GOTO error; END


        -------------------------------------------------------------
        -- LÓGICA DE INSERCIÓN CONDICIONAL
        -------------------------------------------------------------

        IF @ticket = 0 -- Venta Fiscal (dbo.venta y dbo.detVenta)
        BEGIN
            -- 2. OBTENCIÓN Y ACTUALIZACIÓN DE CORRELATIVO FISCAL (LOCK DE FACTURA)
            -- ESTO SOLO SE EJECUTA SI ES UNA VENTA FISCAL
            SELECT
                @nroCorrelativo = nroActual + 1, @dsuc = dsuc, @dcaja = dcaja
            FROM dbo.factura WITH (UPDLOCK, HOLDLOCK)
            WHERE idFactura = @idFacturaControl AND activo = 1;

            IF @nroCorrelativo IS NULL BEGIN SELECT @verrno = 50003, @verrmsg = 'Error: El rango de factura no está activo o no existe.'; GOTO error; END

            -- Validación de timbrado: vigencia y rango autorizado (migración 001)
            SET @verrmsg = dbo.funValidarTimbrado(@idFacturaControl, @nroCorrelativo, GETDATE());
            IF @verrmsg IS NOT NULL BEGIN SET @verrno = 50005; GOTO error; END

            UPDATE dbo.factura SET nroActual = @nroCorrelativo WHERE idFactura = @idFacturaControl;
            SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;

            -- 3. INSERTAR CABECERA DE VENTA (dbo.venta)
            INSERT INTO dbo.venta (
                -- idVenta se omite, ya que es IDENTITY
                idPersonaJur, idSucursal, idMovimientoCaja, idTipoPago, idTipoVenta, idCliente,
                idFactura, dsuc, dcaja, dfactu, cliente, ruc,
                totalVenta, totalDescuento, activo, idUsuarioAlta, fechaAlta, idVendedor
            )
            VALUES (
                @idPersonaJur, @idSucursalVenta, @idMovimientoCaja, @idTipoPago, @idTipoVenta, @idCliente,
                @idFacturaControl, @dsuc, @dcaja, @nroCorrelativo, @nombreCliente, @ruc,
                @totalVenta, @totalDescuento, 1, @idUsuarioAlta, GETDATE(), @idVendedor
            );

            SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
            SET @idVenta = SCOPE_IDENTITY(); -- Obtener el ID generado

            -- 4. INSERTAR DETALLE DE VENTA (dbo.detVenta)
            INSERT INTO dbo.detVenta (
                idVenta, idProducto, idStock, cantidad, precioUnitario, subtotal, precioDescuento, idImpuesto, costo -- Usando idStoc
            )
            SELECT
                @idVenta, T.idProducto, T.idStock, T.cantidad, T.precioUnitario, T.subtotal, T.precioDescuento, T.idImpuesto, T.costo
            FROM dbo.detVentaTmp T
            WHERE T.idTerminalWeb = @idTerminalWeb;

            SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
        END

        ELSE -- Venta Tipo Ticket (@ticket = 1) (dbo.cve y dbo.dve)
        BEGIN
            -- 3. INSERTAR CABECERA DE VENTA (dbo.cve)
            -- Se excluyen los campos fiscales (idFactura, dsuc, dcaja, dfactu) ya que es un TICKET no fiscal.
            -- Asumimos que la tabla dbo.cve no necesita esos campos o los acepta como NULL.
            INSERT INTO dbo.cve (
                -- idVenta se omite, ya que es IDENTITY
                idPersonaJur, idSucursal, idMovimientoCaja, idTipoPago, idTipoVenta, idCliente,
                cliente, ruc,
                totalVenta, totalDescuento, activo, idUsuarioAlta, fechaAlta, idVendedor
            )
            VALUES (
                @idPersonaJur, @idSucursalVenta, @idMovimientoCaja, @idTipoPago, @idTipoVenta, @idCliente,
                @nombreCliente, @ruc,
                @totalVenta, @totalDescuento, 1, @idUsuarioAlta, GETDATE(), @idVendedor
            );

            SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
            SET @idVenta = SCOPE_IDENTITY(); -- Obtener el ID generado

            -- 4. INSERTAR DETALLE DE VENTA (dbo.dve)
            INSERT INTO dbo.dve (
                idVenta, idProducto, idStock, cantidad, precioUnitario, subtotal, precioDescuento, idImpuesto, costo -- Usando idStoc
            )
            SELECT
                @idVenta, T.idProducto, T.idStock, T.cantidad, T.precioUnitario, T.subtotal, T.precioDescuento, T.idImpuesto, T.costo
            FROM dbo.detVentaTmp T
            WHERE T.idTerminalWeb = @idTerminalWeb;

            SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
        END

        -------------------------------------------------------------
        -- LÓGICA COMÚN (Stock y Limpieza)
        -------------------------------------------------------------

        -- 5. DESCONTAR STOCK (dbo.stock)
        UPDATE S SET S.cantidad = S.cantidad - T.cantidad
        FROM dbo.stock S
        INNER JOIN dbo.detVentaTmp T ON S.idStock = T.idStock
        WHERE T.idTerminalWeb = @idTerminalWeb;

        SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;

		-- DESCONTAR SI ES QUE HAY PRODUCTOS QUE TIENEN PRODUCTOS REFERENCIADOS
        IF EXISTS (select 1 from detVentaTmp tmp inner join detProductoRef dpr
					on tmp.idProducto=dpr.idProductoRef)
		begin
			-- descontamos los productos referenciados
			update s set s.cantidad=S.cantidad - dpr.cantidad
			FROM detVentaTmp dvt
			INNER JOIN detProductoRef dpr ON dpr.idProductoRef = dvt.idProducto
			INNER JOIN producto p ON dpr.idProducto = p.idProducto
			INNER JOIN stock s ON p.idProducto = s.idProducto
			WHERE dvt.idTerminalWeb = @idTerminalWeb;

			SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
		end

        -- 6. LIMPIAR TABLA TEMPORAL
        DELETE FROM dbo.detVentaTmp WHERE idTerminalWeb = @idTerminalWeb;
        SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;

    COMMIT TRAN

    SELECT @idVenta as idVenta

    RETURN 1

    error:
        IF @@TRANCOUNT > 0 BEGIN ROLLBACK TRAN END
        RAISERROR (@verrmsg, 16, 1);
        RETURN -1
END
GO
