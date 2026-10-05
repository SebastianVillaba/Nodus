import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type EstadoTimbradoCodigo =
  | 'VIGENTE' | 'POR_VENCER' | 'POR_AGOTARSE' | 'NO_INICIADO' | 'VENCIDO' | 'AGOTADO' | 'SIN_TIMBRADO';

export interface Timbrado {
  idFactura: number;
  idSucursal: number;
  nombreSucursal: string;
  dsuc: string;
  dcaja: string;
  puntoExpedicion: string;
  timbrado: string;
  fechaInicio: string;
  fechaCaduca: string;
  nroDesde: number;
  nroHasta: number | null;
  proximoNumero: number;
  ultimoEmitido: number;
  preImpreso: boolean;
  activo: boolean;
  terminalesAsignadas: number;
  estado: 'VIGENTE' | 'POR_VENCER' | 'NO_VALIDO' | 'INACTIVO';
}

export interface GuardarTimbradoRequest {
  idFactura: number; // 0 = nuevo
  idSucursal: number;
  dsuc: string;
  dcaja: string;
  timbrado: string;
  fechaInicio: string;
  fechaCaduca: string;
  nroDesde: number;
  nroHasta: number | null;
  proximoNumero: number;
  preImpreso: boolean;
  activo: boolean;
}

export interface EstadoTimbrado {
  idFactura: number | null;
  timbrado: string | null;
  estado: EstadoTimbradoCodigo;
  bloquea: boolean;
  mensaje: string | null;
  fechaCaduca: string | null;
  diasParaVencer: number | null;
  numerosRestantes: number | null;
}

export const timbradoService = {
  listar: async (soloActivos = false): Promise<Timbrado[]> => {
    const response = await axios.get(`${API_BASE_URL}/timbrado`, { params: soloActivos ? { soloActivos: 1 } : {} });
    return response.data.timbrados;
  },

  estado: async (idTerminalWeb: number): Promise<EstadoTimbrado> => {
    const response = await axios.get(`${API_BASE_URL}/timbrado/estado`, { params: { idTerminalWeb } });
    return response.data.estado;
  },

  guardar: async (data: GuardarTimbradoRequest): Promise<number> => {
    const response = await axios.post(`${API_BASE_URL}/timbrado`, data);
    return response.data.idFactura;
  },
};
