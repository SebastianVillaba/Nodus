import axios from 'axios';
import { getErrorMessage } from './httpError';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/servicio`;

/** Servicio facturable: no tiene stock (mano de obra, envíos, instalaciones, etc.) */
export interface Servicio {
  idServicio: number;
  codigo: string | null;
  nombreServicio: string;
  descripcion: string | null;
  precio: number;
  idImpuesto: number;
  nombreImpuesto: string;
  porcentajeImpuesto: number;
  /** Admite cantidades con decimales (ej: 1,5 horas) */
  permiteDecimal: boolean;
  activo: boolean;
}

export type ServicioGuardar = Pick<Servicio, 'codigo' | 'nombreServicio' | 'descripcion' | 'precio' | 'idImpuesto' | 'permiteDecimal' | 'activo'> & {
  idServicio?: number | null;
};

export const servicioService = {
  listar: async (busqueda = '', incluirInactivos = false): Promise<Servicio[]> => {
    try {
      const { data } = await axios.get(API_URL, { params: { busqueda, incluirInactivos: incluirInactivos ? 1 : 0 } });
      return (data.result as Servicio[]).map((s) => ({ ...s, precio: Number(s.precio) || 0 }));
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Error al listar los servicios'));
    }
  },

  /** Alta (sin idServicio) o modificación; devuelve el id del servicio */
  guardar: async (servicio: ServicioGuardar): Promise<number> => {
    try {
      const { data } = await axios.post(API_URL, servicio);
      return data.idServicio;
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Error al guardar el servicio'));
    }
  },
};
