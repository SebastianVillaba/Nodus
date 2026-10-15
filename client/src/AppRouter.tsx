import React, { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import SidebarLayout from './components/SideBar/SidebarLayout';
import { Container, CircularProgress, Box } from '@mui/material';
import AuthLayout from './Layout/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';

// Lazy loaded page components
const ABM = lazy(() => import('./pages/ABM'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Facturacion = lazy(() => import('./pages/Facturacion'));
const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const PersonasABM = lazy(() => import('./pages/ABM/PersonasABM'));
const ProductosABM = lazy(() => import('./pages/ABM/ProductosABM'));
const ServiciosABM = lazy(() => import('./pages/ABM/ServiciosABM'));
const Pedidos = lazy(() => import('./pages/Pedidos'));
const Precobranza = lazy(() => import('./pages/Cobranzas/Precobranza'));
const Cobranza = lazy(() => import('./pages/Cobranzas/Cobranza'));
const Compras = lazy(() => import('./pages/Compras/Compras'));
const Remisiones = lazy(() => import('./pages/Remisiones'));
const RecepcionesPendientes = lazy(() => import('./pages/RecepcionesPendientes'));
const GenerarPedidoInterno = lazy(() => import('./pages/PedidoInterno/GenerarPedidoInterno'));
const ConsultaPedidoInterno = lazy(() => import('./pages/PedidoInterno/ConsultaPedidoInterno'));
const Ajustes = lazy(() => import('./pages/Mercaderia/Ajustes'));
const Auditoria = lazy(() => import('./pages/Auditoria/Auditoria'));
const Roles = lazy(() => import('./pages/Administracion/Roles'));
const UsuariosABM = lazy(() => import('./pages/Administracion/UsuariosABM'));
const TerminalesABM = lazy(() => import('./pages/Administracion/TerminalesABM'));
const Timbrados = lazy(() => import('./pages/Administracion/Timbrados'));
const StockInicial = lazy(() => import('./pages/Mercaderia/StockInicial'));
const CargaProductos = lazy(() => import('./pages/Mercaderia/CargaProductos'));
const ArqueoCaja = lazy(() => import('./pages/Caja/ArqueoCaja'));
const ConsultaVentas = lazy(() => import('./pages/Consultas/ConsultaVentas'));
const ConsultaArqueCaja = lazy(() => import('./pages/Consultas/ConsultaArqueCaja'));
const ConsultaCargaProductos = lazy(() => import('./pages/Consultas/ConsultaCargaProductos'));
const HistorialCliente = lazy(() => import('./pages/Consultas/HistorialCliente'));
const ConsultaCobranzas = lazy(() => import('./pages/Consultas/ConsultaCobranzas'));
const NotaCreditoDevolucion = lazy(() => import('./pages/NotasCredito/NotaCreditoDevolucion'));
const NotaCreditoMonto = lazy(() => import('./pages/NotasCredito/NotaCreditoMonto'));
const ConsultaNotasCredito = lazy(() => import('./pages/Consultas/ConsultaNotasCredito'));
const NotaCreditoProveedorDevolucion = lazy(() => import('./pages/NotasCreditoProveedor/NotaCreditoProveedorDevolucion'));
const NotaCreditoProveedorMonto = lazy(() => import('./pages/NotasCreditoProveedor/NotaCreditoProveedorMonto'));
const ConsultaNotasCreditoProveedor = lazy(() => import('./pages/Consultas/ConsultaNotasCreditoProveedor'));
const ConsultaCompras = lazy(() => import('./pages/Consultas/ConsultaCompras'));
const SeguimientoStock = lazy(() => import('./pages/Consultas/SeguimientoStock'));
const Reportes = lazy(() => import('./pages/Reportes/Reportes'));
const LibroIva = lazy(() => import('./pages/Reportes/LibroIva'));
const ArmadoCombos = lazy(() => import('./pages/Mercaderia/ArmadoCombos'));
const CrearOferta = lazy(() => import('./pages/Ofertas/CrearOferta'));
const VerOfertas = lazy(() => import('./pages/Ofertas/VerOfertas'));
const ConsultaStock = lazy(() => import('./pages/Mercaderia/ConsultaStock'));
const ImpresionCodigoBarra = lazy(() => import('./pages/Mercaderia/ImpresionCodigoBarra'));
const GeneracionCodigoBarra = lazy(() => import('./pages/Mercaderia/GeneracionCodigoBarra'));


// Placeholder components for sub-routes
const ClientesABM = () => <Container><h3>Submenú Clientes (ABM)</h3></Container>;
const FacturacionClientes = () => <Container><h3>Submenú Facturación (Clientes)</h3></Container>;

// Loader component for suspense fallback
// Pantallas que no validan permiso por sí mismas
const conPermiso = (permiso: string, page: React.ReactNode) => (
  <RequirePermission permission={permiso}>{page}</RequirePermission>
);

const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <CircularProgress size={40} />
  </Box>
);

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Ruta de login */}
        <Route path="/login" element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>

        {/* Rutas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SidebarLayout>
                <Outlet />
              </SidebarLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<h2>Bienvenido al Sistema</h2>} />
          <Route path="abm" element={<ABM />}>
            <Route path="personas" element={conPermiso('ACCESO_ABM', <PersonasABM />)} />
            <Route path="productos" element={conPermiso('ACCESO_ABM', <ProductosABM />)} />
            <Route path="servicios" element={conPermiso('ACCESO_ABM', <ServiciosABM />)} />
            <Route path="clientes" element={<ClientesABM />} />
          </Route>
          <Route path="clientes" element={<Clientes />}>
            <Route path="facturacion-clientes" element={<FacturacionClientes />} />
          </Route>
          <Route path="facturacion" element={<Facturacion />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="cobranzas">
            <Route path="precobranza" element={conPermiso('ACCESO_PEDIDOS', <Precobranza />)} />
            <Route path="cobranza" element={<Cobranza />} />
          </Route>
          <Route path="caja">
            <Route path="arqueo" element={<ArqueoCaja />} />
          </Route>
          <Route path="notas-credito">
            <Route path="devolucion" element={conPermiso('ACCESO_NC_DEVOLUCION', <NotaCreditoDevolucion />)} />
            <Route path="monto" element={conPermiso('ACCESO_NC_MONTO', <NotaCreditoMonto />)} />
          </Route>
          <Route path="notas-credito-proveedor">
            <Route path="devolucion" element={conPermiso('ACCESO_NC_PROVEEDOR_DEVOLUCION', <NotaCreditoProveedorDevolucion />)} />
            <Route path="monto" element={conPermiso('ACCESO_NC_PROVEEDOR_MONTO', <NotaCreditoProveedorMonto />)} />
          </Route>
          <Route path="compras" element={<Compras />} />
          <Route path="remisiones" element={<Remisiones />} />
          <Route path="recepciones-pendientes" element={<RecepcionesPendientes />} />
          <Route path="pedido-interno">
            <Route path="generar" element={conPermiso('ACCESO_REMISIONES', <GenerarPedidoInterno />)} />
            <Route path="consulta" element={conPermiso('ACCESO_REMISIONES', <ConsultaPedidoInterno />)} />
          </Route>
          <Route path="mercaderia">
            <Route path="ajustes" element={<Ajustes />} />
            <Route path="stock-inicial" element={<StockInicial />} />
            <Route path="armado-combos" element={conPermiso('ACCESO_AJUSTES', <ArmadoCombos />)} />
            <Route path="carga-productos" element={<CargaProductos />} />
            <Route path="consulta-stock" element={<ConsultaStock />} />
            <Route path="generacion-codigo-barra" element={<GeneracionCodigoBarra />} />
            <Route path="impresion-codigo-barra" element={<ImpresionCodigoBarra />} />
          </Route>
          <Route path="oferta">
            <Route path="crear" element={<CrearOferta />} />
            <Route path="ver" element={<VerOfertas />} />
          </Route>
          <Route path="auditoria" element={conPermiso('ACCESO_AUDITORIA', <Auditoria />)} />
          <Route path="consultas">
            <Route path="ventas" element={conPermiso('ACCESO_VENTAS', <ConsultaVentas />)} />
            <Route path="arqueo-caja" element={conPermiso('RPT_CAJA', <ConsultaArqueCaja />)} />
            <Route path="carga-productos" element={conPermiso('ACCESO_CARGA_PRODUCTOS', <ConsultaCargaProductos />)} />
            <Route path="historial-cliente" element={<HistorialCliente />} />
            <Route path="cobranzas" element={conPermiso('ACCESO_COBRANZAS', <ConsultaCobranzas />)} />
            <Route path="notas-credito-devolucion" element={conPermiso('ACCESO_NC_DEVOLUCION', <ConsultaNotasCredito key="DEV" tipo="DEV" />)} />
            <Route path="notas-credito-monto" element={conPermiso('ACCESO_NC_MONTO', <ConsultaNotasCredito key="MONTO" tipo="MONTO" />)} />
            <Route path="compras" element={conPermiso('ACCESO_COMPRAS', <ConsultaCompras />)} />
            <Route path="seguimiento-stock" element={conPermiso('SEGUIMIENTO_STOCK', <SeguimientoStock />)} />
            <Route path="notas-credito-proveedor-devolucion" element={conPermiso('ACCESO_NC_PROVEEDOR_DEVOLUCION', <ConsultaNotasCreditoProveedor key="DEV" tipo="DEV" />)} />
            <Route path="notas-credito-proveedor-monto" element={conPermiso('ACCESO_NC_PROVEEDOR_MONTO', <ConsultaNotasCreditoProveedor key="MONTO" tipo="MONTO" />)} />
          </Route>
          <Route path="reportes" element={conPermiso('RPT_CAJA', <Reportes />)} />
          <Route path="reportes/libro-iva" element={conPermiso('ACCESO_LIBRO_IVA', <LibroIva />)} />
          <Route path="administracion">
            <Route path="roles" element={<Roles />} />
            <Route path="usuarios" element={<UsuariosABM />} />
            <Route path="terminales" element={<TerminalesABM />} />
            <Route path="timbrados" element={<Timbrados />} />
          </Route>
        </Route>

        {/* Redirección por defecto al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRouter;
