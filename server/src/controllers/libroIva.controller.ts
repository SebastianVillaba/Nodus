import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Libro IVA (registro de comprobantes RG 90/2021) de ventas o de compras de un período.
 * Params: libro (ventas | compras). Query: desde, hasta (AAAA-MM-DD).
 * Devuelve los comprobantes y la empresa informante (RUC para el nombre del archivo).
 */
export const libroIva = async (req: Request, res: Response): Promise<void> => {
  const libro = req.params.libro;
  const { desde, hasta } = req.query;

  if (libro !== 'ventas' && libro !== 'compras') {
    res.status(400).json({ success: false, message: 'Libro inválido' });
    return;
  }
  if (!FECHA.test(String(desde ?? '')) || !FECHA.test(String(hasta ?? '')) || String(desde) > String(hasta)) {
    res.status(400).json({ success: false, message: 'Indique un período válido' });
    return;
  }

  try {
    const result = await executeRequest({
      query: libro === 'ventas' ? 'sp_libroIvaVentas' : 'sp_libroIvaCompras',
      isStoredProcedure: true,
      inputs: [
        { name: 'desde', type: sql.Date, value: String(desde) },
        { name: 'hasta', type: sql.Date, value: String(hasta) },
      ],
    });
    const recordsets = (result as { recordsets?: any[][] }).recordsets ?? [];
    res.status(200).json({ success: true, comprobantes: recordsets[0] ?? [], empresa: recordsets[1]?.[0] ?? null });
  } catch (error) {
    sendError(res, error, 'Error al generar el libro IVA');
  }
};
