/*
  003 - Cobro de créditos (recibos)
    - cabCobroCredito / detCobroCredito: recibo de cobro y a qué cuotas se aplicó cada monto.
    - tipoDetalleCobroCredito: tipo tabla para enviar el detalle del cobro en una sola llamada.
    - sp_consultaCuotasPendientes: cuotas con saldo de un cliente (más antiguas primero).
    - sp_guardarCobroCredito: registra el recibo en la caja abierta de la terminal y descuenta saldos.
    - sp_anularCobroCredito: devuelve los saldos; solo mientras la caja del cobro siga abierta.
    - sp_listarCobrosCredito / sp_reporteReciboCobro: consulta y ticket del recibo.
    - Permiso ACCESO_COBRANZAS (rol ADMINISTRADOR).
*/
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.cabCobroCredito') IS NULL
BEGIN
    CREATE TABLE dbo.cabCobroCredito (
        idCobroCredito   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cabCobroCredito PRIMARY KEY,
        idSucursal       INT NOT NULL CONSTRAINT FK_cabCobroCredito_sucursal REFERENCES dbo.sucursal (idSucursal),
        nroRecibo        INT NOT NULL,
        idCliente        INT NOT NULL CONSTRAINT FK_cabCobroCredito_cliente REFERENCES dbo.cliente (idCliente),
        idMovimientoCaja INT NOT NULL CONSTRAINT FK_cabCobroCredito_movimientoCaja REFERENCES dbo.movimientoCaja (idMovimientoCaja),
        idTerminalWeb    INT NOT NULL,
        fechaCobro       DATETIME NOT NULL CONSTRAINT DF_cabCobroCredito_fechaCobro DEFAULT (GETDATE()),
        totalCobrado     MONEY NOT NULL,
        observacion      VARCHAR(200) NULL,
        activo           BIT NOT NULL CONSTRAINT DF_cabCobroCredito_activo DEFAULT (1),
        idUsuarioAlta    INT NOT NULL,
        fechaAlta        DATETIME NOT NULL CONSTRAINT DF_cabCobroCredito_fechaAlta DEFAULT (GETDATE()),
        idUsuarioMod     INT NULL,
        fechaMod         DATETIME NULL,
        CONSTRAINT UQ_cabCobroCredito_recibo UNIQUE (idSucursal, nroRecibo),
        CONSTRAINT CK_cabCobroCredito_total CHECK (totalCobrado > 0)
    );
    CREATE INDEX IX_cabCobroCredito_cliente ON dbo.cabCobroCredito (idCliente, activo);
    CREATE INDEX IX_cabCobroCredito_caja ON dbo.cabCobroCredito (idMovimientoCaja, activo);
END
GO

IF OBJECT_ID('dbo.detCobroCredito') IS NULL
BEGIN
    CREATE TABLE dbo.detCobroCredito (
        idDetCobroCredito INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_detCobroCredito PRIMARY KEY,
        idCobroCredito    INT NOT NULL CONSTRAINT FK_detCobroCredito_cab REFERENCES dbo.cabCobroCredito (idCobroCredito),
        idCuotaVenta      INT NOT NULL CONSTRAINT FK_detCobroCredito_cuotaVenta REFERENCES dbo.cuotaVenta (idCuotaVenta),
        monto             MONEY NOT NULL,
        CONSTRAINT CK_detCobroCredito_monto CHECK (monto > 0),
        CONSTRAINT UQ_detCobroCredito_cuota UNIQUE (idCobroCredito, idCuotaVenta)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.permiso WHERE nombreSistema = 'ACCESO_COBRANZAS')
    INSERT INTO dbo.permiso (modulo, descripcion, nombreSistema)
    VALUES ('VENTAS', 'Cobrar Créditos de Clientes', 'ACCESO_COBRANZAS');

INSERT INTO dbo.rolPermiso (idRol, idPermiso)
SELECT 1, p.idPermiso FROM dbo.permiso p
WHERE p.nombreSistema = 'ACCESO_COBRANZAS'
  AND NOT EXISTS (SELECT 1 FROM dbo.rolPermiso rp WHERE rp.idRol = 1 AND rp.idPermiso = p.idPermiso);
