import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
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
  Tooltip,
  Typography,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ArchiveIcon from '@mui/icons-material/Archive';
import DescriptionIcon from '@mui/icons-material/Description';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  descargarRG90, esNotaCredito, siguienteIdentificador, exportarLibroExcel, fechaDDMMAAAA, libroIvaService, observacionesRG90, planificarRG90, sumar,
} from '../../services/libroIva.service';
import type { EmpresaInformante, FilaLibro, Imputacion, TotalesLibro } from '../../services/libroIva.service';
import { getErrorMessage } from '../../services/httpError';

type Pestana = 'ventas' | 'compras' | 'notas';
type Incluir = Record<Pestana, boolean>;

const formatGs = (v: number) => Math.round(v || 0).toLocaleString('es-PY');
const CLAVE_PREFERENCIAS = 'nodus.libroIva.preferencias';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ddmmaaaa = (fechaIso: string) => fechaIso.split('-').reverse().join('/');

const leerPreferencias = (): { imputacion: Imputacion; incluir: Incluir } => {
  const porDefecto = { imputacion: { iva: true, ire: true, irp: false }, incluir: { ventas: true, compras: true, notas: true } };
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS) ?? '');
    return { imputacion: { ...porDefecto.imputacion, ...guardadas.imputacion }, incluir: { ...porDefecto.incluir, ...guardadas.incluir } };
  } catch {
    return porDefecto;
  }
};

/**
 * Libro IVA de ventas, compras y notas de crédito de un rango de fechas, y generación del archivo de
 * importación del Registro de Comprobantes (RG 90/2021) para Marangatu (CSV, suelto o en ZIP), más Excel.
 */
