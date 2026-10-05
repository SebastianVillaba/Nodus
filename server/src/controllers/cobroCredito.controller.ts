import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

const enteroPositivo = (valor: unknown): number | null => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Cuotas con saldo pendiente de un cliente, más antiguas primero.
 */
export const consultarCuotasPendientes = async (req: Request, res: Response): Promise<void> => {
  const idCliente = enteroPositivo(req.query.idCliente);
  if (!idCliente) {
    res.status(400).json({ success: false, message: "El parámetro 'idCliente' es obligatorio" });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_consultaCuotasPendientes',
      isStoredProcedure: true,
      inputs: [{ name: 'idCliente', type: sql.Int, value: idCliente }],
    });
    res.status(200).json({ success: true, cuotas: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al consultar las cuotas pendientes');
  }
};

/**
 * Registra un recibo de cobro.
 * Body: { idCliente, idTerminalWeb, observacion?, detalle: [{ idCuotaVenta, monto }] }
 */
export const guardarCobroCredito = async (req: Request, res: Response): Promise<void> => {
  const { idCliente, idTerminalWeb, observacion, detalle } = req.body;

  if (!enteroPositivo(idCliente) || !enteroPositivo(idTerminalWeb)) {
    res.status(400).json({ success: false, message: 'Faltan el cliente o la terminal' });
    return;
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    res.status(400).json({ success: false, message: 'Seleccione al menos una cuota a cobrar' });
    return;
  }

  // Detalle como parámetro tabla (dbo.tipoDetalleCobroCredito): el SP aplica todo en una transacción
  const tvp = new sql.Table('dbo.tipoDetalleCobroCredito');
  tvp.columns.add('idCuotaVenta', sql.Int, { nullable: false });
  tvp.columns.add('monto', sql.Money, { nullable: false });
  for (const item of detalle) {
    const idCuotaVenta = enteroPositivo(item?.idCuotaVenta);
    const monto = Number(item?.monto);
    if (!idCuotaVenta || !Number.isFinite(monto)) {
      res.status(400).json({ success: false, message: 'El detalle del cobro tiene datos inválidos' });
      return;
    }
    tvp.rows.add(idCuotaVenta, monto);
  }

  try {
    const result = await executeRequest({
      query: 'sp_guardarCobroCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'idCliente', type: sql.Int, value: Number(idCliente) },
        { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
        { name: 'idUsuarioAlta', type: sql.Int, value: getUserId(req) },
        { name: 'observacion', type: sql.VarChar(200), value: observacion || null },
        { name: 'detalle', type: sql.TVP('tipoDetalleCobroCredito') as any, value: tvp },
      ],
    });
    res.status(201).json({ success: true, message: 'Cobro registrado correctamente', ...result.recordset[0] });
  } catch (error) {
    sendError(res, error, 'Error al registrar el cobro');
  }
};

/**
 * Lista recibos (hasta 500), filtrando por cliente, movimiento de caja, número de recibo o rango de fechas.
 */
export const listarCobrosCredito = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'sp_listarCobrosCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'idCliente', type: sql.Int, value: enteroPositivo(req.query.idCliente) },
        { name: 'idMovimientoCaja', type: sql.Int, value: enteroPositivo(req.query.idMovimientoCaja) },
        { name: 'nroRecibo', type: sql.Int, value: enteroPositivo(req.query.nroRecibo) },
        { name: 'desde', type: sql.Date, value: req.query.desde || null },
        { name: 'hasta', type: sql.Date, value: req.query.hasta || null },
      ],
    });
    res.status(200).json({ success: true, cobros: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al listar los cobros');
  }
};

/**
 * Datos del recibo para imprimir el ticket.
 */
export const reporteReciboCobro = async (req: Request, res: Response): Promise<void> => {
  const idCobroCredito = enteroPositivo(req.params.idCobroCredito);
  if (!idCobroCredito) {
    res.status(400).json({ success: false, message: 'Recibo inválido' });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_reporteReciboCobro',
      isStoredProcedure: true,
      inputs: [{ name: 'idCobroCredito', type: sql.Int, value: idCobroCredito }],
    });
    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    const cabecera = recordsets?.[0]?.[0];
    if (!cabecera) {
      res.status(404).json({ success: false, message: 'El recibo no existe' });
      return;
    }
    res.status(200).json({ success: true, cabecera, detalle: recordsets?.[1] ?? [] });
  } catch (error) {
    sendError(res, error, 'Error al obtener el recibo');
  }
};
