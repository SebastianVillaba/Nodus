import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** DEV = por devolución de mercadería, MONTO = por monto (descuento, bonificación) */
export type TipoNotaCredito = 'DEV' | 'MONTO';

export interface FacturaNotaCredito {
  cabecera: {
    idVenta: number;
    /** true = venta no impresa (cve): la devolución queda sin número ni timbrado */
    noImp: boolean;
    nroFactura: string | null;
    fechaFactura: string;
    timbrado: string | null;
    idCliente: number;
    cliente: string;
    ruc: string;
    idTipoVenta: number;
    condicionVenta: string;
    totalVenta: number;
    activo: boolean;
    totalAcreditado: number;
    totalDisponible: number;
    saldoCuotas: number;
  };
  detalle: {
    idDetVenta: number;
    idProducto: number;
    codigo: string;
    nombreProducto: string;
    idImpuesto: number;
    porcentajeImpuesto: number;
    cantidadVendida: number;
    cantidadDevuelta: number;
    cantidadDisponible: number;
    precioUnitario: number;
    subtotal: number;
  }[];
  impuestos: {
    idImpuesto: number;
    nombreImpuesto: string;
    porcentajeImpuesto: number;
    vendido: number;
    acreditado: number;
    disponible: number;
  }[];
  notas: {
    tipo: TipoNotaCredito;
    idDocumento: number;
    nroNotaCredito: string | null;
    fechaAlta: string;
    totalNotaCredito: number;
    activo: boolean;
  }[];
}

export interface VentaParaNotaCredito {
  idVenta: number;
  noImp: boolean;
  nroFactura: string | null;
  fechaAlta: string;
  cliente: string;
  ruc: string;
  totalVenta: number;
  idTipoVenta: number;
  condicionVenta: string;
  activo: boolean;
}

export interface FiltroVentaNotaCredito {
  noImp: boolean;
  dsuc?: number;
  dcaja?: number;
  dfactu?: number;
  cliente?: string;
  idVenta?: number;
}

export interface NotaCreditoGuardada {
  idDocumento: number;
  nroNotaCredito: string | null;
  noImp?: boolean;
  /** Devolución de una venta al contado: lo que se entregó al cliente desde la caja abierta */
  montoDevueltoCaja?: number;
  totalNotaCredito: number;
  montoAplicadoCredito: number;
}

export interface NotaCreditoListado {
  tipo: TipoNotaCredito;
  idDocumento: number;
  noImp: boolean;
  numero: number | null;
  nroNotaCredito: string | null;
  fechaAlta: string;
  idVenta: number;
  nroFactura: string | null;
  idTipoVenta: number;
  idCliente: number;
  cliente: string;
  ruc: string;
  motivo: string;
  totalNotaCredito: number;
  montoAplicadoCredito: number;
  montoDevueltoCaja: number;
  activo: boolean;
  nombreSucursal: string;
  usuario: string;
  motivoAnulacion: string | null;
  fechaAnulacion: string | null;
  usuarioAnulacion: string | null;
}

export interface DatosNotaCredito {
  cabecera: {
    nombreFantasia: string;
    nombre: string;
    ruc: string;
    direccionEmpresa: string | null;
    telefonoEmpresa: string | null;
    idDocumento: number;
    noImp: boolean;
    idVenta: number;
    fechaHora: string;
    nroNotaCredito: string | null;
    timbrado: string | null;
    fechaInicioVigencia: string | null;
    fechaFinVigencia: string | null;
    cliente: string;
    rucCliente: string;
    nroFactura: string | null;
    fechaFactura: string;
    timbradoFactura: string | null;
    condicionVenta: string;
    motivo: string;
    total: number;
    montoAplicadoCredito: number;
    montoDevueltoCaja: number;
    activo: boolean;
    usuario: string;
    tipo: TipoNotaCredito;
    gravada10: number;
    gravada5: number;
    exenta: number;
    iva10: number;
    iva5: number;
    totalIva: number;
  };
  detalle: {
    cantidad: number;
    codigo: string;
    mercaderia: string;
    precio: number;
    subtotal: number;
    porcentajeImpuesto: number;
  }[];
}

export const notaCreditoService = {
  /** Ventas que coinciden con el filtro (para el modal de búsqueda) */
  buscarVentas: async (filtro: FiltroVentaNotaCredito): Promise<VentaParaNotaCredito[]> => {
    const response = await axios.get(`${API_BASE_URL}/nota-credito/ventas`, { params: { ...filtro, noImp: filtro.noImp ? 1 : 0 } });
    return response.data.ventas;
  },

  /** Venta con sus artículos, disponible por IVA y notas emitidas. Por idVenta (+ noImp) o por número (001-001-0000123) */
  consultarFactura: async (filtro: { nroFactura?: string; idVenta?: number; noImp?: boolean }): Promise<FacturaNotaCredito> => {
    const response = await axios.get(`${API_BASE_URL}/nota-credito/factura`, { params: { ...filtro, noImp: filtro.noImp ? 1 : 0 } });
    const { cabecera, detalle, impuestos, notas } = response.data;
    return { cabecera, detalle, impuestos, notas };
  },

  guardarDevolucion: async (data: {
    idVenta: number;
    idTerminalWeb: number;
    motivo: string;
    noImp: boolean;
    detalle: { idDetVenta: number; cantidad: number }[];
  }): Promise<NotaCreditoGuardada> => {
    const response = await axios.post(`${API_BASE_URL}/nota-credito/devolucion`, data);
    return response.data;
  },

  guardarMonto: async (data: {
    idVenta: number;
    idTerminalWeb: number;
    motivo: string;
    detalle: { concepto: string; idImpuesto: number; monto: number }[];
  }): Promise<NotaCreditoGuardada> => {
    const response = await axios.post(`${API_BASE_URL}/nota-credito/monto`, data);
    return response.data;
  },

  listar: async (filtros: { tipo?: TipoNotaCredito; desde?: string; hasta?: string; nroNotaCredito?: number; idVenta?: number; noImp?: boolean }): Promise<NotaCreditoListado[]> => {
    const params = { ...filtros, noImp: filtros.noImp === undefined ? undefined : filtros.noImp ? 1 : 0 };
    const response = await axios.get(`${API_BASE_URL}/nota-credito`, { params });
    return response.data.notas;
  },

  reporte: async (tipo: TipoNotaCredito, idDocumento: number): Promise<DatosNotaCredito> => {
    const response = await axios.get(`${API_BASE_URL}/nota-credito/${tipo}/${idDocumento}/reporte`);
    return { cabecera: response.data.cabecera, detalle: response.data.detalle };
  },
};
