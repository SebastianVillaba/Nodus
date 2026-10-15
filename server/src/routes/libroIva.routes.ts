import { Router } from 'express';
import { libroIva } from '../controllers/libroIva.controller';

const router = Router();

// GET /api/libro-iva/ventas?desde=2026-10-01&hasta=2026-10-31
router.get('/:libro', libroIva);

export default router;
