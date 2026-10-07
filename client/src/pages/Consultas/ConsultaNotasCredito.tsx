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
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import { notaCreditoService } from '../../services/notaCredito.service';
import type { NotaCreditoListado, DatosNotaCredito, TipoNotaCredito } from '../../services/notaCredito.service';
import { facturaService } from '../../services/ticket.service';
import { getErrorMessage } from '../../services/httpError';
import AnulacionModal from '../../components/AnulacionModal';

const hoy = () => new Date().toISOString().split('T')[0];
const TITULO: Record<TipoNotaCredito, string> = {
  DEV: 'Consulta de Notas de Crédito por Devolución',
  MONTO: 'Consulta de Notas de Crédito por Monto',
};

/** Número a mostrar: las devoluciones de ventas no impresas no tienen número de nota de crédito */
const numeroNota = (n: NotaCreditoListado) => n.nroNotaCredito ?? `Interna ${n.idDocumento}`;

interface Props {
  tipo: TipoNotaCredito;
}

/**
 * Consulta de notas de crédito de un tipo (devolución de mercadería o monto): búsqueda por fecha o número,
 * detalle, reimpresión y anulación con usuario autorizador.
 */
const ConsultaNotasCredito: React.FC<Props> = ({ tipo }) => {
  // ── Filtros ────────────────────────────────
  const [fechaDesde, setFechaDesde] = useState<string>(hoy());
  const [fechaHasta, setFechaHasta] = useState<string>(hoy());
  const [nroNota, setNroNota] = useState('');
  // Solo devoluciones: '' = todas, 'imp' = sobre facturas, 'noimp' = sobre ventas no impresas
  const [impresion, setImpresion] = useState<'' | 'imp' | 'noimp'>('');
  const [tipoBusqueda, setTipoBusqueda] = useState<'fecha' | 'numero'>('fecha');

  // ── Resultados ─────────────────────────────
  const [notas, setNotas] = useState<NotaCreditoListado[]>([]);
  const [seleccionada, setSeleccionada] = useState<NotaCreditoListado | null>(null);
  const [detalle, setDetalle] = useState<DatosNotaCredito['detalle']>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isAnulacionOpen, setIsAnulacionOpen] = useState(false);

  const handleBuscar = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setSeleccionada(null);
    setDetalle([]);

    try {
      let filtros: { tipo: TipoNotaCredito; nroNotaCredito?: number; desde?: string; hasta?: string; noImp?: boolean } = {
        tipo,
        noImp: tipo === 'DEV' && impresion ? impresion === 'noimp' : undefined,
      };
      if (tipoBusqueda === 'numero') {
        // Acepta el número suelto (123) o el formato completo (001-001-0000123)
        const numero = parseInt(nroNota.split('-').pop()?.replace(/\D/g, '') || '', 10);
        if (!numero) throw new Error('Ingrese un número de nota de crédito válido.');
        filtros = { ...filtros, nroNotaCredito: numero };
      } else {
        filtros = { ...filtros, desde: fechaDesde, hasta: fechaHasta };
      }
      const result = await notaCreditoService.listar(filtros);
      setNotas(result);
      if (result.length === 0) setError('No se encontraron notas de crédito.');
    } catch (err) {
      setError(getErrorMessage(err, 'Error al buscar notas de crédito'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBuscar();
  };

  const handleSeleccionar = async (nota: NotaCreditoListado, index: number) => {
    setSeleccionada(nota);
    setCurrentIndex(index);
    setError('');
    setSuccessMsg('');
    setDetalle([]);
    try {
      const datos = await notaCreditoService.reporte(nota.tipo, nota.idDocumento);
      setDetalle(datos.detalle);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar el detalle de la nota de crédito'));
    }
  };

  const handleImprimir = async () => {
    if (!seleccionada) return;
    setIsLoading(true);
    try {
      await facturaService.generarNotaCredito(await notaCreditoService.reporte(seleccionada.tipo, seleccionada.idDocumento));
    } catch (err) {
      setError(getErrorMessage(err, 'Error al imprimir la nota de crédito'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnulacionSuccess = () => {
    setIsAnulacionOpen(false);
    setSuccessMsg(`Nota de crédito ${seleccionada ? numeroNota(seleccionada) : ''} anulada correctamente.`);
    handleBuscar();
  };

  const volverALista = () => {
    setSeleccionada(null);
    setDetalle([]);
    setCurrentIndex(-1);
  };

  const irA = (index: number) => {
    if (index >= 0 && index < notas.length) handleSeleccionar(notas[index], index);
  };

  // ── Helpers ─────────────────────────────────
  const formatMoneda = (v: number) => `${Math.round(v || 0).toLocaleString('es-PY')}`;
  const estado = (n: NotaCreditoListado) => (n.activo ? 'ACTIVA' : 'ANULADA');
  const chipColor = (n: NotaCreditoListado): 'success' | 'error' => (n.activo ? 'success' : 'error');
  const sectionLabel = (text: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}
    </Typography>
  );

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Título ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {tipo === 'DEV' ? <AssignmentReturnIcon color="primary" /> : <RequestQuoteIcon color="primary" />}
        <Typography variant="h6" fontWeight={600}>
          {TITULO[tipo]}
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* ── Filtros ── */}
      <Paper sx={{ p: 2 }}>
        {sectionLabel('Filtros de búsqueda')}
        <Stack direction="column" spacing={2} alignItems="flex-start">
          <FormControl component="fieldset">
            <RadioGroup
              row
              value={tipoBusqueda}
              onChange={(e) => {
                setTipoBusqueda(e.target.value as 'fecha' | 'numero');
                setError('');
                setNotas([]);
                volverALista();
              }}
            >
              <FormControlLabel value="fecha" control={<Radio size="small" />} label="Por Fecha" />
              <FormControlLabel value="numero" control={<Radio size="small" />} label="Por Nro. Nota de Crédito" />
            </RadioGroup>
          </FormControl>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start" flexWrap="wrap" useFlexGap sx={{ width: '100%' }}>
            {tipo === 'DEV' && (
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>Ventas</InputLabel>
                <Select label="Ventas" value={impresion} onChange={(e) => setImpresion(e.target.value as '' | 'imp' | 'noimp')}>
                  <MenuItem value="">Imp y NoImp</MenuItem>
                  <MenuItem value="imp">Imp (facturas)</MenuItem>
                  <MenuItem value="noimp">NoImp (no impresas)</MenuItem>
                </Select>
              </FormControl>
            )}
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
                label="Nro. Nota de Crédito"
                size="small"
                placeholder="123 o 001-001-0000123"
                value={nroNota}
                onChange={(e) => setNroNota(e.target.value.replace(/[^\d-]/g, ''))}
                onKeyDown={handleKeyDown}
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

      {/* ── Lista ── */}
      {seleccionada === null ? (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resultados
              {notas.length > 0 && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'primary.main' }}>
                  ({notas.length} registro{notas.length !== 1 ? 's' : ''})
                </Typography>
              )}
            </Typography>
          </Box>
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Nro. Nota</TableCell>
                  {tipo === 'DEV' && <TableCell sx={{ fontWeight: 700 }}>Venta</TableCell>}
                  <TableCell sx={{ fontWeight: 700 }}>Fecha / Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Factura</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notas.map((n, i) => (
                  <TableRow
                    key={`${n.tipo}-${n.idDocumento}`}
                    hover
                    onClick={() => handleSeleccionar(n, i)}
                    sx={{ cursor: 'pointer', backgroundColor: n.activo ? undefined : 'rgba(244,67,54,0.05)' }}
                  >
                    <TableCell>{numeroNota(n)}</TableCell>
                    {tipo === 'DEV' && (
                      <TableCell>
                        <Chip size="small" variant="outlined" label={n.noImp ? 'NoImp' : 'Imp'} color={n.noImp ? 'default' : 'primary'} />
                      </TableCell>
                    )}
                    <TableCell>{new Date(n.fechaAlta).toLocaleString('es-PY')}</TableCell>
                    <TableCell>{n.nroFactura ?? `Id ${n.idVenta}`}</TableCell>
                    <TableCell>{n.cliente}</TableCell>
                    <TableCell>{n.usuario}</TableCell>
                    <TableCell align="right">{formatMoneda(n.totalNotaCredito)}</TableCell>
                    <TableCell align="center">
                      <Chip label={estado(n)} color={chipColor(n)} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {notas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tipo === 'DEV' ? 8 : 7} align="center" sx={{ py: 6 }}>
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
        /* ── Detalle + controles ── */
        <Paper sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={volverALista}>
              Volver a la Lista
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {/* Datos de la nota */}
            <Box sx={{ minWidth: 280, flex: '0 0 auto', maxWidth: 380 }}>
              {sectionLabel('Datos de la nota de crédito')}
              <Grid container spacing={0.5}>
                {[
                  ['Nro. Nota:', numeroNota(seleccionada)],
                  ['Fecha/Hora:', new Date(seleccionada.fechaAlta).toLocaleString('es-PY')],
                  [seleccionada.noImp ? 'Venta no impresa:' : 'Factura:',
                    `${seleccionada.nroFactura ?? `Id ${seleccionada.idVenta}`} (${seleccionada.idTipoVenta === 2 ? 'Crédito' : 'Contado'})`],
                  ['Cliente:', seleccionada.cliente],
                  ['RUC:', seleccionada.ruc || '—'],
                  ['Usuario:', seleccionada.usuario],
                  ['Sucursal:', seleccionada.nombreSucursal],
                  ['Motivo:', seleccionada.motivo],
                  ...(seleccionada.idTipoVenta === 2 ? [['Rebajado de cuotas:', formatMoneda(seleccionada.montoAplicadoCredito)]] : []),
                  ...(seleccionada.montoDevueltoCaja > 0 ? [['Devuelto de caja:', formatMoneda(seleccionada.montoDevueltoCaja)]] : []),
                ].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">{label}</Typography></Grid>
                    <Grid size={7}><Typography variant="body2">{value}</Typography></Grid>
                  </React.Fragment>
                ))}
                <Grid size={5}><Typography variant="body2" color="text.secondary">Estado:</Typography></Grid>
                <Grid size={7}><Chip label={estado(seleccionada)} color={chipColor(seleccionada)} size="small" /></Grid>
                {!seleccionada.activo && (
                  <>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">Anulada por:</Typography></Grid>
                    <Grid size={7}>
                      <Typography variant="body2">
                        {seleccionada.usuarioAnulacion || '—'}
                        {seleccionada.fechaAnulacion && ` (${new Date(seleccionada.fechaAnulacion).toLocaleString('es-PY')})`}
                      </Typography>
                    </Grid>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">Motivo anulación:</Typography></Grid>
                    <Grid size={7}><Typography variant="body2">{seleccionada.motivoAnulacion || '—'}</Typography></Grid>
                  </>
                )}
                <Grid size={5}><Typography variant="body2" color="text.secondary" fontWeight={600}>Total:</Typography></Grid>
                <Grid size={7}>
                  <Typography variant="body1" fontWeight={700} color="primary.main">{formatMoneda(seleccionada.totalNotaCredito)}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Detalle */}
            <Box sx={{ flex: 1, minWidth: 320 }}>
              {sectionLabel(seleccionada.tipo === 'DEV' ? 'Artículos devueltos' : 'Conceptos')}
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {seleccionada.tipo === 'DEV' && <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Cant.</TableCell>}
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>{seleccionada.tipo === 'DEV' ? 'Mercadería' : 'Concepto'}</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }} align="center">IVA</TableCell>
                      {seleccionada.tipo === 'DEV' && <TableCell sx={{ fontWeight: 700, py: 0.5 }} align="right">Precio</TableCell>}
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }} align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detalle.map((d, i) => (
                      <TableRow key={i}>
                        {seleccionada.tipo === 'DEV' && <TableCell>{Number(d.cantidad)}</TableCell>}
                        <TableCell>{d.mercaderia}</TableCell>
                        <TableCell align="center">{Number(d.porcentajeImpuesto)}%</TableCell>
                        {seleccionada.tipo === 'DEV' && <TableCell align="right">{formatMoneda(d.precio)}</TableCell>}
                        <TableCell align="right">{formatMoneda(d.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                    {detalle.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.disabled">Cargando detalle...</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Controles */}
            <Box sx={{ minWidth: 140 }}>
              {sectionLabel('Controles')}
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                <Tooltip title="Primero"><span>
                  <IconButton size="small" onClick={() => irA(0)} disabled={notas.length === 0}><FirstPageIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Anterior"><span>
                  <IconButton size="small" onClick={() => irA(currentIndex - 1)} disabled={currentIndex <= 0}><NavigateBeforeIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Siguiente"><span>
                  <IconButton size="small" onClick={() => irA(currentIndex + 1)} disabled={currentIndex >= notas.length - 1}><NavigateNextIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Último"><span>
                  <IconButton size="small" onClick={() => irA(notas.length - 1)} disabled={notas.length === 0}><LastPageIcon /></IconButton>
                </span></Tooltip>
              </Box>

              {notas.length > 0 && currentIndex >= 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Registro {currentIndex + 1} de {notas.length}
                </Typography>
              )}

              <Stack spacing={1}>
                <Button variant="contained" startIcon={<ArrowBackIcon />} size="small" fullWidth onClick={volverALista}>
                  Volver
                </Button>
                <Button variant="outlined" startIcon={<PrintIcon />} size="small" fullWidth onClick={handleImprimir} disabled={isLoading}>
                  Imprimir
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                  size="small"
                  fullWidth
                  disabled={!seleccionada.activo}
                  onClick={() => setIsAnulacionOpen(true)}
                >
                  Anular
                </Button>
              </Stack>
            </Box>
          </Box>
        </Paper>
      )}

      {seleccionada && (
        <AnulacionModal
          open={isAnulacionOpen}
          onClose={() => setIsAnulacionOpen(false)}
          tipoMovimiento="NC"
          idNotaCredito={seleccionada.idDocumento}
          tipoNotaCredito={seleccionada.tipo}
          onSuccess={handleAnulacionSuccess}
        />
      )}
    </Box>
  );
};

export default ConsultaNotasCredito;
