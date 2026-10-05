import { Request, Response } from "express";
import { executeRequest, sql } from "../utils/dbHandler";
import { InsertarProductoRequest, InsertarProductoResponse, BuscarProductoRequest, ModificarProductoRequest, InsertarTipoProductoRequest } from "../types/producto/producto.type";
import { flattenError } from "zod";
import { sendError } from '../utils/errorResponse';

/**
 * Controller para insertar una nueva persona en el sistema.
 *
 * @param req
 * @param res
 *
 */
export const insertarProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    // PASO 1: Extraer todos los datos del body de la petición
    // Usamos destructuring para obtener cada campo del objeto req.body
    const {
      nombre,
      presentacion,
      codigo,
      codigoBarra,
      precio,
      idUsuarioAlta,
      idTipoProducto,
      gasto,
      origen,
      activo,
      idImpuesto,
      imagenUrl
    } = req.body as InsertarProductoRequest;

    // PASO 2: Validar campos obligatorios
    // El nombre y el ID del usuario que da de alta son obligatorios
    if (!nombre || !idUsuarioAlta) {
      res.status(400).json({
        success: false,
        message: "El nombre y usuario son obligatorios"
      });
      return;
    }

    // PASO 5: Preparar los parámetros para el stored procedure
    const inputs = [
      { name: 'nombre', type: sql.VarChar, value: nombre },
      { name: 'presentacion', type: sql.VarChar, value: presentacion || '' },
      { name: 'codigo', type: sql.Int, value: codigo || 0 },
      { name: 'codigoBarra', type: sql.VarChar, value: codigoBarra || '' },
      { name: 'precio', type: sql.Money, value: precio || 0 },
      // Costo se maneja por Stock Inicial
      { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta },
      { name: 'idTipoProducto', type: sql.Int, value: idTipoProducto || 0 },
      { name: 'gasto', type: sql.Bit, value: gasto || false },
      { name: 'origen', type: sql.Bit, value: origen || false },
      { name: 'activo', type: sql.Bit, value: activo !== undefined ? activo : true },
      { name: 'idImpuesto', type: sql.Int, value: idImpuesto || 0 },
      { name: 'imagenUrl', type: sql.VarChar, value: imagenUrl || '' },
    ];

    const result = await executeRequest({
      query: 'sp_insertarProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

// PASO 7: Verificar el resultado y enviar respuesta exitosa
const rowsAffected = result.rowsAffected[0];

res.status(201).json({
  success: true,
  message: "Producto insertado exitosamente",
  rowsAffected: rowsAffected
} as InsertarProductoResponse);

  } catch (error: any) {
    sendError(res, error, 'Error interno del servidor al insertar el producto');
  }
};

/**
 * Controller para buscar productos
 */
export const buscarProductos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipoBusqueda, busqueda } = req.query as any;

    const inputs = [
      { name: 'tipoBusqueda', type: sql.Int, value: parseInt(tipoBusqueda) || 1 },
      { name: 'busqueda', type: sql.VarChar, value: busqueda || '' }
    ];

    const result = await executeRequest({
      query: 'sp_consultaProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al buscar productos');
  }
};

/**
 * Controller para obtener información de un producto
 */
export const obtenerInfoProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idProducto } = req.query as any;

    const inputs = [
      { name: 'idProducto', type: sql.Int, value: parseInt(idProducto) }
    ];

    const result = await executeRequest({
      query: 'sp_consultaInformacionProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });
    console.log(result);

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al obtener información del producto');
  }
};

/**
 * Controller para obtener tipos de producto
 */
export const obtenerTiposProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'select * from v_tipoProducto',
      isStoredProcedure: false
    });

    res.status(200).json(result.recordset);
  } catch (error: any) {
    sendError(res, error, 'Error al obtener tipos de producto');
  }
};

/**
 * Controller para consultar precio de producto
 * Ejecuta sp_consultaPrecioProducto que busca por código, código de barra o nombre
 */
export const consultarPrecioProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { busqueda, idTerminalWeb } = req.query as any;

    if (!busqueda) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'busqueda' es obligatorio"
      });
      return;
    }

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'busqueda', type: sql.VarChar, value: busqueda },
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_consultaPrecioProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al consultar precio del producto');
  }
}

