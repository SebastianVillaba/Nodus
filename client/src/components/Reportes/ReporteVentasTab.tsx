import React, { useState, useEffect } from "react";
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Checkbox, 
  Divider, 
  FormControl, 
  FormControlLabel, 
  FormLabel, 
  Grid, 
  InputLabel, 
  MenuItem, 
  Paper, 
  Radio, 
  RadioGroup, 
  Select, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TextField, 
  Typography, 
  CircularProgress, 
  Alert 
} from "@mui/material";
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const ReporteVentasTab = () => {
  const idLabel = React.useId();

  // Estados para filtros
  const [reporteSeleccionado, setReporteSeleccionado] = useState<string>("resumido"); // "resumido" | "vendedor" | "producto"
  
  const [desde, setDesde] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Formato local YYYY-MM-DDTHH:mm
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  
  const [hasta, setHasta] = useState<string>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [sucursales, setSucursales] = useState<any[]>([]);
  const [idSucursal, setIdSucursal] = useState<number>(0);
  const [todasSucursales, setTodasSucursales] = useState<boolean>(true);

  const [tiposProducto, setTiposProducto] = useState<any[]>([]);
  const [idTipoProducto, setIdTipoProducto] = useState<number | 'TODOS'>('TODOS');

  // Estados para consulta de datos
  const [loading, setLoading] = useState<boolean>(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [consultado, setConsultado] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar sucursales y tipos de producto al montar el componente
  useEffect(() => {
    const fetchFiltros = async () => {
      try {
        // Obtenemos las sucursales activas
        const resSuc = await axios.get(`${API_URL}/pedido-interno/sucursales`);
        const sucursalesData = Array.isArray(resSuc.data) ? resSuc.data : (resSuc.data?.result || resSuc.data?.data || []);
        setSucursales(sucursalesData);
        
        // Obtenemos los tipos de producto
        const resTipos = await axios.get(`${API_URL}/producto/tipoProducto`);
        const tiposData = Array.isArray(resTipos.data) ? resTipos.data : (resTipos.data?.result || resTipos.data?.data || []);
        setTiposProducto(tiposData);
      } catch (err) {
        console.error("Error al cargar filtros para reportes", err);
      }
    };
    fetchFiltros();
  }, []);

  // Manejar consulta de datos
  const handleConsultar = async () => {
    setLoading(true);
    setErrorMsg(null);
    setResultados([]);
    setConsultado(true);

    try {
      let endpoint = "";
      if (reporteSeleccionado === "resumido") {
        const suc = todasSucursales ? 0 : idSucursal;
        endpoint = `${API_URL}/reporte/ventas-resumido?desde=${desde}&hasta=${hasta}&idSucursal=${suc}`;
      } else if (reporteSeleccionado === "vendedor") {
        endpoint = `${API_URL}/reporte/ventas-vendedor?desde=${desde}&hasta=${hasta}`;
      } else {
        endpoint = `${API_URL}/reporte/venta-producto-dia?desde=${desde}&hasta=${hasta}&idTipoProducto=${idTipoProducto}`;
      }

      const res = await axios.get(endpoint);
      if (res.data && res.data.success) {
        setResultados(res.data.data || []);
      } else {
        setResultados([]);
        setErrorMsg("La respuesta del servidor no fue exitosa.");
      }
    } catch (err: any) {
      console.error("Error al consultar reporte:", err);
      setErrorMsg(err.response?.data?.message || "Ocurrió un error al consultar el reporte de ventas.");
    } finally {
      setLoading(false);
    }
  };

  // Manejar descarga en PDF
  const handleDescargarPDF = async () => {
    // Abrir la ventana antes del await para que el navegador no la bloquee como popup
    const ventana = window.open('', '_blank');
    try {
      let endpoint = "";
      if (reporteSeleccionado === "resumido") {
        const suc = todasSucursales ? 0 : idSucursal;
        endpoint = `${API_URL}/reporte/ventas-resumido?desde=${desde}&hasta=${hasta}&idSucursal=${suc}&format=pdf`;
      } else if (reporteSeleccionado === "vendedor") {
        endpoint = `${API_URL}/reporte/ventas-vendedor?desde=${desde}&hasta=${hasta}&format=pdf`;
      } else {
        endpoint = `${API_URL}/reporte/venta-producto-dia?desde=${desde}&hasta=${hasta}&idTipoProducto=${idTipoProducto}&format=pdf`;
      }
      
      // Se descarga con axios para que viaje el token de sesión
      const response = await axios.get(endpoint, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      if (ventana) {
        ventana.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      ventana?.close();
      console.error("Error al descargar PDF:", err);
      alert("Error al descargar el PDF");
    }
  };

  // Formato monetario (Guaraníes)
  const formatMoneda = (val: number) => {
    return val.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Cálculos de totales para la fila final de la tabla
  const calcularTotales = () => {
    if (reporteSeleccionado === "resumido") {
      let totalVenta = 0;
      let totalDescuento = 0;
      let totalNeto = 0;
      resultados.forEach(r => {
        const venta = Number(r.totalVenta || 0);
        const desc = Number(r.totalDescuento || 0);
        totalVenta += venta;
        totalDescuento += desc;
        totalNeto += (venta - desc);
      });
      return { totalVenta, totalDescuento, totalNeto };
    } else if (reporteSeleccionado === "vendedor") {
      let totalNeto = 0;
      resultados.forEach(r => {
        totalNeto += Number(r.total || 0);
      });
      return { totalNeto };
    } else {
      let totalCantidad = 0;
      let totalMonto = 0;
      resultados.forEach(r => {
        totalCantidad += Number(r.TotalVendido || 0);
        totalMonto += Number(r.totalMontoVendido || 0);
      });
      return { totalCantidad, totalMonto };
    }
  };

  const totales = calcularTotales();

  return (
    <Box sx={{ width: "100%", mt: 1 }}>
      <Grid container spacing={3}>
        {/* Panel Izquierdo: Filtros */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
              Parámetros del Reporte
            </Typography>
            <Divider sx={{ mb: 2.5 }} />

            <Grid container spacing={2.5}>
              {/* Opciones */}
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel id={`${idLabel}-opciones`} sx={{ fontWeight: 'bold', mb: 1 }}>
                    Opciones de Reporte
                  </FormLabel>
                  <RadioGroup
                    aria-labelledby={`${idLabel}-opciones`}
                    name="reporte-opciones-group"
                    value={reporteSeleccionado}
                    onChange={(e) => {
                      setReporteSeleccionado(e.target.value);
                      setResultados([]);
                      setConsultado(false);
                      setErrorMsg(null);
                    }}
                  >
                    <FormControlLabel value="resumido" control={<Radio />} label="Resumido" />
                    <FormControlLabel value="vendedor" control={<Radio />} label="Resumen por Vendedor" />
                    <FormControlLabel value="producto" control={<Radio />} label="Resumen por Productos" />
                  </RadioGroup>
                </FormControl>
              </Grid>

              {/* Rango de Fechas */}
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary' }}>
                  Rango de Fecha y Hora
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField
                    label="Desde"
                    type="datetime-local"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Hasta"
                    type="datetime-local"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                  />
                </Box>
              </Grid>

              {/* Sucursal (Habilitado sólo en Resumido) */}
              <Grid item xs={12}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 'bold', 
                    mb: 1, 
                    color: reporteSeleccionado === "resumido" ? 'text.secondary' : 'text.disabled' 
                  }}
                >
                  Sucursal
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <FormControl fullWidth size="small" disabled={reporteSeleccionado !== "resumido" || todasSucursales}>
                    <InputLabel id={`${idLabel}-sucursal-select-label`}>Seleccionar Sucursal</InputLabel>
                    <Select
                      labelId={`${idLabel}-sucursal-select-label`}
                      value={idSucursal === 0 && sucursales.length > 0 ? sucursales[0].idSucursal : idSucursal}
                      label="Seleccionar Sucursal"
                      onChange={(e) => setIdSucursal(Number(e.target.value))}
                    >
                      {Array.isArray(sucursales) && sucursales.map((suc) => (
                        <MenuItem key={suc.idSucursal} value={suc.idSucursal}>
                          {suc.nombreSucursal}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={todasSucursales}
                        onChange={(e) => {
                          setTodasSucursales(e.target.checked);
                          if (e.target.checked) setIdSucursal(0);
                        }}
                        disabled={reporteSeleccionado !== "resumido"}
                      />
                    }
                    label="Todas las Sucursales"
                  />
                </Box>
              </Grid>

              {/* Tipo de Productos (Habilitado sólo en Productos) */}
              <Grid item xs={12}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 'bold', 
                    mb: 1, 
                    color: reporteSeleccionado === "producto" ? 'text.secondary' : 'text.disabled' 
                  }}
                >
                  Tipo de Productos
                </Typography>
                <FormControl fullWidth size="small" disabled={reporteSeleccionado !== "producto"}>
                  <InputLabel id={`${idLabel}-tipo-producto-select-label`}>Filtrar por Tipo</InputLabel>
                  <Select
                    labelId={`${idLabel}-tipo-producto-select-label`}
                    value={idTipoProducto}
                    label="Filtrar por Tipo"
                    onChange={(e) => setIdTipoProducto(e.target.value as number | 'TODOS')}
                  >
                    <MenuItem value="TODOS">TODOS</MenuItem>
                    {Array.isArray(tiposProducto) && tiposProducto.map((tipo) => (
                      <MenuItem key={tipo.idTipoProducto} value={tipo.idTipoProducto}>
                        {tipo.nombreTipo}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Acciones */}
              <Grid item xs={12} sx={{ mt: 1 }}>
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={handleConsultar}
                    fullWidth
                    disabled={loading}
                  >
                    Consultar
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<DownloadIcon />}
                    onClick={handleDescargarPDF}
                    fullWidth
                    disabled={loading || resultados.length === 0}
                  >
                    PDF
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Panel Derecho: Tabla de Resultados */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, minHeight: 450, display: "flex", flexDirection: "column" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
              Vista Previa de Resultados
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" flexGrow={1} gap={2}>
                <CircularProgress size={50} />
                <Typography variant="body2" color="text.secondary">
                  Generando reporte...
                </Typography>
              </Box>
            ) : errorMsg ? (
              <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
                <Alert severity="error" sx={{ width: "100%" }}>
                  {errorMsg}
                </Alert>
              </Box>
            ) : !consultado ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" flexGrow={1} sx={{ opacity: 0.6, p: 4 }}>
                <Typography variant="h6" align="center" color="text.secondary">
                  No se ha realizado ninguna consulta
                </Typography>
                <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
                  Selecciona los filtros requeridos en el panel izquierdo y presiona el botón "Consultar" para ver los datos.
                </Typography>
              </Box>
            ) : resultados.length === 0 ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" flexGrow={1} sx={{ p: 4 }}>
                <Typography variant="h6" align="center" color="text.secondary">
                  Sin registros encontrados
                </Typography>
                <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
                  No se encontraron ventas para los filtros y el rango de fechas seleccionado.
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ flexGrow: 1, maxHeight: 600 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {reporteSeleccionado === "resumido" && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>Nro. Factura / CVE</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Cliente</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Vendedor</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Venta (₲)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Descuento (₲)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Neto (₲)</TableCell>
                        </>
                      )}
                      {reporteSeleccionado === "vendedor" && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>Vendedor</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Neto Vendido (₲)</TableCell>
                        </>
                      )}
                      {reporteSeleccionado === "producto" && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>Producto</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Cantidad Vendida</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Monto Vendido (₲)</TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Render de filas */}
                    {resultados.map((item, idx) => (
                      <TableRow key={idx} hover>
                        {reporteSeleccionado === "resumido" && (
                          <>
                            <TableCell>{item.factura || 'CVE / Sin Factura'}</TableCell>
                            <TableCell>{item.cliente || 'Sin nombre'}</TableCell>
                            <TableCell>{item.nombre || 'Sin vendedor'}</TableCell>
                            <TableCell align="right">{formatMoneda(Number(item.totalVenta || 0))}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {Number(item.totalDescuento || 0) > 0 ? `-${formatMoneda(Number(item.totalDescuento))}` : '0'}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatMoneda(Number(item.totalVenta || 0) - Number(item.totalDescuento || 0))}
                            </TableCell>
                          </>
                        )}
                        {reporteSeleccionado === "vendedor" && (
                          <>
                            <TableCell>{item.nombre || 'SIN DEFINIR'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatMoneda(Number(item.total || 0))}</TableCell>
                          </>
                        )}
                        {reporteSeleccionado === "producto" && (
                          <>
                            <TableCell>{item.nombre || 'Sin nombre'}</TableCell>
                            <TableCell align="right">{Number(item.TotalVendido || 0).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatMoneda(Number(item.totalMontoVendido || 0))}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}

                    {/* Fila de Totales */}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      {reporteSeleccionado === "resumido" && (
                        <>
                          <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>TOTAL GENERAL</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatMoneda(totales.totalVenta || 0)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                            {Number(totales.totalDescuento || 0) > 0 ? `-${formatMoneda(totales.totalDescuento || 0)}` : '0'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.05rem' }}>
                            {formatMoneda(totales.totalNeto || 0)}
                          </TableCell>
                        </>
                      )}
                      {reporteSeleccionado === "vendedor" && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>TOTAL GENERAL</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.05rem' }}>
                            {formatMoneda(totales.totalNeto || 0)}
                          </TableCell>
                        </>
                      )}
                      {reporteSeleccionado === "producto" && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>TOTAL GENERAL</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {Number(totales.totalCantidad || 0).toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '1.05rem' }}>
                            {formatMoneda(totales.totalMonto || 0)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};