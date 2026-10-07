import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

/**
 * Lista los timbrados (puntos de expedición) con su estado.
 * Query: soloActivos=1 para usarlo en combos (ej: asignar timbrado a una terminal);
 * idTipoComprobante (1 = factura, 2 = nota de crédito) para filtrar por tipo.
 */
export const listarTimbrados = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'sp_listarTimbrados',
      isStoredProcedure: true,
      inputs: [
        { name: 'soloActivos', type: sql.Bit, value: req.query.soloActivos === '1' },
        { name: 'idTipoComprobante', type: sql.Int, value: Number(req.query.idTipoComprobante) || null },
      ],
    });
    res.status(200).json({ success: true, timbrados: result.recordset });
  } catch (error: any) {
    sendError(res, error, 'Error al listar los timbrados');
  }
};

/**
 * Estado del talonario de una terminal (vigencia, rango y alertas).
 * Query: idTipoComprobante = 1 (factura, por defecto) o 2 (nota de crédito).
 */
export const estadoTimbrado = async (req: Request, res: Response): Promise<void> => {
  const idTerminalWeb = Number(req.query.idTerminalWeb);
  if (!Number.isInteger(idTerminalWeb) || idTerminalWeb <= 0) {
    res.status(400).json({ success: false, message: "El parámetro 'idTerminalWeb' es obligatorio" });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_estadoTimbrado',
      isStoredProcedure: true,
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
        { name: 'idTipoComprobante', type: sql.Int, value: Number(req.query.idTipoComprobante) === 2 ? 2 : 1 },
      ],
    });
    res.status(200).json({ success: true, estado: result.recordset[0] });
  } catch (error: any) {
    sendError(res, error, 'Error al consultar el estado del timbrado');
  }
};

/**
 * Alta (idFactura = 0) o modificación de un timbrado. Las validaciones están en sp_guardarTimbrado.
 */
export const guardarTimbrado = async (req: Request, res: Response): Promise<void> => {
  const {
    idFactura = 0, idSucursal, dsuc, dcaja, timbrado, fechaInicio, fechaCaduca,
    nroDesde, nroHasta, proximoNumero, preImpreso = false, activo = true, idTipoComprobante = 1,
  } = req.body;

  if (!idSucursal || !dsuc || !dcaja || !timbrado || !fechaInicio || !fechaCaduca || !nroDesde || !proximoNumero) {
    res.status(400).json({ success: false, message: 'Complete todos los datos obligatorios del timbrado' });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_guardarTimbrado',
      isStoredProcedure: true,
      inputs: [
        { name: 'idFactura', type: sql.Int, value: Number(idFactura) || 0 },
        { name: 'idSucursal', type: sql.Int, value: Number(idSucursal) },
        { name: 'dsuc', type: sql.VarChar(3), value: String(dsuc) },
        { name: 'dcaja', type: sql.VarChar(3), value: String(dcaja) },
        { name: 'timbrado', type: sql.VarChar(20), value: String(timbrado) },
        { name: 'fechaInicio', type: sql.Date, value: fechaInicio },
        { name: 'fechaCaduca', type: sql.Date, value: fechaCaduca },
        { name: 'nroDesde', type: sql.Numeric(7, 0), value: Number(nroDesde) },
        { name: 'nroHasta', type: sql.Numeric(7, 0), value: nroHasta === '' || nroHasta == null ? null : Number(nroHasta) },
        { name: 'proximoNumero', type: sql.Numeric(7, 0), value: Number(proximoNumero) },
        { name: 'preImpreso', type: sql.Bit, value: Boolean(preImpreso) },
        { name: 'activo', type: sql.Bit, value: Boolean(activo) },
        { name: 'idUsuario', type: sql.Int, value: getUserId(req) },
        { name: 'idTipoComprobante', type: sql.Int, value: Number(idTipoComprobante) || 1 },
      ],
    });
    res.status(200).json({ success: true, message: 'Timbrado guardado correctamente', idFactura: result.recordset[0]?.idFactura });
  } catch (error: any) {
    sendError(res, error, 'Error al guardar el timbrado');
  }
};
