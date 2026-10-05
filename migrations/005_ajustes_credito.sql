/*
  005 - Ajustes a ventas a crédito y cobros
    - sp_guardarVenta: cuotas redondeadas a miles (la última absorbe la diferencia).
    - sp_anularCobroCredito: se puede anular en cualquier momento (antes solo con la caja del cobro abierta).
      El cierre de caja ya toma solo los cobros activos.
    - sp_permisoAnular: tipo 'COBRO' (anular recibos) usa el permiso de anular ventas del usuario.
    - sp_listarCobrosCredito: búsqueda por número de recibo y por rango de fechas, con datos de la anulación.
*/
SET NOCOUNT ON;
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
    @idVendedor int,
    -- Ventas a crédito (idTipoVenta = 2), migración 002
    @cantidadCuotas INT = 1,
    @diasEntreCuotas INT = 30
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
        -- VENTA A CRÉDITO: validaciones (migración 002)
        -------------------------------------------------------------
        IF @idTipoVenta NOT IN (1, 2) BEGIN SELECT @verrno = 50010, @verrmsg = 'Error: Condición de venta no válida.'; GOTO error; END

        IF @idTipoVenta = 2
        BEGIN
            DECLARE @acreditar BIT, @limiteCredito MONEY, @deudaCliente MONEY;

            IF @ticket = 1 BEGIN SELECT @verrno = 50011, @verrmsg = 'Las ventas a crédito solo se pueden emitir con factura, no con ticket.'; GOTO error; END
            IF @cantidadCuotas IS NULL OR @cantidadCuotas < 1 OR @cantidadCuotas > 60 BEGIN SELECT @verrno = 50012, @verrmsg = 'La cantidad de cuotas debe estar entre 1 y 60.'; GOTO error; END
            IF @diasEntreCuotas IS NULL OR @diasEntreCuotas < 1 OR @diasEntreCuotas > 365 BEGIN SELECT @verrno = 50013, @verrmsg = 'Los días entre cuotas deben estar entre 1 y 365.'; GOTO error; END
            IF @totalVenta < @cantidadCuotas BEGIN SELECT @verrno = 50016, @verrmsg = 'El total de la venta es muy chico para esa cantidad de cuotas.'; GOTO error; END

            -- Se bloquea la fila del cliente para que dos ventas simultáneas no superen juntas el límite
            SELECT @acreditar = acreditar, @limiteCredito = limiteCredito
            FROM dbo.cliente WITH (UPDLOCK, HOLDLOCK)
            WHERE idCliente = @idCliente AND activo = 1;

            IF ISNULL(@acreditar, 0) = 0
            BEGIN
                SELECT @verrno = 50014, @verrmsg = 'El cliente ' + ISNULL(@nombreCliente, '') + ' no está habilitado para compras a crédito.';
                GOTO error;
            END

            SELECT @deudaCliente = deuda FROM dbo.v_creditoCliente WHERE idCliente = @idCliente;

            IF ISNULL(@deudaCliente, 0) + @totalVenta > @limiteCredito
            BEGIN
                SELECT @verrno = 50015, @verrmsg = 'La venta supera el límite de crédito del cliente. Límite: ' + dbo.funFormatoGs(@limiteCredito)
                    + ' | Deuda actual: ' + dbo.funFormatoGs(ISNULL(@deudaCliente, 0))
                    + ' | Disponible: ' + dbo.funFormatoGs(@limiteCredito - ISNULL(@deudaCliente, 0))
                    + ' | Esta venta: ' + dbo.funFormatoGs(@totalVenta);
                GOTO error;
            END
        END


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

            -- 4b. CUOTAS DE LA VENTA A CRÉDITO (migración 002)
            -- Cuotas iguales en guaraníes enteros; la última absorbe la diferencia del redondeo.
            IF @idTipoVenta = 2
            BEGIN
                DECLARE @nroCuota INT = 1, @montoCuota MONEY, @montoBase MONEY;
                -- (migración 005) cuotas redondeadas a miles: 100.000 en 3 = 33.000 + 33.000 + 34.000.
                -- Si la venta es muy chica para cuotas de mil, se redondea a guaraníes enteros.
                SET @montoBase = FLOOR(@totalVenta / @cantidadCuotas / 1000) * 1000;
                IF @montoBase = 0 SET @montoBase = FLOOR(@totalVenta / @cantidadCuotas);

                WHILE @nroCuota <= @cantidadCuotas
                BEGIN
                    SET @montoCuota = CASE WHEN @nroCuota = @cantidadCuotas
                                           THEN @totalVenta - @montoBase * (@cantidadCuotas - 1)
                                           ELSE @montoBase END;

                    INSERT INTO dbo.cuotaVenta (idVenta, nroCuota, cantidadCuotas, fechaVencimiento, monto, saldo, activo)
                    VALUES (@idVenta, @nroCuota, @cantidadCuotas,
                            DATEADD(DAY, @diasEntreCuotas * @nroCuota, CAST(GETDATE() AS DATE)),
                            @montoCuota, @montoCuota, 1);

                    SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;
                    SET @nroCuota = @nroCuota + 1;
                END
            END
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

