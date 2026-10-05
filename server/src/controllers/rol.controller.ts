import { Request, Response } from "express";
import { executeRequest, sql } from "../utils/dbHandler";
import { sendError } from '../utils/errorResponse';
import { GuardarPermisosRequest, ValidarPermisoRequest } from "../types/rol.type";
import { getUserId } from "../Middlewares/auth.middleware";
import { obtenerPermisosUsuario, limpiarCachePermisos } from "../Middlewares/permisos.middleware";

/**
 * Obtiene la configuración de permisos para un rol.
 */
export const obtenerConfiguracionRol = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idRol } = req.params;

        const inputs = [
            { name: 'idRol', type: sql.Int, value: parseInt(idRol) }
        ];

        const result = await executeRequest({
            query: 'sp_obtenerConfiguracionRol',
            inputs: inputs as any,
            isStoredProcedure: true
        });

        res.status(200).json({
            success: true,
            result: result.recordset
        });
    } catch (error: any) {
        sendError(res, error, 'Error al obtener la configuración del rol');
    }
};

/**
 * Guarda la configuración de permisos para un rol.
 * Primero limpia los permisos existentes y luego inserta los nuevos.
 */
export const guardarConfiguracionRol = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idRol, permisos } = req.body as GuardarPermisosRequest;

        if (!idRol) {
            res.status(400).json({ success: false, message: "El idRol es obligatorio" });
            return;
        }

        // 1. Limpiar permisos existentes
        await executeRequest({
            query: 'sp_limpiarPermisosRol',
            inputs: [{ name: 'idRol', type: sql.Int, value: idRol }] as any,
            isStoredProcedure: true
        });

        // 2. Insertar nuevos permisos
        if (permisos && permisos.length > 0) {
            for (const idPermiso of permisos) {
                await executeRequest({
                    query: 'sp_agregarPermisoRol',
                    inputs: [
                        { name: 'idRol', type: sql.Int, value: idRol },
                        { name: 'idPermiso', type: sql.Int, value: idPermiso }
                    ] as any,
                    isStoredProcedure: true
                });
            }
        }

        limpiarCachePermisos();

        res.status(200).json({
            success: true,
            message: "Configuración de rol guardada exitosamente"
        });

    } catch (error: any) {
        sendError(res, error, 'Error al guardar la configuración del rol');
    }
};

/**
 * Valida si un usuario tiene permiso para una acción específica.
 */
export const validarPermiso = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idUsuario, nombreSistema } = req.body as ValidarPermisoRequest;

        const inputs = [
            { name: 'idUsuario', type: sql.Int, value: idUsuario },
            { name: 'nombreSistema', type: sql.VarChar(50), value: nombreSistema }
        ];

        const result = await executeRequest({
            query: 'sp_validarPermiso',
            inputs: inputs as any,
            isStoredProcedure: true
        });

        const tienePermiso = result.recordset[0]?.accesoPermitido === 1;

        res.status(200).json({
            success: true,
            tienePermiso
        });

    } catch (error: any) {
        sendError(res, error, 'Error al validar permiso');
    }
};

export const obtenerRoles = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await executeRequest({
            query: 'select idRol,nombreRol from rol where activo=1',
            isStoredProcedure: false
        });

        res.status(200).json({
            success: true,
            result: result.recordset
        });
    } catch (error: any) {
        sendError(res, error, 'Error al obtener roles');
    }
};

/**
 * Devuelve los permisos (nombreSistema) del usuario logueado.
 * El cliente lo usa para armar el menú y proteger las pantallas.
 */
export const obtenerMisPermisos = async (req: Request, res: Response): Promise<void> => {
    try {
        const permisos = await obtenerPermisosUsuario(getUserId(req));
        res.status(200).json({ success: true, permisos: [...permisos] });
    } catch (error: any) {
        sendError(res, error, 'Error al obtener los permisos del usuario');
    }
};
