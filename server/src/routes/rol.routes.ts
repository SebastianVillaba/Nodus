import { Router } from 'express';
import { obtenerConfiguracionRol, guardarConfiguracionRol, validarPermiso, obtenerRoles, obtenerMisPermisos } from '../controllers/rol.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();
const seguridad = requierePermiso(PERMISOS.SEGURIDAD);

router.get('/configuracion/:idRol', seguridad, obtenerConfiguracionRol);
router.post('/configuracion', seguridad, guardarConfiguracionRol);
router.post('/validar', validarPermiso);
router.get('/roles', seguridad, obtenerRoles);
// Permisos del usuario logueado (para el menú y las pantallas)
router.get('/mis-permisos', obtenerMisPermisos);

export default router;