IF OBJECT_ID('dbo.sp_anularCobroCredito') IS NOT NULL DROP PROCEDURE dbo.sp_anularCobroCredito
GO
/*
  Anula un recibo y devuelve los saldos a las cuotas. Se registra en cabAnulado con tipo 'COBRO'.
*/
CREATE PROCEDURE dbo.sp_anularCobroCredito
    @idCobroCredito INT,
    @idUsuario      INT,
    @motivo         VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @verrmsg VARCHAR(255), @activo BIT, @idTerminalWeb INT, @idSucursal INT;

    -- (migración 005) se puede anular en cualquier momento, aunque la caja del cobro ya esté cerrada:
    -- el arqueo solo toma los cobros activos al momento de cerrar.
    SELECT @activo = c.activo, @idTerminalWeb = c.idTerminalWeb, @idSucursal = c.idSucursal
    FROM dbo.cabCobroCredito c
    WHERE c.idCobroCredito = @idCobroCredito;

    IF @activo IS NULL
        SET @verrmsg = 'El recibo no existe.';
    ELSE IF @activo = 0
        SET @verrmsg = 'El recibo ya está anulado.';
    ELSE IF LTRIM(RTRIM(ISNULL(@motivo, ''))) = ''
        SET @verrmsg = 'Indique el motivo de la anulación.';

    IF @verrmsg IS NOT NULL
    BEGIN
        RAISERROR(@verrmsg, 16, 1);
        RETURN -1;
    END

    BEGIN TRAN;

    UPDATE cv SET cv.saldo = cv.saldo + d.monto
    FROM dbo.cuotaVenta cv WITH (UPDLOCK)
    INNER JOIN dbo.detCobroCredito d ON d.idCuotaVenta = cv.idCuotaVenta
    WHERE d.idCobroCredito = @idCobroCredito;

    UPDATE dbo.cabCobroCredito
    SET activo = 0, idUsuarioMod = @idUsuario, fechaMod = GETDATE()
    WHERE idCobroCredito = @idCobroCredito;

    INSERT INTO dbo.cabAnulado (idTerminalWeb, idSucursal, idMovimiento, tipo, idUsuarioAlta, explica)
    VALUES (@idTerminalWeb, @idSucursal, @idCobroCredito, 'COBRO', @idUsuario, @motivo);

    COMMIT TRAN;
END
GO

IF OBJECT_ID('dbo.sp_permisoAnular') IS NOT NULL DROP PROCEDURE dbo.sp_permisoAnular
GO
CREATE PROCEDURE [dbo].[sp_permisoAnular]
    @idUsuario int,
    @tipo      varchar(15)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CASE
        WHEN @tipo = 'COMPRA'    THEN anularCompra
        WHEN @tipo = 'FACT'     THEN anularVenta
        WHEN @tipo = 'REMISION'  THEN anularRemision
        WHEN @tipo = 'RECEPCION' THEN anularRecepcion
        WHEN @tipo = 'CARGA'     THEN anularCargaProducto
        WHEN @tipo = 'AJUSTE'    THEN ISNULL(anularAjuste, 0)
        WHEN @tipo = 'COBRO'     THEN anularVenta -- (migración 005) recibos de cobro de créditos
        ELSE 0
    END AS tienePermiso
    FROM usuario
    WHERE idUsuario = @idUsuario AND activo = 1;
END
GO

IF OBJECT_ID('dbo.sp_listarCobrosCredito') IS NOT NULL DROP PROCEDURE dbo.sp_listarCobrosCredito
GO
CREATE PROCEDURE dbo.sp_listarCobrosCredito
    @idCliente        INT = NULL,
    @idMovimientoCaja INT = NULL,
    @nroRecibo        INT = NULL,
    @desde            DATE = NULL,
    @hasta            DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 500
        c.idCobroCredito,
        c.nroRecibo,
        c.fechaCobro,
        c.idCliente,
        p.nombre AS nombreCliente,
        p.ruc + CASE WHEN ISNULL(p.dv, '') <> '' THEN '-' + p.dv ELSE '' END AS rucCliente,
        c.totalCobrado,
        c.observacion,
        c.activo,
        c.idMovimientoCaja,
        mc.nroCaja,
        mc.estado AS estadoCaja,
        s.nombreSucursal,
        dbo.funObtenerNombrePorUsuario(c.idUsuarioAlta) AS usuario,
        an.explica AS motivoAnulacion,
        an.fechaAlta AS fechaAnulacion,
        dbo.funObtenerNombrePorUsuario(an.idUsuarioAlta) AS usuarioAnulacion
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.cliente cl ON cl.idCliente = c.idCliente
    INNER JOIN dbo.persona p ON p.idPersona = cl.idPersona
    INNER JOIN dbo.movimientoCaja mc ON mc.idMovimientoCaja = c.idMovimientoCaja
    INNER JOIN dbo.sucursal s ON s.idSucursal = c.idSucursal
    OUTER APPLY (
        SELECT TOP 1 a.explica, a.fechaAlta, a.idUsuarioAlta
        FROM dbo.cabAnulado a
        WHERE a.tipo = 'COBRO' AND a.idMovimiento = c.idCobroCredito
        ORDER BY a.idAnulado DESC
    ) an
    WHERE (@idCliente IS NULL OR c.idCliente = @idCliente)
      AND (@idMovimientoCaja IS NULL OR c.idMovimientoCaja = @idMovimientoCaja)
      AND (@nroRecibo IS NULL OR c.nroRecibo = @nroRecibo)
      AND (@desde IS NULL OR c.fechaCobro >= @desde)
      AND (@hasta IS NULL OR c.fechaCobro < DATEADD(DAY, 1, @hasta))
    ORDER BY c.idCobroCredito DESC;
END
GO