GO

-- El tipo tabla no se puede recrear mientras un SP lo use: se borran primero los SPs que lo reciben
IF OBJECT_ID('dbo.sp_guardarCobroCredito') IS NOT NULL DROP PROCEDURE dbo.sp_guardarCobroCredito
GO
IF TYPE_ID('dbo.tipoDetalleCobroCredito') IS NULL
    CREATE TYPE dbo.tipoDetalleCobroCredito AS TABLE (
        idCuotaVenta INT NOT NULL PRIMARY KEY,
        monto        MONEY NOT NULL
    );
GO

IF OBJECT_ID('dbo.sp_consultaCuotasPendientes') IS NOT NULL DROP PROCEDURE dbo.sp_consultaCuotasPendientes
GO
CREATE PROCEDURE dbo.sp_consultaCuotasPendientes
    @idCliente INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cv.idCuotaVenta,
        v.idVenta,
        dbo.funObtenerFacturaFormateada(v.dsuc, v.dcaja, v.dfactu) AS nroFactura,
        v.fechaAlta AS fechaVenta,
        v.totalVenta,
        cv.nroCuota,
        cv.cantidadCuotas,
        cv.fechaVencimiento,
        cv.monto,
        cv.saldo,
        CASE WHEN cv.fechaVencimiento < CAST(GETDATE() AS DATE)
             THEN DATEDIFF(DAY, cv.fechaVencimiento, CAST(GETDATE() AS DATE)) ELSE 0 END AS diasAtraso
    FROM dbo.cuotaVenta cv
    INNER JOIN dbo.venta v ON v.idVenta = cv.idVenta AND v.activo = 1
    WHERE v.idCliente = @idCliente AND cv.activo = 1 AND cv.saldo > 0
    ORDER BY cv.fechaVencimiento, v.idVenta, cv.nroCuota;
END
GO

