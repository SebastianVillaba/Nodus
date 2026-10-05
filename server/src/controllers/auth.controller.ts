import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { executeRequest, sql } from "../utils/dbHandler";
import { sendError } from '../utils/errorResponse';
import { firmarToken } from '../Middlewares/auth.middleware';

interface Usuario {
  idUsuario: number;
  username: string;
  password: string;
  activo: boolean;
}

const CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos";

/**
 * Busca un usuario activo y valida su contraseña.
 * Devuelve null si el usuario no existe, está inactivo o la contraseña no coincide.
 */
export const validarCredenciales = async (username: string, password: string): Promise<Usuario | null> => {
  const result = await executeRequest({
    query: 'SELECT idUsuario, username, password, activo FROM usuario WHERE username = @username',
    inputs: [{ name: 'username', type: sql.VarChar(50), value: username }],
  });

  const user = result.recordset[0] as Usuario | undefined;
  if (!user || !user.activo) return null;

  const validPassword = await bcrypt.compare(password, user.password);
  return validPassword ? user : null;
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ message: "Nombre de usuario y contraseña son obligatorios!" });
    return;
  }

  try {
    const user = await validarCredenciales(username, password);

    if (!user) {
      res.status(401).json({ message: CREDENCIALES_INVALIDAS });
      return;
    }

    const token = firmarToken({ id: user.idUsuario, username: user.username });

    res.json({
      message: "Login exitoso",
      token,
      user: {
        idUsuario: user.idUsuario,
        username: user.username,
      },
      success: true
    });
  } catch (error) {
    sendError(res, error, 'Error en el servidor');
  }
};
