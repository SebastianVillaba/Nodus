/*
  004 - Ventas a crédito y cobros en el arqueo de caja
    - sp_cerrarCaja:
        * Las ventas a crédito de la caja se suman solas a lo arqueado (como un medio más), porque
          forman parte del total de ventas pero no entra dinero.
        * Los cobros de créditos recibidos en la caja se suman a lo esperado (entra dinero).
        * Corrección: el total de ventas restaba el descuento dos veces (totalVenta ya es neto).
    - sp_reporteCierreCaja: totales de contado/crédito/cobros y detalle de ambos para el ticket.
        * Correcciones: el total de ventas daba NULL si no había tickets, y contaba ventas anuladas.
    - sp_resumenCreditoCaja: ventas a crédito y cobros de la caja abierta de una terminal (pantalla de arqueo).
*/
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.sp_resumenCreditoCaja') IS NOT NULL DROP PROCEDURE dbo.sp_resumenCreditoCaja
GO
CREATE PROCEDURE dbo.sp_resumenCreditoCaja
    @idTerminalWeb INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @idMovimientoCaja INT = (
        SELECT MAX(mc.idMovimientoCaja)
        FROM dbo.movimientoCaja mc
        INNER JOIN dbo.TerminalWeb tw ON tw.nroCaja = mc.nroCaja
        WHERE tw.idTerminalWeb = @idTerminalWeb AND mc.estado = 'ABIERTA'
    );

    -- Ventas a crédito de la caja abierta
    SELECT
        v.idVenta,
        dbo.funObtenerFacturaFormateada(v.dsuc, v.dcaja, v.dfactu) AS nroFactura,
        v.cliente,
        v.fechaAlta,
        v.totalVenta
    FROM dbo.venta v
    WHERE v.idMovimientoCaja = @idMovimientoCaja AND v.activo = 1 AND v.idTipoVenta = 2
    ORDER BY v.idVenta;

    -- Cobros de créditos recibidos en la caja abierta
    SELECT
        c.idCobroCredito,
        c.nroRecibo,
        p.nombre AS cliente,
        c.fechaCobro,
        c.totalCobrado
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.cliente cl ON cl.idCliente = c.idCliente
    INNER JOIN dbo.persona p ON p.idPersona = cl.idPersona
    WHERE c.idMovimientoCaja = @idMovimientoCaja AND c.activo = 1
    ORDER BY c.nroRecibo;
END
GO