/*
  Registra un recibo de cobro. @detalle: (idCuotaVenta, monto) a aplicar a cada cuota.
  El cobro queda en la caja abierta de la terminal, así suma al arqueo de esa caja.
*/
CREATE PROCEDURE dbo.sp_guardarCobroCredito
    @idCliente      INT,
    @idTerminalWeb  INT,
    @idUsuarioAlta  INT,
    @observacion    VARCHAR(200) = NULL,
    @detalle        dbo.tipoDetalleCobroCredito READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @verrmsg VARCHAR(400), @idSucursal INT, @nroCaja INT, @idMovimientoCaja INT,
            @total MONEY, @nroRecibo INT, @idCobroCredito INT;

    SELECT @idSucursal = idSucursal, @nroCaja = nroCaja
    FROM dbo.TerminalWeb WHERE idTerminalWeb = @idTerminalWeb AND activo = 1;

    SELECT @idMovimientoCaja = MAX(idMovimientoCaja)
    FROM dbo.movimientoCaja WHERE nroCaja = @nroCaja AND estado = 'ABIERTA';

    SELECT @total = SUM(monto) FROM @detalle;

    IF @idSucursal IS NULL
        SET @verrmsg = 'La terminal no está activa.';
    ELSE IF @idMovimientoCaja IS NULL
        SET @verrmsg = 'Debe abrir la caja antes de registrar un cobro.';
    ELSE IF NOT EXISTS (SELECT 1 FROM dbo.cliente WHERE idCliente = @idCliente)
        SET @verrmsg = 'El cliente no existe.';
    ELSE IF @total IS NULL
        SET @verrmsg = 'Seleccione al menos una cuota a cobrar.';
    ELSE IF EXISTS (SELECT 1 FROM @detalle WHERE monto <= 0)
        SET @verrmsg = 'Los montos a cobrar deben ser mayores a cero.';

    IF @verrmsg IS NOT NULL
    BEGIN
        RAISERROR(@verrmsg, 16, 1);
        RETURN -1;
    END

    BEGIN TRAN;

    -- Cuotas bloqueadas durante el cobro para que dos cajas no cobren el mismo saldo
    DECLARE @cuotas TABLE (idCuotaVenta INT PRIMARY KEY, saldo MONEY, idCliente INT, ventaActiva TINYINT, cuotaActiva BIT, nroFactura VARCHAR(15), nroCuota SMALLINT);

    INSERT INTO @cuotas
    SELECT cv.idCuotaVenta, cv.saldo, v.idCliente, v.activo, cv.activo,
           dbo.funObtenerFacturaFormateada(v.dsuc, v.dcaja, v.dfactu), cv.nroCuota
    FROM dbo.cuotaVenta cv WITH (UPDLOCK, HOLDLOCK)
    INNER JOIN dbo.venta v ON v.idVenta = cv.idVenta
    INNER JOIN @detalle d ON d.idCuotaVenta = cv.idCuotaVenta;

    IF (SELECT COUNT(*) FROM @cuotas) <> (SELECT COUNT(*) FROM @detalle)
        SET @verrmsg = 'Alguna de las cuotas seleccionadas no existe.';
    ELSE IF EXISTS (SELECT 1 FROM @cuotas WHERE idCliente <> @idCliente)
        SET @verrmsg = 'Alguna de las cuotas seleccionadas no pertenece al cliente.';
    ELSE IF EXISTS (SELECT 1 FROM @cuotas WHERE ventaActiva = 0 OR cuotaActiva = 0)
        SET @verrmsg = 'Alguna de las cuotas seleccionadas pertenece a una factura anulada.';
    ELSE
        SELECT TOP 1 @verrmsg = 'El monto a cobrar de la cuota ' + CAST(c.nroCuota AS VARCHAR(5)) + ' de la factura ' + c.nroFactura
                              + ' supera su saldo (' + dbo.funFormatoGs(c.saldo) + ').'
        FROM @cuotas c INNER JOIN @detalle d ON d.idCuotaVenta = c.idCuotaVenta
        WHERE d.monto > c.saldo;

    IF @verrmsg IS NOT NULL
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(@verrmsg, 16, 1);
        RETURN -1;
    END

    SELECT @nroRecibo = ISNULL(MAX(nroRecibo), 0) + 1
    FROM dbo.cabCobroCredito WITH (UPDLOCK, HOLDLOCK)
    WHERE idSucursal = @idSucursal;

    INSERT INTO dbo.cabCobroCredito (idSucursal, nroRecibo, idCliente, idMovimientoCaja, idTerminalWeb,
                                     fechaCobro, totalCobrado, observacion, activo, idUsuarioAlta, fechaAlta)
    VALUES (@idSucursal, @nroRecibo, @idCliente, @idMovimientoCaja, @idTerminalWeb,
            GETDATE(), @total, NULLIF(LTRIM(RTRIM(@observacion)), ''), 1, @idUsuarioAlta, GETDATE());

    SET @idCobroCredito = SCOPE_IDENTITY();

    INSERT INTO dbo.detCobroCredito (idCobroCredito, idCuotaVenta, monto)
    SELECT @idCobroCredito, idCuotaVenta, monto FROM @detalle;

    UPDATE cv SET cv.saldo = cv.saldo - d.monto
    FROM dbo.cuotaVenta cv INNER JOIN @detalle d ON d.idCuotaVenta = cv.idCuotaVenta;

    COMMIT TRAN;

    SELECT @idCobroCredito AS idCobroCredito, @nroRecibo AS nroRecibo, @total AS totalCobrado;
END
GO

IF OBJECT_ID('dbo.sp_anularCobroCredito') IS NOT NULL DROP PROCEDURE dbo.sp_anularCobroCredito
GO
/*
  Anula un recibo y devuelve los saldos a las cuotas. Solo mientras la caja donde se cobró siga abierta,
  para no descuadrar un arqueo ya cerrado.
*/
CREATE PROCEDURE dbo.sp_anularCobroCredito
    @idCobroCredito INT,
    @idUsuario      INT,
    @motivo         VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @verrmsg VARCHAR(255), @activo BIT, @estadoCaja VARCHAR(15), @idTerminalWeb INT, @idSucursal INT;

    SELECT @activo = c.activo, @estadoCaja = mc.estado, @idTerminalWeb = c.idTerminalWeb, @idSucursal = c.idSucursal
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.movimientoCaja mc ON mc.idMovimientoCaja = c.idMovimientoCaja
    WHERE c.idCobroCredito = @idCobroCredito;

    IF @activo IS NULL
        SET @verrmsg = 'El recibo no existe.';
    ELSE IF @activo = 0
        SET @verrmsg = 'El recibo ya está anulado.';
    ELSE IF @estadoCaja <> 'ABIERTA'
        SET @verrmsg = 'No se puede anular: la caja donde se registró el cobro ya está cerrada.';
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

