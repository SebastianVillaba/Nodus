import { Request, Response } from 'express';
import { executeRequest, sql } from '../utils/dbHandler';
import { generateVentasProductoPdf, generateVentasResumidoPdf, generateVentasVendedorPdf } from '../utils/pdfGenerator';
import { sendError } from '../utils/errorResponse';


/**
 * Controller para obtener el reporte de factura de venta
 * @param req - Request con el parámetro idVenta
 * @param res - Response con los datos de la factura
 */
export const reporteFacturaVenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idVenta } = req.query;

    if (!idVenta) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idVenta es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteFacturaVenta',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idVenta',
          type: sql.Int,
          value: parseInt(idVenta as string)
        }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    console.log(recordsets);

    res.status(200).json({
      success: true,
      message: 'Reporte generado exitosamente',
      cabecera: recordsets?.[0]?.[0] ?? null,
      items: recordsets?.[1] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de factura');
  }
};

/**
 * Controller para obtener el reporte del ticket de un pedido
 */
export const reporteTicketPedidoDia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idPedido, nro } = req.query;

    if (!idPedido || !nro) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros idPedido y nro son requeridos'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteTicketPedidoDia',
      isStoredProcedure: true,
      inputs: [
        { name: 'idPedido', type: sql.Int, value: parseInt(idPedido as string, 10) },
        { name: 'nro', type: sql.Int, value: parseInt(nro as string, 10) }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      message: 'Reporte de ticket de pedido generado exitosamente',
      cabecera: recordsets?.[0]?.[0] ?? null,
      items: recordsets?.[1] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar el ticket del pedido');
  }
};

/**
 * Controller para obtener el reporte de ticket de venta
 * @param req - Request con el parámetro idVenta
 * @param res - Response con los datos del ticket
 */
export const reporteTicketVenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idVenta } = req.query;

    if (!idVenta) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idVenta es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteTicketVenta',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idVenta',
          type: sql.Int,
          value: parseInt(idVenta as string)
        }
      ]
    });

    // El SP devuelve 2 recordsets:
    // recordset[0] = Cabecera
    // recordset[1] = Detalle de items

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      message: 'Reporte de ticket generado exitosamente',
      cabecera: recordsets?.[0]?.[0] ?? null,
      items: recordsets?.[1] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de ticket');
  }
};

/**
 * Controller para obtener el reporte de cierre de caja
 * @param req - Request con el parámetro idMovimientoCaja
 * @param res - Response con los datos del cierre
 */
export const reporteCierreCaja = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idMovimientoCaja } = req.query;

    if (!idMovimientoCaja) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idMovimientoCaja es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteCierreCaja',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idMovimientoCaja',
          type: sql.Int,
          value: parseInt(idMovimientoCaja as string)
        }
      ]
    });

    // El SP devuelve 6 recordsets:
    // recordset[0] = Resumen general y balance
    // recordset[1] = Detalle de gastos
    // recordset[2] = Detalle de Arqueo Moneda (Billete/Moneda extranjero/nacional)
    // recordset[3] = Detalle de Arqueo Tarjeta Crédito
    // recordset[4] = Detalle de Arqueo Tarjeta Débito
    // recordset[5] = Detalle de Arqueo Transferencias
    // recordset[6] = Ventas a crédito de la caja (migración 004)
    // recordset[7] = Cobros de créditos recibidos en la caja (migración 004)
    // recordset[8] = Devoluciones de ventas al contado pagadas desde la caja

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      message: 'Reporte de cierre de caja generado exitosamente',
      resumen: recordsets?.[0]?.[0] ?? null,
      gastos: recordsets?.[1] ?? [],
      arqueoMoneda: recordsets?.[2] ?? [],
      tarjetasCredito: recordsets?.[3] ?? [],
      devoluciones: recordsets?.[8] ?? [],
      tarjetasDebito: recordsets?.[4] ?? [],
      transferencias: recordsets?.[5] ?? [],
      ventasCredito: recordsets?.[6] ?? [],
      cobros: recordsets?.[7] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de cierre de caja');
  }
};

/**
 * Controller para obtener el reporte de ticket de remisión
 * @param req - Request con el parámetro idRemision
 * @param res - Response con los datos del ticket
 */
export const reporteTicketRemision = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idRemision } = req.query;

    if (!idRemision) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idRemision es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteTicketRemision',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idRemision',
          type: sql.Int,
          value: parseInt(idRemision as string)
        }
      ]
    });

    // El SP devuelve 2 recordsets:
    // recordset[0] = Cabecera
    // recordset[1] = Detalle de items

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      message: 'Reporte de ticket de remisión generado exitosamente',
      cabecera: recordsets?.[0]?.[0] ?? null,
      items: recordsets?.[1] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de ticket de remisión');
  }
};

/**
 * Controller para obtener el reporte de pedido delivery
 * @param req - Request con el parámetro idDelivery y fecha
 * @param res - Response con los datos del reporte
 */