IF OBJECT_ID('dbo.sp_cerrarCaja') IS NOT NULL DROP PROCEDURE dbo.sp_cerrarCaja
GO
CREATE PROCEDURE [dbo].[sp_cerrarCaja]
    @idTerminalWeb      INT,
    @idUsuarioCierre    INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Variables de control y error
    DECLARE @verrmsg VARCHAR(255);
    DECLARE @nroCaja INT;
    DECLARE @idMovimientoCaja INT;

    -- Variables para el cálculo del faltante/sobrante
    DECLARE @montoCalculado MONEY;    -- Lo que el sistema dice que debe haber
    DECLARE @totalGastos MONEY;
    DECLARE @montoVentasSistema MONEY;
    DECLARE @montoMoneda MONEY;
    DECLARE @montoTarjetaCredito MONEY;
    DECLARE @montoTarjetaDebito MONEY;
    DECLARE @montoTransferencia MONEY;
    DECLARE @montoVentasCredito MONEY;   -- migración 004: ventas a crédito (se cuentan solas en el arqueo)
    DECLARE @totalCobros MONEY;          -- migración 004: cobros de créditos recibidos en esta caja

    -- Variable para el total físico contado (Suma de Billetes + Moneda)
    DECLARE @montoFinalContado MONEY;

    -- 1. VALIDACIONES PREVIAS (Fuera de la transacción para no bloquear recursos)
    SET @nroCaja = (SELECT nroCaja FROM TerminalWeb WHERE idTerminalWeb = @idTerminalWeb);
    IF @nroCaja IS NULL OR @nroCaja = 0
    BEGIN
        RAISERROR('Su terminal no tiene ninguna caja asignada! Revise....', 16, 1);
        RETURN -1;
    END

    SET @idMovimientoCaja = (SELECT MAX(idMovimientoCaja) FROM movimientoCaja WHERE nroCaja = @nroCaja AND estado = 'ABIERTA');
    IF @idMovimientoCaja IS NULL
    BEGIN
        RAISERROR('Su terminal no cuenta con una caja abierta! Revise....', 16, 1);
        RETURN -1;
    END

    -- INICIO DEL BLOQUE ATÓMICO
    BEGIN TRY
        BEGIN TRAN

            -- 2. INSERTAMOS LOS DETALLES TEMPORALES EN SUS RESPECTIVAS TABLAS DEFINITIVAS

            -- PARA LOS GASTOS
            INSERT INTO gastoCaja (idMovimientoCaja, factura, montoGasto, concepto)
            SELECT @idMovimientoCaja, factura, montoGasto, concepto
            FROM gastoCajaTmp
            WHERE idTerminalWeb = @idTerminalWeb;

            -- PARA LAS MONEDAS
            INSERT INTO detArqueoMoneda (idMovimientoCaja, idMoneda, montoMoneda, total)
            SELECT @idMovimientoCaja, idMoneda, montoMoneda, total
            FROM detArqueoMonedaTmp
            WHERE idTerminalWeb = @idTerminalWeb;

            -- PARA LAS TARJETAS DE CREDITO
            INSERT INTO detArqueoTarjetaCredito (idMovimientoCaja, idTarjetaDebito, monto)
            SELECT @idMovimientoCaja, idTarjetaDebito, monto
            FROM detArqueoTarjetaCreditoTmp
            WHERE idTerminalWeb = @idTerminalWeb;

            -- PARA LAS TARJETAS DE DEBITO
            INSERT INTO detArqueoTarjetaDebito (idMovimientoCaja, idTarjetaDebito, monto)
            SELECT @idMovimientoCaja, idTarjetaDebito, monto
            FROM detArqueoTarjetaDebitoTmp
            WHERE idTerminalWeb = @idTerminalWeb;

            -- PARA LAS TARJETAS DE TRANSFERENCIA
            INSERT INTO detArqueoTransferencia (idMovimientoCaja, concepto, monto)
            SELECT @idMovimientoCaja, concepto, monto
            FROM detArqueoTransferenciaTmp
            WHERE idTerminalWeb = @idTerminalWeb;


            -- 3. CÁLCULO DE MONTOS FISICOS

            -- Sumamos billetes cargados en la temporal
            SELECT @montoFinalContado = ISNULL(SUM(ac.cantidad * d.valor), 0)
            FROM dbo.arqueoCajaTmp ac
            INNER JOIN dbo.denominacion d ON ac.idDenominacion = d.idDenominacion
            WHERE ac.idTerminalWeb = @idTerminalWeb;

            -- Calculamos el monto de la moneda
            SELECT @montoMoneda = ISNULL(SUM(total), 0)
            FROM detArqueoMoneda
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- Calculamos el monto de la tarjeta de crédito
            SELECT @montoTarjetaCredito = ISNULL(SUM(monto), 0)
            FROM detArqueoTarjetaCredito
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- Calculamos el monto de la tarjeta de débito
            SELECT @montoTarjetaDebito = ISNULL(SUM(monto), 0)
            FROM detArqueoTarjetaDebito
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- Calculamos el monto de las transferencias
            SELECT @montoTransferencia = ISNULL(SUM(monto), 0)
            FROM detArqueoTransferencia
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- Sumar el total de GASTOS definitivos
            SELECT @totalGastos = ISNULL(SUM(montoGasto), 0)
            FROM dbo.gastoCaja
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- 4. CÁLCULO DE MONTO ESPERADO (SISTEMA)
            -- (migración 004) totalVenta ya es el neto con descuento: antes se restaba totalDescuento otra vez
            SET @montoVentasSistema = (
                SELECT
                    (SELECT ISNULL(SUM(totalVenta), 0) FROM dbo.venta WHERE idMovimientoCaja = @idMovimientoCaja and activo=1) +
                    (SELECT ISNULL(SUM(totalVenta), 0) FROM dbo.cve WHERE idMovimientoCaja = @idMovimientoCaja and activo=1)
            );

            -- Ventas a crédito de la caja: no entra dinero, se suman solas a lo arqueado
            SELECT @montoVentasCredito = ISNULL(SUM(totalVenta), 0)
            FROM dbo.venta
            WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1 AND idTipoVenta = 2;

            -- Cobros de créditos recibidos en esta caja: entra dinero, se suman a lo esperado
            SELECT @totalCobros = ISNULL(SUM(totalCobrado), 0)
            FROM dbo.cabCobroCredito
            WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1;

            -- Sumamos ventas + monto inicial del cajero
            SELECT @montoCalculado = ISNULL(montoInicial, 0) + ISNULL(@montoVentasSistema, 0) + @totalCobros
            FROM dbo.movimientoCaja
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- Restar los Gastos del estimado del sistema
            SET @montoCalculado = ISNULL(@montoCalculado, 0) - @totalGastos;

            -- Totalizar todo lo contado físicamente
            SET @montoFinalContado = (@montoFinalContado + @montoMoneda + @montoTarjetaCredito + @montoTarjetaDebito + @montoTransferencia + @montoVentasCredito);

            -- 5. ACTUALIZAR EL REGISTRO DEL MOVIMIENTO DE CAJA (Cierre de Jornada)
            UPDATE dbo.movimientoCaja
            SET
                fechaCierre = GETDATE(),
                montoFinal = @montoFinalContado,
                montoCalculado = @montoCalculado,
                idUsuarioCierre = @idUsuarioCierre,
                estado = 'CERRADA'
            WHERE idMovimientoCaja = @idMovimientoCaja;

            -- 6. LIMPIEZA DE LAS TABLAS TEMPORALES
            DELETE FROM dbo.arqueoCajaTmp WHERE idTerminalWeb = @idTerminalWeb;
            DELETE FROM dbo.gastoCajaTmp WHERE idTerminalWeb = @idTerminalWeb;
            DELETE FROM dbo.detArqueoMonedaTmp WHERE idTerminalWeb = @idTerminalWeb;
            DELETE FROM dbo.detArqueoTarjetaCreditoTmp WHERE idTerminalWeb = @idTerminalWeb;
            DELETE FROM dbo.detArqueoTarjetaDebitoTmp WHERE idTerminalWeb = @idTerminalWeb;
            DELETE FROM dbo.detArqueoTransferenciaTmp WHERE idTerminalWeb = @idTerminalWeb;

        -- Si todo salió bien, guardamos cambios de forma permanente
        COMMIT TRAN

        -- Retornamos el ID exitoso
        SELECT @idMovimientoCaja AS idMovimientoCaja;

    END TRY
    BEGIN CATCH
        -- Captura de error catastrófico: Volver todo atrás
        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRAN;
        END

        -- Formatear mensaje de error original de SQL Server
        SET @verrmsg = 'Error en Cierre de Caja: ' + ERROR_MESSAGE();
        RAISERROR (@verrmsg, 16, 1);
        RETURN -1;
    END CATCH
