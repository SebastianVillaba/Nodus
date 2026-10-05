import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  id: number;
  username: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

const extraerToken = (header: string | undefined): string | null => {
  if (!header) return null;
  const [tipo, token] = header.split(" ");
  return tipo === "Bearer" && token ? token : null;
};

export const firmarToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });

export const decodificarToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = extraerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ message: "Token no proporcionado" });
    return;
  }

  try {
    req.user = decodificarToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Sesión inválida o expirada" });
  }
};

/**
 * Devuelve el id del usuario autenticado (tomado del token, nunca del body/query).
 * Solo usar en rutas protegidas por verifyToken.
 */
export const getUserId = (req: Request): number => {
  const user = (req as AuthRequest).user;
  if (!user) {
    throw new Error("getUserId llamado en una ruta sin autenticación");
  }
  return user.id;
};

// Campos con los que el cliente indica "quién hace la operación".
// Se sobrescriben con el usuario del token para que no se puedan falsear.
const CAMPOS_USUARIO_ACTUAL = ["idUsuario", "idUsuarioAlta", "idUsuarioMod", "idUsuarioCierre"];

const sobrescribirCampos = (obj: Record<string, unknown>, campos: string[], idUsuario: number): void => {
  for (const campo of campos) {
    if (campo in obj) obj[campo] = idUsuario;
  }
};

/**
 * Reemplaza en body y query los ids de usuario enviados por el cliente por el del token.
 * `excluir` permite dejar pasar campos que en una ruta significan otra cosa
 * (ej: en el ABM de usuarios, idUsuario es el usuario que se está editando).
 */
export const forzarUsuarioAutenticado = (excluir: string[] = []) => {
  const campos = CAMPOS_USUARIO_ACTUAL.filter((c) => !excluir.includes(c));

  return (req: Request, _res: Response, next: NextFunction): void => {
    const idUsuario = getUserId(req);

    if (req.body && typeof req.body === "object") {
      sobrescribirCampos(req.body, campos, idUsuario);
    }
    // En Express 5 req.query es un getter: se reemplaza el objeto completo
    const query = { ...(req.query as Record<string, unknown>) };
    sobrescribirCampos(query, campos, idUsuario);
    Object.defineProperty(req, "query", { value: query, writable: true, configurable: true });

    next();
  };
};
