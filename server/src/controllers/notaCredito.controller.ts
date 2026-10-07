import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

const enteroPositivo = (valor: unknown): number | null => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const recordsetsDe = (result: unknown): any[][] => (result as { recordsets?: any[][] }).recordsets ?? [];

const esNoImp = (valor: unknown) => valor === true || valor === 1 || valor === '1' || valor === 'true';

/**
 * Búsqueda de ventas para emitir una nota de crédito (hasta 100).
 * Query: noImp (1 = ventas no impresas), y al menos uno de: dfactu (con dsuc y dcaja opcionales), cliente (nombre o RUC), idVenta.
 */
export const buscarVentas = async (req: Request, res: Response): Promise<void> => {
  const noImp = esNoImp(req.query.noImp);
  const dfactu = noImp ? null : enteroPositivo(req.query.dfactu);
  const cliente = String(req.query.cliente ?? '').trim().slice(0, 60) || null;
  const idVenta = enteroPositivo(req.query.idVenta);

  if (!dfactu && !cliente && !idVenta) {
    res.status(400).json({ success: false, message: 'Ingrese el número de factura, el cliente o el id de la venta' });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_buscarVentaNotaCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'noImp', type: sql.Bit, value: noImp },
        { name: 'dsuc', type: sql.Numeric(3, 0), value: dfactu ? enteroPositivo(req.query.dsuc) : null },
        { name: 'dcaja', type: sql.Numeric(3, 0), value: dfactu ? enteroPositivo(req.query.dcaja) : null },
        { name: 'dfactu', type: sql.Numeric(7, 0), value: dfactu },
        { name: 'cliente', type: sql.VarChar(60), value: cliente },
        { name: 'idVenta', type: sql.Int, value: idVenta },
      ],
    });
    res.status(200).json({ success: true, ventas: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al buscar las ventas');
  }
};

/**
 * Venta a la que se le va a emitir una nota de crédito: cabecera, artículos con lo ya devuelto,
 * disponible por tasa de IVA y notas ya emitidas.
 * Query: idVenta (+ noImp=1 si es una venta no impresa), o nroFactura con formato 001-001-0000123
 */
export const consultarFactura = async (req: Request, res: Response): Promise<void> => {
  const idVenta = enteroPositivo(req.query.idVenta);
  const noImp = idVenta ? esNoImp(req.query.noImp) : false;
  let dsuc: number | null = null, dcaja: number | null = null, dfactu: number | null = null;

  if (!idVenta) {
    const partes = String(req.query.nroFactura ?? '').trim().split('-').map((p) => Number(p));
    if (partes.length !== 3 || partes.some((p) => !Number.isInteger(p) || p <= 0)) {
      res.status(400).json({ success: false, message: 'Ingrese el número de factura completo (ej: 001-001-0000123)' });
      return;
    }
    [dsuc, dcaja, dfactu] = partes;
  }

  try {
    const result = await executeRequest({
      query: 'sp_consultaFacturaNotaCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'idVenta', type: sql.Int, value: idVenta },
        { name: 'dsuc', type: sql.Numeric(3, 0), value: dsuc },
        { name: 'dcaja', type: sql.Numeric(3, 0), value: dcaja },
        { name: 'dfactu', type: sql.Numeric(7, 0), value: dfactu },
        { name: 'noImp', type: sql.Bit, value: noImp },
      ],
    });
    const recordsets = recordsetsDe(result);
    const cabecera = recordsets[0]?.[0];
    if (!cabecera) {
      res.status(404).json({ success: false, message: 'No se encontró la venta' });
      return;
    }
    res.status(200).json({
      success: true,
      cabecera,
      detalle: recordsets[1] ?? [],
      impuestos: recordsets[2] ?? [],
      notas: recordsets[3] ?? [],
    });
  } catch (error) {
    sendError(res, error, 'Error al consultar la factura');
  }
};

/**
 * Nota de crédito por devolución de mercadería.
 * Body: { idVenta, idTerminalWeb, motivo, noImp?, detalle: [{ idDetVenta, cantidad }] }
 * noImp = true: devolución de una venta no impresa (cve); queda registrada sin número ni timbrado.
 */
export const guardarNotaCreditoDevolucion = async (req: Request, res: Response): Promise<void> => {
  const { idVenta, idTerminalWeb, motivo, detalle, noImp } = req.body;

  if (!enteroPositivo(idVenta) || !enteroPositivo(idTerminalWeb)) {
    res.status(400).json({ success: false, message: 'Faltan la venta o la terminal' });
    return;
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    res.status(400).json({ success: false, message: 'Indique al menos un artículo a devolver' });
    return;
  }

  const tvp = new sql.Table('dbo.tipoDetalleNotaCredito');
  tvp.columns.add('idDetVenta', sql.Int, { nullable: false });
  tvp.columns.add('cantidad', sql.Numeric(10, 4), { nullable: false });
  for (const item of detalle) {
    const idDetVenta = enteroPositivo(item?.idDetVenta);
    const cantidad = Number(item?.cantidad);
    if (!idDetVenta || !Number.isFinite(cantidad) || cantidad <= 0) {
      res.status(400).json({ success: false, message: 'El detalle de la devolución tiene datos inválidos' });
      return;
    }
    tvp.rows.add(idDetVenta, cantidad);
  }

  try {
    const result = await executeRequest({
      query: 'sp_guardarNotaCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'idVenta', type: sql.Int, value: Number(idVenta) },
        { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
        { name: 'idUsuarioAlta', type: sql.Int, value: getUserId(req) },
        { name: 'motivo', type: sql.VarChar(200), value: String(motivo ?? '') },
        { name: 'detalle', type: sql.TVP('tipoDetalleNotaCredito') as any, value: tvp },
        { name: 'noImp', type: sql.Bit, value: esNoImp(noImp) },
      ],
    });
    const nota = result.recordset[0];
    res.status(201).json({ success: true, message: 'Nota de crédito registrada correctamente', idDocumento: nota?.idNotaCredito, ...nota });
  } catch (error) {
    sendError(res, error, 'Error al registrar la nota de crédito');
  }
};

