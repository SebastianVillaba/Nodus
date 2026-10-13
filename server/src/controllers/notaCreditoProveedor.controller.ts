import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

const enteroPositivo = (valor: unknown): number | null => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const recordsetsDe = (result: unknown): any[][] => (result as { recordsets?: any[][] }).recordsets ?? [];

const tipoDe = (valor: unknown): 'DEV' | 'MONTO' | null => (valor === 'DEV' || valor === 'MONTO' ? valor : null);

/**
 * Datos del comprobante del proveedor, comunes a los dos tipos de nota.
 * Devuelve null (y responde 400) si faltan o son inválidos; el SP hace el resto de las validaciones.
 */
const comprobanteDe = (req: Request, res: Response) => {
  const { idCompra, idTerminalWeb, timbrado, dsuc, dcaja, nroNotaCredito, fecha, motivo } = req.body;

  if (!enteroPositivo(idCompra) || !enteroPositivo(idTerminalWeb)) {
    res.status(400).json({ success: false, message: 'Faltan la compra o la terminal' });
    return null;
  }
  if (!/^\d{8}$/.test(String(timbrado ?? '').trim())) {
    res.status(400).json({ success: false, message: 'El timbrado de la nota de crédito debe tener 8 dígitos' });
    return null;
  }
  if (!enteroPositivo(dsuc) || !enteroPositivo(dcaja) || !enteroPositivo(nroNotaCredito)) {
    res.status(400).json({ success: false, message: 'Ingrese el número de la nota de crédito completo' });
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ''))) {
    res.status(400).json({ success: false, message: 'Ingrese la fecha de la nota de crédito' });
    return null;
  }

  return [
    { name: 'idCompra', type: sql.Int, value: Number(idCompra) },
    { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
    { name: 'idUsuarioAlta', type: sql.Int, value: getUserId(req) },
    { name: 'timbrado', type: sql.VarChar(20), value: String(timbrado).trim() },
    { name: 'dsuc', type: sql.Numeric(3, 0), value: Number(dsuc) },
    { name: 'dcaja', type: sql.Numeric(3, 0), value: Number(dcaja) },
    { name: 'nroNotaCredito', type: sql.Numeric(7, 0), value: Number(nroNotaCredito) },
    { name: 'fecha', type: sql.Date, value: String(fecha) },
    { name: 'motivo', type: sql.VarChar(200), value: String(motivo ?? '').slice(0, 200) },
  ];
};

/**
 * Compras fiscales activas a las que se les puede registrar una nota de crédito (hasta 500).
 * Query: proveedor (nombre o RUC), dfactu (con dsuc y dcaja opcionales), idCompra, desde, hasta.
 */
export const buscarCompras = async (req: Request, res: Response): Promise<void> => {
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
        { name: 'noFiscal', type: sql.Bit, value: false },
        { name: 'soloActivas', type: sql.Bit, value: false },
      ],
    });
    res.status(200).json({ success: true, compras: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al buscar las compras');
  }
};

/** Compra fiscal con su detalle, lo ya devuelto, el disponible por IVA y sus notas. Params: id. */
export const consultarCompra = async (req: Request, res: Response): Promise<void> => {
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
        { name: 'noFiscal', type: sql.Bit, value: false },
      ],
    });
    const recordsets = recordsetsDe(result);
    const cabecera = recordsets[0]?.[0];
    if (!cabecera) {
      res.status(404).json({ success: false, message: 'No se encontró la compra' });
      return;
    }
    res.status(200).json({ success: true, cabecera, detalle: recordsets[1] ?? [], impuestos: recordsets[2] ?? [], notas: recordsets[3] ?? [] });
  } catch (error) {
    sendError(res, error, 'Error al consultar la compra');
  }
};

/**
 * Nota de crédito de proveedor por devolución de mercadería (sale del stock del depósito de la compra).
 * Body: { idCompra, idTerminalWeb, timbrado, dsuc, dcaja, nroNotaCredito, fecha (AAAA-MM-DD), motivo, detalle: [{ idDetCompra, cantidad }] }
 */
