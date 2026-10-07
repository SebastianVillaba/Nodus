import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { sendError } from '../utils/errorResponse';

/**
 * Controller para consultar las cajas disponibles
 */
export const consultarCajas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idUsuario } = req.query as any;

    if (!idUsuario) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idUsuario' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idUsuario', type: sql.Int, value: parseInt(idUsuario) }
    ];

    const result = await executeRequest({
      query: 'sp_consultaCajas',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });

  } catch (error: any) {
    sendError(res, error, 'Error al consultar las cajas');
  }
};

/**
 * Controller para abrir una caja
 */
export const abrirCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idUsuario, idTerminalWeb } = req.body;

    if (!idUsuario || !idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idUsuario, idTerminalWeb).'
      });
      return;
    }

    const inputs = [
      { name: 'idUsuario', type: sql.Int, value: idUsuario },
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb }
    ];

    const result = await executeRequest({
      query: 'sp_abrirCaja',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    // El SP debe devolver el idMovimientoCaja creado
    const idMovimientoCaja = result.recordset && result.recordset[0] ? result.recordset[0].idMovimientoCaja : null;

    res.status(201).json({
      success: true,
      message: 'Caja abierta exitosamente',
      idMovimientoCaja: idMovimientoCaja
    });

  } catch (error: any) {
    sendError(res, error, 'Error al abrir la caja');
  }
};

/**
 * Controller para cerrar una caja
 */
export const cerrarCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idUsuarioCierre } = req.body;

    if (!idUsuarioCierre || !idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idUsuarioCierre, idTerminalWeb).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idUsuarioCierre', type: sql.Int, value: idUsuarioCierre }
    ];

    const result = await executeRequest({
      query: 'sp_cerrarCaja',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    // El SP devuelve el idMovimientoCaja cerrado
    const record = result.recordset && result.recordset[0] ? result.recordset[0] : null;
    const idMovimientoCaja = record ? (record.idMovimientoCaja || record.ID_MovimientoCaja || null) : null;

    res.status(200).json({
      success: true,
      message: 'Caja cerrada exitosamente',
      idMovimientoCaja: idMovimientoCaja
    });

  } catch (error: any) {
    sendError(res, error, 'Error al cerrar la caja');
  }
};

/**
 * Controller para agregar un gasto a la caja
 */
export const agregarGastoCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idGastoCajaTmp = null, idTerminalWeb, idMovimientoCaja, concepto, montoGasto, factura } = req.body;

    if (!idMovimientoCaja || !idTerminalWeb || !concepto || !montoGasto || factura === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idMovimientoCaja, idTerminalWeb, concepto, montoGasto, factura).'
      });
      return;
    }

    const inputs = [
      { name: 'idGastoCajaTmp', type: sql.Int, value: idGastoCajaTmp },
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idMovimientoCaja', type: sql.Int, value: idMovimientoCaja },
      { name: 'concepto', type: sql.VarChar(100), value: concepto },
      { name: 'montoGasto', type: sql.Money, value: montoGasto },
      { name: 'factura', type: sql.Numeric(7), value: factura }
    ];

    await executeRequest({
      query: 'sp_agregarGastCajaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Gasto agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar el gasto');
  }
};

/**
 * Controller para listar los gastos de la caja
 */
export const listarGastoCajaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
    ];

    const result = await executeRequest({
      query: 'sp_listarGastoCajaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = result.recordsets as any[];
    const detalle = recordsets[0];
    const totalGasto = recordsets[1];

    res.status(201).json({
      success: true,
      detalle,
      totalGasto,
      message: 'Gasto listado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar el gasto');
  }
};

/**
 * Controller para eliminar un gasto temporal de la caja
 */
export const eliminarGastoCajaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idGastoCajaTmp, idTerminalWeb } = req.query;

    if (!idGastoCajaTmp || !idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idGastoCajaTmp, idTerminalWeb).'
      });
      return;
    }

    const inputs = [
      { name: 'idGastoCajaTmp', type: sql.Int, value: idGastoCajaTmp },
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb }
    ];

    await executeRequest({
      query: 'sp_eliminarGastoCajaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      message: 'Gasto eliminado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar el gasto');
  }
}

/**
 * Controller para agregar un detalle al arqueo de caja 
 */
export const agregarArqueoCajaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idDenominacion, cantidad } = req.body;

    if (!idTerminalWeb || !idDenominacion || !cantidad) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb, idDenominacion, cantidad).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idDenominacion', type: sql.Int, value: idDenominacion },
      { name: 'cantidad', type: sql.Int, value: cantidad }
    ];

    await executeRequest({
      query: 'sp_agregarArqueoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Arqueo agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar el arqueo');
  }
}

/**
 * Controller para listar los arqueos de caja
 */
