import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

/**
 * Consulta arqueos (movimientos de caja cerrados) por rango de fechas.
 * Query params: desde (date), hasta (date)
 */
export const consultaArqueoFecha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta } = req.query as { desde: string; hasta: string };

    if (!desde || !hasta) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'desde' y 'hasta' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'desde', type: sql.Date, value: desde },
      { name: 'hasta', type: sql.Date, value: hasta }
    ];

    const result = await executeRequest({
      query: `
        SELECT 
          mc.idMovimientoCaja AS id, 
          mc.nroCaja,
          pAper.nombre AS responsableApertura,
          mc.montoInicial,
          mc.fechaApertura,
          pCierr.nombre AS responsableCierre,
          mc.fechaCierre,
          mc.montoFinal AS montoContadoCajero,
          mc.montoCalculado AS montoSistema,
          mc.estado
        FROM movimientoCaja mc
        INNER JOIN usuario uAper ON mc.idUsuarioAbre = uAper.idUsuario
        INNER JOIN personal perAper ON perAper.idPersonal = uAper.idPersonal
        INNER JOIN personaFis pfisAper ON pfisAper.idPersonaFis = perAper.idPersonaFis
        INNER JOIN persona pAper ON pfisAper.idPersona = pAper.idPersona
        INNER JOIN usuario uCierr ON mc.idUsuarioCierre = uCierr.idUsuario
        INNER JOIN personal perCierr ON perCierr.idPersonal = uCierr.idPersonal
        INNER JOIN personaFis pfisCierr ON pfisCierr.idPersonaFis = perCierr.idPersonaFis
        INNER JOIN persona pCierr ON pfisCierr.idPersona = pCierr.idPersona
        WHERE mc.estado <> 'ABIERTA'
          AND CAST(mc.fechaApertura AS DATE) BETWEEN @desde AND @hasta
        ORDER BY mc.fechaApertura DESC
      `,
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });

  } catch (error: any) {
    sendError(res, error, 'Error al consultar arqueos por fecha');
  }
};

/**
 * Consulta arqueos (movimientos de caja cerrados) por número de caja.
 * Query params: nroCaja (numeric/int)
 */
export const consultaArqueoNroCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nroCaja } = req.query as { nroCaja: string };

    if (!nroCaja) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'nroCaja' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'nroCaja', type: sql.Int, value: parseInt(nroCaja, 10) }
    ];

    const result = await executeRequest({
      query: `
        SELECT 
          mc.idMovimientoCaja AS id, 
          mc.nroCaja,
          pAper.nombre AS responsableApertura,
          mc.montoInicial,
          mc.fechaApertura,
          pCierr.nombre AS responsableCierre,
          mc.fechaCierre,
          mc.montoFinal AS montoContadoCajero,
          mc.montoCalculado AS montoSistema,
          mc.estado
        FROM movimientoCaja mc
        INNER JOIN usuario uAper ON mc.idUsuarioAbre = uAper.idUsuario
        INNER JOIN personal perAper ON perAper.idPersonal = uAper.idPersonal
        INNER JOIN personaFis pfisAper ON pfisAper.idPersonaFis = perAper.idPersonaFis
        INNER JOIN persona pAper ON pfisAper.idPersona = pAper.idPersona
        INNER JOIN usuario uCierr ON mc.idUsuarioCierre = uCierr.idUsuario
        INNER JOIN personal perCierr ON perCierr.idPersonal = uCierr.idPersonal
        INNER JOIN personaFis pfisCierr ON pfisCierr.idPersonaFis = perCierr.idPersonaFis
        INNER JOIN persona pCierr ON pfisCierr.idPersona = pCierr.idPersona
        WHERE mc.estado <> 'ABIERTA'
          AND mc.nroCaja = @nroCaja
        ORDER BY mc.fechaApertura DESC
      `,
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });

  } catch (error: any) {
    sendError(res, error, 'Error al consultar arqueos por número de caja');
  }
};

/**
 * Consulta la información detallada de un arqueo de caja (cabecera y desgloses).
 * Llama a sp_reporteCierreCaja.
 * Query params: idMovimientoCaja (int)
 */
export const consultaInformacionArqueo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idMovimientoCaja } = req.query as { idMovimientoCaja?: string };

    if (!idMovimientoCaja) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idMovimientoCaja' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idMovimientoCaja', type: sql.Int, value: parseInt(idMovimientoCaja, 10) }
    ];

    const result = await executeRequest({
      query: 'sp_reporteCierreCaja',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      cabecera: recordsets?.[0]?.[0] ?? null,
      gastos: recordsets?.[1] ?? [],
      monedas: recordsets?.[2] ?? [],
      tarjetaCredito: recordsets?.[3] ?? [],
      tarjetaDebito: recordsets?.[4] ?? [],
      transferencias: recordsets?.[5] ?? [],
      ventasCredito: recordsets?.[6] ?? [],   // informativas: no suman al saldo de la caja
      cobros: recordsets?.[7] ?? []           // cobros de créditos activos: suman al saldo teórico
    });

  } catch (error: any) {
    sendError(res, error, 'Error al consultar la información del arqueo');
  }
};
