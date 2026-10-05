import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface CuotaPendiente {
  idCuotaVenta: number;
  idVenta: number;
  nroFactura: string;
  fechaVenta: string;
  totalVenta: number;
  nroCuota: number;
  cantidadCuotas: number;
  fechaVencimiento: string;
  monto: number;
  saldo: number;
  diasAtraso: number;
}

export interface ReciboCobro {
  idCobroCredito: number;
  nroRecibo: number;
  fechaCobro: string;
  idCliente: number;
  nombreCliente: string;
  totalCobrado: number;
  activo: boolean;
  idMovimientoCaja: number;
  estadoCaja: string;
  usuario: string;
  rucCliente?: string;
  observacion?: string | null;
  nroCaja?: number;
  nombreSucursal?: string;
  motivoAnulacion?: string | null;
  fechaAnulacion?: string | null;
  usuarioAnulacion?: string | null;
}

export interface DatosReciboCobro {
  cabecera: {
    nombreFantasia: string;
    ruc: string;
    nombreSucursal: string;
    nroRecibo: number;
    fechaCobro: string;
    cliente: string;
    rucCliente: string;
    totalCobrado: number;
    totalLetra: string;
    observacion: string | null;
    activo: boolean;
    cajero: string;
    saldoPendiente: number;
  };
  detalle: {
    nroFactura: string;
    nroCuota: number;
    cantidadCuotas: number;
    fechaVencimiento: string;
    monto: number;
    saldoCuota: number;
  }[];
}

export const cobroCreditoService = {
  cuotasPendientes: async (idCliente: number): Promise<CuotaPendiente[]> => {
    const response = await axios.get(`${API_BASE_URL}/cobro-credito/cuotas`, { params: { idCliente } });
    return response.data.cuotas;
  },

  guardar: async (data: {
    idCliente: number;
    idTerminalWeb: number;
    observacion?: string;
    detalle: { idCuotaVenta: number; monto: number }[];
  }): Promise<{ idCobroCredito: number; nroRecibo: number; totalCobrado: number }> => {
    const response = await axios.post(`${API_BASE_URL}/cobro-credito`, data);
    return response.data;
  },

  // La anulación se hace con AnulacionModal (usuario y contraseña del autorizador)
  listar: async (filtros: { idCliente?: number; nroRecibo?: number; desde?: string; hasta?: string }): Promise<ReciboCobro[]> => {
    const response = await axios.get(`${API_BASE_URL}/cobro-credito`, { params: filtros });
    return response.data.cobros;
  },

  recibo: async (idCobroCredito: number): Promise<DatosReciboCobro> => {
    const response = await axios.get(`${API_BASE_URL}/cobro-credito/${idCobroCredito}/recibo`);
    return { cabecera: response.data.cabecera, detalle: response.data.detalle };
  },
};

/**
 * Reparte un monto entre las cuotas, de la más antigua a la más nueva (vienen ordenadas por vencimiento).
 * Devuelve el monto a cobrar de cada cuota por idCuotaVenta.
 */
export const distribuirMonto = (cuotas: CuotaPendiente[], monto: number): Record<number, number> => {
  const resultado: Record<number, number> = {};
  let restante = Math.max(0, Math.floor(monto));
  for (const cuota of cuotas) {
    if (restante <= 0) break;
    const aplicar = Math.min(cuota.saldo, restante);
    resultado[cuota.idCuotaVenta] = aplicar;
    restante -= aplicar;
  }
  return resultado;
};

/**
 * Plan de cuotas igual al que genera sp_guardarVenta: cuotas redondeadas a miles y la última
 * absorbe la diferencia (100.000 en 3 = 33.000 + 33.000 + 34.000).
 */
export const calcularCuotas = (total: number, cantidad: number): number[] => {
  if (cantidad < 1 || total <= 0) return [];
  let base = Math.floor(total / cantidad / 1000) * 1000;
  if (base === 0) base = Math.floor(total / cantidad);
  return Array.from({ length: cantidad }, (_, i) => (i === cantidad - 1 ? total - base * (cantidad - 1) : base));
};
