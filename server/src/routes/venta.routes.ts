import { Router } from 'express';
import { agregarDetalleVenta, agregarServicioVenta, consultarDetalleVenta, eliminarDetalleVenta, guardarVenta, consultaFacturaCorrelativa, obtenerVendedores } from '../controllers/venta.controller';
// import { verifyToken } from '../Middlewares/auth.middleware'; // Deshabilitado temporalmente

const router = Router();

// Ruta para agregar un item al detalle de venta temporal
// TODO: Agregar autenticación cuando el sistema de login esté implementado
router.post('/detalletmp', agregarDetalleVenta);

// Ruta para agregar un servicio al detalle de venta temporal
router.post('/detalletmp/servicio', agregarServicioVenta);

// Ruta para consultar los items del detalle de venta temporal
// TODO: Agregar autenticación cuando el sistema de login esté implementado
router.get('/detalletmp', consultarDetalleVenta);

// Ruta para eliminar un item del detalle de venta temporal
// TODO: Agregar autenticación cuando el sistema de login esté implementado
router.delete('/detalletmp', eliminarDetalleVenta);

// Ruta para guardar/finalizar una venta
// TODO: Agregar autenticación cuando el sistema de login esté implementado
router.post('/guardar', guardarVenta);

// Ruta para consultar la factura actual
// TODO: Agregar autenticación cuando el sistema de login esté implementado
// Ruta para consultar la factura actual
// TODO: Agregar autenticación cuando el sistema de login esté implementado
router.get('/facturaActual', consultaFacturaCorrelativa);

// Ruta para obtener la lista de vendedores
router.get('/vendedores', obtenerVendedores);



export default router;
