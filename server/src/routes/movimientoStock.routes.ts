import { Router } from 'express';
import { buscarProductos, listarDepositos, consultarMovimientos, conciliacion } from '../controllers/movimientoStock.controller';

const router = Router();

// GET /api/seguimiento-stock/productos?busqueda=...
router.get('/productos', buscarProductos);
// GET /api/seguimiento-stock/depositos
router.get('/depositos', listarDepositos);
// GET /api/seguimiento-stock/movimientos?idProducto=1&idDeposito=&desde=2026-10-01&hasta=2026-10-31
router.get('/movimientos', consultarMovimientos);
// GET /api/seguimiento-stock/conciliacion
router.get('/conciliacion', conciliacion);

export default router;
