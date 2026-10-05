import { Router } from 'express';
import { listarTimbrados, estadoTimbrado, guardarTimbrado } from '../controllers/timbrado.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();

// Lectura abierta: Facturación consulta el estado y el ABM de terminales lista los timbrados
router.get('/', listarTimbrados);
router.get('/estado', estadoTimbrado);
router.post('/', requierePermiso(PERMISOS.TIMBRADOS), guardarTimbrado);

export default router;
