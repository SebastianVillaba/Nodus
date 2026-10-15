import { Router } from 'express';
import { guardarServicio, listarServicios } from '../controllers/servicio.controller';

const router = Router();

// GET /api/servicio?busqueda=&incluirInactivos=1
router.get('/', listarServicios);
// POST /api/servicio (alta sin idServicio, modificación con idServicio)
router.post('/', guardarServicio);

export default router;
