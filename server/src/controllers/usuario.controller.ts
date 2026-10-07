import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { CrearUsuarioRequest, ModificarUsuarioRequest } from '../types/usuario.type';
import bcrypt from 'bcryptjs';
import { validarCredenciales } from './auth.controller';

export const crearUsuario = async (req: Request, res: Response) => {
    const { 
        idPersonal, 
        username, 
        password, 
        idRol, 
        idUsuarioAlta,
        anularCompra,
        anularVenta,
        anularRemision,
        anularRecepcion,
        anularAjuste,
        anularCargaProducto,
        anularCobro,
        anularNotaCredito
    } = req.body as CrearUsuarioRequest;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await executeRequest({
            isStoredProcedure: true,
            query: 'sp_crearUsuario',
            inputs: [
                { name: 'idPersonal', type: sql.Int, value: idPersonal },
                { name: 'username', type: sql.VarChar(50), value: username },
                { name: 'password', type: sql.VarChar(255), value: hashedPassword },
                { name: 'idRol', type: sql.Int, value: idRol },
                { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta },
                { name: 'anularCompra', type: sql.Bit, value: !!anularCompra },
                { name: 'anularVenta', type: sql.Bit, value: !!anularVenta },
                { name: 'anularRemision', type: sql.Bit, value: !!anularRemision },
                { name: 'anularRecepcion', type: sql.Bit, value: !!anularRecepcion },
                { name: 'anularAjuste', type: sql.Bit, value: !!anularAjuste },
                { name: 'anularCargaProducto', type: sql.Bit, value: !!anularCargaProducto },
                { name: 'anularCobro', type: sql.Bit, value: !!anularCobro },
                { name: 'anularNotaCredito', type: sql.Bit, value: !!anularNotaCredito }
            ]
        });

        res.json({ success: true, message: 'Usuario creado exitosamente' });
    } catch (error: any) {
        sendError(res, error, 'Error al crear usuario');
    }
};

export const modificarUsuario = async (req: Request, res: Response) => {
    const { 
        idUsuario, 
        username, 
        password, 
        idRol, 
        activo,
        anularCompra,
        anularVenta,
        anularRemision,
        anularRecepcion,
        anularAjuste,
        anularCargaProducto,
        anularCobro,
        anularNotaCredito
    } = req.body as ModificarUsuarioRequest;

    try {
        let hashedPassword = null;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        await executeRequest({
            isStoredProcedure: true,
            query: 'sp_modificarUsuario',
            inputs: [
                { name: 'idUsuario', type: sql.Int, value: idUsuario },
                { name: 'username', type: sql.VarChar(50), value: username },
                { name: 'password', type: sql.VarChar(255), value: hashedPassword },
                { name: 'idRol', type: sql.Int, value: idRol },
                { name: 'activo', type: sql.TinyInt, value: activo },
                { name: 'anularCompra', type: sql.Bit, value: !!anularCompra },
                { name: 'anularVenta', type: sql.Bit, value: !!anularVenta },
                { name: 'anularRemision', type: sql.Bit, value: !!anularRemision },
                { name: 'anularRecepcion', type: sql.Bit, value: !!anularRecepcion },
                { name: 'anularAjuste', type: sql.Bit, value: !!anularAjuste },
                { name: 'anularCargaProducto', type: sql.Bit, value: !!anularCargaProducto },
                { name: 'anularCobro', type: sql.Bit, value: !!anularCobro },
                { name: 'anularNotaCredito', type: sql.Bit, value: !!anularNotaCredito }
            ]
        });

        res.json({ success: true, message: 'Usuario modificado exitosamente' });
    } catch (error: any) {
        sendError(res, error, 'Error al modificar usuario');
    }
};

export const buscarUsuario = async (req: Request, res: Response) => {
    const { busqueda } = req.query;

    try {
        const result = await executeRequest({
            isStoredProcedure: true,
            query: 'sp_buscarUsuario',
            inputs: [
                { name: 'busqueda', type: sql.VarChar(50), value: busqueda || '' }
            ]
        });

        res.json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al buscar usuarios');
    }
};

export const obtenerUsuario = async (req: Request, res: Response) => {
    const { idUsuario } = req.params;

    try {
        const result = await executeRequest({
            isStoredProcedure: true,
            query: 'sp_consultaInformacionUsuario',
            inputs: [
                { name: 'idUsuario', type: sql.Int, value: idUsuario }
            ]
        });

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (error: any) {
        sendError(res, error, 'Error al obtener usuario');
    }
};

export const buscarPersonaParaUsuario = async (req: Request, res: Response) => {
    const { busqueda } = req.query;

    try {
        const result = await executeRequest({
            isStoredProcedure: true,
            query: 'sp_buscarPersonaParaUsuario',
            inputs: [
                { name: 'busqueda', type: sql.VarChar(50), value: busqueda || '' }
            ]
        });

        res.json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al buscar persona para usuario');
    }
};

export const validarVendedor = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        res.status(400).json({ success: false, message: 'El usuario y la contraseña son obligatorios' });
        return;
    }

    try {
        const matchedUser = await validarCredenciales(username, password);

        if (!matchedUser) {
            res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
            return;
        }

        // Execute stored procedure to verify if they are a valid seller
        const spResult = await executeRequest({
            isStoredProcedure: true,
            query: 'sp_vendedorUsuario',
            inputs: [
                { name: 'idUsuario', type: sql.Int, value: matchedUser.idUsuario }
            ]
        });

        if (spResult.recordset && spResult.recordset.length > 0) {
            res.status(200).json({
                success: true,
                result: {
                    idVendedor: spResult.recordset[0].idVendedor,
                    nombre: spResult.recordset[0].vendedor
                }
            });
        } else {
            res.status(403).json({
                success: false,
                message: 'Usted no está habilitado/a como Vendedor/a en el Sistema..'
            });
        }

    } catch (error: any) {
        sendError(res, error, 'Error al validar vendedor');
    }
};

/**
 * Controller para obtener la lista de personales creados que no tienen usuario.
 */
export const obtenerPersonalesSinUsuario = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await executeRequest({
            query: `
                SELECT 
                    per.idPersonal,
                    p.idPersona,
                    p.nombre AS nombreCompleto,
                    ISNULL(p.ruc, 'S/RUC') AS ruc,
                    p.email
                FROM dbo.personal per
                INNER JOIN dbo.personaFis pf ON per.idPersonaFis = pf.idPersonaFis
                INNER JOIN dbo.persona p ON pf.idPersona = p.idPersona
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.v_usuario u WHERE u.idPersona = p.idPersona
                ) AND per.activo = 1
                ORDER BY p.nombre;
            `,
            isStoredProcedure: false
        });

        res.json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al obtener personales sin usuario');
    }
};

