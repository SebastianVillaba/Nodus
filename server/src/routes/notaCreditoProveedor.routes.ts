import { Router } from 'express';
import {
  buscarCompras, consultarCompra, guardarDevolucion, guardarMonto, listarNotas, consultarNota,
} from '../controllers/notaCreditoProveedor.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();
const cualquierNota = requierePermiso(PERMISOS.NC_PROVEEDOR_DEVOLUCION, PERMISOS.NC_PROVEEDOR_MONTO);

router.get('/compras', cualquierNota, buscarCompras);
router.get('/compras/:id', cualquierNota, consultarCompra);
router.get('/', cualquierNota, listarNotas);
router.get('/:tipo/:id', cualquierNota, consultarNota);
router.post('/devolucion', requierePermiso(PERMISOS.NC_PROVEEDOR_DEVOLUCION), guardarDevolucion);
router.post('/monto', requierePermiso(PERMISOS.NC_PROVEEDOR_MONTO), guardarMonto);
// La anulación va por /anulacion/nota-credito-proveedor (con usuario y contraseña del autorizador)

export default router;
