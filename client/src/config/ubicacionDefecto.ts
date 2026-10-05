/**
 * Ubicación que se preselecciona al cargar un cliente/persona nueva.
 * Se configura por instalación en el .env del cliente, ej:
 *   VITE_DEPARTAMENTO_DEFECTO=GUAIRA
 *   VITE_DISTRITO_DEFECTO=VILLARRICA
 *   VITE_CIUDAD_DEFECTO=VILLARRICA
 * Si no se define, no se preselecciona nada.
 */
const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

const crearMatcher = (valor: string | undefined) => {
  const buscado = valor ? normalizar(valor) : '';
  return (nombre: string): boolean => !!buscado && normalizar(nombre).includes(buscado);
};

export const esDepartamentoPorDefecto = crearMatcher(import.meta.env.VITE_DEPARTAMENTO_DEFECTO);
export const esDistritoPorDefecto = crearMatcher(import.meta.env.VITE_DISTRITO_DEFECTO);
export const esCiudadPorDefecto = crearMatcher(import.meta.env.VITE_CIUDAD_DEFECTO);