export const listarArqueoCajaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_listarArqueoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar el arqueo');
  }
}

/**
 * Controller para eliminar un arqueo de caja
 */
export const eliminarArqueoCajaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idArqueoTmp } = req.query as any;

    if (!idTerminalWeb || !idArqueoTmp) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' y 'idArqueoTmp' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) },
      { name: 'idArqueoTmp', type: sql.Int, value: parseInt(idArqueoTmp) }
    ];

    const result = await executeRequest({
      query: 'sp_eliminarArqueoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar el arqueo');
  }
}

/**
 * Controller para agregar un detalle de tarjeta de crédito temporal al arqueo
 */
export const agregarDetArqueoTarjetaCreditoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idTarjetaDebito, monto } = req.body;

    if (!idTerminalWeb || !idTarjetaDebito || monto === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb, idTarjetaDebito, monto).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idTarjetaDebito', type: sql.Int, value: idTarjetaDebito },
      { name: 'monto', type: sql.Money, value: monto }
    ];

    await executeRequest({
      query: 'sp_agregarDetArqueoTarjetaCreditoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Detalle de tarjeta de crédito agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar detalle de tarjeta de crédito');
  }
};

/**
 * Controller para listar los detalles de tarjeta de crédito temporal
 */
export const listarDetArqueoTarjetaCreditoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_listarDetArqueoTarjetaCreditoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = result.recordsets as any[];
    const detalle = recordsets[0];
    const totalArqueo = recordsets[1]?.[0]?.totalArqueo || 0;

    res.status(200).json({
      success: true,
      result: detalle,
      totalArqueo
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar detalles de tarjeta de crédito');
  }
};

/**
 * Controller para eliminar un detalle de tarjeta de crédito temporal
 */
export const eliminarDetArqueoTarjetaCreditoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idTarjetaDebito } = req.query as any;

    if (!idTerminalWeb || !idTarjetaDebito) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'idTerminalWeb' y 'idTarjetaDebito' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) },
      { name: 'idTarjetaDebito', type: sql.Int, value: parseInt(idTarjetaDebito) }
    ];

    await executeRequest({
      query: 'DELETE FROM dbo.detArqueoTarjetaCreditoTmp WHERE idTerminalWeb = @idTerminalWeb AND idTarjetaDebito = @idTarjetaDebito',
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      message: 'Detalle de tarjeta de crédito eliminado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar detalle de tarjeta de crédito');
  }
};

/**
 * Controller para agregar un detalle de tarjeta de débito temporal al arqueo
 */
export const agregarDetArqueoTarjetaDebitoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idTarjetaDebito, monto } = req.body;

    if (!idTerminalWeb || !idTarjetaDebito || monto === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb, idTarjetaDebito, monto).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idTarjetaDebito', type: sql.Int, value: idTarjetaDebito },
      { name: 'monto', type: sql.Money, value: monto }
    ];

    await executeRequest({
      query: 'sp_agregarDetArqueoTarjetaDebitoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Detalle de tarjeta de débito agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar detalle de tarjeta de débito');
  }
};

/**
 * Controller para listar los detalles de tarjeta de débito temporal
 */
export const listarDetArqueoTarjetaDebitoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_listarDetArqueoTarjetaDebitoTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = result.recordsets as any[];
    const detalle = recordsets[0];
    const totalArqueo = recordsets[1]?.[0]?.totalArqueo || 0;

    res.status(200).json({
      success: true,
      result: detalle,
      totalArqueo
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar detalles de tarjeta de débito');
  }
};

/**
 * Controller para eliminar un detalle de tarjeta de débito temporal
 */
export const eliminarDetArqueoTarjetaDebitoTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idTarjetaDebito } = req.query as any;

    if (!idTerminalWeb || !idTarjetaDebito) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'idTerminalWeb' y 'idTarjetaDebito' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) },
      { name: 'idTarjetaDebito', type: sql.Int, value: parseInt(idTarjetaDebito) }
    ];

    await executeRequest({
      query: 'DELETE FROM dbo.detArqueoTarjetaDebitoTmp WHERE idTerminalWeb = @idTerminalWeb AND idTarjetaDebito = @idTarjetaDebito',
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      message: 'Detalle de tarjeta de débito eliminado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar detalle de tarjeta de débito');
  }
};

/**
 * Controller para agregar un detalle de transferencia temporal al arqueo
 */
export const agregarDetArqueoTransferenciaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, concepto, monto } = req.body;

    if (!idTerminalWeb || !concepto || monto === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb, concepto, monto).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'concepto', type: sql.VarChar(50), value: concepto },
      { name: 'monto', type: sql.Money, value: monto }
    ];

    await executeRequest({
      query: 'sp_agregarDetArqueoTransferenciaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Detalle de transferencia agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar detalle de transferencia');
  }
};

