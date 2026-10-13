import axios from 'axios';
import type { CompraConsulta, CompraListado, FiltroCompras } from './compras.service';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/nota-credito-proveedor`;

/** DEV = por devolución de mercadería, MONTO = por monto (descuento, bonificación, diferencia de precio) */
export type TipoNotaCreditoProveedor = 'DEV' | 'MONTO';

/** Datos del comprobante que emitió el proveedor */
export interface ComprobanteProveedor {
  timbrado: string;
  dsuc: number;
  dcaja: number;
  nroNotaCredito: number;
  /** AAAA-MM-DD */
  fecha: string;
  motivo: string;
}

export interface NotaCreditoProveedorGuardada {
  idDocumento: number;
  nroNotaCredito: string;
  totalNotaCredito: number;
}

export interface NotaCreditoProveedorListado {
  tipo: TipoNotaCreditoProveedor;
  idDocumento: number;
  idCompra: number;
  timbrado: string;
  nroNotaCredito: string;
  fecha: string;
  fechaAlta: string;
  motivo: string;
  totalNotaCredito: number;
  activo: boolean;
  proveedor: string;
  ruc: string;
  nroFacturaCompra: string;
  fechaCompra: string;
}

export interface NotaCreditoProveedorDetalle {
  cabecera: NotaCreditoProveedorListado & {
    usuario: string;
    timbradoCompra: string;
    totalCompra: number;
    motivoAnulacion: string | null;
    usuarioAnulacion: string | null;
    fechaAnulacion: string | null;
  };
  detalle: {
    idDetCompra: number | null;
    codigo: string | null;
    descripcion: string;
    deposito: string | null;
    impuesto: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
}

export interface FiltroNotasCreditoProveedor {
  tipo: TipoNotaCreditoProveedor;
  desde?: string;
  hasta?: string;
  proveedor?: string;
  nroNotaCredito?: number;
  idCompra?: number;
}

export const notaCreditoProveedorService = {
  /** Compras fiscales para registrar la nota */
  buscarCompras: async (filtro: Omit<FiltroCompras, 'noFiscal' | 'soloActivas'>): Promise<CompraListado[]> => {
    const response = await axios.get(`${API_URL}/compras`, { params: filtro });
    return response.data.compras;
  },

  consultarCompra: async (idCompra: number): Promise<CompraConsulta> => {
    const response = await axios.get(`${API_URL}/compras/${idCompra}`);
    const { cabecera, detalle, impuestos, notas } = response.data;
    return { cabecera, detalle, impuestos, notas };
  },

  guardarDevolucion: async (datos: ComprobanteProveedor & {
    idCompra: number;
    idTerminalWeb: number;
    detalle: { idDetCompra: number; cantidad: number }[];
  }): Promise<NotaCreditoProveedorGuardada> => {
    const response = await axios.post(`${API_URL}/devolucion`, datos);
    return response.data;
  },

  guardarMonto: async (datos: ComprobanteProveedor & {
    idCompra: number;
    idTerminalWeb: number;
    detalle: { concepto: string; idImpuesto: number; monto: number }[];
  }): Promise<NotaCreditoProveedorGuardada> => {
    const response = await axios.post(`${API_URL}/monto`, datos);
    return response.data;
  },

  listar: async (filtro: FiltroNotasCreditoProveedor): Promise<NotaCreditoProveedorListado[]> => {
    const response = await axios.get(API_URL, { params: filtro });
    return response.data.notas;
  },

  consultar: async (tipo: TipoNotaCreditoProveedor, idDocumento: number): Promise<NotaCreditoProveedorDetalle> => {
    const response = await axios.get(`${API_URL}/${tipo}/${idDocumento}`);
    return { cabecera: response.data.cabecera, detalle: response.data.detalle };
  },
};
