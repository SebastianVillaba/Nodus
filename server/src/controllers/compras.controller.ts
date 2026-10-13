import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

// Interfaces
export interface IAgregarDetalleDTO {
    idTerminalWeb: number;
    idProveedor: number;
    idProducto: number;
    idDeposito: number;
    cantidad: number;
    bonificacion: number;
    costoTotal: number;
    porcentajeDescuento: number;
    notacredito: boolean;
    precio: number;
}

export interface IGuardarCompraDTO {
    idTerminalWeb: number;
    idSucursal: number;
    idPersonaJur: number;
    idProveedor: number;
    idTipoCompra: number;
    dsuc: string;
    dcaja: string;
    dfactu: string;
    timbrado: string;
    responsable: string;
    fecha: string;
    cotizacion: number;
    vence: string;
    total: number;
    habilitarCompra: boolean;
    idUsuarioAlta: number;
}

// Helper function to format date from YYYY-MM-DD to DD/MM/YYYY
const formatDateToDDMMYYYY = (dateString: string): string => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Controller Methods

export const agregarDetalleCompra = async (req: Request, res: Response) => {
    const {
        idTerminalWeb,
        idProveedor,
        idProducto,
        idDeposito,
        cantidad,
        bonificacion,
        costoTotal,
        porcentajeDescuento,
        notacredito,
        precio
    }: IAgregarDetalleDTO = req.body;

    try {
        await executeRequest({
            query: 'sp_agregarDetCompraTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
                { name: 'idProveedor', type: sql.Int, value: idProveedor },
                { name: 'idProducto', type: sql.Int, value: idProducto },
                { name: 'idDeposito', type: sql.Int, value: idDeposito },
                { name: 'cantidad', type: sql.Numeric(18, 2), value: cantidad },
                { name: 'bonificacion', type: sql.Numeric(18, 2), value: bonificacion },
                { name: 'costoTotal', type: sql.Money, value: costoTotal },
                { name: 'porcentajeDescuento', type: sql.Numeric(18, 2), value: porcentajeDescuento },
                { name: 'notacredito', type: sql.Bit, value: notacredito },
                { name: 'precio', type: sql.Money, value: precio }
            ]
        });
        res.status(200).json({ message: 'Detalle de compra agregado correctamente.' });
    } catch (error: any) {
        sendError(res, error, 'Error al agregar detalle de compra');
    }
};

export const consultarDetalleTemporal = async (req: Request, res: Response) => {
    const { idTerminalWeb } = req.query;

    try {
        const result = await executeRequest({
            query: 'sp_consultaDetCompraTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) }
            ]
        });
        res.status(200).json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al consultar detalle temporal');
    }
};

export const eliminarItemTemporal = async (req: Request, res: Response) => {
    const { idTerminalWeb, idDetCompraTmp } = req.query; // Nota: idDetPedidoTmp se mantiene como nombre de param si el front lo manda así, pero el SP es el nuevo

    try {
        await executeRequest({
            query: 'sp_eliminarDetCompraTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
                { name: 'idDetCompraTmp', type: sql.Int, value: Number(idDetCompraTmp) }
            ]
        });
        res.status(200).json({ message: 'Item eliminado correctamente.' });
    } catch (error: any) {
        sendError(res, error, 'Error al eliminar item temporal');
    }
};

export const limpiarTemporal = async (req: Request, res: Response) => {
    const { idTerminalWeb } = req.query; // O body, dependiendo de cómo se llame. Usualmente DELETE usa query o params.

    try {
        await executeRequest({
            query: 'sp_limpiarDetCompraTmp',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) }
            ]
        });
        res.status(200).json({ message: 'Temporal limpiado correctamente.' });
    } catch (error: any) {
        sendError(res, error, 'Error al limpiar temporal');
    }
};

