import { Router } from 'express';
import {
  consultarCuotasPendientes, guardarCobroCredito, listarCobrosCredito, reporteReciboCobro,
} from '../controllers/cobroCredito.controller';
import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();
const cobranzas = requierePermiso(PERMISOS.COBRANZAS);

router.get('/cuotas', cobranzas, consultarCuotasPendientes);
router.get('/', cobranzas, listarCobrosCredito);
router.get('/:idCobroCredito/recibo', cobranzas, reporteReciboCobro);
router.post('/', cobranzas, guardarCobroCredito);
// La anulación va por /anulacion/cobro-credito (con usuario y contraseña del autorizador)

export default router;
