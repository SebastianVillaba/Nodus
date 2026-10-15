import { Router } from 'express';
import authRoutes from './auth.routes';
import personaRoutes from './persona.routes';
import productoRoutes from './producto.routes';
import servicioRoutes from './servicio.routes';
import ubicacionRoutes from './ubicacion.routes';
import ventaRoutes from './venta.routes';
import terminalRoutes from './terminal.routes';
import cajaRoutes from './caja.routes';
import reporteRoutes from './reporte.routes';
import pedidoRoutes from './pedido.routes';
import pedidoInternoRoutes from './pedidoInterno.routes';
import deliveryRoutes from './delivery.routes';
import precobranzaRoutes from './precobranza.routes';
import comprasRoutes from './compras.routes';
import sectorRoutes from './sector.routes';
import remisionRoutes from './remision.routes';
import ajustesRoutes from './ajustes.routes';
import impuestoRoutes from './impuesto.routes';
import auditoriaRoutes from './auditoria.routes';
import rolRoutes from './rol.routes';
import usuarioRoutes from './usuario.routes';
import terminalWebRoutes from './terminalWeb.routes';
import stockInicialRoutes from './stockInicial.routes';
import denominacionRoutes from './denominacion.routes';
import anulacionRoutes from './anulacion.routes';
import consultaVentaRoutes from './consultaVenta.routes';
import consultaArqueoRoutes from './consultaArqueo.routes';
import ofertaRoutes from './oferta.routes';
import cargaProductosRoutes from './cargaProductos.routes';
import barcodeRoutes from './barcode.routes';
import consultaCargaProductosRoutes from './consultaCargaProductos.routes';
import historialClienteRoutes from './historialCliente.routes';
import timbradoRoutes from './timbrado.routes';
import cobroCreditoRoutes from './cobroCredito.routes';
import notaCreditoRoutes from './notaCredito.routes';
import notaCreditoProveedorRoutes from './notaCreditoProveedor.routes';
import libroIvaRoutes from './libroIva.routes';
import armadoComboRoutes from './armadoCombo.routes';
import movimientoStockRoutes from './movimientoStock.routes';
import { verifyToken, forzarUsuarioAutenticado } from '../Middlewares/auth.middleware';
import { requierePermiso, requierePermisoEscritura, PERMISOS } from '../Middlewares/permisos.middleware';

const router = Router();

// Rutas públicas: login y validación de la terminal (se usan antes de iniciar sesión)
router.use('/auth', authRoutes);
router.use('/terminal', terminalRoutes);

// Todo lo que sigue requiere un token válido
router.use(verifyToken);

// En el ABM de usuarios idUsuario es el usuario editado, no quien opera
router.use('/usuario', forzarUsuarioAutenticado(['idUsuario']), usuarioRoutes);

router.use(forzarUsuarioAutenticado());

// Permisos: las escrituras de cada módulo exigen su permiso; las lecturas quedan abiertas
// porque otras pantallas las usan como catálogo. Seguridad, auditoría e historial exigen
// permiso también para leer. /persona, /usuario y /rol definen sus permisos por ruta.

router.use('/persona', personaRoutes);
router.use('/producto', requierePermisoEscritura(PERMISOS.ABM), productoRoutes);
router.use('/servicio', requierePermisoEscritura(PERMISOS.ABM), servicioRoutes);
router.use('/caja', requierePermisoEscritura(PERMISOS.CAJA), cajaRoutes);
router.use('/ubicaciones', ubicacionRoutes);
router.use('/venta', requierePermisoEscritura(PERMISOS.VENTAS), ventaRoutes);
router.use('/pedido', requierePermisoEscritura(PERMISOS.PEDIDOS), pedidoRoutes);
router.use('/reporte', reporteRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/denominacion', denominacionRoutes);
router.use('/precobranza', requierePermisoEscritura(PERMISOS.PEDIDOS), precobranzaRoutes);
router.use('/compras', requierePermisoEscritura(PERMISOS.COMPRAS), comprasRoutes);
router.use('/remisiones', requierePermisoEscritura(PERMISOS.REMISIONES), remisionRoutes);
router.use('/pedido-interno', requierePermisoEscritura(PERMISOS.REMISIONES), pedidoInternoRoutes);
router.use('/sector', sectorRoutes);
router.use('/ajustes', requierePermisoEscritura(PERMISOS.AJUSTES), ajustesRoutes);
router.use('/impuesto', impuestoRoutes);
router.use('/auditoria', requierePermiso(PERMISOS.AUDITORIA), auditoriaRoutes);
router.use('/rol', rolRoutes);
router.use('/terminal-web', requierePermiso(PERMISOS.SEGURIDAD), terminalWebRoutes);
router.use('/stock-inicial', requierePermisoEscritura(PERMISOS.AJUSTES), stockInicialRoutes);
router.use('/anulacion', anulacionRoutes);
router.use('/consulta-venta', consultaVentaRoutes);
router.use('/consulta-arqueo', consultaArqueoRoutes);
router.use('/ofertas', requierePermisoEscritura(PERMISOS.OFERTAS), ofertaRoutes);
router.use('/carga-productos', requierePermisoEscritura(PERMISOS.CARGA_PRODUCTOS), cargaProductosRoutes);
router.use('/barcode', requierePermisoEscritura(PERMISOS.CARGA_PRODUCTOS, PERMISOS.VER_STOCK), barcodeRoutes);
router.use('/consulta-carga-productos', consultaCargaProductosRoutes);
router.use('/historial-cliente', requierePermiso(PERMISOS.HISTORIAL_CLIENTE), historialClienteRoutes);
router.use('/timbrado', timbradoRoutes);
router.use('/cobro-credito', cobroCreditoRoutes);
router.use('/nota-credito', notaCreditoRoutes);
router.use('/nota-credito-proveedor', notaCreditoProveedorRoutes);
router.use('/libro-iva', requierePermiso(PERMISOS.LIBRO_IVA), libroIvaRoutes);
router.use('/armado-combo', requierePermisoEscritura(PERMISOS.AJUSTES), armadoComboRoutes);
router.use('/seguimiento-stock', requierePermiso(PERMISOS.SEGUIMIENTO_STOCK), movimientoStockRoutes);

export default router;