export default function LibroIva() {
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [pestana, setPestana] = useState<Pestana>('ventas');
  const [filas, setFilas] = useState<FilaLibro[] | null>(null);
  const [rango, setRango] = useState('');
  const [empresa, setEmpresa] = useState<EmpresaInformante | null>(null);
  const [preferencias, setPreferencias] = useState(leerPreferencias);
  const [identificador, setIdentificador] = useState('V0001');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { imputacion, incluir } = preferencias;
  const ventas = useMemo(() => (filas ?? []).filter((f) => f.libro === 'ventas' && !esNotaCredito(f)), [filas]);
  const compras = useMemo(() => (filas ?? []).filter((f) => f.libro === 'compras' && !esNotaCredito(f)), [filas]);
  const notas = useMemo(() => (filas ?? []).filter(esNotaCredito), [filas]);
  const visibles = pestana === 'ventas' ? ventas : pestana === 'compras' ? compras : notas;

  const paraArchivo = useMemo(() => [
    ...(incluir.ventas ? ventas : []),
    ...(incluir.compras ? compras : []),
    ...(incluir.notas ? notas : []),
  ], [incluir, ventas, compras, notas]);
  const archivos = useMemo(
    () => (empresa ? planificarRG90(empresa.ruc, identificador || '?', paraArchivo) : []),
    [empresa, identificador, paraArchivo],
  );
  const conObservaciones = useMemo(() => (filas ?? []).filter((f) => observacionesRG90(f).length > 0).length, [filas]);

  const debito = sumar([...ventas, ...notas.filter((n) => n.libro === 'ventas')], -1);
  const credito = sumar([...compras, ...notas.filter((n) => n.libro === 'compras')], -1);

  const guardarPreferencias = (nuevas: typeof preferencias) => {
    setPreferencias(nuevas);
    try { localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(nuevas)); } catch { /* sin almacenamiento */ }
  };

  const generar = async () => {
    setError('');
    setSuccess('');
    if (!desde || !hasta || desde > hasta) {
      setError('Indique un rango de fechas válido.');
      return;
    }
    setCargando(true);
    try {
      const [v, c] = await Promise.all([
        libroIvaService.obtener('ventas', desde, hasta),
        libroIvaService.obtener('compras', desde, hasta),
      ]);
      setFilas([...v.comprobantes, ...c.comprobantes]);
      setEmpresa(v.empresa ?? c.empresa);
      setRango(`${ddmmaaaa(desde)} al ${ddmmaaaa(hasta)}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al generar el libro IVA'));
    } finally {
      setCargando(false);
    }
  };

  const descargarArchivo = async (zip: boolean) => {
    if (!empresa) return;
    setError('');
    setSuccess('');
    if (!imputacion.iva && !imputacion.ire && !imputacion.irp) {
      setError('Cada comprobante debe imputarse al menos a una obligación (IVA, IRE o IRP-RSP).');
      return;
    }
    if (!/^[A-Za-z0-9]{1,5}$/.test(identificador)) {
      setError('El identificador del archivo debe tener de 1 a 5 letras o números.');
      return;
    }
    if (paraArchivo.length === 0) {
      setError('No hay comprobantes para incluir en el archivo.');
      return;
    }
    try {
      const nombres = await descargarRG90({ ruc: empresa.ruc, identificador, filas: paraArchivo, imputacion, zip });
      // Cada envío del mismo período lleva otro identificador: se avanza al siguiente libre para que la
      // próxima descarga no tenga el mismo nombre (el navegador la guardaría como "(1)" y se confunden)
      const usados = new Set(archivos.map((a) => a.nombre.split('_').pop()));
      let siguiente = siguienteIdentificador(identificador);
      while (usados.has(siguiente)) siguiente = siguienteIdentificador(siguiente);
      setIdentificador(siguiente);
      setSuccess(`Descargado: ${nombres.join(', ')} (${paraArchivo.length} comprobantes).${zip ? ' Importalo en Marangatu (Registro de Comprobantes).' : ''} La próxima descarga usará el identificador ${siguiente}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al generar el archivo RG 90'));
    }
  };

  const descargarExcel = async () => {
    setError('');
    try {
      await exportarLibroExcel({ empresa, rango, ventas, compras, notas });
    } catch (err) {
      setError(getErrorMessage(err, 'Error al exportar a Excel'));
    }
  };

  const tarjeta = (titulo: string, t: TotalesLibro) => (
    <Grid size={{ xs: 12, md: 6 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>{titulo}</Typography>
        <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          {[['Total', t.total], ['IVA 10%', t.iva10], ['IVA 5%', t.iva5], ['Exento', t.exento]].map(([l, v]) => (
            <Box key={l as string}>
              <Typography variant="caption" color="text.secondary">{l}</Typography>
              <Typography variant="body1" fontWeight={700}>{formatGs(v as number)}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </Grid>
  );

  const totalesVisibles = sumar(visibles);

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MenuBookIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Libro IVA y Registro de Comprobantes (RG 90)</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
          <TextField label="Desde" type="date" size="small" value={desde} onChange={(e) => setDesde(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <TextField label="Hasta" type="date" size="small" value={hasta} onChange={(e) => setHasta(e.target.value)}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }} />
          <Button variant="contained" startIcon={<SearchIcon />} onClick={generar} disabled={cargando} sx={{ height: 40 }}>
            {cargando ? 'Generando...' : 'Generar'}
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={descargarExcel} disabled={!filas} sx={{ height: 40 }}>
            Exportar Excel
          </Button>
        </Stack>

        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', mt: 2 }}>
          Archivo RG 90
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
          <Typography variant="body2" color="text.secondary">Incluir:</Typography>
          {([['ventas', 'Ventas'], ['compras', 'Compras'], ['notas', 'Notas de crédito']] as [Pestana, string][]).map(([k, l]) => (
            <FormControlLabel key={k} label={l} control={
              <Checkbox size="small" checked={incluir[k]} onChange={(e) => guardarPreferencias({ ...preferencias, incluir: { ...incluir, [k]: e.target.checked } })} />
            } />
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 2 } }}>Imputa a:</Typography>
          {([['iva', 'IVA'], ['ire', 'IRE'], ['irp', 'IRP-RSP']] as [keyof Imputacion, string][]).map(([k, l]) => (
            <FormControlLabel key={k} label={l} control={
              <Checkbox size="small" checked={imputacion[k]} onChange={(e) => guardarPreferencias({ ...preferencias, imputacion: { ...imputacion, [k]: e.target.checked } })} />
            } />
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          <Tooltip title="Identificador del envío (hasta 5 letras o números). Cambialo en cada archivo que subas del mismo período.">
            <TextField size="small" label="Identificador" value={identificador} sx={{ width: 120 }}
              onChange={(e) => setIdentificador(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase())} />
          </Tooltip>
          <Button variant="contained" color="success" startIcon={<ArchiveIcon />} onClick={() => descargarArchivo(true)} disabled={!empresa} sx={{ height: 40 }}>
            ZIP para Marangatu
          </Button>
          <Button variant="outlined" color="success" startIcon={<DescriptionIcon />} onClick={() => descargarArchivo(false)} disabled={!empresa} sx={{ height: 40 }}>
            Descargar CSV
          </Button>
          {archivos.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {paraArchivo.length} comprobante{paraArchivo.length !== 1 ? 's' : ''} → {archivos.map((a) => a.nombre).join(', ')}
              {archivos.length > 1 ? ' (un archivo por mes o por cada 5.000 filas)' : ''}
            </Typography>
          )}
        </Stack>
      </Paper>

      {filas && (
        <Grid container spacing={1.5}>
          {tarjeta('Ventas netas · IVA débito (facturas − NC emitidas)', debito)}
          {tarjeta('Compras netas · IVA crédito (facturas − NC recibidas)', credito)}
        </Grid>
      )}

      {filas && conObservaciones > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          {conObservaciones} comprobante{conObservaciones > 1 ? 's tienen' : ' tiene'} datos que Marangatu podría rechazar (marcados en la tabla).
          Corregilos antes de importar.
        </Alert>
      )}

      {filas && (
        <Paper sx={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs value={pestana} onChange={(_, v) => setPestana(v)} sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Tab value="ventas" label={`Ventas (${ventas.length})`} />
            <Tab value="compras" label={`Compras (${compras.length})`} />
            <Tab value="notas" label={`Notas de crédito (${notas.length})`} />
          </Tabs>
          <TableContainer sx={{ flex: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {pestana === 'notas' && <TableCell sx={{ fontWeight: 700 }}>Libro</TableCell>}
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Timbrado</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Número</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{pestana === 'ventas' ? 'Cliente' : pestana === 'compras' ? 'Proveedor' : 'Cliente / Proveedor'}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>RUC / CI</TableCell>
                  {pestana !== 'notas' && <TableCell sx={{ fontWeight: 700 }}>Cond.</TableCell>}
                  <TableCell sx={{ fontWeight: 700 }} align="right">Gravado 10%</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">IVA 10%</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Gravado 5%</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">IVA 5%</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Exento</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  {pestana === 'notas' && <TableCell sx={{ fontWeight: 700 }}>Comprobante asociado</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map((c) => {
                  const obs = observacionesRG90(c);
                  return (
                    <TableRow key={`${c.libro}-${c.origen}-${c.idDocumento}`} hover sx={{ backgroundColor: obs.length ? 'rgba(237,108,2,0.08)' : undefined }}>
                      {pestana === 'notas' && (
                        <TableCell>
                          <Chip size="small" variant="outlined" color={c.libro === 'ventas' ? 'primary' : 'secondary'}
                            label={`${c.libro === 'ventas' ? 'Emitida' : 'Recibida'} · ${c.origen === 'NC MONTO' ? 'monto' : 'devolución'}`} />
                        </TableCell>
                      )}
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <span>{fechaDDMMAAAA(c.fecha)}</span>
                          {obs.length > 0 && <Tooltip title={obs.join(' · ')}><WarningAmberIcon fontSize="small" color="warning" /></Tooltip>}
                        </Stack>
                      </TableCell>
                      <TableCell>{c.timbrado}</TableCell>
                      <TableCell>{c.numero}</TableCell>
                      <TableCell>{c.nombre}</TableCell>
                      <TableCell>{c.tipoIdentificacion === 15 ? '—' : c.numeroIdentificacion}</TableCell>
                      {pestana !== 'notas' && <TableCell>{c.condicion === 2 ? 'Crédito' : 'Contado'}</TableCell>}
                      <TableCell align="right">{c.gravado10 ? formatGs(c.gravado10) : ''}</TableCell>
                      <TableCell align="right">{c.iva10 ? formatGs(c.iva10) : ''}</TableCell>
                      <TableCell align="right">{c.gravado5 ? formatGs(c.gravado5) : ''}</TableCell>
                      <TableCell align="right">{c.iva5 ? formatGs(c.iva5) : ''}</TableCell>
                      <TableCell align="right">{c.exento ? formatGs(c.exento) : ''}</TableCell>
                      <TableCell align="right">{formatGs(c.total)}</TableCell>
                      {pestana === 'notas' && <TableCell>{c.numeroAsociado ? `${c.numeroAsociado} (timb. ${c.timbradoAsociado ?? ''})` : ''}</TableCell>}
                    </TableRow>
                  );
                })}
                {visibles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 6 }}>
                      <Typography color="text.disabled">Sin comprobantes del {rango}.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {visibles.length > 0 && (
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: 2, borderColor: 'divider' } }}>
                    <TableCell colSpan={6}>Totales</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.gravado10)}</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.iva10)}</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.gravado5)}</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.iva5)}</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.exento)}</TableCell>
                    <TableCell align="right">{formatGs(totalesVisibles.total)}</TableCell>
                    {pestana === 'notas' && <TableCell />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
