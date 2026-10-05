import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { getUserId } from '../Middlewares/auth.middleware';
import { sendError } from '../utils/errorResponse';

export const agregarAlTemp = async (req: Request, res: Response): Promise<void> => {
  const { idTerminalWeb, idStock, cantidad } = req.body;

  if (!idTerminalWeb || !idStock || !cantidad) {
    res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios: idTerminalWeb, idStock, cantidad' });
    return;
  }

  try {
    const result = await executeRequest({
      isStoredProcedure: true,
      query: 'sp_agregarCodigoBarraTmp',
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
        { name: 'idStock', type: sql.Int, value: idStock },
        { name: 'cantidad', type: sql.Int, value: cantidad }
      ]
    });

    res.status(201).json({ success: true, message: 'Producto agregado a la cola de impresión', result: result.rowsAffected[0] });
  } catch (error: any) {
    sendError(res, error, 'Error al agregar a la cola');
  }
};

export const consultarTemp = async (req: Request, res: Response): Promise<void> => {
  const { idTerminalWeb } = req.query;

  if (!idTerminalWeb) {
    res.status(400).json({ success: false, message: 'El parámetro idTerminalWeb es obligatorio' });
    return;
  }

  try {
    const result = await executeRequest({
      isStoredProcedure: true,
      query: 'sp_consultaCodigoBarraTmp',
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb as string) }
      ]
    });

    res.status(200).json({ success: true, result: result.recordset });
  } catch (error: any) {
    sendError(res, error, 'Error al consultar la cola');
  }
};

export const actualizarCantidadTemp = async (req: Request, res: Response): Promise<void> => {
  const { idTerminalWeb, idStock, cantidad } = req.body;

  if (!idTerminalWeb || !idStock || cantidad === undefined) {
    res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios: idTerminalWeb, idStock, cantidad' });
    return;
  }

  try {
    await executeRequest({
      isStoredProcedure: true,
      query: 'sp_actualizarCantidadCodigoBarraTmp',
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
        { name: 'idStock', type: sql.Int, value: idStock },
        { name: 'cantidad', type: sql.Int, value: cantidad }
      ]
    });

    res.status(200).json({ success: true, message: 'Cantidad actualizada correctamente' });
  } catch (error: any) {
    sendError(res, error, 'Error al actualizar cantidad');
  }
};

export const eliminarDelTemp = async (req: Request, res: Response): Promise<void> => {
  const { idStock } = req.params;
  const { idTerminalWeb } = req.query;

  if (!idTerminalWeb || !idStock) {
    res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios: idTerminalWeb, idStock' });
    return;
  }

  try {
    await executeRequest({
      isStoredProcedure: true,
      query: 'sp_eliminarCodigoBarraTmp',
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb as string) },
        { name: 'idStock', type: sql.Int, value: parseInt(idStock) }
      ]
    });

    res.status(200).json({ success: true, message: 'Producto eliminado de la cola' });
  } catch (error: any) {
    sendError(res, error, 'Error al eliminar de la cola');
  }
};

export const limpiarTemp = async (req: Request, res: Response): Promise<void> => {
  const { idTerminalWeb } = req.query;

  if (!idTerminalWeb) {
    res.status(400).json({ success: false, message: 'El parámetro idTerminalWeb es obligatorio' });
    return;
  }

  try {
    await executeRequest({
      isStoredProcedure: true,
      query: 'sp_limpiarCodigoBarraTmp',
      inputs: [
        { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb as string) }
      ]
    });

    res.status(200).json({ success: true, message: 'Cola de impresión vaciada' });
  } catch (error: any) {
    sendError(res, error, 'Error al vaciar la cola');
  }
};

export const guardarCodigosGenerados = async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    res.status(400).json({ success: false, message: 'Faltan parámetros obligatorios: items (debe ser un array)' });
    return;
  }

  try {
    for (const item of items) {
      const { idProducto, codigoBarra } = item;
      if (!idProducto || !codigoBarra) {
        continue;
      }
      await executeRequest({
        isStoredProcedure: true,
        query: 'sp_guardarCodigoBarraProducto',
        inputs: [
          { name: 'idProducto', type: sql.Int, value: idProducto },
          { name: 'codigoBarra', type: sql.VarChar(30), value: codigoBarra },
          { name: 'idUsuarioMod', type: sql.Int, value: getUserId(req) }
        ]
      });
    }

    res.status(200).json({ success: true, message: 'Códigos de barra asignados correctamente a los productos' });
  } catch (error: any) {
    sendError(res, error, 'Error al guardar los códigos');
  }
};