export const guardarDevolucion = async (req: Request, res: Response): Promise<void> => {
  const inputs = comprobanteDe(req, res);
  if (!inputs) return;

  const { detalle } = req.body;
  if (!Array.isArray(detalle) || detalle.length === 0) {
    res.status(400).json({ success: false, message: 'Indique al menos un artículo a devolver' });
    return;
  }

  const tvp = new sql.Table('dbo.tipoDetalleNotaCreditoProveedor');
  tvp.columns.add('idDetCompra', sql.Int, { nullable: false });
  tvp.columns.add('cantidad', sql.Numeric(10, 4), { nullable: false });
  for (const item of detalle) {
    const idDetCompra = enteroPositivo(item?.idDetCompra);
    const cantidad = Number(item?.cantidad);
    if (!idDetCompra || !Number.isFinite(cantidad) || cantidad <= 0) {
      res.status(400).json({ success: false, message: 'El detalle de la devolución tiene datos inválidos' });
      return;
    }
    tvp.rows.add(idDetCompra, cantidad);
  }

  try {
    const result = await executeRequest({
      query: 'sp_guardarNotaCreditoProveedor',
      isStoredProcedure: true,
      inputs: [...inputs, { name: 'detalle', type: sql.TVP('tipoDetalleNotaCreditoProveedor') as any, value: tvp }],
    });
    const nota = result.recordset[0];
    res.status(201).json({ success: true, message: 'Nota de crédito registrada correctamente', idDocumento: nota?.idNotaCreditoProveedor, ...nota });
  } catch (error) {
    sendError(res, error, 'Error al registrar la nota de crédito');
  }
};

/**
 * Nota de crédito de proveedor por monto (descuento, bonificación, diferencia de precio). No mueve stock.
 * Body: { idCompra, idTerminalWeb, timbrado, dsuc, dcaja, nroNotaCredito, fecha, motivo, detalle: [{ concepto, idImpuesto, monto }] }
 */
export const guardarMonto = async (req: Request, res: Response): Promise<void> => {
  const inputs = comprobanteDe(req, res);
  if (!inputs) return;

  const { detalle } = req.body;
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
      query: 'sp_guardarNotaCreditoMontoProveedor',
      isStoredProcedure: true,
      inputs: [...inputs, { name: 'detalle', type: sql.TVP('tipoDetalleNotaCreditoMonto') as any, value: tvp }],
    });
    const nota = result.recordset[0];
    res.status(201).json({ success: true, message: 'Nota de crédito registrada correctamente', idDocumento: nota?.idNotaCreditoMontoProveedor, ...nota });
  } catch (error) {
    sendError(res, error, 'Error al registrar la nota de crédito');
  }
};

/** Lista notas de crédito de proveedor (hasta 500). Query: tipo (DEV | MONTO), desde, hasta, proveedor, nroNotaCredito, idCompra. */
export const listarNotas = async (req: Request, res: Response): Promise<void> => {
  const tipo = tipoDe(req.query.tipo);
  if (!tipo) {
    res.status(400).json({ success: false, message: 'Tipo de nota de crédito inválido' });
    return;
  }
  try {
    const result = await executeRequest({
      query: 'sp_listarNotasCreditoProveedor',
      isStoredProcedure: true,
      inputs: [
        { name: 'tipo', type: sql.VarChar(5), value: tipo },
        { name: 'desde', type: sql.Date, value: req.query.desde || null },
        { name: 'hasta', type: sql.Date, value: req.query.hasta || null },
        { name: 'proveedor', type: sql.VarChar(60), value: String(req.query.proveedor ?? '').trim().slice(0, 60) || null },
        { name: 'nroNotaCredito', type: sql.Numeric(7, 0), value: enteroPositivo(req.query.nroNotaCredito) },
        { name: 'idCompra', type: sql.Int, value: enteroPositivo(req.query.idCompra) },
      ],
    });
    res.status(200).json({ success: true, notas: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al listar las notas de crédito');
  }
};

/** Una nota de crédito de proveedor con su detalle. Params: tipo (DEV | MONTO), id. */
export const consultarNota = async (req: Request, res: Response): Promise<void> => {
  const tipo = tipoDe(req.params.tipo);
  const idDocumento = enteroPositivo(req.params.id);
  if (!tipo || !idDocumento) {
    res.status(400).json({ success: false, message: 'Nota de crédito inválida' });
    return;
  }
  try {
    const result = await executeRequest({
      query: 'sp_consultaNotaCreditoProveedor',
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
