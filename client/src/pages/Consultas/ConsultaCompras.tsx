import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
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
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import UppercaseTextField from '../../components/UppercaseTextField';
import AnulacionModal from '../../components/AnulacionModal';
import { comprasService } from '../../services/compras.service';
import type { CompraConsulta, CompraListado, FiltroCompras } from '../../services/compras.service';
import { getErrorMessage } from '../../services/httpError';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatGs = (v: number) => Math.round(v || 0).toLocaleString('es-PY');
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-PY', { timeZone: 'UTC' });
const soloDigitos = (texto: string, largo: number) => texto.replace(/\D/g, '').slice(0, largo);
type Tipo = '' | 'fiscal' | 'nofiscal';

/**
 * Consulta de compras fiscales y no fiscales: búsqueda por fecha y proveedor o por número de factura,
 * detalle (con lo devuelto al proveedor y las notas de crédito) y anulación con usuario autorizador.
 */
const ConsultaCompras: React.FC = () => {
  const [busqueda, setBusqueda] = useState<'fecha' | 'factura'>('fecha');
  const [tipo, setTipo] = useState<Tipo>('');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [proveedor, setProveedor] = useState('');
  const [dsuc, setDsuc] = useState('');
  const [dcaja, setDcaja] = useState('');
  const [dfactu, setDfactu] = useState('');

  const [compras, setCompras] = useState<CompraListado[]>([]);
  const [indice, setIndice] = useState(-1);
  const [datos, setDatos] = useState<CompraConsulta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [anulando, setAnulando] = useState(false);

  const seleccionada = indice >= 0 ? compras[indice] : null;

  const buscar = async () => {
    setError('');
    setSuccess('');
    setIndice(-1);
    setDatos(null);
    const filtro: FiltroCompras = { noFiscal: tipo === '' ? undefined : tipo === 'nofiscal' };
    if (busqueda === 'factura') {
      if (!Number(dfactu)) {
        setError('Ingrese el número de factura.');
        return;
      }
      filtro.dsuc = Number(dsuc) || undefined;
      filtro.dcaja = Number(dcaja) || undefined;
      filtro.dfactu = Number(dfactu);
    } else {
      filtro.desde = desde;
      filtro.hasta = hasta;
      if (proveedor.trim()) filtro.proveedor = proveedor.trim();
    }

    setCargando(true);
    try {
      const resultado = await comprasService.listar(filtro);
      setCompras(resultado);
      if (resultado.length === 0) setError('No se encontraron compras.');
    } catch (err) {
      setError(getErrorMessage(err, 'Error al buscar las compras'));
    } finally {
      setCargando(false);
    }
  };

  const abrir = async (i: number) => {
    if (i < 0 || i >= compras.length) return;
    setIndice(i);
    setDatos(null);
    setError('');
    try {
      setDatos(await comprasService.consultar(compras[i].idCompra, compras[i].noFiscal));
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar la compra'));
    }
  };

  const alAnular = async () => {
    setAnulando(false);
    if (!seleccionada) return;
    setSuccess(`Compra ${seleccionada.nroFactura} anulada: la mercadería salió del stock.`);
    const actualizadas = await comprasService.listar({ idCompra: seleccionada.idCompra, noFiscal: seleccionada.noFiscal });
    setCompras((prev) => prev.map((c, i) => (i === indice && actualizadas[0] ? actualizadas[0] : c)));
    setDatos(await comprasService.consultar(seleccionada.idCompra, seleccionada.noFiscal));
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
  const chipTipo = (noFiscal: boolean) => (
    <Chip size="small" variant="outlined" label={noFiscal ? 'No fiscal' : 'Fiscal'} color={noFiscal ? 'default' : 'primary'} />
  );

  const c = datos?.cabecera;

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ShoppingCartIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Consulta de Compras</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2 }}>
        {etiqueta('Filtros de búsqueda')}
        <RadioGroup row value={busqueda} onChange={(e) => { setBusqueda(e.target.value as 'fecha' | 'factura'); setError(''); }}>
          <FormControlLabel value="fecha" control={<Radio size="small" />} label="Por fecha y proveedor" />
          <FormControlLabel value="factura" control={<Radio size="small" />} label="Por nro. de factura" />
        </RadioGroup>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Compras</InputLabel>
            <Select label="Compras" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              <MenuItem value="">Fiscales y no fiscales</MenuItem>
              <MenuItem value="fiscal">Fiscales</MenuItem>
              <MenuItem value="nofiscal">No fiscales</MenuItem>
            </Select>
          </FormControl>
          {busqueda === 'fecha' ? (
            <>
              <TextField label="Fecha desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)}
                InputLabelProps={{ shrink: true }} onKeyDown={alEnter} sx={{ minWidth: 155 }} />
              <TextField label="Fecha hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)}
                InputLabelProps={{ shrink: true }} onKeyDown={alEnter} sx={{ minWidth: 155 }} />
              <UppercaseTextField label="Proveedor (nombre o RUC)" size="small" value={proveedor}
                onChange={(e) => setProveedor(e.target.value.slice(0, 60))} onKeyDown={alEnter} sx={{ minWidth: 240 }} />
            </>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" label="Est." value={dsuc} onChange={(e) => setDsuc(soloDigitos(e.target.value, 3))}
                onKeyDown={alEnter} sx={{ width: 80 }} inputProps={{ inputMode: 'numeric' }} />
              <Typography>-</Typography>
              <TextField size="small" label="Pto." value={dcaja} onChange={(e) => setDcaja(soloDigitos(e.target.value, 3))}
                onKeyDown={alEnter} sx={{ width: 80 }} inputProps={{ inputMode: 'numeric' }} />
              <Typography>-</Typography>
              <TextField size="small" label="Nro. factura" value={dfactu} onChange={(e) => setDfactu(soloDigitos(e.target.value, 7))}
                onKeyDown={alEnter} sx={{ width: 160 }} inputProps={{ inputMode: 'numeric' }} autoFocus />
            </Stack>
          )}
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
              {compras.length > 0 && (
                <Typography component="span" variant="body2" sx={{ ml: 1, color: 'primary.main' }}>
                  ({compras.length} registro{compras.length !== 1 ? 's' : ''} · {formatGs(compras.filter((x) => x.activo).reduce((a, x) => a + x.total, 0))} Gs. activas)
                </Typography>
              )}
            </Typography>
          </Box>
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Id</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Factura</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Proveedor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>RUC</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Condición</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Notas de crédito</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {compras.map((x, i) => (
                  <TableRow key={`${x.noFiscal ? 'n' : 'f'}-${x.idCompra}`} hover onClick={() => abrir(i)}
                    sx={{ cursor: 'pointer', backgroundColor: x.activo ? undefined : 'rgba(244,67,54,0.05)' }}>
                    <TableCell>{x.idCompra}</TableCell>
                    <TableCell>{chipTipo(x.noFiscal)}</TableCell>
                    <TableCell>{fechaCorta(x.fecha)}</TableCell>
                    <TableCell>{x.nroFactura}</TableCell>
                    <TableCell>{x.proveedor}</TableCell>
                    <TableCell>{x.ruc}</TableCell>
                    <TableCell>{x.condicion}</TableCell>
                    <TableCell align="right">{formatGs(x.total)}</TableCell>
                    <TableCell align="right">{x.totalNotasCredito ? formatGs(x.totalNotasCredito) : ''}</TableCell>
                    <TableCell>{x.usuario}</TableCell>
                    <TableCell align="center">{chipEstado(x.activo)}</TableCell>
                  </TableRow>
                ))}
                {compras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
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
              <IconButton size="small" onClick={() => abrir(indice + 1)} disabled={indice >= compras.length - 1}><NavigateNextIcon /></IconButton>
            </span></Tooltip>
            <Typography variant="caption" color="text.secondary">Registro {indice + 1} de {compras.length}</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" color="error" startIcon={<BlockIcon />} disabled={!c?.activo} onClick={() => setAnulando(true)}>
              Anular compra
            </Button>
          </Stack>

          {!c ? (
            <Typography color="text.disabled">Cargando...</Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ minWidth: 300, maxWidth: 420 }}>
                  {etiqueta('Datos de la compra')}
                  <Grid container spacing={0.5}>
                    {[
                      ['Compra:', <>{c.idCompra} {chipTipo(c.noFiscal)}</>],
                      ['Factura:', c.nroFactura],
                      ['Timbrado:', c.timbrado || '—'],
                      ['Fecha:', fechaCorta(c.fecha)],
                      ['Condición:', c.condicion],
                      ['Proveedor:', c.proveedor],
                      ['RUC:', c.ruc],
                      ['Responsable:', c.responsable || '—'],
                      ['Cargada por:', `${c.usuario} (${new Date(c.fechaAlta).toLocaleString('es-PY')})`],
                      ['Terminal:', c.terminal || '—'],
                      ['Estado:', chipEstado(c.activo)],
                      ...(!c.activo ? [
                        ['Anulada por:', `${c.usuarioAnulacion || '—'}${c.fechaAnulacion ? ` (${new Date(c.fechaAnulacion).toLocaleString('es-PY')})` : ''}`],
                        ['Motivo anulación:', c.motivoAnulacion || '—'],
                      ] : []),
                      ...(!c.noFiscal ? [['Notas de crédito:', formatGs(c.totalAcreditado)]] : []),
                    ].map(([label, valor]) => (
                      <React.Fragment key={String(label)}>
                        <Grid size={5}><Typography variant="body2" color="text.secondary">{label}</Typography></Grid>
                        <Grid size={7}><Typography variant="body2" component="div">{valor}</Typography></Grid>
                      </React.Fragment>
                    ))}
                    <Grid size={5}><Typography variant="body2" color="text.secondary" fontWeight={600}>Total:</Typography></Grid>
                    <Grid size={7}><Typography variant="body1" fontWeight={700} color="primary.main">{formatGs(c.total)}</Typography></Grid>
                  </Grid>
                </Box>

                <Divider orientation="vertical" flexItem />

                <Box sx={{ flex: 1, minWidth: 320 }}>
                  {etiqueta('Notas de crédito del proveedor')}
                  {c.noFiscal ? (
                    <Typography variant="body2" color="text.secondary">Las compras no fiscales no admiten notas de crédito.</Typography>
                  ) : datos.notas.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Sin notas de crédito.</Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Nro.</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {datos.notas.map((n) => (
                          <TableRow key={`${n.tipo}-${n.idDocumento}`}>
                            <TableCell>{n.nroNotaCredito}</TableCell>
                            <TableCell>{n.tipo === 'DEV' ? 'Devolución' : 'Monto'}</TableCell>
                            <TableCell>{fechaCorta(n.fecha)}</TableCell>
                            <TableCell align="right">{formatGs(n.totalNotaCredito)}</TableCell>
                            <TableCell align="center">{chipEstado(n.activo)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </Box>

              <Box>
                {etiqueta('Artículos')}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Depósito</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>IVA</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Cant.</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Bonif.</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Costo</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Precio venta</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Subtotal</TableCell>
                        {!c.noFiscal && <TableCell sx={{ fontWeight: 700 }} align="right">Devuelto</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {datos.detalle.map((d) => (
                        <TableRow key={d.idDetCompra}>
                          <TableCell>{d.codigo}</TableCell>
                          <TableCell>{d.producto}</TableCell>
                          <TableCell>{d.deposito}</TableCell>
                          <TableCell>{d.impuesto}</TableCell>
                          <TableCell align="right">{Number(d.cantidad)}</TableCell>
                          <TableCell align="right">{Number(d.bonificacion) || ''}</TableCell>
                          <TableCell align="right">{formatGs(d.costo)}</TableCell>
                          <TableCell align="right">{formatGs(d.precio)}</TableCell>
                          <TableCell align="right">{formatGs(d.subtotal)}</TableCell>
                          {!c.noFiscal && <TableCell align="right">{Number(d.devuelto) || ''}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </Paper>
      )}

      {seleccionada && (
        <AnulacionModal
          open={anulando}
          onClose={() => setAnulando(false)}
          tipoMovimiento="COMPRA"
          idCompra={seleccionada.idCompra}
          noFiscal={seleccionada.noFiscal}
          onSuccess={alAnular}
        />
      )}
    </Box>
  );
};

export default ConsultaCompras;
