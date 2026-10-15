import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

/**
 * Seguimiento de stock (kardex): cada cambio de stock queda en movimientoStock con su saldo anterior y posterior.
 */

/** Productos para el buscador: por código, código de barras o nombre. */
export const buscarProductos = async (req: Request, res: Response): Promise<void> => {
  try {
    const busqueda = String(req.query.busqueda || '').trim();
    if (!busqueda) {
      res.status(400).json({ success: false, message: 'Ingrese un código, código de barras o nombre.' });
      return;
    }

    const result = await executeRequest({
      query: `
        SELECT TOP 50 p.idProducto, p.codigo, RTRIM(p.codigoBarra) AS codigoBarra, RTRIM(p.nombre) AS nombre, p.activo,
               (SELECT SUM(s.cantidad) FROM stock s WHERE s.idProducto = p.idProducto) AS stock
        FROM producto p
        WHERE CAST(p.codigo AS VARCHAR(10)) = @busqueda OR p.codigoBarra = @busqueda OR p.nombre LIKE '%' + @busqueda + '%'
        ORDER BY CASE WHEN CAST(p.codigo AS VARCHAR(10)) = @busqueda OR p.codigoBarra = @busqueda THEN 0 ELSE 1 END, p.nombre`,
      inputs: [{ name: 'busqueda', type: sql.VarChar(60), value: busqueda }],
    });

    res.status(200).json({ success: true, productos: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al buscar productos');
  }
};

export const listarDepositos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'SELECT idDeposito, RTRIM(nombreDeposito) AS nombreDeposito FROM deposito ORDER BY nombreDeposito',
    });
    res.status(200).json({ success: true, depositos: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al listar los depósitos');
  }
};

/** Movimientos de un producto: saldo inicial, movimientos del período y saldo final (por depósito). */
export const consultarMovimientos = async (req: Request, res: Response): Promise<void> => {
  try {
    const idProducto = Number(req.query.idProducto);
    if (!idProducto) {
      res.status(400).json({ success: false, message: 'Seleccione un producto.' });
      return;
    }

    const result = await executeRequest({
      query: 'sp_consultaMovimientoStock',
      isStoredProcedure: true,
      inputs: [
        { name: 'idProducto', type: sql.Int, value: idProducto },
        { name: 'idDeposito', type: sql.Int, value: Number(req.query.idDeposito) || null },
        { name: 'desde', type: sql.Date, value: req.query.desde || null },
        { name: 'hasta', type: sql.Date, value: req.query.hasta || null },
      ],
    });

    const recordsets = result.recordsets as any[];
    res.status(200).json({
      success: true,
      saldoInicial: recordsets[0],
      movimientos: recordsets[1],
      saldoFinal: recordsets[2],
    });
  } catch (error) {
    sendError(res, error, 'Error al consultar los movimientos de stock');
  }
};

/** Registros de stock cuya cantidad no coincide con el último saldo del seguimiento. */
export const conciliacion = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({ query: 'sp_conciliacionStock', isStoredProcedure: true });
    res.status(200).json({ success: true, diferencias: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al consultar la conciliación de stock');
  }
};
