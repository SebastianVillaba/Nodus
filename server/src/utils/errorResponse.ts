import { Response } from 'express';
import { logger } from './logger';
import { env } from '../config/env';

/**
 * Arma el texto del error de SQL Server incluyendo el SP y la línea cuando vienen.
 * Ej: "Violation of UNIQUE KEY constraint 'UQ_ruc'... (sp_agregarClienteRapido, línea 23)"
 */
export const formatDbError = (error: any): string => {
  const mensaje = error?.message || 'Error desconocido';
  const ubicacion = [
    error?.procName,
    error?.lineNumber ? `línea ${error.lineNumber}` : null
  ].filter(Boolean).join(', ');

  return ubicacion ? `${mensaje} (${ubicacion})` : mensaje;
};

/**
 * Responde un error uniforme al cliente.
 *
 * - RAISERROR/THROW de negocio (number >= 50000): 400 con el mensaje del SP tal cual.
 * - Otro error SQL o de código: statusDefault (500).
 *   En desarrollo se devuelve el detalle real ("contexto: detalle (SP, línea N)");
 *   en producción solo el contexto, para no exponer la estructura de la base. El detalle queda en el log.
 */
export const sendError = (res: Response, error: any, contexto: string, statusDefault = 500): void => {
  logger.error({ err: error }, contexto);

  if (res.headersSent) return;

  const esNegocio = typeof error?.number === 'number' && error.number >= 50000;

  if (esNegocio) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }

  if (env.NODE_ENV === 'production') {
    res.status(statusDefault).json({ success: false, message: contexto });
    return;
  }

  res.status(statusDefault).json({
    success: false,
    message: `${contexto}: ${formatDbError(error)}`,
    error: error?.message || 'Error desconocido',
    detail: {
      number: error?.number,
      procName: error?.procName,
      lineNumber: error?.lineNumber
    }
  });
};