IF OBJECT_ID('dbo.sp_listarCobrosCredito') IS NOT NULL DROP PROCEDURE dbo.sp_listarCobrosCredito
GO
CREATE PROCEDURE dbo.sp_listarCobrosCredito
    @idCliente        INT = NULL,
    @idMovimientoCaja INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 200
        c.idCobroCredito,
        c.nroRecibo,
        c.fechaCobro,
        c.idCliente,
        p.nombre AS nombreCliente,
        c.totalCobrado,
        c.activo,
        c.idMovimientoCaja,
        mc.estado AS estadoCaja,
        dbo.funObtenerNombrePorUsuario(c.idUsuarioAlta) AS usuario
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.cliente cl ON cl.idCliente = c.idCliente
    INNER JOIN dbo.persona p ON p.idPersona = cl.idPersona
    INNER JOIN dbo.movimientoCaja mc ON mc.idMovimientoCaja = c.idMovimientoCaja
    WHERE (@idCliente IS NULL OR c.idCliente = @idCliente)
      AND (@idMovimientoCaja IS NULL OR c.idMovimientoCaja = @idMovimientoCaja)
    ORDER BY c.idCobroCredito DESC;
END
GO

IF OBJECT_ID('dbo.sp_reporteReciboCobro') IS NOT NULL DROP PROCEDURE dbo.sp_reporteReciboCobro
GO
CREATE PROCEDURE dbo.sp_reporteReciboCobro
    @idCobroCredito INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Cabecera
    SELECT
        pj.nombreFantasia,
        pe.ruc + CASE WHEN ISNULL(pe.dv, '') <> '' THEN '-' + pe.dv ELSE '' END AS ruc,
        s.nombreSucursal,
        c.nroRecibo,
        c.fechaCobro,
        pc.nombre AS cliente,
        pc.ruc + CASE WHEN ISNULL(pc.dv, '') <> '' THEN '-' + pc.dv ELSE '' END AS rucCliente,
        c.totalCobrado,
        dbo.funNumeroLetras(c.totalCobrado) AS totalLetra,
        c.observacion,
        c.activo,
        dbo.funObtenerNombrePorUsuario(c.idUsuarioAlta) AS cajero,
        ISNULL((SELECT deuda FROM dbo.v_creditoCliente WHERE idCliente = c.idCliente), 0) AS saldoPendiente
    FROM dbo.cabCobroCredito c
    INNER JOIN dbo.sucursal s ON s.idSucursal = c.idSucursal
    INNER JOIN dbo.personaJur pj ON pj.idPersonaJur = s.idPersonaJur
    INNER JOIN dbo.persona pe ON pe.idPersona = pj.idPersona
    INNER JOIN dbo.cliente cl ON cl.idCliente = c.idCliente
    INNER JOIN dbo.persona pc ON pc.idPersona = cl.idPersona
    WHERE c.idCobroCredito = @idCobroCredito;

    -- Detalle: a qué cuotas se aplicó
    SELECT
        dbo.funObtenerFacturaFormateada(v.dsuc, v.dcaja, v.dfactu) AS nroFactura,
        cv.nroCuota,
        cv.cantidadCuotas,
        cv.fechaVencimiento,
        d.monto,
        cv.saldo AS saldoCuota
    FROM dbo.detCobroCredito d
    INNER JOIN dbo.cuotaVenta cv ON cv.idCuotaVenta = d.idCuotaVenta
    INNER JOIN dbo.venta v ON v.idVenta = cv.idVenta
    WHERE d.idCobroCredito = @idCobroCredito
    ORDER BY cv.fechaVencimiento, cv.nroCuota;
END
GO
