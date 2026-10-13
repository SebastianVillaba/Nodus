import { Router } from 'express';
import { verificarPermisoAnular, anularFacturacion, anularCargaProducto, anularCobroCredito, anularNotaCredito, anularCompra, anularNotaCreditoProveedor } from '../controllers/anulacion.controller';

const router = Router();

// Verifica si un usuario tiene permiso para anular según el tipo
// GET /api/anulacion/permiso?idUsuario=1&tipo=FACTU
router.get('/permiso', verificarPermisoAnular);

// Anula una facturación (venta)
// POST /api/anulacion/facturacion
router.post('/facturacion', anularFacturacion);

// Anula una carga de productos
// POST /api/anulacion/carga-producto
router.post('/carga-producto', anularCargaProducto);

// Anula un recibo de cobro de créditos
// POST /api/anulacion/cobro-credito
router.post('/cobro-credito', anularCobroCredito);

// Anula una nota de crédito (por devolución o por monto)
// POST /api/anulacion/nota-credito
router.post('/nota-credito', anularNotaCredito);

// Anula una compra (fiscal o no fiscal)
// POST /api/anulacion/compra
router.post('/compra', anularCompra);

// Anula una nota de crédito de proveedor (por devolución o por monto)
// POST /api/anulacion/nota-credito-proveedor
router.post('/nota-credito-proveedor', anularNotaCreditoProveedor);

export default router;

