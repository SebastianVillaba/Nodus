import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Stack,
  CircularProgress,
} from '@mui/material';
import TextField from '../components/UppercaseTextField';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import type { ItemFactura, Cliente } from '../types/factura.types';
import type { Caja } from '../types/caja.types';
import { ventaService } from '../services/venta.service';
import { reporteService } from '../services/reporte.service';
import facturaService, { ticketService } from '../services/ticket.service';
import { productoService } from '../services/producto.service';
import type { DatosFactura, DatosTicket } from '../types/ticket.types';
import SearchProductModal from '../components/SearchProductModal';
import CajaSelectorModal from '../components/CajaSelectorModal';
import PagoModal from '../components/PagoModal';
import TipoComprobanteModal from '../components/TipoComprobanteModal';
import { useTerminal } from '../hooks/useTerminal';
import { timbradoService } from '../services/timbrado.service';
import type { EstadoTimbrado } from '../services/timbrado.service';
import { consultarCreditoCliente } from '../services/persona.service';
import type { CreditoCliente } from '../services/persona.service';
import SearchClienteModal from '../components/SearchClienteModal';
import RequirePermission from '../components/RequirePermission';
import VendedorValidationModal from '../components/VendedorValidationModal';

const Facturacion: React.FC = () => {
  // Obtener información de la terminal
  const { idTerminalWeb } = useTerminal();
  const [estadoTimbrado, setEstadoTimbrado] = useState<EstadoTimbrado | null>(null);

  // Estado del timbrado de la terminal (vencimiento / rango) para avisar antes de facturar
  const consultarEstadoTimbrado = useCallback(async () => {
    if (!idTerminalWeb) return;
    try {
      setEstadoTimbrado(await timbradoService.estado(idTerminalWeb));
    } catch (error) {
      console.error('Error al consultar el estado del timbrado:', error);
    }
  }, [idTerminalWeb]);

  useEffect(() => {
    consultarEstadoTimbrado();
  }, [consultarEstadoTimbrado]);
  const [numeroFactura, setNumeroFactura] = useState<string | undefined>();
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [condicion, setCondicion] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  // Venta a crédito (migración 002)
  const [creditoCliente, setCreditoCliente] = useState<CreditoCliente | null>(null);
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [diasEntreCuotas, setDiasEntreCuotas] = useState(30);
  const [items, setItems] = useState<ItemFactura[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // TODO: Obtener idUsuario del contexto de autenticación
  const idUsuario = 1; // Temporal - reemplazar con usuario autenticado

  // Estados para búsqueda>([]);
  const [termino, setTermino] = useState('');
  const [openSearchModal, setOpenSearchModal] = useState(false);

  // Estados para el detalle de items y referencias
  const [productoSeleccionado, setProductoSeleccionado] = useState<any | null>(null);
  const [nombreProducto, setNombreProducto] = useState('');
  const [cantidadProducto, setCantidadProducto] = useState(1);
  const [precioProducto, setPrecioProducto] = useState(0);
  const [precioDescuento, setPrecioDescuento] = useState(0);
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(0);
  const [subtotalProducto, setSubtotalProducto] = useState(0);
  const [selectedProductImg, setSelectedProductImg] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState<boolean>(false);

  // Referencias para usabilidad del teclado
  const busquedaInputRef = useRef<HTMLInputElement>(null);
  const precioDescuentoInputRef = useRef<HTMLInputElement>(null);
  const cantidadInputRef = useRef<HTMLInputElement>(null);
  const agregarButtonRef = useRef<HTMLButtonElement>(null);

  // Modal de cliente
  const [openClienteModal, setOpenClienteModal] = useState(false);

  // Modal de caja
  const [openCajaSelector, setOpenCajaSelector] = useState(false);
  const [cajaSeleccionada, setCajaSeleccionada] = useState<Caja | null>(null);

  // Modales de pago y tipo de comprobante
  const [openPagoModal, setOpenPagoModal] = useState(false);
  const [openTipoComprobanteModal, setOpenTipoComprobanteModal] = useState(false);

  // Modal de vendedor
  const [openVendedorModal, setOpenVendedorModal] = useState(false);
  const [vendedorAutorizado, setVendedorAutorizado] = useState<{ idVendedor: number; nombre: string } | null>(null);

  // Calcular totales
  const calcularTotales = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const descuentoTotal = items.reduce((sum, item) => sum + (item.descuento || 0), 0);
    const iva5Total = items.reduce((sum, item) => sum + (item.iva5 || 0), 0);
    const iva10Total = items.reduce((sum, item) => sum + (item.iva10 || 0), 0);
    const ivaTotal = iva5Total + iva10Total;
    const total = subtotal - descuentoTotal;
    return { subtotal, descuentoTotal, total, iva5Total, iva10Total, ivaTotal };
  };

  const { subtotal, descuentoTotal, total, iva5Total, iva10Total, ivaTotal } = calcularTotales();

  // Atajo de teclado F4 para terminar venta y F2 para buscar clientes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F4') {
        event.preventDefault();
        if (items.length > 0) {
          handleTerminarVenta();
        }
      }
      if (event.key === 'F2') {
        event.preventDefault();
        setOpenClienteModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items]);

  // Handlers para búsqueda de productos usando sp_consultaPrecioProducto
  const handleBuscarProductos = async (busqueda: string) => {
    if (!busqueda || busqueda.length < 1) {
      return;
    }

    try {
      // Buscar productos primero
      console.log(busqueda);
      const results = await productoService.consultarPrecioProducto(busqueda, idTerminalWeb);

      if (results.length === 1) {
        // Si hay un solo resultado, seleccionarlo
        handleSeleccionarProducto(results[0]);
      } else if (results.length > 1) {
        // Si hay más de un resultado, abrir el modal
        setOpenSearchModal(true);
      } else {
        // Si no hay resultados
        setError('No se encontraron productos con ese criterio');
      }
    } catch (error: any) {
      console.error('Error al buscar productos:', error);
      setError(error.message || 'Error al buscar productos');
    }
  };

  // Manejar búsqueda al presionar Enter y shortcut de cantidad
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      // Verificar si el término empieza con + para establecer cantidad
      if (termino.startsWith('+')) {
        const cantidad = parseFloat(termino.substring(1));
        if (!isNaN(cantidad) && cantidad > 0) {
          setCantidadProducto(cantidad);
          setTermino('');
          return;
        }
      }
      if (termino.length===0) {
        setOpenSearchModal(true)
      }
      handleBuscarProductos(termino);
    }
  };

  // Cargar items desde detVentaTmp
  const cargarDetalleVenta = async () => {
    if (!idTerminalWeb) return;

    setIsLoadingItems(true);
    try {
      const detalles = await ventaService.consultarDetalleVenta(idTerminalWeb, idUsuario);
      console.log(detalles);

      const itemsFormateados: ItemFactura[] = detalles.map(det => {

        return {
          idDetVentaTmp: det.idDetVentaTmp,
          nro: 0,
          idProducto: det.idProducto,
          nombreMercaderia: det.nombreMercaderia,
          descripcion: det.nombreMercaderia,
          origen: det.origen,
          unidades: det.cantidad,
          precioUnitario: det.precioUnitario,
          descuento: (det.precioUnitario - det.precioDescuento) * det.cantidad,
          subtotal: det.precioUnitario * det.cantidad,
          gravada10: det.gravada10,
          gravada5: det.gravada5,
          exenta: det.exenta,
          iva10: det.iva10,
          iva5: det.iva5,
          ivaTotal: (det.iva5 || 0) + (det.iva10 || 0),
          precio: det.precioUnitario
        };
      });

      setItems(itemsFormateados);
    } catch (error: any) {
      console.error('Error al cargar detalle de venta:', error);
      setError(error.message || 'Error al cargar productos');
    } finally {
      setIsLoadingItems(false);
    }
  };

  // Cargar items y número de factura al montar el componente
  useEffect(() => {
    cargarDetalleVenta();

    // Cargar número de factura inicial
    const cargarNumeroFactura = async () => {
      if (!idTerminalWeb) return;

      try {
        const facturaData = await ventaService.consultaFacturaCorrelativa(idTerminalWeb);
        if (facturaData && facturaData.length > 0) {
          const nroFactura = facturaData[0].nroFacturaFormateado;
          setNumeroFactura(nroFactura?.toString());
        }
      } catch (error: any) {
        console.error('Error al cargar número de factura:', error);
      }
    };

    cargarNumeroFactura();
  }, [idTerminalWeb]);

  // Seleccionar producto para cargar en los inputs antes de agregar
  const handleSeleccionarProducto = async (producto: any) => {
    setProductoSeleccionado(producto);
    setNombreProducto(producto.nombreMercaderia || producto.nombre || '');
    setPrecioProducto(producto.precio || 0);
    
    let precioFinal = producto.precio || 0;
    try {
      const descData = await productoService.obtenerPrecioDescuento(producto.idProducto);
      if (descData && descData.length > 0 && descData[0].precioDescuento !== null && descData[0].precioDescuento !== undefined) {
        precioFinal = descData[0].precioDescuento;
      }
    } catch (err) {
      console.error('Error al obtener precio de descuento de la API:', err);
    }
    
    setPrecioDescuento(precioFinal);
    
    // Calcular % descuento inicial
    const desc = (producto.precio || 0) - precioFinal;
    const pct = producto.precio > 0 ? (desc / producto.precio) * 100 : 0;
    setPorcentajeDescuento(parseFloat(pct.toFixed(1)));
    
    setSubtotalProducto(cantidadProducto * precioFinal);

    // Obtener imagen del producto
    setSelectedProductImg(null);
    if (producto.imagenUrl) {
      setSelectedProductImg(producto.imagenUrl);
    } else if (producto.idProducto) {
      setLoadingImg(true);
      try {
        const info = await productoService.obtenerInfoProducto(producto.idProducto);
        if (info && info.length > 0) {
          setSelectedProductImg(info[0].imagenUrl || '');
        } else {
          setSelectedProductImg('');
        }
      } catch (err) {
        console.error('Error al obtener la imagen para la vista previa:', err);
        setSelectedProductImg('');
      } finally {
        setLoadingImg(false);
      }
    }

    // Enfocar el campo precioDescuento y seleccionar su texto
    setTimeout(() => {
      if (precioDescuentoInputRef.current) {
        precioDescuentoInputRef.current.focus();
        precioDescuentoInputRef.current.select();
      }
    }, 150);
  };

  // Agregar detalle de venta temporal tras validación
  const handleAgregarDetalle = async () => {
    if (!idTerminalWeb) {
      setError('No hay terminal configurada');
      return;
    }
    if (!productoSeleccionado) {
      setError('Debe seleccionar un producto primero');
      return;
    }

    // Validar que el precio con descuento no sea menor que el costo del producto
    const costoProducto = productoSeleccionado.costo || 0;
    if (precioDescuento < costoProducto) {
      setError('No se puede establecer un precio menor al costo del producto');
      return;
    }

    try {
      // Agregar a la BD
      await ventaService.agregarDetalleVenta({
        idTerminalWeb,
        idUsuario,
        idProducto: productoSeleccionado.idProducto,
        idStock: productoSeleccionado.idStock || 1,
        cantidad: cantidadProducto,
        precioUnitario: precioProducto, // precio original
        precioDescuento: precioDescuento // precio ingresado por el usuario
      });

      // Recargar la lista
      await cargarDetalleVenta();

      // Limpiar estados de carga de producto
      setProductoSeleccionado(null);
      setNombreProducto('');
      setPrecioProducto(0);
      setPrecioDescuento(0);
      setPorcentajeDescuento(0);
      setSubtotalProducto(0);
      setCantidadProducto(1);
      setTermino('');
      setSelectedProductImg(null);

      // Enfocar de nuevo en búsqueda
      setTimeout(() => {
        busquedaInputRef.current?.focus();
      }, 50);

    } catch (error: any) {
      console.error('Error al agregar producto:', error);
      setError(error.message || 'Error al agregar producto');
    }
  };

  // Eliminar producto de la factura
  const handleEliminarItem = async (index: number) => {
    const item = items[index];

    if (!item.idDetVentaTmp) {
      // Si no tiene idDetVentaTmp, solo eliminar del estado local
      setItems(items.filter((_, i) => i !== index));
      return;
    }

    if (!idTerminalWeb) {
      setError('No hay terminal configurada');
      return;
    }

    try {
      // Eliminar de la BD
      await ventaService.eliminarDetalleVenta(idTerminalWeb, item.idDetVentaTmp);

      // Recargar la lista
      await cargarDetalleVenta();

    } catch (error: any) {
      console.error('Error al eliminar producto:', error);
      setError(error.message || 'Error al eliminar producto');
    }
  };

  // Iniciar proceso de terminar venta
  const handleTerminarVenta = () => {
    setError('');
    setSuccess('');

    // Validaciones
    if (items.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    // Venta a crédito: se valida acá para avisar antes; el servidor vuelve a validar todo
    if (condicion === 'CREDITO') {
      if (!cliente?.idCliente || cliente.idCliente === 1) {
        setError('Para vender a crédito seleccione un cliente (F2).');
        return;
      }
      if (!creditoCliente?.acreditar) {
        setError(`El cliente ${cliente.nombre} no está habilitado para compras a crédito.`);
        return;
      }
      if (total > creditoCliente.disponible) {
        setError(`La venta supera el crédito disponible del cliente (Gs. ${formatGs(creditoCliente.disponible)}).`);
        return;
      }
      if (cantidadCuotas < 1 || cantidadCuotas > 60 || diasEntreCuotas < 1 || diasEntreCuotas > 365) {
        setError('Revise las cuotas: entre 1 y 60 cuotas, cada 1 a 365 días.');
        return;
      }
    }

    // Abrir modal de pago
    setOpenPagoModal(true);
  };

  // Cuando se confirma el pago, abrir modal de tipo de comprobante
  const handleConfirmarPago = (idVendedor: number | null) => {
    if (idVendedor) {
      setVendedorAutorizado({ idVendedor, nombre: '' });
    } else {
      setVendedorAutorizado(null);
    }
    setOpenPagoModal(false);

    // A crédito siempre es factura (nunca ticket): se guarda directo
    if (condicion === 'CREDITO') {
      handleGuardarVenta(false, idVendedor);
      return;
    }
    setOpenTipoComprobanteModal(true);
  };

  const handleVendedorAutenticado= (idVendedor: number, nombre: string) => {
    setVendedorAutorizado({ idVendedor, nombre });
    setOpenVendedorModal(false);
    setOpenTipoComprobanteModal(true);
  }

  // Guardar venta según el tipo de comprobante seleccionado
  const handleGuardarVenta = async (esTicket: boolean, idVendedorElegido?: number | null) => {
    setOpenTipoComprobanteModal(false);

    try {
      const { total, descuentoTotal } = calcularTotales();
      const idMovimientoCaja = localStorage.getItem('idMovimientoCaja');
      const idUsuario = localStorage.getItem('idUsuario') || '1';

      if (!idMovimientoCaja) {
        setError('Debe abrir una caja antes de realizar una venta');
        return;
      }

      const ventaData = {
        idUsuarioAlta: parseInt(idUsuario),
        idTerminalWeb: idTerminalWeb,
        idPersonaJur: 1, // TODO: Obtener de la configuración
        idMovimientoCaja: parseInt(idMovimientoCaja),
        idTipoPago: 1, // TODO: Obtener del formulario
        idTipoVenta: condicion === 'CREDITO' ? 2 : 1,
        idCliente: cliente?.idCliente || 1, // 1 = Cliente SIN NOMBRE
        ruc: cliente?.documento || 'XXXXXXX',
        nombreCliente: cliente?.nombre || 'SIN NOMBRE',
        totalVenta: total,
        totalDescuento: descuentoTotal,
        ticket: esTicket ? 1 : 0,
        idVendedor: idVendedorElegido ?? vendedorAutorizado?.idVendedor ?? null,
        cantidadCuotas: condicion === 'CREDITO' ? cantidadCuotas : 1,
        diasEntreCuotas: condicion === 'CREDITO' ? diasEntreCuotas : 30
      };

      console.log('Venta a guardar:', ventaData);

      const response = await ventaService.guardarVenta(ventaData);

      if (response.success) {
        setSuccess(`${esTicket ? 'Ticket' : 'Factura'} guardada exitosamente`);

        // Generar e imprimir comprobante según el tipo seleccionado
        if (response.idVenta) {
          try {
            if (esTicket) {
              // Generar ticket simple
              const datosReporte = await reporteService.obtenerDatosTicket(response.idVenta);

              const datosTicketSimple: DatosTicket = {
                // Datos de la empresa
                nombreFantasia: datosReporte.cabecera.nombreFantasia,
                ruc: datosReporte.cabecera.ruc,
                nombreSucursal: datosReporte.cabecera.nombreSucursal,
                nombreTipoPago: datosReporte.cabecera.nombreTipoPago,

                // Datos de la venta
                fechaHora: new Date(datosReporte.cabecera.fechaHora),
                idVenta: response.idVenta,
                total: datosReporte.cabecera.total,

                // Datos del cliente
                cliente: datosReporte.cabecera.cliente,
                rucCliente: datosReporte.cabecera.rucCliente,

                // Información adicional
                vendedor: datosReporte.cabecera.vendedor || 'Sistema',
                totalLetra: datosReporte.cabecera.totalLetra,
                leyenda: datosReporte.cabecera.leyenda,

                // Items
                items: datosReporte.items.map((item: any) => ({
                  cantidad: item.cantidad,
                  codigo: item.codigo,
                  mercaderia: item.mercaderia,
                  precio: item.precio,
                  subtotal: item.subtotal
                }))
              };

              await ticketService.generarTicket(datosTicketSimple);
            } else {
              // Generar factura completa
              const datosReporte = await reporteService.obtenerDatosFactura(response.idVenta);

              const datosFactura: DatosFactura = {
                        // Datos de la empresa
                        nombreFantasia: datosReporte.cabecera.nombreFantasia,
                        nombre: datosReporte.cabecera.nombre || '',
                        rubro: datosReporte.cabecera.rubro || '',
                        ruc: datosReporte.cabecera.ruc || '',
                        direccion: datosReporte.cabecera.direccionEmpresa || '',
                        telefono: datosReporte.cabecera.telefonoEmpresa || '',
                
                        // Datos de la venta
                        fechaHora: new Date(datosReporte.cabecera.fechaHora),
                        nroFactura: `${numeroFactura}`,
                        total: datosReporte.cabecera.total,
                
                        // Datos de control fiscal
                        timbrado: datosReporte.cabecera.timbrado || '',
                        fechaInicioVigencia: new Date(datosReporte.cabecera.fechaInicioVigencia),
                        fechaFinVigencia: new Date(datosReporte.cabecera.fechaFinVigencia),
                
                        // Datos del cliente
                        cliente: datosReporte.cabecera.cliente || '',
                        rucCliente: datosReporte.cabecera.rucCliente || '',
                        direccionCliente: datosReporte.cabecera.direccionCliente || '',
                        telefonoCliente: datosReporte.cabecera.telefonoCliente || '',
                
                        // Información adicional
                        vendedor:  datosReporte.cabecera.vendedor || 'Sistema',
                        tipoFactura: datosReporte.cabecera.tipoFactura || '',
                        formaVenta: datosReporte.cabecera.formaVenta || '',
                
                        // Liquidación IVA
                        gravada10: datosReporte.cabecera.gravada10 || 0,
                        gravada5: datosReporte.cabecera.gravada5 || 0,
                        exenta: datosReporte.cabecera.exenta || 0,
                        iva10: datosReporte.cabecera.iva10 || 0,
                        iva5: datosReporte.cabecera.iva5 || 0,
                        totalIva: datosReporte.cabecera.totalIva || 0,
                
                        // Items
                        items: datosReporte.items.map((item: any) => ({
                          cantidad: item.cantidad,
                          codigo: item.codigo,
                          mercaderia: item.mercaderia,
                          precio: item.precio,
                          subtotal: item.subtotal,
                          porcentajeImpuesto: item.porcentajeImpuesto
                        }))
                      };

              await facturaService.generarTicket(datosFactura);
            }
          } catch (error: any) {
            console.error('Error al generar comprobante:', error);
            setError(`Venta guardada pero hubo un error al generar el ${esTicket ? 'ticket' : 'comprobante de factura'}`);
          }
        }

        // Actualizar número de factura
        try {
          const facturaData = await ventaService.consultaFacturaCorrelativa(idTerminalWeb);
          if (facturaData && facturaData.length > 0) {
            const nroFactura = facturaData[0].nroFacturaFormateado;
            setNumeroFactura(nroFactura?.toString());
          }
        } catch (error: any) {
          console.error('Error al actualizar factura correlativa:', error);
          setError(error?.message || 'Error al consultar la factura correlativa');
        }

        // Limpiar formulario
        setTimeout(() => {
          handleNuevaFactura();
        }, 2000);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error al guardar la venta');
    }
  };

  // Mantener la función original por compatibilidad
  const handleGuardarFactura = handleTerminarVenta;

  // Nueva factura
  const handleNuevaFactura = async () => {
    setCliente(null);
    setCondicion('CONTADO');
    setCreditoCliente(null);
    setCantidadCuotas(1);
    setDiasEntreCuotas(30);
    setItems([]);
    setVendedorAutorizado(null);
    setError('');
    setSuccess('');
    consultarEstadoTimbrado();
    // Incrementar número de factura
    try {
      const facturaData = await ventaService.consultaFacturaCorrelativa(idTerminalWeb);
      if (facturaData && facturaData.length > 0) {
        const nroFactura = facturaData[0].nroFacturaFormateado;
        setNumeroFactura(nroFactura?.toString());
      }
    } catch (error: any) {
      console.error('Error al consultar la factura correlativa:', error);
      setError(error.message || 'Error al consultar la factura correlativa');
      return;
    }
  };

  // Handler para cuando se selecciona un cliente en el modal
  const handleClienteSelected = (clienteData: any) => {
    // Validar que el cliente tenga un ID válido
    if (!clienteData.idCliente || clienteData.idCliente === 0) {
      setError('El cliente seleccionado no tiene un ID válido');
      return;
    }

    let documento = clienteData.ruc || '';
    let dv = clienteData.dv || '';
    if (documento.includes('-')) {
      const parts = documento.split('-');
      documento = parts[0];
      dv = parts[1] || dv;
    }

    const nuevoCliente: Cliente = {
      idCliente: clienteData.idCliente,
      nombre: clienteData.nombreCliente,
      direccion: clienteData.direccion || '',
      telefono: clienteData.celular || '',
      documento,
      dv
    };
    setCliente(nuevoCliente);
    setSuccess('Cliente seleccionado correctamente');

    // Situación de crédito del cliente (límite, deuda, disponible)
    setCreditoCliente(null);
    consultarCreditoCliente(clienteData.idCliente)
      .then(setCreditoCliente)
      .catch((error) => console.error('Error al consultar el crédito del cliente:', error));
  };

  const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);

  return (
    <RequirePermission permission="ACCESO_VENTAS">
      <Box sx={{ height: 'calc(100vh - 120px)' }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Paper sx={{ p: 2, mb: 2, width: '140vh' }}>
            <Grid container spacing={4}>
              <Grid size={6}>
                <Stack spacing={1}>
                  <div>
                    <TextField
                      label="RUC"
                      size='small'
                      value={cliente?.documento || ''}
                      InputProps={{ readOnly: true }}
                      sx={{
                        width: '16vh'
                      }}
                    />
                    <TextField
                      label="dv"
                      size='small'
                      value={cliente?.dv || ''}
                      InputProps={{ readOnly: true }}
                      sx={{
                        width: '8vh'
                      }}
                    />
                  </div>
                  <TextField
                    label="Nombre"
                    size="small"
                    value={cliente?.nombre || ''}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Direccion"
                    size='small'
                    value={cliente?.direccion || ''}
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Telefono"
                    size='small'
                    value={cliente?.telefono || ''}
                    InputProps={{ readOnly: true }}
                  />
                </Stack>
              </Grid>

              <Grid size={3}>
                <Stack spacing={1}>
                  <TextField
                    fullWidth
                    label="Fecha"
                    size="small"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <div style={{ display: 'flex', gap: '1vh' }}>
                    <Button
                      variant='contained'
                      sx={{
                        width: '10vh'
                      }}
                      onClick={() => setOpenClienteModal(true)}
                      title="Buscar/Agregar Cliente (F2)"
                    >
                      <PersonSearchIcon />
                    </Button>
                  </div>
                </Stack>
              </Grid>
              <Grid size={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Condición</InputLabel>
                  <Select
                    value={condicion}
                    label="Condición"
                    onChange={(e) => setCondicion(e.target.value as 'CONTADO' | 'CREDITO')}
                  >
                    <MenuItem value="CONTADO">Contado</MenuItem>
                    <MenuItem value="CREDITO">Crédito</MenuItem>
                  </Select>
                </FormControl>

                {/* Venta a crédito: situación del cliente y plan de cuotas */}
                {condicion === 'CREDITO' && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {!cliente || cliente.idCliente === 1 ? (
                      <Alert severity="info" sx={{ py: 0 }}>Seleccione el cliente (F2)</Alert>
                    ) : !creditoCliente ? (
                      <Alert severity="info" sx={{ py: 0 }}>Consultando crédito...</Alert>
                    ) : !creditoCliente.acreditar ? (
                      <Alert severity="error" sx={{ py: 0 }}>Cliente sin crédito habilitado</Alert>
                    ) : (
                      <Alert severity={total > creditoCliente.disponible ? 'error' : creditoCliente.montoVencido > 0 ? 'warning' : 'success'} sx={{ py: 0 }}>
                        Disponible: Gs. {formatGs(creditoCliente.disponible)}
                        <br />Límite {formatGs(creditoCliente.limiteCredito)} · Deuda {formatGs(creditoCliente.deuda)}
                        {creditoCliente.montoVencido > 0 && <><br />Vencido: Gs. {formatGs(creditoCliente.montoVencido)}</>}
                      </Alert>
                    )}
                    <Stack direction="row" spacing={1}>
                      <TextField
                        label="Cuotas"
                        size="small"
                        type="number"
                        value={cantidadCuotas}
                        onChange={(e) => setCantidadCuotas(Math.max(1, Number(e.target.value) || 1))}
                        inputProps={{ min: 1, max: 60 }}
                      />
                      <TextField
                        label="Cada (días)"
                        size="small"
                        type="number"
                        value={diasEntreCuotas}
                        onChange={(e) => setDiasEntreCuotas(Math.max(1, Number(e.target.value) || 1))}
                        inputProps={{ min: 1, max: 365 }}
                      />
                    </Stack>
                  </Stack>
                )}
              </Grid>
            </Grid>
          </Paper>
          <Paper sx={{ p: 2, mb: 2, minHeight: '18vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Typography variant='h2'>₲</Typography>
              <Typography
                variant='h3'
                sx={{
                  backgroundColor: "#2dfc61",
                  color: "black",
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: '1.5px solid #000',
                  mx: 1,
                  minWidth: '25vh',
                  maxWidth: '100%',
                  textAlign: 'center',
                  wordBreak: 'break-word'
                }}
              >{total.toLocaleString()}</Typography>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '12px'
            }}>
              <Typography
                sx={{
                  fontWeight: 'bold',
                  fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
                  backgroundColor: '#f5f5f5',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  letterSpacing: '1px',
                  textAlign: 'center',
                  wordBreak: 'break-all',
                  maxWidth: '100%'
                }}
                variant='h5'
              >{numeroFactura}</Typography>
            </div>
          </Paper>
        </div>

        {/* Mensajes */}
        {estadoTimbrado?.mensaje && (
          <Alert severity={estadoTimbrado.bloquea ? 'error' : 'warning'} sx={{ mb: 2 }}>
            {estadoTimbrado.mensaje}
            {estadoTimbrado.bloquea && ' No se pueden emitir facturas (sí tickets) hasta corregirlo en Administración → Timbrados.'}
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => {
          setSuccess('');
          setCliente(null);
        }}>{success}</Alert>}

        <Box >
          {/* Tabla de productos */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={1} sx={{
              width: '100%'
            }}>
              <Grid size={7}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5
                }}>
                  <TextField
                    fullWidth
                    label="Buscar producto (código, código de barra o nombre)"
                    size="small"
                    value={termino}
                    onChange={(e) => setTermino(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    placeholder="Ingrese nombre o código del producto"
                    inputRef={busquedaInputRef}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    value={nombreProducto}
                    onChange={(e) => setNombreProducto(e.target.value)}
                    variant='standard'
                    disabled
                  />
                </Box>
              </Grid>
              {/* PRECIO DESCUENTO */}
              <Grid size={1}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5
                }}>
                  <TextField 
                    fullWidth
                    label="Precio Desc"
                    value={precioDescuento}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPrecioDescuento(val);
                      
                      // Calcular % Desc.
                      const desc = precioProducto - val;
                      const pct = precioProducto > 0 ? (desc / precioProducto) * 100 : 0;
                      setPorcentajeDescuento(parseFloat(pct.toFixed(2)));
                      
                      // Calcular Subtotal
                      setSubtotalProducto(cantidadProducto * val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        cantidadInputRef.current?.focus();
                        cantidadInputRef.current?.select();
                      }
                    }}
                    size="small"
                    sx={{
                      width: '100%',
                    }}
                    inputRef={precioDescuentoInputRef}
                  />
                  <TextField 
                    fullWidth
                    value={precioProducto}
                    size="small"
                    label="Precio Unitario"
                    sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#f0f4f8',
                    },
                    width: '100%'
                    }}
                    disabled
                  />
                </Box>
              </Grid>
              {/* DESCUENTO */}
              <Grid size={1}>
                <TextField 
                  fullWidth
                  label="% Desc."
                  value={porcentajeDescuento}
                  disabled
                  size="small"
                />
              </Grid>
              {/*   CANTIDAD   */}
              <Grid size={1}>
                <TextField
                  label="Cantidad"
                  size="small"
                  type="number"
                  value={cantidadProducto}
                  onChange={(e) => {
                    const valor = parseFloat(e.target.value);
                    const qty = isNaN(valor) || valor <= 0 ? 1 : valor;
                    setCantidadProducto(qty);
                    setSubtotalProducto(qty * precioDescuento);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarButtonRef.current?.focus();
                    }
                  }}
                  inputProps={{ min: 0.001, step: 0.001 }}
                  inputRef={cantidadInputRef}
                />
              </Grid>
              {/* ─────────── */}
              {/*  SUB-TOTAL  */}
              {/* ─────────── */}
              <Grid size={1}>
                  <TextField
                    fullWidth
                    label="Subtotal"
                    value={subtotalProducto}
                    size="small"
                    disabled
                  />
              </Grid>
              <Grid size={1}>
                <Button 
                  sx={{
                    width: '100%'
                  }}
                  variant='contained'
                  onClick={handleAgregarDetalle}
                  ref={agregarButtonRef}
                >
                  <AddIcon/>
                </Button>
              </Grid>
            </Grid>
          </Paper>
          <Grid container spacing={1} sx={{
            width: '100%'
          }}>
            <Grid size={10}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Descripción</TableCell>
                        <TableCell>Origen</TableCell>
                        <TableCell align="center">Cantidad</TableCell>
                        <TableCell align="right">Precio Unit.</TableCell>
                        <TableCell align="right">Subtotal</TableCell>
                        <TableCell align="right">Descuento</TableCell>
                        <TableCell align="right">Prec. Descuento</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.descripcion || item.nombreMercaderia}</TableCell>
                          <TableCell>{item.origen === 'N' ? 'Nacional' : 'Importado'}</TableCell>
                          <TableCell align='center'>{item.unidades}</TableCell>
                          <TableCell align="right">₲{(item.precioUnitario || item.precio || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">₲{(item.subtotal || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            {item.descuento}
                          </TableCell>
                          <TableCell align="right">₲{((item.subtotal || 0) - (item.descuento || 0)).toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => handleEliminarItem(index)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              No hay productos agregados, ingresa el codigo o nombre de un producto para comenzar.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
            <Grid size={2}>
              {/* Imagen del producto seleccionado */}
                <Box sx={{
                  minWidth: '100%',
                  maxHeightheight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1,
                  backgroundColor: '#fafafa',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  minHeight: '120px'
                }}>
                  {loadingImg ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" color="text.secondary">
                        Cargando...
                      </Typography>
                    </Box>
                  ) : selectedProductImg ? (
                    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={productoService.obtenerUrlImagen(selectedProductImg)}
                        alt="Vista previa"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '200px',
                          objectFit: 'contain',
                          borderRadius: '4px',
                          backgroundColor: 'white',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {productoSeleccionado ? 'Sin imagen' : 'Sin producto'}
                      </Typography>
                    </Box>
                  )}
                </Box>
            </Grid>
          </Grid>


        </Box>

        {/* Totales y acciones */}
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={1}>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body1" align="right">{subtotal.toLocaleString()}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">Descuento:</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body1" align="right" color="error">-{descuentoTotal.toLocaleString()}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={1}>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">IVA 5%:</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body1" align="right">{iva5Total.toLocaleString()}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body2" color="text.secondary">IVA 10%:</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="body1" align="right">{iva10Total.toLocaleString()}</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="h6">Total IVA:</Typography>
                    </Grid>
                    <Grid xs={6}>
                      <Typography variant="h6" align="right" color="primary">{ivaTotal.toLocaleString()}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={handleGuardarFactura}
                  disabled={items.length === 0}
                  size="large"
                >
                  Terminar Venta (F4)
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Modal de búsqueda de productos */}
        <SearchProductModal
          open={openSearchModal}
          onClose={() => setOpenSearchModal(false)}
          idTerminalWeb={idTerminalWeb}
          onSelectProduct={handleSeleccionarProducto}
          busqueda={termino}
        />

        {/* Modal de búsqueda de cliente */}
        <SearchClienteModal
          open={openClienteModal}
          onClose={() => setOpenClienteModal(false)}
          onClienteSelected={handleClienteSelected}
        />

        {/* Modal de pago */}
        <PagoModal
          open={openPagoModal}
          totalVenta={total}
          onClose={() => setOpenPagoModal(false)}
          onConfirm={handleConfirmarPago}
          credito={condicion === 'CREDITO' ? { cantidadCuotas, diasEntreCuotas } : null}
        />

        {/* Modal de selección de tipo de comprobante */}
        <TipoComprobanteModal
          open={openTipoComprobanteModal}
          onClose={() => setOpenTipoComprobanteModal(false)}
          onSelectTipo={handleGuardarVenta}
        />  

        {/* Modal de validación de vendedor */}
        <VendedorValidationModal
          open={openVendedorModal}
          onClose={() => setOpenVendedorModal(false)}
          onSuccess={handleVendedorAutenticado}
        />
      </Box>
    </RequirePermission>
  );
};

export default Facturacion;