export const reportePedidoDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idDelivery, fecha } = req.query;

    if (!idDelivery || !fecha) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros idDelivery y fecha son requeridos'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reportePedidoDelivery',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idDelivery',
          type: sql.Int,
          value: parseInt(idDelivery as string)
        },
        {
          name: 'fecha',
          type: sql.Date,
          value: new Date(fecha as string)
        }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;

    res.status(200).json({
      success: true,
      message: 'Reporte de pedido por delivery generado exitosamente',
      data: recordsets?.[0] ?? []
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de pedido por delivery');
  }
};

/**
 * Controller para obtener el reporte de venta de productos en un rango de fechas.
 * @param req - Request con los parámetros desde, hasta, idTipoProducto y opcionalmente format (ej. format=pdf)
 * @param res - Response con los datos del reporte o el archivo PDF
 */
export const reporteVentaProductoDia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta, idTipoProducto, format } = req.query;

    if (!desde || !hasta) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros desde y hasta son requeridos'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteVentaProductoDia',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'desde',
          type: sql.DateTime,
          value: new Date(desde as string)
        },
        {
          name: 'hasta',
          type: sql.DateTime,
          value: new Date(hasta as string)
        }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    let data = recordsets?.[0] ?? [];

    // Mapear idTipoProducto obteniendo los tipos desde la tabla de productos
    try {
      const prodTypesRes = await executeRequest({
        query: 'SELECT nombre, idTipoProducto FROM producto',
        isStoredProcedure: false
      });
      const prodTypeMap = new Map<string, number>();
      prodTypesRes.recordset.forEach((p: any) => {
        if (p.nombre) {
          prodTypeMap.set(p.nombre.trim().toLowerCase(), p.idTipoProducto);
        }
      });
      data = data.map((item: any) => {
        const itemNombre = item.nombre ? item.nombre.trim().toLowerCase() : '';
        return {
          ...item,
          idTipoProducto: prodTypeMap.get(itemNombre) || 0
        };
      });
    } catch (err) {
      console.error('Error mapping product types:', err);
    }

    // Filtrar si se requiere un tipo específico
    if (idTipoProducto && idTipoProducto !== 'TODOS' && idTipoProducto !== '0') {
      const filterId = parseInt(idTipoProducto as string, 10);
      data = data.filter((item: any) => item.idTipoProducto === filterId);
    }

    if (format === 'pdf') {
      return generateVentasProductoPdf(res, data, desde as string, hasta as string);
    }

    res.status(200).json({
      success: true,
      message: 'Reporte de venta de producto generado exitosamente',
      data: data
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de venta de producto');
  }
};

/**
 * Controller para obtener el reporte resumido de ventas en un rango de fechas y sucursal.
 * @param req - Request con desde, hasta, idSucursal y opcionalmente format (ej. format=pdf)
 */
export const reporteVentaResumidoFecha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta, idSucursal, format } = req.query;

    if (!desde || !hasta || idSucursal === undefined) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros desde, hasta e idSucursal son requeridos'
      });
      return;
    }

    const parsedSucursalId = parseInt(idSucursal as string, 10);

    const result = await executeRequest({
      query: 'sp_reporteVentaResumidoFecha',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'desde',
          type: sql.DateTime,
          value: new Date(desde as string)
        },
        {
          name: 'hasta',
          type: sql.DateTime,
          value: new Date(hasta as string)
        },
        {
          name: 'idSucursal',
          type: sql.Int,
          value: parsedSucursalId
        }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    const data = recordsets?.[0] ?? [];

    if (format === 'pdf') {
      let sucursalNombre = 'Todas las Sucursales';
      if (parsedSucursalId > 0) {
        const sucResult = await executeRequest({
          query: 'SELECT nombreSucursal FROM Sucursal WHERE idSucursal = @idSucursal',
          inputs: [{ name: 'idSucursal', type: sql.Int, value: parsedSucursalId }],
          isStoredProcedure: false
        });
        if (sucResult.recordset?.[0]?.nombreSucursal) {
          sucursalNombre = sucResult.recordset[0].nombreSucursal;
        }
      }
      return generateVentasResumidoPdf(res, data, desde as string, hasta as string, sucursalNombre);
    }

    res.status(200).json({
      success: true,
      message: 'Reporte de ventas resumido generado exitosamente',
      data: data
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de ventas resumido');
  }
};

/**
 * Controller para obtener el reporte de ventas por vendedor en un rango de fechas.
 * @param req - Request con desde, hasta y opcionalmente format (ej. format=pdf)
 */
export const reporteVentasVendedorFecha = async (req: Request, res: Response): Promise<void> => {
  try {
    const { desde, hasta, format } = req.query;

    if (!desde || !hasta) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros desde y hasta son requeridos'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_reporteVentasVendedorFecha',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'desde',
          type: sql.DateTime,
          value: new Date(desde as string)
        },
        {
          name: 'hasta',
          type: sql.DateTime,
          value: new Date(hasta as string)
        }
      ]
    });

    const recordsets = (result as typeof result & { recordsets?: any[] }).recordsets;
    const data = recordsets?.[0] ?? [];

    if (format === 'pdf') {
      return generateVentasVendedorPdf(res, data, desde as string, hasta as string);
    }

    res.status(200).json({
      success: true,
      message: 'Reporte de ventas por vendedor generado exitosamente',
      data: data
    });
  } catch (error) {
    sendError(res, error, 'Error al generar reporte de ventas por vendedor');
  }
};