END
GO

IF OBJECT_ID('dbo.sp_reporteCierreCaja') IS NOT NULL DROP PROCEDURE dbo.sp_reporteCierreCaja
GO
CREATE PROCEDURE [dbo].[sp_reporteCierreCaja]
    @idMovimientoCaja INT
AS
BEGIN
    SET NOCOUNT ON;

	-- (migración 004) antes: daba NULL si una de las tablas no tenía ventas, contaba ventas anuladas
	-- y restaba el descuento dos veces (totalVenta ya es neto)
	DECLARE @montoVentasSistema MONEY, @montoVentasCredito MONEY, @totalCobros MONEY

	SET @montoVentasSistema = (
			SELECT
				(SELECT ISNULL(SUM(totalVenta), 0) FROM dbo.venta WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1) +
				(SELECT ISNULL(SUM(totalVenta), 0) FROM dbo.cve WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1)
	);

	SELECT @montoVentasCredito = ISNULL(SUM(totalVenta), 0)
	FROM dbo.venta WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1 AND idTipoVenta = 2;

	SELECT @totalCobros = ISNULL(SUM(totalCobrado), 0)
	FROM dbo.cabCobroCredito WHERE idMovimientoCaja = @idMovimientoCaja AND activo = 1;

    -- ==========================================================
    -- RESULTADO 1: RESUMEN GENERAL Y BALANCE
    -- ==========================================================
    SELECT
        -- 1. IDENTIFICACIÓN
        mc.nroCaja,
        mc.idMovimientoCaja,
        dbo.funObtenerNombrePorUsuario(mc.idUsuarioAbre) AS cajeroApertura,
        dbo.funObtenerNombrePorUsuario(mc.idUsuarioCierre) AS cajeroCierre,
        mc.fechaApertura,
        mc.fechaCierre,

        -- 2. FLUJO DE DINERO (MOVIMIENTOS)
        mc.montoInicial,

        -- Total Ventas (Ingresos por venta directa)
        @montoVentasSistema AS totalVentas,

        @montoVentasSistema - @montoVentasCredito AS totalVentasContado,
        @montoVentasCredito AS totalVentasCredito,

        -- Total Cobranzas: cobros de créditos recibidos en esta caja (migración 004)
        @totalCobros AS totalCobranza,

        -- Total Gastos (Salidas de dinero)
        ISNULL((SELECT SUM(montoGasto) FROM gastoCaja WHERE idMovimientoCaja = mc.idMovimientoCaja), 0) AS totalGastos,

        -- Total Moneda
        ISNULL((SELECT SUM(total) FROM detArqueoMoneda WHERE idMovimientoCaja = mc.idMovimientoCaja), 0) AS totalMoneda,

        -- Total Tarjeta Debito
        ISNULL((SELECT SUM(monto) FROM detArqueoTarjetaDebito WHERE idMovimientoCaja = mc.idMovimientoCaja), 0) AS totalTarjetaDebito,

        -- Total Tarjeta Credito
        ISNULL((SELECT SUM(monto) FROM detArqueoTarjetaCredito WHERE idMovimientoCaja = mc.idMovimientoCaja), 0) AS totalTarjetaCredito,

        -- Total Transferencia
        ISNULL((SELECT SUM(monto) FROM detArqueoTransferencia WHERE idMovimientoCaja = mc.idMovimientoCaja), 0) AS totalTransferencia,

        -- 3. BALANCE FINAL
        mc.montoCalculado AS saldoTeorico, -- Lo que el sistema dice que debe haber
        mc.montoFinal AS saldoReal,        -- Lo que el cajero contó (Declarado)

        -- Diferencia (Si es negativo, falta dinero. Si es positivo, sobra)
        (ISNULL(mc.montoFinal, 0) - ISNULL(mc.montoCalculado, 0)) AS diferencia,

        -- Estado en texto para el ticket
        CASE
            WHEN (ISNULL(mc.montoFinal, 0) - ISNULL(mc.montoCalculado, 0)) = 0 THEN 'CAJA CUADRADA'
            WHEN (ISNULL(mc.montoFinal, 0) - ISNULL(mc.montoCalculado, 0)) < 0 THEN 'FALTANTE DE DINERO'
            ELSE 'SOBRANTE DE DINERO'
        END AS estadoCierre

    FROM dbo.movimientoCaja mc
    WHERE mc.idMovimientoCaja = @idMovimientoCaja;

    -- ==========================================================
    -- RESULTADO 2: DETALLE DE GASTOS (SALIDAS DE CAJA)
    -- ==========================================================
    -- Es importante listar esto en el ticket porque justifica por qué hay menos dinero
    SELECT
        g.concepto,
        g.montoGasto
    FROM dbo.gastoCaja g
    WHERE g.idMovimientoCaja = @idMovimientoCaja

    select
		m.nombre,
		dam.montoMoneda,
		dam.total
    from detArqueoMoneda dam inner join moneda m
    on dam.idMoneda=m.idMoneda
    where idMovimientoCaja=@idMovimientoCaja

    select
		td.nombreTarjetaDebito,
		dam.monto
    from detArqueoTarjetaCredito dam inner join tarjetaDebito td
    on dam.idTarjetaDebito=td.idTarjetaDebito
    where idMovimientoCaja=@idMovimientoCaja

    select
		td.nombreTarjetaDebito,
		dam.monto
    from detArqueoTarjetaDebito dam inner join tarjetaDebito td
    on dam.idTarjetaDebito=td.idTarjetaDebito
    where idMovimientoCaja=@idMovimientoCaja

    select
		concepto,
		monto
    from detArqueoTransferencia
    where idMovimientoCaja=@idMovimientoCaja

    -- RESULTADO 7 (migración 004): ventas a crédito de la caja
    SELECT
        dbo.funObtenerFacturaFormateada(v.dsuc, v.dcaja, v.dfactu) AS nroFactura,
        v.cliente,
        v.totalVenta
    FROM dbo.venta v
    WHERE v.idMovimientoCaja = @idMovimientoCaja AND v.activo = 1 AND v.idTipoVenta = 2
    ORDER BY v.idVenta;

    -- RESULTADO 8 (migración 004): cobros de créditos recibidos en la caja
    SELECT
        c.nroRecibo,
        p.nombre AS cliente,
        c.totalCobrado
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.cliente cl ON cl.idCliente = c.idCliente
    INNER JOIN dbo.persona p ON p.idPersona = cl.idPersona
    WHERE c.idMovimientoCaja = @idMovimientoCaja AND c.activo = 1
    ORDER BY c.nroRecibo;

END
GO
