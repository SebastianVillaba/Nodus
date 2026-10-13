import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import UppercaseTextField from '../../components/UppercaseTextField';
import AnulacionModal from '../../components/AnulacionModal';
import { notaCreditoProveedorService } from '../../services/notaCreditoProveedor.service';
import type {
  FiltroNotasCreditoProveedor, NotaCreditoProveedorDetalle, NotaCreditoProveedorListado, TipoNotaCreditoProveedor,
} from '../../services/notaCreditoProveedor.service';
import { getErrorMessage } from '../../services/httpError';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatGs = (v: number) => Math.round(v || 0).toLocaleString('es-PY');
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-PY', { timeZone: 'UTC' });
const TITULO: Record<TipoNotaCreditoProveedor, string> = {
  DEV: 'Consulta de NC de Proveedor por Devolución',
  MONTO: 'Consulta de NC de Proveedor por Monto',
};

interface Props {
  tipo: TipoNotaCreditoProveedor;
}

/**
 * Consulta de notas de crédito de proveedor de un tipo: búsqueda por fecha y proveedor o por número,
 * detalle y anulación con usuario autorizador.
 */
const ConsultaNotasCreditoProveedor: React.FC<Props> = ({ tipo }) => {
  const [busqueda, setBusqueda] = useState<'fecha' | 'numero'>('fecha');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [proveedor, setProveedor] = useState('');
  const [nroNota, setNroNota] = useState('');

  const [notas, setNotas] = useState<NotaCreditoProveedorListado[]>([]);
  const [indice, setIndice] = useState(-1);
  const [datos, setDatos] = useState<NotaCreditoProveedorDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [anulando, setAnulando] = useState(false);

  const seleccionada = indice >= 0 ? notas[indice] : null;

  const buscar = async () => {
    setError('');
    setSuccess('');
    setIndice(-1);
    setDatos(null);
    const filtro: FiltroNotasCreditoProveedor = { tipo };
    if (busqueda === 'numero') {
      // Acepta el número suelto (123) o el formato completo (001-001-0000123)
      const numero = parseInt(nroNota.split('-').pop()?.replace(/\D/g, '') || '', 10);
      if (!numero) {
        setError('Ingrese un número de nota de crédito válido.');
        return;
      }
      filtro.nroNotaCredito = numero;
    } else {
      filtro.desde = desde;
      filtro.hasta = hasta;
    }
    if (proveedor.trim()) filtro.proveedor = proveedor.trim();

    setCargando(true);
    try {
      const resultado = await notaCreditoProveedorService.listar(filtro);
      setNotas(resultado);
      if (resultado.length === 0) setError('No se encontraron notas de crédito.');
    } catch (err) {
      setError(getErrorMessage(err, 'Error al buscar las notas de crédito'));
    } finally {
      setCargando(false);
    }
  };

  const abrir = async (i: number) => {
    if (i < 0 || i >= notas.length) return;
    setIndice(i);
    setDatos(null);
    setError('');
    try {
      setDatos(await notaCreditoProveedorService.consultar(tipo, notas[i].idDocumento));
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar la nota de crédito'));
    }
  };

  const alAnular = async () => {
    setAnulando(false);
    if (!seleccionada) return;
    setSuccess(`Nota de crédito ${seleccionada.nroNotaCredito} anulada${tipo === 'DEV' ? ': la mercadería volvió al stock' : ''}.`);
    setNotas((prev) => prev.map((n, i) => (i === indice ? { ...n, activo: false } : n)));
    setDatos(await notaCreditoProveedorService.consultar(tipo, seleccionada.idDocumento));
  };

  const alEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar();
  };

  const etiqueta = (texto: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {texto}
    </Typography>
  );
  const chipEstado = (activo: boolean) => (
    <Chip size="small" variant="outlined" label={activo ? 'ACTIVA' : 'ANULADA'} color={activo ? 'success' : 'error'} />
  );

  const c = datos?.cabecera;

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {tipo === 'DEV' ? <AssignmentReturnIcon color="primary" /> : <RequestQuoteIcon color="primary" />}
        <Typography variant="h6" fontWeight={600}>{TITULO[tipo]}</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2 }}>
        {etiqueta('Filtros de búsqueda')}
        <RadioGroup row value={busqueda} onChange={(e) => { setBusqueda(e.target.value as 'fecha' | 'numero'); setError(''); }}>
          <FormControlLabel value="fecha" control={<Radio size="small" />} label="Por fecha de la nota" />
          <FormControlLabel value="numero" control={<Radio size="small" />} label="Por nro. de nota de crédito" />
        </RadioGroup>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          {busqueda === 'fecha' ? (
            <>
              <TextField label="Fecha desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)}
                InputLabelProps={{ shrink: true }} onKeyDown={alEnter} sx={{ minWidth: 155 }} />
              <TextField label="Fecha hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)}
                InputLabelProps={{ shrink: true }} onKeyDown={alEnter} sx={{ minWidth: 155 }} />
            </>
          ) : (
            <TextField label="Nro. nota de crédito" size="small" placeholder="123 o 001-001-0000123" value={nroNota}
              onChange={(e) => setNroNota(e.target.value.replace(/[^\d-]/g, ''))} onKeyDown={alEnter} sx={{ minWidth: 220 }} autoFocus />
          )}
          <UppercaseTextField label="Proveedor (nombre o RUC)" size="small" value={proveedor}
            onChange={(e) => setProveedor(e.target.value.slice(0, 60))} onKeyDown={alEnter} sx={{ minWidth: 240 }} />
          <Button variant="contained" startIcon={<SearchIcon />} onClick={buscar} disabled={cargando} sx={{ height: 40 }}>
            Buscar
          </Button>
        </Stack>
      </Paper>

      {!seleccionada ? (
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
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
                  <TableCell sx={{ fontWeight: 700 }}>Nro. nota</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Timbrado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Factura de compra</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Proveedor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>RUC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notas.map((n, i) => (
                  <TableRow key={n.idDocumento} hover onClick={() => abrir(i)}
                    sx={{ cursor: 'pointer', backgroundColor: n.activo ? undefined : 'rgba(244,67,54,0.05)' }}>
                    <TableCell>{n.nroNotaCredito}</TableCell>
                    <TableCell>{n.timbrado}</TableCell>
                    <TableCell>{fechaCorta(n.fecha)}</TableCell>
                    <TableCell>{n.nroFacturaCompra}</TableCell>
                    <TableCell>{n.proveedor}</TableCell>
                    <TableCell>{n.ruc}</TableCell>
                    <TableCell align="right">{formatGs(n.totalNotaCredito)}</TableCell>
                    <TableCell align="center">{chipEstado(n.activo)}</TableCell>
                  </TableRow>
                ))}
                {notas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Typography color="text.disabled">{cargando ? 'Buscando...' : 'Realice una búsqueda para ver los resultados'}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Paper sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => { setIndice(-1); setDatos(null); }}>
              Volver a la lista
            </Button>
            <Tooltip title="Anterior"><span>
              <IconButton size="small" onClick={() => abrir(indice - 1)} disabled={indice <= 0}><NavigateBeforeIcon /></IconButton>
            </span></Tooltip>
            <Tooltip title="Siguiente"><span>
              <IconButton size="small" onClick={() => abrir(indice + 1)} disabled={indice >= notas.length - 1}><NavigateNextIcon /></IconButton>
            </span></Tooltip>
            <Typography variant="caption" color="text.secondary">Registro {indice + 1} de {notas.length}</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" color="error" startIcon={<BlockIcon />} disabled={!c?.activo} onClick={() => setAnulando(true)}>
              Anular
            </Button>
          </Stack>

          {!c ? (
            <Typography color="text.disabled">Cargando...</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 300, maxWidth: 420 }}>
                {etiqueta('Datos de la nota de crédito')}
                <Grid container spacing={0.5}>
                  {[
                    ['Nro. nota:', c.nroNotaCredito],
                    ['Timbrado:', c.timbrado],
                    ['Fecha:', fechaCorta(c.fecha)],
                    ['Proveedor:', c.proveedor],
                    ['RUC:', c.ruc],
                    ['Factura de compra:', `${c.nroFacturaCompra} (${fechaCorta(c.fechaCompra)})`],
                    ['Total compra:', formatGs(c.totalCompra)],
                    ['Motivo:', c.motivo],
                    ['Registrada por:', `${c.usuario} (${new Date(c.fechaAlta).toLocaleString('es-PY')})`],
                    ['Estado:', chipEstado(c.activo)],
                    ...(!c.activo ? [
                      ['Anulada por:', `${c.usuarioAnulacion || '—'}${c.fechaAnulacion ? ` (${new Date(c.fechaAnulacion).toLocaleString('es-PY')})` : ''}`],
                      ['Motivo anulación:', c.motivoAnulacion || '—'],
                    ] : []),
                  ].map(([label, valor]) => (
                    <React.Fragment key={String(label)}>
                      <Grid size={5}><Typography variant="body2" color="text.secondary">{label}</Typography></Grid>
                      <Grid size={7}><Typography variant="body2" component="div">{valor}</Typography></Grid>
                    </React.Fragment>
                  ))}
                  <Grid size={5}><Typography variant="body2" color="text.secondary" fontWeight={600}>Total:</Typography></Grid>
                  <Grid size={7}><Typography variant="body1" fontWeight={700} color="primary.main">{formatGs(c.totalNotaCredito)}</Typography></Grid>
                </Grid>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ flex: 1, minWidth: 320 }}>
                {etiqueta(tipo === 'DEV' ? 'Artículos devueltos' : 'Conceptos')}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {tipo === 'DEV' && <TableCell sx={{ fontWeight: 700 }}>Cant.</TableCell>}
                        <TableCell sx={{ fontWeight: 700 }}>{tipo === 'DEV' ? 'Mercadería' : 'Concepto'}</TableCell>
                        {tipo === 'DEV' && <TableCell sx={{ fontWeight: 700 }}>Depósito</TableCell>}
                        <TableCell sx={{ fontWeight: 700 }}>IVA</TableCell>
                        {tipo === 'DEV' && <TableCell sx={{ fontWeight: 700 }} align="right">Costo unit.</TableCell>}
                        <TableCell sx={{ fontWeight: 700 }} align="right">Subtotal</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {datos.detalle.map((d, i) => (
                        <TableRow key={i}>
                          {tipo === 'DEV' && <TableCell>{Number(d.cantidad)}</TableCell>}
                          <TableCell>{d.descripcion}</TableCell>
                          {tipo === 'DEV' && <TableCell>{d.deposito}</TableCell>}
                          <TableCell>{d.impuesto}</TableCell>
                          {tipo === 'DEV' && <TableCell align="right">{formatGs(d.precioUnitario)}</TableCell>}
                          <TableCell align="right">{formatGs(d.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {seleccionada && (
        <AnulacionModal
          open={anulando}
          onClose={() => setAnulando(false)}
          tipoMovimiento="NCP"
          idNotaCredito={seleccionada.idDocumento}
          tipoNotaCredito={tipo}
          onSuccess={alAnular}
        />
      )}
    </Box>
  );
};

export default ConsultaNotasCreditoProveedor;
