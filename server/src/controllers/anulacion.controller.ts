import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';
import { validarCredenciales } from './auth.controller';

const tienePermisoAnular = async (idUsuario: number, tipo: string): Promise<boolean> => {
  const result = await executeRequest({
    query: 'sp_permisoAnular',
    inputs: [
      { name: 'idUsuario', type: sql.Int, value: idUsuario },
      { name: 'tipo', type: sql.VarChar(15), value: tipo }
    ] as any,
    isStoredProcedure: true
  });
  // El SP retorna una fila con idUsuario si tiene permiso, o sin filas si no lo tiene
  return !!result.recordset && result.recordset.length > 0;
};

/**
 * Valida en el servidor las credenciales del usuario autorizador y su permiso de anulación.
 * Devuelve su idUsuario, o null si ya respondió con el error correspondiente.
 */
const obtenerAutorizador = async (req: Request, res: Response, tipo: string): Promise<number | null> => {
  const { usuarioAutorizador, passwordAutorizador } = req.body;

  if (typeof usuarioAutorizador !== 'string' || typeof passwordAutorizador !== 'string'
    || !usuarioAutorizador || !passwordAutorizador) {
    res.status(400).json({ success: false, message: 'Debe ingresar usuario y contraseña del autorizador' });
    return null;
  }

  const autorizador = await validarCredenciales(usuarioAutorizador, passwordAutorizador);
  if (!autorizador) {
    res.status(401).json({ success: false, message: 'Usuario o contraseña del autorizador incorrectos' });
    return null;
  }

  if (!(await tienePermisoAnular(autorizador.idUsuario, tipo))) {
    res.status(403).json({ success: false, message: 'El usuario ingresado no está habilitado para realizar esta anulación' });
    return null;
  }

  return autorizador.idUsuario;
};

/**
 * Verifica si un usuario tiene permiso para anular según el tipo indicado.
 * Llama a sp_permisoAnular.
 * 
 * Query params: idUsuario (int), tipo (string: 'FACTU' | 'COMPRA' | 'REMISION' | 'RECEPCION' | 'GASTO' | 'AJUSTE')
 */
export const verificarPermisoAnular = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idUsuario, tipo } = req.query as { idUsuario: string; tipo: string };

    if (!idUsuario || !tipo) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'idUsuario' y 'tipo' son obligatorios"
      });
      return;
    }

    const tiposValidos = ['FACT', 'COMPRA', 'REMISION', 'RECEPCION', 'AJUSTE', 'CARGA'];
    if (!tiposValidos.includes(tipo.toUpperCase())) {
      res.status(400).json({
        success: false,
        message: `El tipo '${tipo}' no es válido. Tipos permitidos: ${tiposValidos.join(', ')}`
      });
      return;
    }

    const tienePermiso = await tienePermisoAnular(parseInt(idUsuario), tipo.toUpperCase());

    res.status(200).json({
      success: true,
      tienePermiso
    });

  } catch (error: any) {
    sendError(res, error, 'Error al verificar el permiso de anulación');
  }
};

/**
 * Anula una facturación (venta).
 * Llama a sp_anularFacturacion.
 * 
 * Body: { idVenta, idTerminalWeb, idSucursal, explica, tipo, usuarioAutorizador, passwordAutorizador }
 *   tipo = 1 (Factura impresa) | 2 (Remito/CVE)
 */
export const anularFacturacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idVenta,
      idTerminalWeb,
      idSucursal,
      explica,
      tipo
    } = req.body;

    // Validar parámetros obligatorios
    if (!idVenta || !idTerminalWeb || !idSucursal || !explica || tipo === undefined) {
      res.status(400).json({
        success: false,
        message: "Faltan parámetros requeridos: idVenta, idTerminalWeb, idSucursal, explica, tipo"
      });
      return;
    }

    if (tipo !== 1 && tipo !== 2) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'tipo' debe ser 1 (factura impresa) o 2 (remito)"
      });
      return;
    }

    // tipo 1 = factura impresa (permiso FACT), 2 = remito (permiso REMISION)
    const idUsuarioAlta = await obtenerAutorizador(req, res, tipo === 1 ? 'FACT' : 'REMISION');
    if (idUsuarioAlta === null) return;

    await executeRequest({
      query: 'sp_anularFacturacion',
      inputs: [
        { name: 'idVenta',       type: sql.Int,         value: idVenta        },
        { name: 'idTerminalWeb', type: sql.Int,         value: idTerminalWeb  },
        { name: 'idSucursal',    type: sql.Int,         value: idSucursal     },
        { name: 'idUsuarioAlta', type: sql.Int,         value: idUsuarioAlta  },
        { name: 'explica',       type: sql.VarChar(sql.MAX), value: explica    },
        { name: 'tipo',          type: sql.Numeric(2),  value: tipo           }
      ] as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      message: 'Facturación anulada correctamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al anular la facturación');
  }
};

/**
 * Anula una carga de productos.
 * Llama a sp_anularCargaProducto.
 * 
 * Body: { idCargaProducto, idTerminalWeb, idSucursal, explica, usuarioAutorizador, passwordAutorizador }
 */
export const anularCargaProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idCargaProducto,
      idTerminalWeb,
      idSucursal,
      explica
    } = req.body;

    if (!idCargaProducto || !idTerminalWeb || !idSucursal || !explica) {
      res.status(400).json({
        success: false,
        message: "Faltan parámetros requeridos: idCargaProducto, idTerminalWeb, idSucursal, explica"
      });
      return;
    }

    const idUsuarioAlta = await obtenerAutorizador(req, res, 'CARGA');
    if (idUsuarioAlta === null) return;

    await executeRequest({
      query: 'sp_anularCargaProducto',
      inputs: [
        { name: 'idCargaProducto', type: sql.Int,                 value: idCargaProducto },
        { name: 'idTerminalWeb',   type: sql.Int,                 value: idTerminalWeb   },
        { name: 'idSucursal',      type: sql.Int,                 value: idSucursal      },
        { name: 'idUsuarioAlta',   type: sql.Int,                 value: idUsuarioAlta   },
        { name: 'explica',         type: sql.VarChar(sql.MAX),    value: explica        }
      ] as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      message: 'Carga de producto anulada correctamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al anular la carga de producto');
  }
};