/**
 * Controller para listar los detalles de transferencia temporal
 */
export const listarDetArqueoTransferenciaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_listarDetArqueoTransferenciaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = result.recordsets as any[];
    const detalle = recordsets[0];
    const totalArqueo = recordsets[1]?.[0]?.totalArqueo || 0;

    res.status(200).json({
      success: true,
      result: detalle,
      totalArqueo
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar detalles de transferencia');
  }
};

/**
 * Controller para eliminar un detalle de transferencia temporal
 */
export const eliminarDetArqueoTransferenciaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, concepto } = req.query as any;

    if (!idTerminalWeb || !concepto) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'idTerminalWeb' y 'concepto' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) },
      { name: 'concepto', type: sql.VarChar(50), value: concepto }
    ];

    await executeRequest({
      query: 'DELETE FROM dbo.detArqueoTransferenciaTmp WHERE idTerminalWeb = @idTerminalWeb AND concepto = @concepto',
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      message: 'Detalle de transferencia eliminado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar detalle de transferencia');
  }
};

/**
 * Controller para agregar un detalle de moneda temporal al arqueo
 */
export const agregarDetArqueoMonedaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idMoneda, montoMoneda, total } = req.body;

    if (!idTerminalWeb || !idMoneda || montoMoneda === undefined || total === undefined) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos (idTerminalWeb, idMoneda, montoMoneda, total).'
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb },
      { name: 'idMoneda', type: sql.Int, value: idMoneda },
      { name: 'montoMoneda', type: sql.Money, value: montoMoneda },
      { name: 'total', type: sql.Money, value: total }
    ];

    await executeRequest({
      query: 'sp_agregarDetArqueoMonedaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: 'Detalle de moneda agregado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al agregar detalle de moneda');
  }
};

/**
 * Controller para listar los detalles de moneda temporal
 */
export const listarDetArqueoMonedaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_listarDetArqueoMonedaTmp',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const recordsets = result.recordsets as any[];
    const detalle = recordsets[0];
    const totalArqueo = recordsets[1]?.[0]?.totalArqueo || 0;

    res.status(200).json({
      success: true,
      result: detalle,
      totalArqueo
    });

  } catch (error: any) {
    sendError(res, error, 'Error al listar detalles de moneda');
  }
};

/**
 * Controller para eliminar un detalle de moneda temporal
 */
export const eliminarDetArqueoMonedaTmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idTerminalWeb, idMoneda } = req.query as any;

    if (!idTerminalWeb || !idMoneda) {
      res.status(400).json({
        success: false,
        message: "Los parámetros 'idTerminalWeb' y 'idMoneda' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) },
      { name: 'idMoneda', type: sql.Int, value: parseInt(idMoneda) }
    ];

    await executeRequest({
      query: 'DELETE FROM dbo.detArqueoMonedaTmp WHERE idTerminalWeb = @idTerminalWeb AND idMoneda = @idMoneda',
      inputs: inputs as any,
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      message: 'Detalle de moneda eliminado exitosamente'
    });

  } catch (error: any) {
    sendError(res, error, 'Error al eliminar detalle de moneda');
  }
};

/**
 * Controller para listar las tarjetas disponibles
 */
export const listarTarjetas = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'SELECT idTarjetaDebito, nombreTarjetaDebito FROM dbo.tarjetaDebito ORDER BY nombreTarjetaDebito',
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al listar tarjetas');
  }
};

/**
 * Controller para listar las monedas activas
 */
export const listarMonedas = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'SELECT idMoneda, nombre, simbolo, cotizacion, activo FROM dbo.moneda WHERE activo = 1 ORDER BY nombre',
      isStoredProcedure: false
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al listar monedas');
  }
};


/**
 * Ventas a crédito y cobros de créditos de la caja abierta de la terminal (pantalla de arqueo).
 * Las ventas a crédito son informativas (no entra dinero); los cobros suman a lo esperado.
 */
export const resumenCreditoCaja = async (req: Request, res: Response): Promise<void> => {
  const idTerminalWeb = Number(req.query.idTerminalWeb);
  if (!Number.isInteger(idTerminalWeb) || idTerminalWeb <= 0) {
    res.status(400).json({ success: false, message: "El parámetro 'idTerminalWeb' es obligatorio" });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_resumenCreditoCaja',
      isStoredProcedure: true,
      inputs: [{ name: 'idTerminalWeb', type: sql.Int, value: idTerminalWeb }],
    });
    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    res.status(200).json({
      success: true,
      ventasCredito: recordsets?.[0] ?? [],
      cobros: recordsets?.[1] ?? [],
      devoluciones: recordsets?.[2] ?? [],   // devoluciones de ventas al contado: el dinero salió de la caja
    });
  } catch (error: any) {
    sendError(res, error, 'Error al consultar las ventas a crédito de la caja');
  }
};