/**
 * Nota de crédito por monto (descuento, bonificación, diferencia de precio). No mueve stock.
 * Body: { idVenta, idTerminalWeb, motivo, detalle: [{ concepto, idImpuesto, monto }] }
 */
export const guardarNotaCreditoMonto = async (req: Request, res: Response): Promise<void> => {
  const { idVenta, idTerminalWeb, motivo, detalle } = req.body;

  if (!enteroPositivo(idVenta) || !enteroPositivo(idTerminalWeb)) {
    res.status(400).json({ success: false, message: 'Faltan la factura o la terminal' });
    return;
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    res.status(400).json({ success: false, message: 'Cargue al menos un concepto' });
    return;
  }

  const tvp = new sql.Table('dbo.tipoDetalleNotaCreditoMonto');
  tvp.columns.add('concepto', sql.VarChar(100), { nullable: false });
  tvp.columns.add('idImpuesto', sql.Int, { nullable: false });
  tvp.columns.add('monto', sql.Money, { nullable: false });
  for (const item of detalle) {
    const concepto = String(item?.concepto ?? '').trim().slice(0, 100);
    const idImpuesto = enteroPositivo(item?.idImpuesto);
    const monto = Number(item?.monto);
    if (!concepto || !idImpuesto || !Number.isFinite(monto)) {
      res.status(400).json({ success: false, message: 'El detalle de la nota de crédito tiene datos inválidos' });
      return;
    }
    tvp.rows.add(concepto, idImpuesto, monto);
  }

  try {
    const result = await executeRequest({
      query: 'sp_guardarNotaCreditoMonto',
      isStoredProcedure: true,
      inputs: [
        { name: 'idVenta', type: sql.Int, value: Number(idVenta) },
        { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
        { name: 'idUsuarioAlta', type: sql.Int, value: getUserId(req) },
        { name: 'motivo', type: sql.VarChar(200), value: String(motivo ?? '') },
        { name: 'detalle', type: sql.TVP('tipoDetalleNotaCreditoMonto') as any, value: tvp },
      ],
    });
    const nota = result.recordset[0];
    res.status(201).json({ success: true, message: 'Nota de crédito registrada correctamente', idDocumento: nota?.idNotaCreditoMonto, ...nota });
  } catch (error) {
    sendError(res, error, 'Error al registrar la nota de crédito');
  }
};

/**
 * Lista notas de crédito (hasta 500). Query: tipo (DEV | MONTO), desde, hasta, nroNotaCredito, idVenta,
 * noImp (solo devoluciones: 1 = de ventas no impresas, 0 = de facturas; sin enviar = todas).
 */
export const listarNotasCredito = async (req: Request, res: Response): Promise<void> => {
  const tipo = req.query.tipo === 'DEV' || req.query.tipo === 'MONTO' ? req.query.tipo : null;
  try {
    const result = await executeRequest({
      query: 'sp_listarNotasCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'tipo', type: sql.VarChar(5), value: tipo },
        { name: 'desde', type: sql.Date, value: req.query.desde || null },
        { name: 'hasta', type: sql.Date, value: req.query.hasta || null },
        { name: 'nroNotaCredito', type: sql.Numeric(7, 0), value: enteroPositivo(req.query.nroNotaCredito) },
        { name: 'idVenta', type: sql.Int, value: enteroPositivo(req.query.idVenta) },
        { name: 'noImp', type: sql.Bit, value: req.query.noImp === undefined || req.query.noImp === '' ? null : esNoImp(req.query.noImp) },
      ],
    });
    res.status(200).json({ success: true, notas: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al listar las notas de crédito');
  }
};

/**
 * Datos para imprimir una nota de crédito. Params: tipo (DEV | MONTO), id.
 */
export const reporteNotaCredito = async (req: Request, res: Response): Promise<void> => {
  const tipo = req.params.tipo === 'MONTO' ? 'MONTO' : req.params.tipo === 'DEV' ? 'DEV' : null;
  const idDocumento = enteroPositivo(req.params.id);
  if (!tipo || !idDocumento) {
    res.status(400).json({ success: false, message: 'Nota de crédito inválida' });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_reporteNotaCredito',
      isStoredProcedure: true,
      inputs: [
        { name: 'tipo', type: sql.VarChar(5), value: tipo },
        { name: 'idDocumento', type: sql.Int, value: idDocumento },
      ],
    });
    const recordsets = recordsetsDe(result);
    const cabecera = recordsets[0]?.[0];
    if (!cabecera) {
      res.status(404).json({ success: false, message: 'La nota de crédito no existe' });
      return;
    }
    res.status(200).json({ success: true, cabecera, detalle: recordsets[1] ?? [] });
  } catch (error) {
    sendError(res, error, 'Error al obtener la nota de crédito');
  }
};
