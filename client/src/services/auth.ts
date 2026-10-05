import axios from 'axios';

const TOKEN_KEY = 'authToken';
const SESSION_KEYS = [TOKEN_KEY, 'user', 'idUsuario', 'idMovimientoCaja', 'idCajaActual'];

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

let permisosPromise: Promise<Set<string>> | null = null;

/** Permisos (nombreSistema) del usuario logueado. Se consultan una vez por sesión. */
export const obtenerMisPermisos = (): Promise<Set<string>> => {
  if (!permisosPromise) {
    permisosPromise = axios
      .get<{ permisos: string[] }>(`${API_BASE_URL}/rol/mis-permisos`)
      .then((response) => new Set(response.data.permisos))
      .catch((error) => {
        permisosPromise = null; // permitir reintentar
        throw error;
      });
  }
  return permisosPromise;
};

export const clearSession = (): void => {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  permisosPromise = null;
};

/**
 * Agrega el token a cada request y, si el servidor responde 401 con una sesión abierta,
 * la limpia y manda al login (token vencido o inválido).
 */
export const setupAuthInterceptor = (): void => {
  axios.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const esLogin = error.config?.url?.includes('/auth/login');
      if (error.response?.status === 401 && !esLogin && getAuthToken()) {
        clearSession();
        window.location.assign('/login');
      }
      return Promise.reject(error);
    }
  );
};
