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
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { cobroCreditoService } from '../../services/cobroCredito.service';
import type { ReciboCobro, DatosReciboCobro } from '../../services/cobroCredito.service';
import { ticketService } from '../../services/ticket.service';
import { getErrorMessage } from '../../services/httpError';
import AnulacionModal from '../../components/AnulacionModal';

const hoy = () => new Date().toISOString().split('T')[0];

/**
 * Consulta de recibos de cobro de créditos: búsqueda por fecha o por número de recibo,
 * detalle de las cuotas pagadas, reimpresión y anulación con usuario autorizador.
 */
const ConsultaCobranzas: React.FC = () => {
  // ── Filtros ────────────────────────────────
  const [fechaDesde, setFechaDesde] = useState<string>(hoy());
  const [fechaHasta, setFechaHasta] = useState<string>(hoy());
  const [nroRecibo, setNroRecibo] = useState('');
  const [tipoBusqueda, setTipoBusqueda] = useState<'fecha' | 'recibo'>('fecha');

  // ── Resultados ─────────────────────────────
  const [recibos, setRecibos] = useState<ReciboCobro[]>([]);
  const [seleccionado, setSeleccionado] = useState<ReciboCobro | null>(null);
  const [detalle, setDetalle] = useState<DatosReciboCobro['detalle']>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isAnulacionOpen, setIsAnulacionOpen] = useState(false);

  const handleBuscar = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setSeleccionado(null);
    setDetalle([]);

    try {
      let filtros: { nroRecibo?: number; desde?: string; hasta?: string };
      if (tipoBusqueda === 'recibo') {
        const numero = parseInt(nroRecibo.replace(/\D/g, ''), 10);
        if (!numero) throw new Error('Ingrese un número de recibo válido.');
        filtros = { nroRecibo: numero };
      } else {
        filtros = { desde: fechaDesde, hasta: fechaHasta };
      }
      const result = await cobroCreditoService.listar(filtros);
      setRecibos(result);
      if (result.length === 0) setError('No se encontraron recibos.');
    } catch (err) {
      setError(getErrorMessage(err, 'Error al buscar recibos'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBuscar();
  };

  const handleSeleccionar = async (recibo: ReciboCobro, index: number) => {
    setSeleccionado(recibo);
    setCurrentIndex(index);
    setError('');
    setSuccessMsg('');
    setDetalle([]);
    try {
      const datos = await cobroCreditoService.recibo(recibo.idCobroCredito);
      setDetalle(datos.detalle);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar el detalle del recibo'));
    }
  };

  const handleImprimir = async () => {
    if (!seleccionado) return;
    setIsLoading(true);
    try {
      const datos = await cobroCreditoService.recibo(seleccionado.idCobroCredito);
      await ticketService.generarTicketReciboCobro(datos);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al imprimir el recibo'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnulacionSuccess = () => {
    setIsAnulacionOpen(false);
    setSuccessMsg(`Recibo Nº ${seleccionado?.nroRecibo} anulado correctamente.`);
    handleBuscar();
  };

  const volverALista = () => {
    setSeleccionado(null);
    setDetalle([]);
    setCurrentIndex(-1);
  };

  const irA = (index: number) => {
    if (index >= 0 && index < recibos.length) handleSeleccionar(recibos[index], index);
  };

  // ── Helpers ─────────────────────────────────
  const formatMoneda = (v: number) => `${(v || 0).toLocaleString('es-PY')}`;
  const estadoRecibo = (r: ReciboCobro) => (r.activo ? 'ACTIVO' : 'ANULADO');
  const chipColor = (r: ReciboCobro): 'success' | 'error' => (r.activo ? 'success' : 'error');
  const sectionLabel = (text: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {text}
    </Typography>
  );

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* ── Título ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RequestQuoteIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Consulta de Cobranzas
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
                setTipoBusqueda(e.target.value as 'fecha' | 'recibo');
                setError('');
                setRecibos([]);
                volverALista();
              }}
            >
              <FormControlLabel value="fecha" control={<Radio size="small" />} label="Por Fecha" />
              <FormControlLabel value="recibo" control={<Radio size="small" />} label="Por Nro. Recibo" />
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
                label="Nro. Recibo"
                size="small"
                value={nroRecibo}
                onChange={(e) => setNroRecibo(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                inputProps={{ inputMode: 'numeric' }}
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

      {/* ── Lista de recibos ── */}
      {seleccionado === null ? (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }}>
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resultados
              {recibos.length > 0 && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'primary.main' }}>
                  ({recibos.length} registro{recibos.length !== 1 ? 's' : ''})
                </Typography>
              )}
            </Typography>
          </Box>
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Nro. Recibo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha / Hora</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>RUC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Caja</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recibos.map((r, i) => (
                  <TableRow
                    key={r.idCobroCredito}
                    hover
                    onClick={() => handleSeleccionar(r, i)}
                    sx={{ cursor: 'pointer', backgroundColor: r.activo ? undefined : 'rgba(244,67,54,0.05)' }}
                  >
                    <TableCell>{r.nroRecibo}</TableCell>
                    <TableCell>{new Date(r.fechaCobro).toLocaleString('es-PY')}</TableCell>
                    <TableCell>{r.nombreCliente}</TableCell>
                    <TableCell>{r.rucCliente}</TableCell>
                    <TableCell>{r.usuario}</TableCell>
                    <TableCell>{r.nroCaja} ({r.estadoCaja})</TableCell>
                    <TableCell align="right">{formatMoneda(r.totalCobrado)}</TableCell>
                    <TableCell align="center">
                      <Chip label={estadoRecibo(r)} color={chipColor(r)} size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
                {recibos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
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
            {/* Datos del recibo */}
            <Box sx={{ minWidth: 260, flex: '0 0 auto' }}>
              {sectionLabel('Datos del recibo')}
              <Grid container spacing={0.5}>
                {[
                  ['Nro. Recibo:', String(seleccionado.nroRecibo)],
                  ['Fecha/Hora:', new Date(seleccionado.fechaCobro).toLocaleString('es-PY')],
                  ['Cliente:', seleccionado.nombreCliente],
                  ['RUC:', seleccionado.rucCliente || '—'],
                  ['Usuario:', seleccionado.usuario],
                  ['Sucursal:', seleccionado.nombreSucursal || '—'],
                  ['Caja:', `${seleccionado.nroCaja ?? '—'} (${seleccionado.estadoCaja})`],
                  ['Observación:', seleccionado.observacion || '—'],
                ].map(([label, value]) => (
                  <React.Fragment key={label}>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">{label}</Typography></Grid>
                    <Grid size={7}><Typography variant="body2">{value}</Typography></Grid>
                  </React.Fragment>
                ))}
                <Grid size={5}><Typography variant="body2" color="text.secondary">Estado:</Typography></Grid>
                <Grid size={7}><Chip label={estadoRecibo(seleccionado)} color={chipColor(seleccionado)} size="small" /></Grid>
                {!seleccionado.activo && (
                  <>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">Anulado por:</Typography></Grid>
                    <Grid size={7}>
                      <Typography variant="body2">
                        {seleccionado.usuarioAnulacion || '—'}
                        {seleccionado.fechaAnulacion && ` (${new Date(seleccionado.fechaAnulacion).toLocaleString('es-PY')})`}
                      </Typography>
                    </Grid>
                    <Grid size={5}><Typography variant="body2" color="text.secondary">Motivo:</Typography></Grid>
                    <Grid size={7}><Typography variant="body2">{seleccionado.motivoAnulacion || '—'}</Typography></Grid>
                  </>
                )}
                <Grid size={5}><Typography variant="body2" color="text.secondary" fontWeight={600}>Total:</Typography></Grid>
                <Grid size={7}>
                  <Typography variant="body1" fontWeight={700} color="primary.main">{formatMoneda(seleccionado.totalCobrado)}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Cuotas pagadas */}
            <Box sx={{ flex: 1, minWidth: 320 }}>
              {sectionLabel('Cuotas pagadas')}
              <TableContainer sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Factura</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Cuota</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Vencimiento</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }} align="right">Pagado</TableCell>
                      <TableCell sx={{ fontWeight: 700, py: 0.5 }} align="right">Saldo actual</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detalle.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell>{d.nroFactura}</TableCell>
                        <TableCell>{d.nroCuota}/{d.cantidadCuotas}</TableCell>
                        <TableCell>{new Date(d.fechaVencimiento).toLocaleDateString('es-PY', { timeZone: 'UTC' })}</TableCell>
                        <TableCell align="right">{formatMoneda(d.monto)}</TableCell>
                        <TableCell align="right">{formatMoneda(d.saldoCuota)}</TableCell>
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
                  <IconButton size="small" onClick={() => irA(0)} disabled={recibos.length === 0}><FirstPageIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Anterior"><span>
                  <IconButton size="small" onClick={() => irA(currentIndex - 1)} disabled={currentIndex <= 0}><NavigateBeforeIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Siguiente"><span>
                  <IconButton size="small" onClick={() => irA(currentIndex + 1)} disabled={currentIndex >= recibos.length - 1}><NavigateNextIcon /></IconButton>
                </span></Tooltip>
                <Tooltip title="Último"><span>
                  <IconButton size="small" onClick={() => irA(recibos.length - 1)} disabled={recibos.length === 0}><LastPageIcon /></IconButton>
                </span></Tooltip>
              </Box>

              {recibos.length > 0 && currentIndex >= 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Registro {currentIndex + 1} de {recibos.length}
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
                  disabled={!seleccionado.activo}
                  onClick={() => setIsAnulacionOpen(true)}
                >
                  Anular
                </Button>
              </Stack>
            </Box>
          </Box>
        </Paper>
      )}

      {seleccionado && (
        <AnulacionModal
          open={isAnulacionOpen}
          onClose={() => setIsAnulacionOpen(false)}
          tipoMovimiento="COBRO"
          idCobroCredito={seleccionado.idCobroCredito}
          onSuccess={handleAnulacionSuccess}
        />
      )}
    </Box>
  );
};

export default ConsultaCobranzas;
