import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

/**
 * Lista los servicios (ABM y búsqueda en facturación).
 * Query: busqueda (código o parte del nombre), incluirInactivos (1 = también los inactivos).
 */
export const listarServicios = async (req: Request, res: Response): Promise<void> => {
  try {
    const busqueda = String(req.query.busqueda ?? '').trim().slice(0, 100);
    const result = await executeRequest({
      query: 'sp_listarServicios',
      isStoredProcedure: true,
      inputs: [
        { name: 'busqueda', type: sql.VarChar(100), value: busqueda || null },
        { name: 'incluirInactivos', type: sql.Bit, value: req.query.incluirInactivos === '1' },
      ],
    });
    res.status(200).json({ success: true, result: result.recordset });
  } catch (error) {
    sendError(res, error, 'Error al listar los servicios');
  }
};

/**
 * Alta (sin idServicio) o modificación de un servicio.
 */
export const guardarServicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idServicio, codigo, nombreServicio, descripcion, precio, idImpuesto, permiteDecimal, activo } = req.body;

    if (!String(nombreServicio ?? '').trim() || !idImpuesto || precio === undefined || Number(precio) < 0) {
      res.status(400).json({ success: false, message: 'Indique nombre, precio e impuesto del servicio.' });
      return;
    }

    const result = await executeRequest({
      query: 'sp_guardarServicio',
      isStoredProcedure: true,
      inputs: [
        { name: 'idServicio', type: sql.Int, value: idServicio ? Number(idServicio) : null },
        { name: 'codigo', type: sql.VarChar(20), value: codigo ? String(codigo).slice(0, 20) : null },
        { name: 'nombreServicio', type: sql.VarChar(150), value: String(nombreServicio).slice(0, 150) },
        { name: 'descripcion', type: sql.VarChar(300), value: descripcion ? String(descripcion).slice(0, 300) : null },
        { name: 'precio', type: sql.Money, value: Number(precio) },
        { name: 'idImpuesto', type: sql.Int, value: Number(idImpuesto) },
        { name: 'permiteDecimal', type: sql.Bit, value: !!permiteDecimal },
        { name: 'activo', type: sql.Bit, value: activo === undefined ? true : !!activo },
        { name: 'idUsuario', type: sql.Int, value: getUserId(req) },
      ],
    });
    res.status(200).json({
      success: true,
      message: idServicio ? 'Servicio actualizado' : 'Servicio creado',
      idServicio: result.recordset?.[0]?.idServicio,
    });
  } catch (error) {
    sendError(res, error, 'Error al guardar el servicio');
  }
};
