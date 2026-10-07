import { Router } from 'express';
import {
  buscarVentas, consultarFactura, guardarNotaCreditoDevolucion, guardarNotaCreditoMonto, listarNotasCredito, reporteNotaCredito,
} from '../controllers/notaCredito.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();
const cualquierNota = requierePermiso(PERMISOS.NC_DEVOLUCION, PERMISOS.NC_MONTO);

router.get('/ventas', cualquierNota, buscarVentas);
router.get('/factura', cualquierNota, consultarFactura);
router.get('/', cualquierNota, listarNotasCredito);
router.get('/:tipo/:id/reporte', cualquierNota, reporteNotaCredito);
router.post('/devolucion', requierePermiso(PERMISOS.NC_DEVOLUCION), guardarNotaCreditoDevolucion);
router.post('/monto', requierePermiso(PERMISOS.NC_MONTO), guardarNotaCreditoMonto);
// La anulación va por /anulacion/nota-credito (con usuario y contraseña del autorizador)

export default router;
