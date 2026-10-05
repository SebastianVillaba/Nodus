import { Router } from 'express';
import { crearUsuario, modificarUsuario, buscarUsuario, obtenerUsuario, buscarPersonaParaUsuario, validarVendedor, obtenerPersonalesSinUsuario } from '../controllers/usuario.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();
const seguridad = requierePermiso(PERMISOS.SEGURIDAD);

router.post('/', seguridad, crearUsuario);
router.put('/', seguridad, modificarUsuario);
router.get('/buscar', seguridad, buscarUsuario);
router.get('/buscar-persona', seguridad, buscarPersonaParaUsuario);
router.get('/personales-sin-usuario', seguridad, obtenerPersonalesSinUsuario);
// Lo usa el cobro en Facturación: cualquier usuario autenticado
router.post('/validar-vendedor', validarVendedor);
router.get('/:idUsuario', seguridad, obtenerUsuario);

export default router;
