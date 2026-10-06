import React, { useState } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { consultaArqueoService } from '../../services/consultaArqueo.service';
import { reporteService } from '../../services/reporte.service';
import { ticketService } from '../../services/ticket.service';
import type { DatosCierreCaja } from '../../types/ticket.types';

// ──────────────────────────────────────────────
// Interfaces para Tipos de Arqueo
// ──────────────────────────────────────────────
interface ArqueoCabecera {
  id: number;
  nroCaja: number;
  responsableApertura: string;
  montoInicial: number;
  fechaApertura: string;
  responsableCierre: string;
  fechaCierre: string;
  montoContadoCajero: number;
  montoSistema: number;
  estado: string;
}

interface GastoItem {
  concepto: string;
  montoGasto: number;
}

interface MonedaItem {
  nombre: string;
  montoMoneda: number;
  total: number;
}

interface TarjetaItem {
  nombreTarjetaDebito: string;
  monto: number;
}

interface TransferenciaItem {
  concepto: string;
  monto: number;
}

interface VentaCreditoItem {
  nroFactura: string;
  cliente: string;
  totalVenta: number;
}

interface CobroItem {
  nroRecibo: number;
  cliente: string;
  totalCobrado: number;
}

const ConsultaArqueCaja: React.FC = () => {
  // ── Filtros ────────────────────────────────
  const [fechaDesde, setFechaDesde] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [nroCajaFiltro, setNroCajaFiltro] = useState('');
  const [tipoBusqueda, setTipoBusqueda] = useState<'fecha' | 'caja'>('fecha');

  // ── Resultados ─────────────────────────────
  const [arqueos, setArqueos] = useState<ArqueoCabecera[]>([]);
  const [selectedArqueo, setSelectedArqueo] = useState<ArqueoCabecera | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Desgloses del Arqueo Seleccionado ──────
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [monedas, setMonedas] = useState<MonedaItem[]>([]);
  const [tarjetaCredito, setTarjetaCredito] = useState<TarjetaItem[]>([]);
  const [tarjetaDebito, setTarjetaDebito] = useState<TarjetaItem[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaItem[]>([]);
  const [ventasCredito, setVentasCredito] = useState<VentaCreditoItem[]>([]);
  const [cobros, setCobros] = useState<CobroItem[]>([]);
  const [totales, setTotales] = useState({ ventasContado: 0, cobranza: 0, gastos: 0 });

  // ── Navegación entre registros ──────────────
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // ── Handlers de búsqueda ────────────────────
  const handleBuscar = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setSelectedArqueo(null);
    clearDesgloses();

    try {
      let result;
      if (tipoBusqueda === 'caja') {
        if (nroCajaFiltro.trim() === '') {
          throw new Error('Ingrese un número de caja válido.');
        }
        const numCaja = parseInt(nroCajaFiltro, 10);
        if (isNaN(numCaja)) {
          throw new Error('El número de caja debe ser numérico.');
        }
        result = await consultaArqueoService.consultaArqueoNroCaja(numCaja);
      } else {
        result = await consultaArqueoService.consultaArqueoFecha(fechaDesde, fechaHasta);
      }

      const mapped = result.map((a: any) => ({
        id: a.id,
        nroCaja: a.nroCaja,
        responsableApertura: a.responsableApertura || 'Sistema',
        montoInicial: a.montoInicial || 0,
        fechaApertura: a.fechaApertura ? new Date(a.fechaApertura).toLocaleString('es-PY') : '',
        responsableCierre: a.responsableCierre || '',
        fechaCierre: a.fechaCierre ? new Date(a.fechaCierre).toLocaleString('es-PY') : '',
        montoContadoCajero: a.montoContadoCajero || 0,
        montoSistema: a.montoSistema || 0,
        estado: a.estado || ''
      }));

      setArqueos(mapped);
    } catch (err: any) {
      setError(err.message || 'Error al buscar arqueos de caja');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBuscar();
  };

  const clearDesgloses = () => {
    setGastos([]);
    setMonedas([]);
    setTarjetaCredito([]);
    setTarjetaDebito([]);
    setTransferencias([]);
    setVentasCredito([]);
    setCobros([]);
    setTotales({ ventasContado: 0, cobranza: 0, gastos: 0 });
  };

  // ── Seleccionar arqueo de la lista ──────────
  const handleSelectArqueo = async (arqueo: ArqueoCabecera, index: number) => {
    setSelectedArqueo(arqueo);
    setCurrentIndex(index);
    setError('');
    setSuccessMsg('');
    clearDesgloses();

    try {
      const resp = await consultaArqueoService.consultaInformacionArqueo(arqueo.id);
      
      // Si el SP devuelve información detallada
      if (resp.cabecera) {
        setSelectedArqueo({
          id: arqueo.id,
          nroCaja: resp.cabecera.nroCaja,
          responsableApertura: resp.cabecera.cajeroApertura || arqueo.responsableApertura,
          montoInicial: resp.cabecera.montoInicial || 0,
          fechaApertura: resp.cabecera.fechaApertura ? new Date(resp.cabecera.fechaApertura).toLocaleString('es-PY') : arqueo.fechaApertura,
          responsableCierre: resp.cabecera.cajeroCierre || arqueo.responsableCierre,
          fechaCierre: resp.cabecera.fechaCierre ? new Date(resp.cabecera.fechaCierre).toLocaleString('es-PY') : arqueo.fechaCierre,
          montoContadoCajero: resp.cabecera.saldoReal || 0,
          montoSistema: resp.cabecera.saldoTeorico || 0,
          estado: arqueo.estado
        });
      }

      setGastos(resp.gastos || []);
      setMonedas(resp.monedas || []);
      setTarjetaCredito(resp.tarjetaCredito || []);
      setTarjetaDebito(resp.tarjetaDebito || []);
      setTransferencias(resp.transferencias || []);
      setVentasCredito(resp.ventasCredito || []);
      setCobros(resp.cobros || []);
      setTotales({
        ventasContado: resp.cabecera?.totalVentas || 0,
        cobranza: resp.cabecera?.totalCobranza || 0,
        gastos: resp.cabecera?.totalGastos || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Error al obtener el detalle del arqueo');
    }
  };

  // ── Navegación entre registros ──────────────
  const navPrimero   = () => { if (arqueos.length > 0) handleSelectArqueo(arqueos[0], 0); };
  const navAnterior  = () => { if (currentIndex > 0) handleSelectArqueo(arqueos[currentIndex - 1], currentIndex - 1); };
  const navSiguiente = () => { if (currentIndex < arqueos.length - 1) handleSelectArqueo(arqueos[currentIndex + 1], currentIndex + 1); };
  const navUltimo    = () => { if (arqueos.length > 0) handleSelectArqueo(arqueos[arqueos.length - 1], arqueos.length - 1); };

  // ── Imprimir Ticket de Cierre ───────────────
  const handleImprimirCierre = async () => {
    if (!selectedArqueo) return;
    setIsLoading(true);
    setError('');

    try {
      const datosReporte = await reporteService.obtenerDatosCierreCaja(selectedArqueo.id);
      
      // Mapear los datos al tipo esperado por ticketService.generarTicketCierreCaja
      const datosCierre: DatosCierreCaja = {
        resumen: {
          nombreCaja: `Caja ${datosReporte.resumen.nroCaja}`,
          cajeroApertura: datosReporte.resumen.cajeroApertura || '',
          cajeroCierre: datosReporte.resumen.cajeroCierre || '',
          fechaApertura: datosReporte.resumen.fechaApertura,
          fechaCierre: datosReporte.resumen.fechaCierre,
          montoInicial: datosReporte.resumen.montoInicial || 0,
          totalVentas: datosReporte.resumen.totalVentas || 0,
          totalVentasContado: datosReporte.resumen.totalVentasContado || 0,
          totalVentasCredito: datosReporte.resumen.totalVentasCredito || 0,
          totalCobranza: datosReporte.resumen.totalCobranza || 0,
          totalGastos: datosReporte.resumen.totalGastos || 0,
          totalMoneda: datosReporte.resumen.totalMoneda || 0,
          totalTarjetaDebito: datosReporte.resumen.totalTarjetaDebito || 0,
          totalTarjetaCredito: datosReporte.resumen.totalTarjetaCredito || 0,
          totalTransferencia: datosReporte.resumen.totalTransferencia || 0,
          saldoTeorico: datosReporte.resumen.saldoTeorico || 0,
          saldoReal: datosReporte.resumen.saldoReal || 0,
          diferencia: datosReporte.resumen.diferencia || 0,
          estadoCierre: datosReporte.resumen.estadoCierre || ''
        },
        gastos: datosReporte.gastos || [],
        arqueoMoneda: datosReporte.arqueoMoneda || [],
        tarjetasCredito: datosReporte.tarjetasCredito || [],
        tarjetasDebito: datosReporte.tarjetasDebito || [],
        transferencias: datosReporte.transferencias || [],
        ventasCredito: datosReporte.ventasCredito || [],
        cobros: datosReporte.cobros || []
      };

      await ticketService.generarTicketCierreCaja(datosCierre);
      setSuccessMsg('Ticket de cierre de caja generado correctamente.');
    } catch (err: any) {
      console.error('Error al imprimir cierre de caja:', err);
      setError(err.message || 'Error al generar el ticket de cierre');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────
  const formatMoneda = (v: number) => `${v.toLocaleString('es-PY')}`;
  const chipColorEstado = (estado: string): 'success' | 'warning' | 'default' => {
    if (estado === 'CERRADA') return 'success';
    if (estado === 'ABIERTA') return 'warning';
    return 'default';
  };

  const getDiferenciaInfo = (teorico: number, real: number) => {
    const dif = real - teorico;
    if (dif === 0) return { texto: 'CAJA CUADRADA', color: 'success.main', valor: 0 };
    if (dif < 0) return { texto: 'FALTANTE DE DINERO', color: 'error.main', valor: dif };
    return { texto: 'SOBRANTE DE DINERO', color: 'info.main', valor: dif };
  };

  const sectionLabel = (text: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}
    </Typography>
  );

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Título ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PointOfSaleIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Consulta de Arqueos de Caja
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* ── Panel de filtros (Stack horizontal) ── */}
      <Paper sx={{ p: 2 }}>
        {sectionLabel('Filtros de búsqueda')}
        <Stack direction="column" spacing={2} alignItems="flex-start">
          <FormControl component="fieldset">
            <RadioGroup
              row
              value={tipoBusqueda}
              onChange={(e) => {
                setTipoBusqueda(e.target.value as 'fecha' | 'caja');
                setError('');
                setArqueos([]);
                setSelectedArqueo(null);
                clearDesgloses();
              }}
            >
              <FormControlLabel value="fecha" control={<Radio size="small" />} label="Por Fecha" />
              <FormControlLabel value="caja" control={<Radio size="small" />} label="Por Nro. Caja" />
            </RadioGroup>
          </FormControl>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start" flexWrap="wrap" useFlexGap sx={{ width: '100%' }}>
            {tipoBusqueda === 'fecha' ? (
              <>
                <TextField
                  label="Fecha desde"
                  type="date"
                  size="small"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  onKeyDown={handleKeyDown}
                  sx={{ minWidth: 155 }}
                />
                <TextField
                  label="Fecha hasta"
                  type="date"
                  size="small"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  onKeyDown={handleKeyDown}
                  sx={{ minWidth: 155 }}
                />
              </>
            ) : (
              <TextField
                label="Nro. Caja"
                size="small"
                value={nroCajaFiltro}
                onChange={(e) => setNroCajaFiltro(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej. 1"
                sx={{ minWidth: 200, flex: 1, maxWidth: 300 }}
                autoFocus
              />
            )}
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleBuscar}
              disabled={isLoading}
              sx={{ height: 40, alignSelf: 'flex-start' }}
            >
              Buscar
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Lista de arqueos ────────────────────── */}
      {selectedArqueo === null ? (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%', mx: 'auto' }}>
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resultados
              {arqueos.length > 0 && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'primary.main' }}>
                  ({arqueos.length} registro{arqueos.length !== 1 ? 's' : ''})
                </Typography>
              )}
            </Typography>
          </Box>
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>ID Arqueo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Nro. Caja</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Apertura</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Responsable Apertura</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cierre</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Responsable Cierre</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Monto Inicial</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Saldo Sistema</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Monto Contado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {arqueos.map((arqueo, i) => (
                  <TableRow
                    key={arqueo.id}
                    hover
                    selected={selectedArqueo?.id === arqueo.id}
                    onClick={() => handleSelectArqueo(arqueo, i)}
                    sx={{
                      cursor: 'pointer',
                      '&.Mui-selected': { backgroundColor: 'action.selected' }
                    }}
                  >
                    <TableCell>{arqueo.id}</TableCell>
                    <TableCell>Caja {arqueo.nroCaja}</TableCell>
                    <TableCell>{arqueo.fechaApertura}</TableCell>
                    <TableCell>{arqueo.responsableApertura}</TableCell>
                    <TableCell>{arqueo.fechaCierre || '—'}</TableCell>
                    <TableCell>{arqueo.responsableCierre || '—'}</TableCell>
                    <TableCell align="right">{formatMoneda(arqueo.montoInicial)}</TableCell>
                    <TableCell align="right">{formatMoneda(arqueo.montoSistema)}</TableCell>
                    <TableCell align="right">{formatMoneda(arqueo.montoContadoCajero)}</TableCell>
                    <TableCell align="center">
                      <Chip label={arqueo.estado} color={chipColorEstado(arqueo.estado)} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {arqueos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                      <Typography color="text.disabled">
                        {isLoading ? 'Buscando...' : 'Realice una búsqueda para ver los resultados'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        /* ── Panel inferior: detalle + controles ── */
        <Paper sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          
          {/* Volver a la Lista arriba */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setSelectedArqueo(null);
                clearDesgloses();
                setCurrentIndex(-1);
              }}
            >
              Volver a la Lista
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>

            {/* Columna Izquierda: Datos del Arqueo */}
            <Box sx={{ minWidth: 280, flex: '1 0 300px' }}>
              {sectionLabel('Resumen de Arqueo')}
              <Grid container spacing={1}>
                {[
                  ['ID Arqueo:', selectedArqueo?.id ?? '—'],
                  ['Nro. Caja:', selectedArqueo ? `Caja ${selectedArqueo.nroCaja}` : '—'],
                  ['Resp. Apertura:', selectedArqueo?.responsableApertura ?? '—'],
                  ['Fecha Apertura:', selectedArqueo?.fechaApertura ?? '—'],
                  ['Resp. Cierre:', selectedArqueo?.responsableCierre || '—'],
                  ['Fecha Cierre:', selectedArqueo?.fechaCierre || '—'],
                ].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">{label}</Typography></Grid>
                    <Grid size={7}><Typography variant="body2" fontWeight={500}>{value}</Typography></Grid>
                  </React.Fragment>
                ))}
                
                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                {[
                  ['Monto Inicial:', formatMoneda(selectedArqueo?.montoInicial ?? 0)],
                  ['+ Ventas Contado:', formatMoneda(totales.ventasContado)],
                  ['+ Cobranzas:', formatMoneda(totales.cobranza)],
                  ['- Gastos:', formatMoneda(totales.gastos)],
                  ['Saldo Sistema (Teórico):', formatMoneda(selectedArqueo?.montoSistema ?? 0)],
                  ['Saldo Real (Cajero):', formatMoneda(selectedArqueo?.montoContadoCajero ?? 0)],
                ].map(([label, value], i) => (
                  <React.Fragment key={label}>
                    <Grid item xs={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: i >= 4 ? 600 : 400 }}>
                        {label}
                      </Typography>
                    </Grid>
                    <Grid item xs={5}>
                      <Typography variant="body2" align="right" sx={{ fontWeight: i >= 4 ? 700 : 500 }}>
                        {value}
                      </Typography>
                    </Grid>
                  </React.Fragment>
                ))}

                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                {/* Diferencia y Balance */}
                {(() => {
                  const difInfo = getDiferenciaInfo(selectedArqueo?.montoSistema ?? 0, selectedArqueo?.montoContadoCajero ?? 0);
                  return (
                    <>
                      <Grid item xs={6}><Typography variant="body2" color="text.secondary" fontWeight={600}>Diferencia:</Typography></Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" align="right" fontWeight={700} sx={{ color: difInfo.color }}>
                          {formatMoneda(difInfo.valor)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sx={{ mt: 0.5, textAlign: 'center' }}>
                        <Chip
                          label={difInfo.texto}
                          sx={{
                            backgroundColor: `${difInfo.color}15`,
                            color: difInfo.color,
                            fontWeight: 700,
                            border: `1px solid ${difInfo.color}`
                          }}
                        />
                      </Grid>
                    </>
                  );
                })()}
              </Grid>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* Columna Derecha: Tablas Desglosadas de Movimientos */}
            <Box sx={{ flex: 2, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
              
              {/* Gastos */}
              <Box>
                {sectionLabel('Egresos / Gastos de Caja')}
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Concepto</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {gastos.map((g, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{g.concepto}</TableCell>
                          <TableCell align="right">{formatMoneda(g.montoGasto)}</TableCell>
                        </TableRow>
                      ))}
                      {gastos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} align="center" sx={{ py: 2 }}>
                            <Typography variant="caption" color="text.disabled">Sin gastos registrados</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Grid de 2 columnas para tarjetas y transferencias */}
              <Grid container spacing={2}>
                {/* Tarjetas Crédito & Débito */}
                <Grid item xs={12} md={6}>
                  {sectionLabel('Movimientos con Tarjeta')}
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Tarjeta</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Tipo</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* Tarjetas de Crédito */}
                        {tarjetaCredito.map((t, idx) => (
                          <TableRow key={`c-${idx}`}>
                            <TableCell>{t.nombreTarjetaDebito}</TableCell>
                            <TableCell><Chip label="Crédito" size="small" color="secondary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                            <TableCell align="right">{formatMoneda(t.monto)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Tarjetas de Débito */}
                        {tarjetaDebito.map((t, idx) => (
                          <TableRow key={`d-${idx}`}>
                            <TableCell>{t.nombreTarjetaDebito}</TableCell>
                            <TableCell><Chip label="Débito" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} /></TableCell>
                            <TableCell align="right">{formatMoneda(t.monto)}</TableCell>
                          </TableRow>
                        ))}
                        {tarjetaCredito.length === 0 && tarjetaDebito.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                              <Typography variant="caption" color="text.disabled">Sin movimientos de tarjeta</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Transferencias */}
                <Grid item xs={12} md={6}>
                  {sectionLabel('Transferencias Bancarias')}
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Concepto</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transferencias.map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{t.concepto}</TableCell>
                            <TableCell align="right">{formatMoneda(t.monto)}</TableCell>
                          </TableRow>
                        ))}
                        {transferencias.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} align="center" sx={{ py: 2 }}>
                              <Typography variant="caption" color="text.disabled">Sin transferencias registradas</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>

              {/* Cobros de créditos (suman) y ventas a crédito (informativas) */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {sectionLabel('Cobros de Créditos')}
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Recibo</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Cliente</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cobros.map((x) => (
                          <TableRow key={x.nroRecibo}>
                            <TableCell>{x.nroRecibo}</TableCell>
                            <TableCell>{x.cliente}</TableCell>
                            <TableCell align="right">{formatMoneda(x.totalCobrado)}</TableCell>
                          </TableRow>
                        ))}
                        {cobros.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                              <Typography variant="caption" color="text.disabled">Sin cobros de créditos</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  {sectionLabel('Ventas a Crédito (informativo)')}
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Factura</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Cliente</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ventasCredito.map((x) => (
                          <TableRow key={x.nroFactura}>
                            <TableCell>{x.nroFactura}</TableCell>
                            <TableCell>{x.cliente}</TableCell>
                            <TableCell align="right">{formatMoneda(x.totalVenta)}</TableCell>
                          </TableRow>
                        ))}
                        {ventasCredito.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                              <Typography variant="caption" color="text.disabled">Sin ventas a crédito</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography variant="caption" color="text.secondary">No ingresan dinero: no suman al saldo de la caja.</Typography>
                </Grid>
              </Grid>

              {/* Moneda Extranjera */}
              <Box>
                {sectionLabel('Moneda Extranjera')}
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 150 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, py: 0.5 }}>Divisa</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Monto Divisa</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 0.5 }} align="right">Equivalente (PYG)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {monedas.map((m, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{m.nombre}</TableCell>
                          <TableCell align="right">{m.montoMoneda.toLocaleString('es-PY')}</TableCell>
                          <TableCell align="right">{formatMoneda(m.total)}</TableCell>
                        </TableRow>
                      ))}
                      {monedas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                            <Typography variant="caption" color="text.disabled">Sin moneda extranjera declarada</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', lg: 'block' } }} />

            {/* Controles y Acciones */}
            <Box sx={{ minWidth: 150, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sectionLabel('Controles')}

              {/* Navegación entre Arqueos */}
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1, justifyContent: 'center' }}>
                <Tooltip title="Primero">
                  <span>
                    <IconButton size="small" onClick={navPrimero} disabled={arqueos.length === 0}>
                      <FirstPageIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Anterior">
                  <span>
                    <IconButton size="small" onClick={navAnterior} disabled={currentIndex <= 0}>
                      <NavigateBeforeIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Siguiente">
                  <span>
                    <IconButton size="small" onClick={navSiguiente} disabled={currentIndex >= arqueos.length - 1}>
                      <NavigateNextIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Último">
                  <span>
                    <IconButton size="small" onClick={navUltimo} disabled={arqueos.length === 0}>
                      <LastPageIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {arqueos.length > 0 && currentIndex >= 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, textAlign: 'center' }}>
                  Registro {currentIndex + 1} de {arqueos.length}
                </Typography>
              )}

              {/* Botones de Acción */}
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<ArrowBackIcon />}
                  size="small"
                  fullWidth
                  onClick={() => {
                    setSelectedArqueo(null);
                    clearDesgloses();
                    setCurrentIndex(-1);
                  }}
                >
                  Volver
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  size="small"
                  disabled={!selectedArqueo || isLoading}
                  fullWidth
                  onClick={handleImprimirCierre}
                >
                  Imprimir
                </Button>
              </Stack>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ConsultaArqueCaja;
