/*
  006 - Permiso por usuario para anular recibos de cobro de créditos
    - usuario.anularCobro (bit). Los usuarios existentes lo heredan de anularVenta, que era el permiso
      que se usaba hasta ahora para anular cobros (migración 005).
    - sp_permisoAnular: tipo 'COBRO' usa anularCobro.
    - sp_crearUsuario / sp_modificarUsuario / sp_consultaInformacionUsuario: manejan anularCobro.
  Cada anulación de cobro queda registrada en cabAnulado con tipo 'COBRO' (motivo, usuario y fecha).
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.usuario', 'anularCobro') IS NULL
BEGIN
    ALTER TABLE dbo.usuario ADD anularCobro BIT NOT NULL CONSTRAINT DF_usuario_anularCobro DEFAULT (0);
    EXEC('UPDATE dbo.usuario SET anularCobro = ISNULL(anularVenta, 0)');
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
        WHEN @tipo = 'COBRO'     THEN anularCobro -- migración 006
        ELSE 0
    END AS tienePermiso
    FROM usuario
    WHERE idUsuario = @idUsuario AND activo = 1;
END
GO

IF OBJECT_ID('dbo.sp_crearUsuario') IS NOT NULL DROP PROCEDURE dbo.sp_crearUsuario
GO
CREATE PROCEDURE [dbo].[sp_crearUsuario]
    @idPersonal				INT,
    @username				VARCHAR(50),
    @password				VARCHAR(255), -- Asumo que el Frontend ya la envía hasheada (MD5/SHA) o la guardas plana
    @idRol					INT,
    @idUsuarioAlta			INT, -- Quien crea al usuario (para auditoría futura si agregas campo),
    @anularCompra			int,
    @anularVenta			int,
    @anularRemision			int,
    @anularRecepcion		int,
	@anularAjuste			int,
	@anularCargaProducto	int,
	@anularCobro			int = 0 -- migración 006: anular recibos de cobro de créditos
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @verrno INT, @verrmsg VARCHAR(255);
    DECLARE @idUsuario INT;

    BEGIN TRAN

        -- 1. Validar que el personal exista
        IF NOT EXISTS(SELECT 1 FROM dbo.personal WHERE idPersonal = @idPersonal)
        BEGIN
            SELECT @verrno=50001, @verrmsg='Error: El personal indicado no existe. Primero debe crearla.'; GOTO error;
        END

        -- 2. Validar que el nombre de usuario no esté ocupado
        IF EXISTS(SELECT 1 FROM dbo.usuario WHERE username = @username)
        BEGIN
            SELECT @verrno=50002, @verrmsg='Error: El nombre de usuario (username) ya está en uso.'; GOTO error;
        END

        -- 3. Validar Rol
        IF NOT EXISTS(SELECT 1 FROM dbo.rol WHERE idRol = @idRol)
        BEGIN
            SELECT @verrno=50003, @verrmsg='Error: El Rol seleccionado no existe.'; GOTO error;
        END

        -- 4. Generar ID (MAX + 1)
        -- Usamos TABLOCKX para evitar condiciones de carrera si dos admins crean usuarios a la vez
        SELECT @idUsuario = ISNULL(MAX(idUsuario) + 1, 1) FROM dbo.usuario WITH (TABLOCKX);

        -- 5. Insertar
        INSERT INTO dbo.usuario (
            idUsuario, idPersonal, username, password, activo, fechaAlta, idRol,anularCompra,anularVenta,anularRecepcion,anularRemision,anularAjuste,anularCargaProducto,anularCobro
        )
        VALUES (
            @idUsuario, @idPersonal, @username, @password, 1, GETDATE(), @idRol,@anularCompra,@anularVenta,@anularRecepcion,@anularRemision,@anularAjuste,@anularCargaProducto,@anularCobro
        );

        SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;

    COMMIT TRAN

    RETURN 1;

    error:
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        RAISERROR(@verrmsg, 16, 1);
        RETURN -1;
END
GO

IF OBJECT_ID('dbo.sp_modificarUsuario') IS NOT NULL DROP PROCEDURE dbo.sp_modificarUsuario
GO
CREATE PROCEDURE [dbo].[sp_modificarUsuario]
            @idUsuario      INT,
            @username       VARCHAR(50),
            @password       VARCHAR(255) = NULL,
            @idRol          INT,
            @activo         TINYINT,
            @anularCompra   INT,
            @anularVenta    INT,
            @anularRemision INT,
            @anularRecepcion INT,
            @anularAjuste   INT,
            @anularCargaProducto INT,
            @anularCobro    INT = NULL -- migración 006; NULL = no cambiar
        AS
        BEGIN
            SET NOCOUNT ON;
            DECLARE @verrno INT, @verrmsg VARCHAR(255);

            BEGIN TRAN

                -- 1. Validar duplicado de Username (Excluyendo al propio usuario)
                IF EXISTS(SELECT 1 FROM dbo.usuario WHERE username = @username AND idUsuario <> @idUsuario)
                BEGIN
                    SELECT @verrno=50001, @verrmsg='Error: El nombre de usuario ya está en uso por otra persona.'; GOTO error;
                END

                -- 2. Validar Rol
                IF NOT EXISTS(SELECT 1 FROM dbo.rol WHERE idRol = @idRol)
                BEGIN
                    SELECT @verrno=50002, @verrmsg='Error: El Rol seleccionado no existe.'; GOTO error;
                END

                -- 3. Update
                UPDATE dbo.usuario
                SET
                    username = @username,
                    password = CASE WHEN @password IS NOT NULL AND @password <> '' THEN @password ELSE password END,
                    idRol = @idRol,
                    activo = @activo,
                    anularCompra = @anularCompra,
                    anularVenta = @anularVenta,
                    anularRemision = @anularRemision,
                    anularRecepcion = @anularRecepcion,
                    anularAjuste = @anularAjuste,
                    anularCargaProducto = @anularCargaProducto,
                    anularCobro = ISNULL(@anularCobro, anularCobro)
                WHERE idUsuario = @idUsuario;

                SET @verrno = @@ERROR; IF (@verrno <> 0) GOTO error;

            COMMIT TRAN
            RETURN 1;

            error:
                IF @@TRANCOUNT > 0 ROLLBACK TRAN;
                RAISERROR(@verrmsg, 16, 1);
                RETURN -1;
        END;
GO

IF OBJECT_ID('dbo.sp_consultaInformacionUsuario') IS NOT NULL DROP PROCEDURE dbo.sp_consultaInformacionUsuario
GO
CREATE PROCEDURE [dbo].[sp_consultaInformacionUsuario]
            @idUsuario INT
        AS
        BEGIN
            SET NOCOUNT ON;

            SELECT
                u.idUsuario,
                u.username,
                '********' AS password,
                u.idRol,
                r.nombreRol,
                u.activo,
                p.idPersona,
                p.nombre AS nombrePersona,
                p.ruc,
                u.anularCompra,
                u.anularVenta,
                u.anularRemision,
                u.anularRecepcion,
                u.anularAjuste,
                u.anularCargaProducto,
                u.anularCobro
            FROM dbo.usuario u
            INNER JOIN personal per on per.idPersonal=u.idPersonal
            INNER JOIN dbo.personaFis pf ON per.idPersonaFis = pf.idPersonaFis
            INNER JOIN dbo.persona p ON pf.idPersona = p.idPersona
            LEFT JOIN dbo.rol r ON u.idRol = r.idRol
            WHERE u.idUsuario = @idUsuario;
        END;
GO
