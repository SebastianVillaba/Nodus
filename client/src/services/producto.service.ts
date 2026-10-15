import axios from 'axios';
import { getErrorMessage } from './httpError';
import type { Producto, TipoProducto } from '../types/producto.types';

// URL base del API - ajusta según tu configuración
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Interface para la respuesta del endpoint producto/info
 */
interface ProductoInfoResponse {
  succes: boolean;
  message: string;
  result: ProductoInfo[];
}

/**
 * Interface para la respuesta del API al insertar un producto
 */
interface InsertarProductoResponse {
  success: boolean;
  message: string;
  rowsAffected?: number;
}

/**
 * Interface para los datos de producto desde producto/info
 */
interface ProductoInfo {
  idProducto: number;
  nombre: string;
  presentacion: string;
  codigo: string;
  codigoBarra: string;
  precio: number;
  costo: number;
  idTipoProducto: number;
  gasto: boolean;
  idImpuesto: number;
  imagenUrl?: string;
}

/**
 * Servicio para manejar las operaciones relacionadas con Productos
 */
export const productoService = {
  /**
   * Inserta un nuevo producto en el sistema
   * @param producto - Datos del producto a insertar
   * @returns Respuesta del servidor
   */
  insertarProducto: async (producto: Producto): Promise<InsertarProductoResponse> => {
    try {
      const response = await axios.post<InsertarProductoResponse>(
        `${API_BASE_URL}/producto`,
        producto
      );
      return response.data;
    } catch (error: any) {
      // Manejar errores del servidor
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Error al insertar el producto');
      }
      throw new Error(getErrorMessage(error, 'Error de conexión con el servidor'));
    }
  },

  /**
   * Modifica un producto existente
   * @param producto - Datos del producto a modificar
   * @returns Respuesta del servidor
   */
  modificarProducto: async (producto: any): Promise<InsertarProductoResponse> => {
    try {
      const response = await axios.put<InsertarProductoResponse>(
        `${API_BASE_URL}/producto`,
        producto
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Error al modificar el producto');
      }
      throw new Error(getErrorMessage(error, 'Error de conexión con el servidor'));
    }
  },

  /**
   * Busca productos por término de búsqueda
   * @param searchTerm - Término a buscar
   * @param searchBy - Campo por el cual buscar
   * @returns Lista de productos encontrados
   */
  buscarProductos: async (
    searchTerm: string,
    searchBy: number
  ): Promise<Producto[]> => {
    try {
      // TODO: Implementar endpoint de búsqueda en el backend
      const response = await axios.get<Producto[]>(
        `${API_BASE_URL}/producto/consulta`,
        {
          params: {
            "tipoBusqueda": searchBy,
            "busqueda": searchTerm
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error al buscar productos:', error);
      throw new Error(getErrorMessage(error, 'Error al buscar productos'));
    }
  },

  /**
   * Obtiene información detallada de un producto por su ID
   * @param idProducto - ID del producto
   * @returns Información completa del producto
   */
  obtenerInfoProducto: async (idProducto: number): Promise<ProductoInfo[]> => {
    try {
      const response = await axios.get<ProductoInfoResponse>(
        `${API_BASE_URL}/producto/info`,
        {
          params: {
            idProducto: idProducto
          }
        }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Error al obtener información del producto:', error);
      throw new Error(getErrorMessage(error, 'Error al obtener información del producto'));
    }
  },

  /**
   * Obtiene la lista de tipos de producto
   * @returns Lista de tipos de producto
   */
  obtenerTiposProducto: async (): Promise<TipoProducto[]> => {
    try {
      const response = await axios.get<TipoProducto[]>(
        `${API_BASE_URL}/producto/tipoProducto`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener tipos de producto:', error);
      throw new Error(getErrorMessage(error, 'Error al obtener tipos de producto'));
    }
  },

  /**
   * Crea un nuevo tipo de producto en el sistema (creación rápida)
   * @param nombre - Nombre del tipo de producto
   * @param idUsuarioAlta - ID del usuario creador
   * @returns Respuesta del servidor
   */
  insertarTipoProducto: async (nombre: string, idUsuarioAlta: number): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post<{ success: boolean; message: string }>(
        `${API_BASE_URL}/producto/tipoProducto`,
        { nombre, idUsuarioAlta }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Error al insertar el tipo de producto');
      }
      throw new Error(getErrorMessage(error, 'Error de conexión con el servidor'));
    }
  },

  /**
   * Consulta precio de producto por código, código de barra o nombre
   * @param busqueda - Término de búsqueda (código, código de barra o nombre)
   * @returns Lista de productos encontrados con precio y stock
   */
  consultarPrecioProducto: async (busqueda: string, idTerminalWeb: number): Promise<any[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/producto/precio`,
        {
          params: {
            busqueda: busqueda,
            idTerminalWeb: idTerminalWeb
          }
        }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Error al consultar precio del producto:', error);
      throw new Error(getErrorMessage(error, 'Error al consultar precio del producto'));
    }
  },

  /**
   * Consulta stock de producto por código, código de barra o nombre
   * @param busqueda - Término de búsqueda (código, código de barra o nombre)
   * @param idTerminalWeb - ID de la terminal web
   * @returns Lista de productos encontrados con stock
   */
  consultarStockProducto: async (busqueda: string, idTerminalWeb: number): Promise<any[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/producto/stock`,
        {
          params: {
            busqueda: busqueda,
            idTerminalWeb: idTerminalWeb
          }
        }
      );
      return response.data.result;
    } catch (error: any) {
      console.error('Error al consultar stock del producto:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al consultar stock del producto'));
    }
  },

  /**
   * Obtiene precio de descuento de un producto
   * @param idProducto - ID del producto
   * @returns Lista con el precio de descuento del producto
   */
  obtenerPrecioDescuento: async (idProducto: number): Promise<any[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/producto/precioDescuento`,
        {
          params: {
            idProducto: idProducto
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener precio de descuento:', error);
      throw new Error(getErrorMessage(error, 'Error al obtener precio de descuento'));
    }
  },

  /**
   * Sube una imagen para un producto
   * @param file - Archivo de imagen a subir
   * @returns Ruta de la imagen subida en el servidor
   */
  uploadImagen: async (file: File): Promise<{ success: boolean; imagenUrl: string }> => {
    try {
      const formData = new FormData();
      formData.append('imagen', file);
      const response = await axios.post<{ success: boolean; imagenUrl: string }>(
        `${API_BASE_URL}/producto/upload-image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error al subir la imagen:', error);
      if (error.response?.data) {
        throw new Error(error.response.data.message || 'Error al subir la imagen');
      }
      throw new Error(getErrorMessage(error, 'Error de conexión al subir la imagen'));
    }
  },

  /**
   * Carga las referencias de un producto en la tabla temporal.
   */
  cargarReferenciasTmp: async (idTerminalWeb: number, idProductoRef: number): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/producto/ref/cargar`, {
        idTerminalWeb,
        idProductoRef
      });
      return response.data;
    } catch (error: any) {
      console.error('Error al cargar referencias tmp:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al cargar referencias en la temporal'));
    }
  },

  /**
   * Obtiene los detalles de la temporal de referencias de productos.
   */
  obtenerDetallesTmp: async (idTerminalWeb: number): Promise<any[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/producto/ref/detalle`, {
        params: { idTerminalWeb }
      });
      return response.data.result;
    } catch (error: any) {
      console.error('Error al obtener detalles tmp:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al obtener detalles de referencias temporales'));
    }
  },

  /**
   * Agrega un producto referenciado al detalle temporal.
   */
  agregarDetalleTmp: async (idTerminalWeb: number, idProducto: number, cantidad: number): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/producto/ref/detalle`, {
        idTerminalWeb,
        idProducto,
        cantidad
      });
      return response.data;
    } catch (error: any) {
      console.error('Error al agregar detalle tmp:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al agregar producto referenciado temporal'));
    }
  },

  /**
   * Elimina un producto de la temporal por nro.
   */
  eliminarDetalleTmp: async (idTerminalWeb: number, nro: number): Promise<any> => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/producto/ref/detalle/${nro}`, {
        params: { idTerminalWeb }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error al eliminar detalle tmp:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al eliminar producto referenciado temporal'));
    }
  },

  /**
   * Guarda las referencias persistiendo los datos de la temporal.
   */
  /** controlaStock: true = combo con stock propio (se arma por adelantado), false = descuenta sus componentes al vender */
  guardarReferencias: async (idUsuarioAlta: number, idTerminalWeb: number, idProductoRef: number, controlaStock = false): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/producto/ref/guardar`, {
        idUsuarioAlta,
        idTerminalWeb,
        idProductoRef,
        controlaStock
      });
      return response.data;
    } catch (error: any) {
      console.error('Error al guardar referencias:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al guardar los productos referenciados'));
    }
  },

  /**
   * Limpia la tabla temporal de referencias para una terminal.
   */
  limpiarTemporal: async (idTerminalWeb: number): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/producto/ref/limpiar`, {
        idTerminalWeb
      });
      return response.data;
    } catch (error: any) {
      console.error('Error al limpiar temporal:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al limpiar temporal de referencias'));
    }
  },

  /**
   * Obtiene costo y precio sugeridos para un producto de referencia
   */
  obtenerSugeridosProductoRef: async (idProductoRef: number): Promise<{ existe: boolean; costoSugerido: number; precioSugerido: number }> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/producto/ref/sugeridos/${idProductoRef}`);
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener sugeridos de producto ref:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(getErrorMessage(error, 'Error al obtener valores sugeridos del producto referenciado'));
    }
  },

  /**
   * Obtiene la URL completa de una imagen
   * @param path - Ruta relativa de la imagen
   * @returns URL completa
   */
  obtenerUrlImagen: (path: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = API_BASE_URL.replace(/\/api$/, '');
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }
};
