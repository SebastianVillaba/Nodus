import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Grid,
    IconButton,
    CircularProgress,
} from '@mui/material';
import TextField from '../../components/UppercaseTextField';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import SearchProveedorModal from '../../components/SearchProveedorModal';
import SearchProductModal from '../../components/SearchProductModal';
import HabilitarCompraModal from '../../components/HabilitarCompraModal';
import { useTerminal } from '../../hooks/useTerminal';
import { comprasService } from '../../services/compras.service';
import type { DetalleCompraTmp } from '../../services/compras.service';
import { productoService } from '../../services/producto.service';
import RequirePermission from '../../components/RequirePermission';
import { getErrorMessage } from '../../services/httpError';

export default function Compras() {
    const { idTerminalWeb, idSucursal, idDepositoCompra } = useTerminal();

    // Estados para Cabecera 
    const [proveedor, setProveedor] = useState<any>(null);
    const [timbrado, setTimbrado] = useState('');
    const [dsuc, setDSuc] = useState('');
    const [dcaja, setDCaja] = useState('');
    const [factura, setFactura] = useState('');
    const [responsable, setResponsable] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    // Estados para Detalle (Entrada de producto)
    const [producto, setProducto] = useState<any>(null);
    const [cantidad, setCantidad] = useState<number>(0);
    const [precio, setPrecio] = useState<number>(0); // Precio calculado o manual
    const [costoTotal, setCostoTotal] = useState<number>(0); // Costo Total del item
    const [porcentajeSobreCosto, setPorcentajeSobreCosto] = useState<number>(0);
    const [bonificacion, setBonificacion] = useState<number>(0);
    const [lote, setLote] = useState('');
    const [vencimiento, setVencimiento] = useState('');
    const [precioManual, setPrecioManual] = useState<boolean>(false); // Flag para saber si el precio fue editado manualmente

    // Lista de detalles
    const [detalles, setDetalles] = useState<DetalleCompraTmp[]>([]);

    // Modales
    const [openProveedorModal, setOpenProveedorModal] = useState(false);
    const [openProductoModal, setOpenProductoModal] = useState(false);
    const [openHabilitarModal, setOpenHabilitarModal] = useState(false);
    const [productoSearchTerm, setProductoSearchTerm] = useState('');

    // Estados para la vista previa de la imagen del producto
    const [selectedProductImg, setSelectedProductImg] = useState<string | null>(null);
    const [loadingImg, setLoadingImg] = useState<boolean>(false);

    // Totales calculados
    const totalIva5 = detalles.reduce((acc, item) => acc + item.gravada5, 0);
    const totalIva10 = detalles.reduce((acc, item) => acc + item.gravada10, 0);
    const totalFactura = detalles.reduce((acc, item) => acc + item.subtotal, 0);

    /*******************************************************
     * REFERENCIAS PARA LOS SALTOS DE FOCO EN LOS TEXTBOX *
     *******************************************************/
    // CABECERA PARA LA IDENTIFICACION DEL PROVEEDOR
    const botonBuscarProveedorRef = useRef<HTMLButtonElement>(null);
    const timbradoRef = useRef<HTMLInputElement>(null);
    const dsucRef = useRef<HTMLInputElement>(null);
    const dcajaRef = useRef<HTMLInputElement>(null);
    const facturaRef = useRef<HTMLInputElement>(null);
    const responsableRef = useRef<HTMLInputElement>(null);
    const fechaRef = useRef<HTMLInputElement>(null);

    // CABECERA DE CARGA DE LOS PRODUCTOS
    const productoRef = useRef<HTMLInputElement>(null);
    const porcentajeRef = useRef<HTMLInputElement>(null);
    const costoRef = useRef<HTMLInputElement>(null); // Este parece ser porcentaje en el original? No, costoRef era costo input?
    // En el original: 
    // label="% S/Costo" -> value={costo} -> onChange setCosto -> inputRef={porcentajeRef}
    // Pero el estado se llamaba costo, y habia costoTotal.
    // Voy a mantener la logica visual pero corregir nombres.

    const cantidadRef = useRef<HTMLInputElement>(null);
    const precioRef = useRef<HTMLInputElement>(null);
    const bonificacionRef = useRef<HTMLInputElement>(null);
    const botonAgregarRef = useRef<HTMLButtonElement>(null);
    const costoTotalRef = useRef<HTMLInputElement>(null);


    // Cargar detalles al iniciar
    const cargarDetalles = useCallback(async () => {
        if (idTerminalWeb) {
            try {
                const data = await comprasService.consultarDetalleTemporal(idTerminalWeb);
                setDetalles(data);
            } catch (error) {
                console.error("Error cargando detalles", error);
            }
        }
    }, [idTerminalWeb]);

    useEffect(() => {
        cargarDetalles();
    }, [cargarDetalles]);

    const handleProveedorSelected = (prov: any) => {
        setProveedor(prov);
        setResponsable(prov.responsable || '');
        timbradoRef.current?.focus();
    };

    const handleProductoSelected = async (prod: any) => {
        setProducto(prod);
        setProductoSearchTerm(prod.nombreMercaderia || prod.nombre);
        // Al seleccionar producto, reseteamos valores
        setCostoTotal(0);
        setCantidad(1);
        setPorcentajeSobreCosto(0);
        setPrecioManual(false);
        setBonificacion(0);
        setLote('');
        setVencimiento('');

        // Obtener imagen del producto
        setSelectedProductImg(null);
        if (prod.imagenUrl) {
            setSelectedProductImg(prod.imagenUrl);
        } else if (prod.idProducto) {
            setLoadingImg(true);
            try {
                const info = await productoService.obtenerInfoProducto(prod.idProducto);
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

        // Enfocar siguiente campo (Cantidad o Costo Total según flujo)
        setTimeout(() => {
            porcentajeRef.current?.focus();
        }, 100);
    };

    // Validadores de Cabecera
    const handleCabeceraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Validación de solo números para campos numéricos
        if (['dsuc', 'dcaja', 'timbrado', 'factura'].includes(name)) {
            if (!/^\d*$/.test(value)) return;
        }

        switch (name) {
            case 'dsuc':
                if (value.length <= 3) setDSuc(value);
                break;
            case 'dcaja':
                if (value.length <= 3) setDCaja(value);
                break;
            case 'timbrado':
                if (value.length <= 8) setTimbrado(value);
                break;
            case 'factura': // dfactu
                if (value.length <= 7) setFactura(value);
                break;
            case 'responsable':
                setResponsable(value);
                break;
        }
    };

    // Lógica de Precio Automático
    // Utilizo useEffect referenciando a costoTotal,cantidad,bonificacion,porcentaje para cada vez que cambien 
    // alguno de esos se calcule el precioFinal
    useEffect(() => {
        if (precioManual) return; // Si el usuario editó el precio manualmente, no lo sobrescribimos

        if ((cantidad + bonificacion) > 0 && costoTotal >= 0) {
            const costoUnitario = costoTotal / (cantidad + bonificacion);
            // Evitar división por cero o infinitos
            if (!isFinite(costoUnitario)) return;

            const nuevoPrecio = costoUnitario + (costoUnitario * (porcentajeSobreCosto / 100));
            setPrecio(Math.round(nuevoPrecio)); // Redondeamos para evitar decimales extraños
        } else {
            setPrecio(0);
        }
    }, [costoTotal, cantidad, bonificacion, porcentajeSobreCosto, precioManual]);

    // Handler para cambios manuales en precio
    const handlePrecioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPrecio(Number(e.target.value));
        setPrecioManual(true);
    };

    const handleAgregarDetalle = async () => {
        if (!producto) {
            alert('Seleccione un producto');
            productoRef.current?.focus();
            return;
        }
        if (cantidad <= 0) {
            alert('La cantidad debe ser mayor a 0');
            cantidadRef.current?.focus();
            return;
        }
        if (precio <= 0) {
            alert('El precio debe ser mayor a 0');
            precioRef.current?.focus();
            return;
        }
        if (!idTerminalWeb) {
            alert('Terminal no identificada');
            return;
        }

        try {
            const detalle = {
                idTerminalWeb,
                idProveedor: proveedor ? proveedor.idProveedor : 0, // Asumiendo 0 o null si no hay proveedor, aunque debería haber
                idProducto: producto.idProducto,
                idDeposito: idDepositoCompra, // el servidor usa siempre el depósito de compras de la terminal
                cantidad,
                bonificacion,
                costoTotal,
                porcentajeDescuento: 0,
                notacredito: false,
                precio
            };

            await comprasService.agregarDetalleCompra(detalle);
            await cargarDetalles();

            // Limpiar campos de entrada
            setProducto('');
            setProductoSearchTerm('');
            setCantidad(0);
            setCostoTotal(0);
            setPorcentajeSobreCosto(0);
            setPrecioManual(false);
            setBonificacion(0);
            setLote('');
            setVencimiento('');
            setSelectedProductImg(null);

            productoRef.current?.focus();

        } catch (error) {
            console.error("Error agregando detalle", error);
            alert(getErrorMessage(error, "Error al agregar detalle"));
        }
    };

    const handleEliminarDetalle = async (idDetCompraTmp: number) => {
        if (!idTerminalWeb) return;
        try {
            await comprasService.eliminarItemTemporal(idTerminalWeb, idDetCompraTmp);
            await cargarDetalles();
        } catch (error) {
            console.error("Error eliminando detalle", error);
        }
    };

    const handleLimpiarDetalle = async () => {
        if (!idTerminalWeb) return;
        if (!window.confirm('¿Está seguro de limpiar todo el detalle?')) return;
        try {
            await comprasService.limpiarTemporal(idTerminalWeb);
            await cargarDetalles();
        } catch (error) {
            console.error("Error limpiando detalle", error);
        }
    };

    const handleGuardarCompra = async () => {
        if (!proveedor) {
            alert('Seleccione un proveedor');
            return;
        }
        if (detalles.length === 0) {
            alert('Agregue al menos un producto');
            return;
        }
        if (!factura) {
            alert('Ingrese el número de factura');
            return;
        }
        if (!idTerminalWeb) return;

        // Abrir modal de confirmación
        setOpenHabilitarModal(true);
    };

    const confirmarGuardarCompra = async (habilitar: boolean) => {
        setOpenHabilitarModal(false);
        if (!idTerminalWeb || !proveedor) return;

        try {
            const compra = {
                idTerminalWeb,
                idSucursal, // el servidor toma sucursal y empresa de la terminal
                idPersonaJur: 0,
                idProveedor: proveedor.idProveedor, // Usar idProveedor correcto
                idTipoCompra: 1, // Contado/Credito? Default 1
                dsuc,
                dcaja,
                dfactu: factura,
                timbrado,
                responsable,
                fecha,
                cotizacion: 1,
                vence: fecha, // Default hoy
                total: totalFactura,
                habilitarCompra: habilitar, // Usar el valor seleccionado en el modal
                idUsuarioAlta: 0 // el servidor usa el usuario autenticado
            };

            const guardada = await comprasService.guardarCompra(compra);
            alert(`Compra ${guardada.idCompra ?? ''} guardada correctamente${habilitar ? ' (no fiscal)' : ''}. La mercadería ingresó al stock.`);

            // Limpiar todo
            setProveedor(null);
            setTimbrado('');
            setDSuc('');
            setDCaja('');
            setFactura('');
            setResponsable('');
            setDetalles([]);
            await cargarDetalles();

        } catch (error) {
            console.error("Error guardando compra", error);
            alert(getErrorMessage(error, "Error al guardar la compra"));
        }
    };

    const handleProductoSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const term = (e.target as HTMLInputElement).value;
            if (!term) {
                setOpenProductoModal(true);
                return;
            }

            try {
                const results = await comprasService.buscarProducto(term);
                if (results && results.length === 1) {
                    handleProductoSelected(results[0]);
                } else {
                    setProductoSearchTerm(term); // Pasar termino al modal si es posible
                    setOpenProductoModal(true);
                }
            } catch (error) {
                console.error("Error buscando producto", error);
                setOpenProductoModal(true);
            }
        }
    };

    useEffect(() => {
        botonBuscarProveedorRef.current?.focus();
    }, []);

    return (
        <RequirePermission permission="ACCESO_COMPRAS">

            <Box sx={{ p: 2, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 1
                }}>
                    <Box sx={{ flex: 1 }}>
                        {/* Cabecera */}
                        <Paper sx={{ p: 2, backgroundColor: '#f8f9fa' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={6} lg={12}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            fullWidth
                                            label="Proveedor"
                                            size="small"
                                            value={proveedor ? proveedor.nombre : ''}
                                            InputProps={{
                                                readOnly: true,
                                            }}
                                            placeholder="Seleccione Proveedor"
                                        />
                                        <Button
                                            variant="contained"
                                            sx={{ minWidth: 'auto', px: 2 }}
                                            onClick={() => setOpenProveedorModal(true)}
                                            ref={botonBuscarProveedorRef}
                                        >
                                            <SearchIcon />
                                        </Button>
                                    </Box>
                                </Grid>
                                <Grid item xs={2}>
                                    <TextField
                                        fullWidth
                                        label="Timbrado"
                                        size="small"
                                        value={timbrado}
                                        onChange={handleCabeceraChange}
                                        name="timbrado"
                                        inputRef={timbradoRef}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                dsucRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid item size={3}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            value={dsuc}
                                            onChange={handleCabeceraChange}
                                            name="dsuc"
                                            label="Est."
                                            inputRef={dsucRef}
                                            sx={{ width: '50%' }}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    dcajaRef.current?.focus();
                                                }
                                            }}
                                        />
                                        <TextField
                                            fullWidth
                                            size="small"
                                            value={dcaja}
                                            onChange={handleCabeceraChange}
                                            name="dcaja"
                                            label="Pto."
                                            inputRef={dcajaRef}
                                            sx={{ width: '50%' }}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    facturaRef.current?.focus();
                                                }
                                            }}
                                        />
                                        <TextField
                                            fullWidth
                                            size="small"
                                            value={factura}
                                            onChange={handleCabeceraChange}
                                            name="factura"
                                            label="Nro. factura"
                                            inputRef={facturaRef}
                                            sx={{ width: '80%' }}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    responsableRef.current?.focus();
                                                }
                                            }}
                                        />
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <TextField
                                        fullWidth
                                        label="Responsable"
                                        size="small"
                                        value={responsable}
                                        inputRef={responsableRef}
                                        onChange={handleCabeceraChange}
                                        name="responsable"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                productoRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={1.5}>
                                    <TextField
                                        fullWidth
                                        type='date'
                                        label="Fecha factura"
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ max: new Date().toISOString().split('T')[0] }}
                                        size="small"
                                        value={fecha}
                                        inputRef={fechaRef}
                                        onChange={(e) => setFecha(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                productoRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Entrada de Productos */}
                        <Paper sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item size={3}>
                                    <TextField
                                        fullWidth
                                        label="Producto (Enter para buscar)"
                                        size="small"
                                        value={productoSearchTerm}
                                        placeholder="Buscar producto..."
                                        inputRef={productoRef}
                                        onKeyDown={handleProductoSearchKeyDown}
                                        // Permitir escribir si no hay producto seleccionado para buscar
                                        onChange={(e) => {
                                            setProductoSearchTerm(e.target.value);
                                            const nombre = producto?.nombreMercaderia || producto?.nombre;
                                            if (producto && e.target.value !== nombre) {
                                                setProducto(null);
                                                setSelectedProductImg(null);
                                            }
                                        }}
                                        InputProps={{
                                            endAdornment: (
                                                <IconButton size="small" onClick={() => setOpenProductoModal(true)}>
                                                    <SearchIcon />
                                                </IconButton>
                                            )
                                        }}
                                    />
                                </Grid>

                                <Grid item size={1}>
                                    <TextField
                                        fullWidth
                                        label="% S/Costo"
                                        type="number"
                                        size="small"
                                        value={porcentajeSobreCosto}
                                        onChange={(e) => setPorcentajeSobreCosto(Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                cantidadRef.current?.focus();
                                            }
                                        }}
                                        inputRef={porcentajeRef}
                                    />
                                </Grid>

                                <Grid item size={1.5}>
                                    <TextField
                                        fullWidth
                                        label="Cantidad"
                                        type="number"
                                        size="small"
                                        value={cantidad}
                                        onChange={(e) => setCantidad(Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        inputRef={cantidadRef}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                costoTotalRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>

                                <Grid item size={1.5}>
                                    <TextField
                                        fullWidth
                                        label="Costo Total"
                                        type="number"
                                        size="small"
                                        value={costoTotal}
                                        onChange={(e) => setCostoTotal(Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        inputRef={costoTotalRef}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                bonificacionRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>

                                <Grid item size={1.5}>
                                    <TextField
                                        fullWidth
                                        label="Bonificación"
                                        type="number"
                                        size="small"
                                        value={bonificacion}
                                        onChange={(e) => setBonificacion(Number(e.target.value))}
                                        onFocus={(e) => e.target.select()}
                                        inputRef={bonificacionRef}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                precioRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid item size={1.5}>
                                    <TextField
                                        fullWidth
                                        label="Precio"
                                        type="number"
                                        size="small"
                                        value={precio}
                                        onChange={handlePrecioChange}
                                        onFocus={(e) => e.target.select()}
                                        inputRef={precioRef}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                botonAgregarRef.current?.focus();
                                            }
                                        }}
                                    />
                                </Grid>

                                <Grid item xs={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<AddIcon />}
                                        onClick={handleAgregarDetalle}
                                        fullWidth
                                        ref={botonAgregarRef}
                                    >
                                        Agregar
                                    </Button>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Box>
                    <Box sx={{
                        width: '200px',
                        flexShrink: 0,
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
                                    {producto ? 'Sin imagen' : 'Sin producto'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Grilla de Detalles */}
                <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Nro.</TableCell>
                                <TableCell>Mercadería</TableCell>
                                <TableCell align="right">Cant.</TableCell>
                                <TableCell align="right">Boni.</TableCell>
                                <TableCell align="right">Costo</TableCell>
                                <TableCell align="right">Precio</TableCell>
                                <TableCell align="right">Exenta</TableCell>
                                <TableCell align="right">IVA 5%</TableCell>
                                <TableCell align="right">IVA 10%</TableCell>
                                <TableCell align="right">Subtotal</TableCell>
                                <TableCell align="center">Acción</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {detalles.map((row, index) => (
                                <TableRow key={row.idDetCompraTmp} hover>
                                    <TableCell>{row.nro}</TableCell>
                                    <TableCell>{row.nombreMercaderia}</TableCell>
                                    <TableCell align="right">{row.cantidad}</TableCell>
                                    <TableCell align="right">{row.bonificacion}</TableCell>
                                    <TableCell align="right">{row.costo.toLocaleString('')}</TableCell>
                                    <TableCell align="right">{row.precio}</TableCell>
                                    <TableCell align="right">{row.exenta?.toLocaleString()}</TableCell>
                                    <TableCell align="right">{row.gravada5?.toLocaleString()}</TableCell>
                                    <TableCell align="right">{row.gravada10?.toLocaleString()}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{row.subtotal?.toLocaleString()}</TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" color="error" onClick={() => handleEliminarDetalle(row.idDetCompraTmp)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {detalles.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={15} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                        No hay items en el detalle
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Footer / Totales */}
                <Paper sx={{ p: 2, mt: 1, backgroundColor: '#f5f5f5' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#00e676', p: 0.5, borderRadius: 1 }}>
                                    <Typography variant="body2" fontWeight="bold">IVA 5%:</Typography>
                                    <Typography variant="body2" fontWeight="bold">{totalIva5.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#00e676', p: 0.5, borderRadius: 1 }}>
                                    <Typography variant="body2" fontWeight="bold">IVA 10%:</Typography>
                                    <Typography variant="body2" fontWeight="bold">{totalIva10.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Typography>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle2" fontWeight="bold">TOTAL FACTURA:</Typography>
                            <Typography variant="h4" fontWeight="bold" sx={{ color: '#ffeb3b', bgcolor: '#424242', px: 2, borderRadius: 1, display: 'inline-block' }}>
                                {totalFactura.toLocaleString()}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                            <Button
                                variant="outlined"
                                size="large"
                                color="warning"
                                startIcon={<CleaningServicesIcon />}
                                onClick={handleLimpiarDetalle}
                            >
                                Limpiar
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<SaveIcon />}
                                onClick={handleGuardarCompra}
                            >
                                Guardar
                            </Button>
                            <Button
                                variant="outlined"
                                size="large"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => {
                                    // Cancelar podría ser limpiar todo o salir.
                                    // Por ahora lo dejo como limpiar
                                    handleLimpiarDetalle();
                                }}
                            >
                                Cancelar
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Modales */}
                <SearchProveedorModal
                    open={openProveedorModal}
                    onClose={() => setOpenProveedorModal(false)}
                    onProveedorSelected={handleProveedorSelected}
                />

                <SearchProductModal
                    open={openProductoModal}
                    onClose={() => setOpenProductoModal(false)}
                    onSelectProduct={handleProductoSelected}
                    idTerminalWeb={idTerminalWeb || 0}
                    busqueda={productoSearchTerm}
                    useComprasSearch={true}
                />

                <HabilitarCompraModal
                    open={openHabilitarModal}
                    onClose={() => setOpenHabilitarModal(false)}
                    onConfirm={confirmarGuardarCompra}
                />
            </Box>
        </RequirePermission>
    );
}
