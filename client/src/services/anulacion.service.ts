import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface AnularFacturacionRequest {
  idVenta: number;
  idTerminalWeb: number;
  idSucursal: number;
  explica: string;
  tipo: number;
  usuarioAutorizador: string;
  passwordAutorizador: string;
}

export interface AnularCargaProductoRequest {
  idCargaProducto: number;
  idTerminalWeb: number;
  idSucursal: number;
  explica: string;
  usuarioAutorizador: string;
  passwordAutorizador: string;
}

export interface AnularCobroCreditoRequest {
  idCobroCredito: number;
  explica: string;
  usuarioAutorizador: string;
  passwordAutorizador: string;
}

export const anulacionService = {
  /**
   * Verifica si un usuario tiene permiso para anular según el tipo indicado.
   * Llama a GET /api/anulacion/permiso
   */
  verificarPermisoAnular: async (idUsuario: number, tipo: string): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/anulacion/permiso`, {
        params: { idUsuario, tipo }
      });
      // El backend retorna tienePermiso (boolean) en su respuesta
      return response.data.tienePermiso;
    } catch (error: any) {
      console.error('Error al verificar permiso de anulación:', error);
      throw new Error(error.response?.data?.message || 'Error al verificar el permiso de anulación');
    }
  },

  /**
   * Anula una facturación (venta).
   * Llama a POST /api/anulacion/facturacion
   */
  anularFacturacion: async (data: AnularFacturacionRequest): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/anulacion/facturacion`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error al anular la facturación:', error);
      throw new Error(error.response?.data?.message || 'Error al anular la facturación');
    }
  },

  /**
   * Anula una carga de productos.
   * Llama a POST /api/anulacion/carga-producto
   */
  /**
   * Anula un recibo de cobro de créditos.
   * Llama a POST /api/anulacion/cobro-credito
   */
  anularCobroCredito: async (data: AnularCobroCreditoRequest): Promise<any> => {
    const response = await axios.post(`${API_BASE_URL}/anulacion/cobro-credito`, data);
    return response.data;
  },

  anularCargaProducto: async (data: AnularCargaProductoRequest): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/anulacion/carga-producto`, data);
      return response.data;
    } catch (error: any) {
      console.error('Error al anular la carga de producto:', error);
      throw new Error(error.response?.data?.message || 'Error al anular la carga de producto');
    }
  }
};

