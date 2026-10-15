import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

/**
 * Carga las referencias de un producto existente en la tabla temporal.
 */
export const cargarReferenciasTmp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idTerminalWeb, idProductoRef } = req.body;

        if (!idTerminalWeb || !idProductoRef) {
            res.status(400).json({ success: false, message: 'Faltan datos obligatorios (idTerminalWeb, idProductoRef)' });
            return;
        }

        const result = await executeRequest({
            query: 'sp_cargarProductoRefTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
                { name: 'idProductoRef', type: sql.Int, value: Number(idProductoRef) }
            ]
        });

        // Configuración del combo: controlaStock = true si tiene stock propio (se arma por adelantado)
        const recordsets = (result as { recordsets?: any[][] }).recordsets ?? [];
        const combo = recordsets[0]?.[0];
        res.status(200).json({
            success: true,
            message: 'Referencias cargadas en la tabla temporal correctamente',
            controlaStock: !!combo?.controlaStock,
            esCombo: !!combo?.activo,
            detalle: recordsets[1] ?? [],
        });
    } catch (error: any) {
        sendError(res, error, 'Error al cargar referencias en la temporal');
    }
};

/**
 * Consulta el detalle temporal de productos referenciados para una terminal.
 */
export const obtenerDetallesTmp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idTerminalWeb } = req.query;

        if (!idTerminalWeb) {
            res.status(400).json({ success: false, message: 'El parámetro idTerminalWeb es obligatorio' });
            return;
        }

        const result = await executeRequest({
            query: 'sp_consultaDetProductoRefTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) }
            ]
        });

        res.status(200).json({
            success: true,
            result: result.recordset
        });
    } catch (error: any) {
        sendError(res, error, 'Error al consultar detalles de la temporal');
    }
};

/**
 * Agrega un producto referenciado al detalle temporal.
 */
export const agregarDetalleTmp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idTerminalWeb, idProducto, cantidad } = req.body;

        if (!idTerminalWeb || !idProducto || cantidad === undefined || Number(cantidad) <= 0) {
            res.status(400).json({ success: false, message: 'Todos los campos son obligatorios y cantidad debe ser mayor a 0' });
            return;
        }

        await executeRequest({
            query: 'sp_agregarDetProductoRefTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
                { name: 'idProducto', type: sql.Int, value: Number(idProducto) },
                { name: 'cantidad', type: sql.Numeric(10, 4), value: Number(cantidad) }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Producto agregado a referencias temporales'
        });
    } catch (error: any) {
        sendError(res, error, 'Error al agregar producto a la temporal');
    }
};

/**
 * Elimina un producto individual del detalle temporal por nro.
 */
export const eliminarDetalleTmp = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nro } = req.params;
        const { idTerminalWeb } = req.query;

        if (!nro || !idTerminalWeb) {
            res.status(400).json({ success: false, message: 'El nro y idTerminalWeb son obligatorios' });
            return;
        }

        await executeRequest({
            query: 'DELETE FROM dbo.detProductoRefTmp WHERE idTerminalWeb = @idTerminalWeb AND nro = @nro',
            isStoredProcedure: false,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
                { name: 'nro', type: sql.Int, value: Number(nro) }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Producto eliminado de referencias temporales'
        });
    } catch (error: any) {
        sendError(res, error, 'Error al eliminar producto de la temporal');
    }
};

/**
 * Guarda las referencias temporales a la tabla persistida.
 */
export const guardarReferencias = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idUsuarioAlta, idTerminalWeb, idProductoRef, controlaStock } = req.body;

        if (!idUsuarioAlta || !idTerminalWeb || !idProductoRef) {
            res.status(400).json({ success: false, message: 'Faltan datos requeridos (idUsuarioAlta, idTerminalWeb, idProductoRef)' });
            return;
        }

        const result = await executeRequest({
            query: 'sp_guardarProductoRef',
            isStoredProcedure: true,
            inputs: [
                { name: 'idUsuarioAlta', type: sql.Int, value: Number(idUsuarioAlta) },
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
                { name: 'idProductoRef', type: sql.Int, value: Number(idProductoRef) },
                { name: 'controlaStock', type: sql.Bit, value: controlaStock === true || controlaStock === 1 }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Productos referenciados guardados correctamente',
            result: result.recordset
        });
    } catch (error: any) {
        sendError(res, error, 'Error al guardar referencias en la base de datos');
    }
};

/**
 * Limpia la tabla temporal de productos referenciados para una terminal.
 */
export const limpiarTemporal = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idTerminalWeb } = req.body;

        if (!idTerminalWeb) {
            res.status(400).json({ success: false, message: 'El campo idTerminalWeb es obligatorio' });
            return;
        }

        await executeRequest({
            query: 'DELETE FROM dbo.detProductoRefTmp WHERE idTerminalWeb = @idTerminalWeb',
            isStoredProcedure: false,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Temporal de productos referenciados limpiada correctamente'
        });
    } catch (error: any) {
        sendError(res, error, 'Error al limpiar temporal');
    }
};

/**
 * Obtiene el costo y precio sugerido de un producto de referencia (combo)
 * sumando los costos y precios de sus componentes.
 */
export const obtenerSugeridosProductoRef = async (req: Request, res: Response): Promise<void> => {
    try {
        const { idProductoRef } = req.params;

        if (!idProductoRef) {
            res.status(400).json({ success: false, message: 'El idProductoRef es obligatorio' });
            return;
        }

        const result = await executeRequest({
            query: `
                SELECT 
                    ISNULL(SUM(d.cantidad * p.costo), 0) AS costoSugerido,
                    ISNULL(SUM(d.cantidad * p.precio), 0) AS precioSugerido,
                    COUNT(1) AS cantidadComponentes
                FROM dbo.cabProductoReferenciado c
                INNER JOIN dbo.detProductoReferenciado d ON d.idProductoReferenciado = c.idProductoReferenciado
                INNER JOIN dbo.producto p ON d.idProducto = p.idProducto
                WHERE c.idProducto = @idProductoRef AND c.activo = 1
            `,
            isStoredProcedure: false,
            inputs: [
                { name: 'idProductoRef', type: sql.Int, value: Number(idProductoRef) }
            ]
        });

        const record = result.recordset[0];
        const existe = record && record.cantidadComponentes > 0;

        res.status(200).json({
            success: true,
            existe,
            costoSugerido: existe ? record.costoSugerido : 0,
            precioSugerido: existe ? record.precioSugerido : 0
        });
    } catch (error: any) {
        sendError(res, error, 'Error al obtener costos sugeridos');
    }
};

