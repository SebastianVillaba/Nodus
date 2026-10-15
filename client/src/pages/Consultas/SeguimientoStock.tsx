import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import UppercaseTextField from '../../components/UppercaseTextField';
import { movimientoStockService } from '../../services/movimientoStock.service';
import type {
  ConsultaMovimientos,
  DepositoSeguimiento,
  DiferenciaStock,
  ProductoSeguimiento,
} from '../../services/movimientoStock.service';
import { getErrorMessage } from '../../services/httpError';

const fechaISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => fechaISO(new Date());
const primeroDelMes = () => {
  const d = new Date();
  return fechaISO(new Date(d.getFullYear(), d.getMonth(), 1));
};
const formatCant = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString('es-PY', { maximumFractionDigits: 4 });
// Las fechas de SQL Server llegan como UTC: se muestran tal cual se guardaron
const fechaHora = (v: string) => new Date(v).toLocaleString('es-PY', { timeZone: 'UTC' });

/**
 * Seguimiento de stock (kardex): todo lo que le pasó a un producto en un período, con el saldo después de
 * cada movimiento, y la conciliación que avisa si el stock actual no coincide con lo registrado.
 */
const SeguimientoStock: React.FC = () => {
  const [pestana, setPestana] = useState<'movimientos' | 'conciliacion'>('movimientos');
  const [error, setError] = useState('');

  // Movimientos
  const [busqueda, setBusqueda] = useState('');
  const [opciones, setOpciones] = useState<ProductoSeguimiento[]>([]);
  const [producto, setProducto] = useState<ProductoSeguimiento | null>(null);
  const [depositos, setDepositos] = useState<DepositoSeguimiento[]>([]);
  const [idDeposito, setIdDeposito] = useState<number | ''>('');
  const [desde, setDesde] = useState(primeroDelMes());
  const [hasta, setHasta] = useState(hoy());
  const [datos, setDatos] = useState<ConsultaMovimientos | null>(null);
  const [cargando, setCargando] = useState(false);

  // Conciliación
  const [diferencias, setDiferencias] = useState<DiferenciaStock[] | null>(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    movimientoStockService
      .listarDepositos()
      .then(setDepositos)
      .catch((err) => setError(getErrorMessage(err, 'Error al cargar los depósitos')));
  }, []);

  const consultar = async (prod: ProductoSeguimiento | null = producto) => {
    if (!prod) {
      setError('Busque y seleccione un producto.');
      return;
    }
    if (desde && hasta && desde > hasta) {
      setError('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    setError('');
    setCargando(true);
    try {
      setDatos(
        await movimientoStockService.consultarMovimientos({
          idProducto: prod.idProducto,
          idDeposito: idDeposito || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        })
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Error al consultar los movimientos'));
    } finally {
      setCargando(false);
    }
  };

  const elegir = (prod: ProductoSeguimiento) => {
    setProducto(prod);
    setOpciones([]);
    setBusqueda('');
    consultar(prod);
  };

  const buscarProducto = async () => {
    if (!busqueda.trim()) {
      setError('Ingrese un código, código de barras o nombre.');
      return;
    }
    setError('');
    try {
      const resultado = await movimientoStockService.buscarProductos(busqueda.trim());
      if (resultado.length === 0) {
        setOpciones([]);
        setError(`No se encontraron productos para "${busqueda.trim()}".`);
      } else if (resultado.length === 1) {
        elegir(resultado[0]);
      } else {
        setOpciones(resultado);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Error al buscar productos'));
    }
  };

  const verificar = async () => {
    setError('');
    setVerificando(true);
    try {
      setDiferencias(await movimientoStockService.conciliacion());
    } catch (err) {
      setError(getErrorMessage(err, 'Error al verificar el stock'));
    } finally {
      setVerificando(false);
    }
  };

  const etiqueta = (texto: string) => (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {texto}
    </Typography>
  );

  const total = (lista: { saldo: number }[] | undefined) => (lista || []).reduce((a, x) => a + Number(x.saldo || 0), 0);
  const movimientos = datos?.movimientos || [];
  const entradas = movimientos.reduce((a, m) => a + Number(m.entrada || 0), 0);
  const salidas = movimientos.reduce((a, m) => a + Number(m.salida || 0), 0);
  const saldoFinal = total(datos?.saldoFinal);
  const stockActual = (datos?.saldoFinal || []).reduce((a, x) => a + Number(x.stockActual || 0), 0);
  // El stock actual solo es comparable con el saldo final si el período llega hasta hoy
  const hastaHoy = !hasta || hasta >= hoy();
  const variosDepositos = !idDeposito && depositos.length > 1;

  const tarjeta = (titulo: string, valor: string, color?: string) => (
    <Paper variant="outlined" sx={{ px: 2, py: 1.5, minWidth: 140, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{titulo}</Typography>
      <Typography variant="h6" fontWeight={700} color={color}>{valor}</Typography>
    </Paper>
  );

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Seguimiento de Stock</Typography>
      </Box>

      <Tabs value={pestana} onChange={(_, v) => { setPestana(v); setError(''); }} sx={{ minHeight: 40 }}>
        <Tab value="movimientos" label="Movimientos por producto" sx={{ minHeight: 40 }} />
        <Tab value="conciliacion" label="Conciliación" sx={{ minHeight: 40 }} />
      </Tabs>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {pestana === 'movimientos' ? (
        <>
          <Paper sx={{ p: 2 }}>
            {etiqueta('Filtros')}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
              <UppercaseTextField
                label="Producto (código, código de barras o nombre)"
                size="small"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value.slice(0, 60))}
                onKeyDown={(e) => { if (e.key === 'Enter') buscarProducto(); }}
                sx={{ minWidth: 320 }}
                autoFocus
              />
              <Button variant="outlined" startIcon={<SearchIcon />} onClick={buscarProducto} sx={{ height: 40 }}>
                Buscar producto
              </Button>
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>Depósito</InputLabel>
                <Select label="Depósito" value={idDeposito} onChange={(e) => setIdDeposito(e.target.value as number | '')}>
                  <MenuItem value="">Todos los depósitos</MenuItem>
                  {depositos.map((d) => (
                    <MenuItem key={d.idDeposito} value={d.idDeposito}>{d.nombreDeposito}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Fecha desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 155 }} />
              <TextField label="Fecha hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ minWidth: 155 }} />
              <Button variant="contained" startIcon={<SearchIcon />} onClick={() => consultar()} disabled={cargando || !producto} sx={{ height: 40 }}>
                Consultar
              </Button>
            </Stack>

            {producto && (
              <Box sx={{ mt: 1.5 }}>
                <Chip color="primary" variant="outlined"
                  label={`${producto.codigo} · ${producto.nombre}${producto.activo ? '' : ' (inactivo)'}`}
                  onDelete={() => { setProducto(null); setDatos(null); }} />
              </Box>
            )}

            {opciones.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 1.5, maxHeight: 220, overflow: 'auto' }}>
                <List dense disablePadding>
                  {opciones.map((p) => (
                    <ListItemButton key={p.idProducto} onClick={() => elegir(p)}>
                      <ListItemText
                        primary={`${p.codigo} · ${p.nombre}${p.activo ? '' : ' (inactivo)'}`}
                        secondary={`${p.codigoBarra ? `Cód. barras ${p.codigoBarra} · ` : ''}Stock ${formatCant(p.stock)}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
          </Paper>

          {datos && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                {tarjeta('Saldo inicial', formatCant(total(datos.saldoInicial)), total(datos.saldoInicial) < 0 ? 'error.main' : undefined)}
                {tarjeta('Entradas', `+${formatCant(entradas)}`, 'success.main')}
                {tarjeta('Salidas', `−${formatCant(salidas)}`, 'error.main')}
                {tarjeta('Saldo final', formatCant(saldoFinal), saldoFinal < 0 ? 'error.main' : 'primary.main')}
              </Stack>
              {hastaHoy && saldoFinal !== stockActual && (
                <Alert severity="warning">
                  El stock actual ({formatCant(stockActual)}) no coincide con el saldo del seguimiento ({formatCant(saldoFinal)}).
                  Revise la pestaña Conciliación.
                </Alert>
              )}
            </>
          )}

          <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, pb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Movimientos
                {movimientos.length > 0 && (
                  <Typography component="span" variant="body2" sx={{ ml: 1, color: 'primary.main' }}>
                    ({movimientos.length} registro{movimientos.length !== 1 ? 's' : ''})
                  </Typography>
                )}
              </Typography>
            </Box>
            <TableContainer sx={{ flex: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Movimiento</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Documento</TableCell>
                    {variosDepositos && <TableCell sx={{ fontWeight: 700 }}>Depósito</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>Detalle</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Entrada</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Salida</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Saldo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movimientos.map((m) => (
                    <TableRow key={m.idMovimientoStock} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fechaHora(m.fecha)}</TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={m.tipoDescripcion}
                          color={m.entrada > 0 ? 'success' : m.salida > 0 ? 'error' : 'default'} />
                      </TableCell>
                      <TableCell>{m.nroDocumento || '—'}</TableCell>
                      {variosDepositos && <TableCell>{m.deposito}</TableCell>}
                      <TableCell>{m.observacion || ''}</TableCell>
                      <TableCell>{m.usuario || '—'}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{m.entrada ? formatCant(m.entrada) : ''}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{m.salida ? formatCant(m.salida) : ''}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: m.saldo < 0 ? 'error.main' : undefined }}>{formatCant(m.saldo)}</TableCell>
                    </TableRow>
                  ))}
                  {movimientos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={variosDepositos ? 9 : 8} align="center" sx={{ py: 6 }}>
                        <Typography color="text.disabled">
                          {cargando ? 'Consultando...' : datos ? 'El producto no tuvo movimientos en el período.' : 'Busque un producto para ver sus movimientos'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      ) : (
        <Paper sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="contained" startIcon={<FactCheckIcon />} onClick={verificar} disabled={verificando}>
              {verificando ? 'Verificando...' : 'Verificar stock'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Compara el stock de cada producto con el último saldo registrado en el seguimiento.
            </Typography>
          </Stack>

          {diferencias && diferencias.length === 0 && (
            <Alert severity="success">El stock de todos los productos coincide con el seguimiento.</Alert>
          )}

          {diferencias && diferencias.length > 0 && (
            <>
              <Alert severity="warning">
                {diferencias.length} registro{diferencias.length !== 1 ? 's' : ''} de stock no coincide{diferencias.length !== 1 ? 'n' : ''} con
                el seguimiento: el stock se modificó por fuera de las operaciones del sistema.
              </Alert>
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Depósito</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Stock actual</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Saldo registrado</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Diferencia</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Último movimiento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {diferencias.map((d) => (
                      <TableRow key={d.idStock}>
                        <TableCell>{d.codigo}</TableCell>
                        <TableCell>{d.producto}</TableCell>
                        <TableCell>{d.deposito}</TableCell>
                        <TableCell align="right">{formatCant(d.stockActual)}</TableCell>
                        <TableCell align="right">{d.saldoRegistrado === null ? 'Sin movimientos' : formatCant(d.saldoRegistrado)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: d.diferencia > 0 ? 'success.main' : 'error.main' }}>
                          {d.diferencia > 0 ? '+' : ''}{formatCant(d.diferencia)}
                        </TableCell>
                        <TableCell>{d.fechaUltimoMovimiento ? fechaHora(d.fechaUltimoMovimiento) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default SeguimientoStock;