export const guardarCompra = async (req: Request, res: Response) => {
    const {
        idTerminalWeb,
        idSucursal,
        idPersonaJur,
        idProveedor,
        idTipoCompra,
        dsuc,
        dcaja,
        dfactu,
        timbrado,
        responsable,
        fecha,
        cotizacion,
        vence,
        total,
        habilitarCompra,
        idUsuarioAlta
    }: IGuardarCompraDTO = req.body;

    try {
        const result = await executeRequest({
            query: 'sp_guardarCompra',
            isStoredProcedure: true,
            inputs: [
                { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
                { name: 'idSucursal', type: sql.Int, value: idSucursal },
                { name: 'idPersonaJur', type: sql.Int, value: idPersonaJur },
                { name: 'idProveedor', type: sql.Int, value: idProveedor },
                { name: 'idTipoCompra', type: sql.Int, value: idTipoCompra },
                { name: 'dsuc', type: sql.VarChar(3), value: dsuc },
                { name: 'dcaja', type: sql.VarChar(3), value: dcaja },
                { name: 'dfactu', type: sql.VarChar(10), value: dfactu },
                { name: 'timbrado', type: sql.VarChar(20), value: timbrado },
                { name: 'responsable', type: sql.VarChar(40), value: responsable },
                { name: 'fecha', type: sql.VarChar(15), value: formatDateToDDMMYYYY(fecha) },
                { name: 'cotizacion', type: sql.Money, value: cotizacion },
                { name: 'vence', type: sql.VarChar(15), value: formatDateToDDMMYYYY(vence) },
                { name: 'total', type: sql.Money, value: total },
                { name: 'habilitarCompra', type: sql.Bit, value: habilitarCompra },
                { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta }
            ]
        });

        const compra = result.recordset?.[0];
        res.status(200).json({ message: 'Compra guardada correctamente.', idCompra: compra?.idCompra, noFiscal: compra?.noFiscal, data: result.recordset });
    } catch (error: any) {
        sendError(res, error, 'Error al guardar compra');
    }
};

export const buscarProducto = async (req: Request, res: Response) => {
    const { busqueda } = req.query;

    try {
        const result = await executeRequest({
            query: 'sp_consultaProductoCompra',
            isStoredProcedure: true,
            inputs: [
                { name: 'busqueda', type: sql.VarChar(20), value: String(busqueda) }
            ]
        });
        res.status(200).json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al buscar producto');
    }
};

export const buscarProveedor = async (req: Request, res: Response) => {
    const { busqueda } = req.query;

    try {
        const result = await executeRequest({
            query: 'select * from funProveedoresActivos (2)',
            isStoredProcedure: false,
        });
        res.status(200).json(result.recordset);
    } catch (error: any) {
        sendError(res, error, 'Error al buscar los proveedores');
    }
};

const enteroPositivo = (valor: unknown): number | null => {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const esVerdadero = (valor: unknown) => valor === true || valor === 1 || valor === '1' || valor === 'true';

/**
 * Consulta de compras (hasta 500). Query: desde, hasta, proveedor (nombre o RUC), dsuc, dcaja, dfactu, idCompra,
 * noFiscal (1 = no fiscales, 0 = fiscales, sin enviar = todas), soloActivas.
 */
export const listarCompras = async (req: Request, res: Response) => {
    const dfactu = enteroPositivo(req.query.dfactu);
    try {
        const result = await executeRequest({
            query: 'sp_listarCompras',
            isStoredProcedure: true,
            inputs: [
                { name: 'desde', type: sql.Date, value: req.query.desde || null },
                { name: 'hasta', type: sql.Date, value: req.query.hasta || null },
                { name: 'proveedor', type: sql.VarChar(60), value: String(req.query.proveedor ?? '').trim().slice(0, 60) || null },
                { name: 'dsuc', type: sql.Numeric(3, 0), value: dfactu ? enteroPositivo(req.query.dsuc) : null },
                { name: 'dcaja', type: sql.Numeric(3, 0), value: dfactu ? enteroPositivo(req.query.dcaja) : null },
                { name: 'dfactu', type: sql.Numeric(7, 0), value: dfactu },
                { name: 'idCompra', type: sql.Int, value: enteroPositivo(req.query.idCompra) },
                { name: 'noFiscal', type: sql.Bit, value: req.query.noFiscal === undefined || req.query.noFiscal === '' ? null : esVerdadero(req.query.noFiscal) },
                { name: 'soloActivas', type: sql.Bit, value: esVerdadero(req.query.soloActivas) },
            ]
        });
        res.status(200).json({ success: true, compras: result.recordset });
    } catch (error: any) {
        sendError(res, error, 'Error al listar las compras');
    }
};

/**
 * Una compra: cabecera, detalle (con lo devuelto al proveedor y el stock actual), disponible por IVA y notas de crédito.
 * Params: id. Query: noFiscal (1 = compra no fiscal).
 */
export const consultarCompra = async (req: Request, res: Response) => {
    const idCompra = enteroPositivo(req.params.id);
    if (!idCompra) {
        res.status(400).json({ success: false, message: 'Compra inválida' });
        return;
    }
    try {
        const result = await executeRequest({
            query: 'sp_consultaCompra',
            isStoredProcedure: true,
            inputs: [
                { name: 'idCompra', type: sql.Int, value: idCompra },
                { name: 'noFiscal', type: sql.Bit, value: esVerdadero(req.query.noFiscal) },
            ]
        });
        const recordsets = (result as { recordsets?: any[][] }).recordsets ?? [];
        const cabecera = recordsets[0]?.[0];
        if (!cabecera) {
            res.status(404).json({ success: false, message: 'No se encontró la compra' });
            return;
        }
        res.status(200).json({
            success: true,
            cabecera,
            detalle: recordsets[1] ?? [],
            impuestos: recordsets[2] ?? [],
            notas: recordsets[3] ?? [],
        });
    } catch (error: any) {
        sendError(res, error, 'Error al consultar la compra');
    }
};
