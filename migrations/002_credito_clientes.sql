/*
  002 - Ventas a crédito
    - cliente.acreditar / cliente.limiteCredito: si se le puede vender a crédito y hasta cuánto.
    - cuotaVenta: cuotas de cada factura a crédito (monto y saldo pendiente).
    - v_creditoCliente: deuda, disponible y vencidos por cliente.
    - funFormatoGs: formatea montos en guaraníes para mensajes (1.250.000).
    - sp_consultaCreditoCliente / sp_actualizarCreditoCliente.
    - sp_guardarVenta: valida y genera cuotas cuando idTipoVenta = 2 (solo factura, nunca ticket).
    - sp_anularFacturacion: no anula facturas a crédito con cobros; si no tiene, anula sus cuotas.
      Se corrige el manejo de errores (antes perdía el mensaje real ante errores de SQL).
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.cliente', 'acreditar') IS NULL
    ALTER TABLE dbo.cliente ADD acreditar BIT NOT NULL CONSTRAINT DF_cliente_acreditar DEFAULT (0);
GO
IF COL_LENGTH('dbo.cliente', 'limiteCredito') IS NULL
    ALTER TABLE dbo.cliente ADD limiteCredito MONEY NOT NULL CONSTRAINT DF_cliente_limiteCredito DEFAULT (0);
GO
IF OBJECT_ID('dbo.CK_cliente_limiteCredito') IS NULL
    ALTER TABLE dbo.cliente ADD CONSTRAINT CK_cliente_limiteCredito CHECK (limiteCredito >= 0);
GO

IF OBJECT_ID('dbo.cuotaVenta') IS NULL
BEGIN
    CREATE TABLE dbo.cuotaVenta (
        idCuotaVenta     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cuotaVenta PRIMARY KEY,
        idVenta          INT NOT NULL CONSTRAINT FK_cuotaVenta_venta REFERENCES dbo.venta (idVenta),
        nroCuota         SMALLINT NOT NULL,
        cantidadCuotas   SMALLINT NOT NULL,
        fechaVencimiento DATE NOT NULL,
        monto            MONEY NOT NULL,
        saldo            MONEY NOT NULL,
        activo           BIT NOT NULL CONSTRAINT DF_cuotaVenta_activo DEFAULT (1),
        CONSTRAINT UQ_cuotaVenta_venta_nro UNIQUE (idVenta, nroCuota),
        CONSTRAINT CK_cuotaVenta_saldo CHECK (saldo >= 0 AND saldo <= monto),
        CONSTRAINT CK_cuotaVenta_monto CHECK (monto > 0)
    );
    CREATE INDEX IX_cuotaVenta_pendientes ON dbo.cuotaVenta (activo, saldo) INCLUDE (idVenta, fechaVencimiento);
END
GO

IF OBJECT_ID('dbo.funFormatoGs') IS NOT NULL DROP FUNCTION dbo.funFormatoGs
GO
-- 1250000 -> '1.250.000'
CREATE FUNCTION dbo.funFormatoGs (@monto MONEY)
RETURNS VARCHAR(30)
AS
BEGIN
    DECLARE @texto VARCHAR(30) = CONVERT(VARCHAR(30), CAST(ROUND(@monto, 0) AS MONEY), 1); -- 1,250,000.00
    SET @texto = LEFT(@texto, LEN(@texto) - 3);                                            -- 1,250,000
    RETURN REPLACE(@texto, ',', '.');
END
GO

IF OBJECT_ID('dbo.v_creditoCliente') IS NOT NULL DROP VIEW dbo.v_creditoCliente
GO
/*
  Situación de crédito de cada cliente. Solo cuentan cuotas activas de facturas activas.
*/
CREATE VIEW dbo.v_creditoCliente
AS
SELECT
    c.idCliente,
    c.idPersona,
    p.nombre AS nombreCliente,
    c.acreditar,
    c.limiteCredito,
    ISNULL(d.deuda, 0) AS deuda,
    c.limiteCredito - ISNULL(d.deuda, 0) AS disponible,
    ISNULL(d.montoVencido, 0) AS montoVencido,
    ISNULL(d.cuotasVencidas, 0) AS cuotasVencidas,
    d.vencimientoMasAntiguo