/**
 * Controller para consultar stock de producto
 * Ejecuta sp_consultaStockProducto que busca por código, código de barra o nombre en el depósito de la terminal
 */
export const consultarStockProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { busqueda, idTerminalWeb } = req.query as any;

    if (!idTerminalWeb) {
      res.status(400).json({
        success: false,
        message: "El parámetro 'idTerminalWeb' es obligatorio"
      });
      return;
    }

    const searchVal = (busqueda === undefined || busqueda === null || busqueda === '') ? '%' : busqueda;

    const inputs = [
      { name: 'busqueda', type: sql.VarChar, value: searchVal },
      { name: 'idTerminalWeb', type: sql.Int, value: parseInt(idTerminalWeb) }
    ];

    const result = await executeRequest({
      query: 'sp_consultaStockProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al consultar stock del producto');
  }
}

/**
 * Controller para modificar un producto existente.
 */
export const modificarProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idProducto,
      nombre,
      presentacion,
      codigo,
      codigoBarra,
      precio,
      origen,
      idUsuarioMod,
      idTipoProducto,
      gasto,
      activo,
      idImpuesto,
      imagenUrl
    } = req.body as ModificarProductoRequest;

    // Validar campos obligatorios
    if (!idProducto || !nombre || !idUsuarioMod) {
      res.status(400).json({
        success: false,
        message: "Los campos 'idProducto', 'nombre' e 'idUsuarioMod' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idProducto', type: sql.Int, value: idProducto },
      { name: 'nombre', type: sql.VarChar(100), value: nombre },
      { name: 'presentacion', type: sql.VarChar(30), value: presentacion || '' },
      { name: 'codigo', type: sql.Int, value: codigo || 0 },
      { name: 'codigoBarra', type: sql.VarChar(30), value: codigoBarra || '' },
      { name: 'precio', type: sql.Money, value: precio || 0 },
      // Costo no se edita aqui
      { name: 'idUsuarioMod', type: sql.Int, value: idUsuarioMod },
      { name: 'idTipoProducto', type: sql.Int, value: idTipoProducto || 0 },
      { name: 'gasto', type: sql.Bit, value: gasto || false },
      { name: 'origen', type: sql.Bit, value: origen !== undefined ? origen : false },
      { name: 'activo', type: sql.Bit, value: activo !== undefined ? activo : true },
      { name: 'idImpuesto', type: sql.Int, value: idImpuesto || 0 },
      { name: 'imagenUrl', type: sql.VarChar, value: imagenUrl || '' }
    ];

    const result = await executeRequest({
      query: 'sp_modificarProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const rowsAffected = result.rowsAffected[0];

    res.status(200).json({
      success: true,
      message: "Producto modificado exitosamente",
      rowsAffected: rowsAffected
    });

  } catch (error: any) {
    sendError(res, error, 'Error interno del servidor al modificar el producto');
  }
}

export const obtenerPrecioDescuento = async (req: Request, res: Response): Promise<void> => {
  const { idProducto } = req.query;
  try {
    const result = await executeRequest({
      query: 'select [dbo].[funObtenerPrecioOferta](@idProducto) as precioDescuento',
      inputs: [{ name: 'idProducto', type: sql.Int, value: Number(idProducto) }],
      isStoredProcedure: false
    })
    res.status(200).json(result.recordset);
  } catch (error: any) {
    sendError(res, error, 'Error al obtener el precio de descuento');
  }
};

/**
 * Controller para insertar un nuevo tipo de producto rápido
 */
export const insertarTipoProducto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, idUsuarioAlta } = req.body as InsertarTipoProductoRequest;

    if (!nombre) {
      res.status(400).json({
        success: false,
        message: "El nombre es obligatorio"
      });
      return;
    }

    if (!idUsuarioAlta) {
      res.status(400).json({
        success: false,
        message: "El usuario de alta es obligatorio"
      });
      return;
    }

    const inputs = [
      { name: 'nombre', type: sql.VarChar, value: nombre },
      { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta }
    ];

    const result = await executeRequest({
      query: 'sp_insertarTipoProducto',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    res.status(201).json({
      success: true,
      message: "Tipo de producto insertado exitosamente",
      rowsAffected: result.rowsAffected[0]
    });

  } catch (error: any) {
    sendError(res, error, 'Error interno del servidor al insertar el tipo de producto');
  }
};