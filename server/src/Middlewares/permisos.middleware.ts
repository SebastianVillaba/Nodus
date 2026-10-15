import { Request, Response, NextFunction } from "express";
import { executeRequest, sql } from "../utils/dbHandler";
import { getUserId } from "./auth.middleware";
import { sendError } from "../utils/errorResponse";

/**
 * Permisos del sistema (columna permiso.nombreSistema).
 * Si se agrega uno nuevo, cargarlo también en la tabla permiso (ver database/).
 */
export const PERMISOS = {
  CAJA: "ACCESO_CAJA",
  VENTAS: "ACCESO_VENTAS",
  RPT_CAJA: "RPT_CAJA",
  VER_STOCK: "VER_STOCK",
  AJUSTES: "ACCESO_AJUSTES",
  REMISIONES: "ACCESO_REMISIONES",
  COMPRAS: "ACCESO_COMPRAS",
  SEGURIDAD: "ACCESO_SEGURIDAD",
  AUDITORIA: "ACCESO_AUDITORIA",
  PEDIDOS: "ACCESO_PEDIDOS",
  OFERTAS: "ACCESO_OFERTAS",
  CARGA_PRODUCTOS: "ACCESO_CARGA_PRODUCTOS",
  HISTORIAL_CLIENTE: "ACCESO_HISTORIAL_CLIENTE",
  ABM: "ACCESO_ABM",
  TIMBRADOS: "ACCESO_TIMBRADOS",
  COBRANZAS: "ACCESO_COBRANZAS",
  NC_DEVOLUCION: "ACCESO_NC_DEVOLUCION",
  NC_MONTO: "ACCESO_NC_MONTO",
  NC_PROVEEDOR_DEVOLUCION: "ACCESO_NC_PROVEEDOR_DEVOLUCION",
  NC_PROVEEDOR_MONTO: "ACCESO_NC_PROVEEDOR_MONTO",
  SEGUIMIENTO_STOCK: "SEGUIMIENTO_STOCK",
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

// Cache corto por usuario para no consultar la base en cada request.
// Un cambio de rol/permisos se refleja como máximo en CACHE_MS.
const CACHE_MS = 60_000;
const cache = new Map<number, { permisos: Set<string>; vence: number }>();

export const obtenerPermisosUsuario = async (idUsuario: number): Promise<Set<string>> => {
  const enCache = cache.get(idUsuario);
  if (enCache && enCache.vence > Date.now()) return enCache.permisos;

  const result = await executeRequest({
    query: `
      SELECT DISTINCT p.nombreSistema
      FROM usuario u
      INNER JOIN rol r ON u.idRol = r.idRol
      INNER JOIN rolPermiso rp ON r.idRol = rp.idRol
      INNER JOIN permiso p ON rp.idPermiso = p.idPermiso
      WHERE u.idUsuario = @idUsuario AND u.activo = 1 AND r.activo = 1`,
    inputs: [{ name: "idUsuario", type: sql.Int, value: idUsuario }],
  });

  const permisos = new Set<string>(result.recordset.map((r: { nombreSistema: string }) => r.nombreSistema));
  cache.set(idUsuario, { permisos, vence: Date.now() + CACHE_MS });
  return permisos;
};

/** Invalida el cache (ej: después de modificar la configuración de un rol). */
export const limpiarCachePermisos = (): void => cache.clear();

/**
 * Exige que el usuario autenticado tenga al menos uno de los permisos indicados.
 * Usar después de verifyToken.
 */
export const requierePermiso = (...permisos: Permiso[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const delUsuario = await obtenerPermisosUsuario(getUserId(req));
      if (permisos.some((p) => delUsuario.has(p))) {
        next();
        return;
      }
      res.status(403).json({ success: false, message: "No tienes permiso para realizar esta acción" });
    } catch (error) {
      sendError(res, error, "Error al validar permisos");
    }
  };
};

const METODOS_LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Igual que requierePermiso pero solo para operaciones de escritura (POST/PUT/DELETE/PATCH).
 * Las lecturas quedan abiertas a cualquier usuario autenticado porque otras pantallas
 * las usan como catálogos (ej: Facturación busca productos y clientes).
 */
export const requierePermisoEscritura = (...permisos: Permiso[]) => {
  const validar = requierePermiso(...permisos);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (METODOS_LECTURA.has(req.method)) {
      next();
      return;
    }
    void validar(req, res, next);
  };
};