FROM dbo.cliente c
INNER JOIN dbo.persona p ON p.idPersona = c.idPersona
LEFT JOIN (
    SELECT
        v.idCliente,
        SUM(cv.saldo) AS deuda,
        SUM(CASE WHEN cv.fechaVencimiento < CAST(GETDATE() AS DATE) THEN cv.saldo ELSE 0 END) AS montoVencido,
        SUM(CASE WHEN cv.fechaVencimiento < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS cuotasVencidas,
        MIN(cv.fechaVencimiento) AS vencimientoMasAntiguo
    FROM dbo.cuotaVenta cv
    INNER JOIN dbo.venta v ON v.idVenta = cv.idVenta AND v.activo = 1
    WHERE cv.activo = 1 AND cv.saldo > 0
    GROUP BY v.idCliente
) d ON d.idCliente = c.idCliente;
GO

IF OBJECT_ID('dbo.sp_consultaCreditoCliente') IS NOT NULL DROP PROCEDURE dbo.sp_consultaCreditoCliente
GO
CREATE PROCEDURE dbo.sp_consultaCreditoCliente
    @idCliente INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT idCliente, nombreCliente, acreditar, limiteCredito, deuda, disponible,
           montoVencido, cuotasVencidas, vencimientoMasAntiguo
    FROM dbo.v_creditoCliente
    WHERE idCliente = @idCliente;
END
GO

IF OBJECT_ID('dbo.sp_actualizarCreditoCliente') IS NOT NULL DROP PROCEDURE dbo.sp_actualizarCreditoCliente
GO
/*
  Configura el crédito del cliente de una persona. Bajar el límite por debajo de la deuda actual
  está permitido: el cliente no podrá comprar a crédito hasta pagar.
*/
CREATE PROCEDURE dbo.sp_actualizarCreditoCliente
    @idPersona      INT,
    @acreditar      BIT,
    @limiteCredito  MONEY,
    @idUsuario      INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @limiteCredito IS NULL OR @limiteCredito < 0
    BEGIN
        RAISERROR('El límite de crédito no puede ser negativo.', 16, 1);
        RETURN -1;
    END

    IF @acreditar = 1 AND @limiteCredito = 0
    BEGIN
        RAISERROR('Para habilitar el crédito indique un límite mayor a cero.', 16, 1);
        RETURN -1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.cliente WHERE idPersona = @idPersona)
    BEGIN
        RAISERROR('La persona no está registrada como cliente.', 16, 1);
        RETURN -1;
    END

    UPDATE dbo.cliente
    SET acreditar = @acreditar, limiteCredito = @limiteCredito, idUsuarioMod = @idUsuario, fechaMod = GETDATE()
    WHERE idPersona = @idPersona;
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
                SET @montoBase = FLOOR(@totalVenta / @cantidadCuotas);

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

IF OBJECT_ID('dbo.sp_anularFacturacion') IS NOT NULL DROP PROCEDURE dbo.sp_anularFacturacion
GO
CREATE PROCEDURE [dbo].[sp_anularFacturacion]
	@idVenta				int,
	@idTerminalWeb			int,
	@idSucursal				int,
	@idUsuarioAlta			int,
	@explica				varchar(max),
	@tipo					numeric(02)
