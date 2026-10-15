import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { getUserId } from '../Middlewares/auth.middleware';

/**
 * Combos con stock propio del depósito de ventas de la terminal: stock armado, cuántos se pueden armar,
 * sus componentes y los últimos armados. Query: idTerminalWeb.
 */
export const listarCombos = async (req: Request, res: Response): Promise<void> => {
  const idTerminalWeb = Number(req.query.idTerminalWeb);
  if (!Number.isInteger(idTerminalWeb) || idTerminalWeb <= 0) {
    res.status(400).json({ success: false, message: 'Falta la terminal' });
    return;
  }
  try {
    const result = await executeRequest({
      query: 'sp_listarCombosArmado',
      isStoredProcedure: true,
      inputs: [{ name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb }],
    });
    const recordsets = (result as { recordsets?: any[][] }).recordsets ?? [];
    res.status(200).json({ success: true, combos: recordsets[0] ?? [], componentes: recordsets[1] ?? [], historial: recordsets[2] ?? [] });
  } catch (error) {
    sendError(res, error, 'Error al listar los combos');
  }
};

/**
 * Arma (salen los componentes, entra el combo) o desarma un combo con stock propio.
 * Body: { idProducto, cantidad, desarmar, idTerminalWeb, observacion }
 */
export const armarCombo = async (req: Request, res: Response): Promise<void> => {
  const { idProducto, cantidad, desarmar, idTerminalWeb, observacion } = req.body;
  if (!Number(idProducto) || !Number(idTerminalWeb) || !(Number(cantidad) > 0)) {
    res.status(400).json({ success: false, message: 'Indique el combo y una cantidad mayor a cero' });
    return;
  }
  try {
    const result = await executeRequest({
      query: 'sp_armarCombo',
      isStoredProcedure: true,
      inputs: [
        { name: 'idProducto', type: sql.Int, value: Number(idProducto) },
        { name: 'cantidad', type: sql.Numeric(10, 4), value: Number(cantidad) },
        { name: 'desarmar', type: sql.Bit, value: desarmar === true },
        { name: 'idTerminalWeb', type: sql.Int, value: Number(idTerminalWeb) },
        { name: 'idUsuario', type: sql.Int, value: getUserId(req) },
        { name: 'observacion', type: sql.VarChar(200), value: String(observacion ?? '').slice(0, 200) },
      ],
    });
    res.status(201).json({ success: true, idArmadoCombo: result.recordset?.[0]?.idArmadoCombo });
  } catch (error) {
    sendError(res, error, desarmar ? 'Error al desarmar el combo' : 'Error al armar el combo');
  }
};