AS
BEGIN
	declare @verrno int, @verrmsg varchar(255),@nroFactura as varchar(10),@idOrdenPaciente int

	begin tran
		if exists(select * from venta where idVenta=@idVenta)
		begin
			-- controlar que ya no esté anulado
			if exists(select * from venta where idVenta=@idVenta and activo=0)
			begin
				select @verrno=50000,
						@verrmsg='Esta venta ya ha sido anulada..!'
				goto error
			end
		end

		--*************************************--
		-- insertar la cabecera de la anulacion--
		--*************************************--
		insert into cabAnulado(idTerminalWeb,idSucursal,idMovimiento,tipo,idUsuarioAlta,explica)
		values(@idTerminalWeb,@idSucursal,@idVenta,'FACT',@idUsuarioAlta,@explica)
		-- controlar si existe un error en la cabecera
		set @verrno=@@error
		if (@verrno <> 0)
			goto error

		-- traer en una variable el idAnulado
		declare @idAnulado as int
		set @idAnulado=(Select Max(idAnulado) From cabAnulado)

		--************************************************************************************************--
		if @tipo=1
		begin
			-------------
			-- IMPRESO --
			-------------
			-- Venta a crédito (migración 002): no se anula si ya tiene cobros; si no, se anulan sus cuotas
			if exists(select 1 from cuotaVenta where idVenta=@idVenta and activo=1 and saldo<monto)
			begin
				select @verrno=50000,
						@verrmsg='La factura tiene cobros registrados. Anule primero los recibos de cobro..!'
				goto error
			end

			update cuotaVenta set activo=0
			where idVenta=@idVenta and activo=1
			set @verrno=@@error
			if (@verrno <> 0)
				goto error

			--*************************************--
			-- insertar el detalle de la anulacion --
			--*************************************--
			insert into detAnulado(idAnulado,idStock,cantidad)
			select @idAnulado,dv.idStock,dv.cantidad
			from detVenta dv
			where dv.idVenta=@idVenta
			-- controlar si existe un error en la cabecera
			set @verrno=@@error
			if (@verrno <> 0)
				goto error

			--******************************************--
			-- actualizar la cabecera de la facturacion --
			--******************************************--
			update venta set activo=0
			where idVenta=@idVenta
			-- si se encuentra algun error
			set @verrno=@@error
			if (@verrno <> 0)
				goto error

			--**********************************--
			-- actualizar el stock --
			--**********************************--
			update stock set cantidad=s.cantidad+dv.cantidad
			from stock s inner join detVenta dv
			on s.idStock=dv.idStock
			where dv.idVenta=@idVenta
			-- si se encuentra algun error
			set @verrno=@@error
			if (@verrno <> 0)
				goto error
		end

		if @tipo=2
		begin
			------------
			-- REMITO --
			------------
			--*************************************--
			-- insertar el detalle de la anulacion --
			--*************************************--
			insert into detAnulado(idAnulado,idStock,cantidad)
			select @idAnulado,dv.idStock,dv.cantidad
			from dve dv
			where dv.idVenta=@idVenta
			-- controlar si existe un error en la cabecera
			set @verrno=@@error
			if (@verrno <> 0)
				goto error

			--******************************************--
			-- actualizar la cabecera de la facturacion --
			--******************************************--
			update cve set activo=0
			where idVenta=@idVenta
			-- si se encuentra algun error
			set @verrno=@@error
			if (@verrno <> 0)
				goto error

			--**********************************--
			-- actualizar el stock --
			--**********************************--
			update stock set cantidad=s.cantidad+dv.cantidad
			from stock s inner join dve dv
			on s.idStock=dv.idStock
			where dv.idVenta=@idVenta
			-- si se encuentra algun error
			set @verrno=@@error
			if (@verrno <> 0)
				goto error
		end

		--************************************************************************************************--

	commit transaction
	Return @@rowcount
	error:
		-- (migración 002) antes: raiserror @verrno @verrmsg fallaba con errores de sistema (ej: 515)
		-- y se perdía el mensaje real; además hacía el rollback después del raiserror.
		if @@trancount > 0 rollback transaction
		set @verrmsg = isnull(@verrmsg, 'Error al anular la venta.')
		raiserror (@verrmsg, 16, 1)
		return -1
end
GO
