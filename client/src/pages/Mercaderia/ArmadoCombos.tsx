import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import BuildIcon from '@mui/icons-material/Build';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import UppercaseTextField from '../../components/UppercaseTextField';
import { useTerminal } from '../../hooks/useTerminal';
import { getErrorMessage } from '../../services/httpError';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/armado-combo`;

interface Combo { idProducto: number; codigo: string; nombre: string; stockArmado: number; armables: number }
interface Componente { idCombo: number; idProducto: number; codigo: string; nombre: string; cantidad: number; stock: number }
interface Armado { idArmadoCombo: number; fechaAlta: string; tipo: 'A' | 'D'; combo: string; cantidad: number; observacion: string | null; usuario: string }

const num = (v: number) => Number(v).toLocaleString('es-PY', { maximumFractionDigits: 4 });

/**
 * Armado de combos con stock propio (ej: canastas): al armar salen los componentes y entra el combo; al
 * desarmar, al revés. Trabaja sobre el depósito de ventas de la terminal y queda en el seguimiento de stock.
 */
export default function ArmadoCombos() {
  const { idTerminalWeb } = useTerminal();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [historial, setHistorial] = useState<Armado[]>([]);
  const [idCombo, setIdCombo] = useState<number | ''>('');
  const [cantidad, setCantidad] = useState('1');
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cargar = useCallback(async () => {
    if (!idTerminalWeb) return;
    try {
      const { data } = await axios.get(API_URL, { params: { idTerminalWeb } });
      setCombos(data.combos);
      setComponentes(data.componentes);
      setHistorial(data.historial);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar los combos'));
    }
  }, [idTerminalWeb]);

  useEffect(() => { cargar(); }, [cargar]);

  const combo = combos.find((c) => c.idProducto === idCombo);
  const cant = Number(cantidad.replace(',', '.')) || 0;
  const delCombo = useMemo(() => componentes.filter((c) => c.idCombo === idCombo), [componentes, idCombo]);

  const ejecutar = async (desarmar: boolean) => {
    if (!combo || !idTerminalWeb) return;
    setError('');
    setSuccess('');
    if (cant <= 0) {
      setError('Indique una cantidad mayor a cero.');
      return;
    }
    setGuardando(true);
    try {
      await axios.post(API_URL, { idProducto: combo.idProducto, cantidad: cant, desarmar, idTerminalWeb, observacion: observacion.trim() });
      setSuccess(`${desarmar ? 'Se desarmaron' : 'Se armaron'} ${num(cant)} ${combo.nombre}.`);
      setObservacion('');
      await cargar();
    } catch (err) {
      setError(getErrorMessage(err, desarmar ? 'Error al desarmar' : 'Error al armar'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CardGiftcardIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Armado de Combos</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Solo combos <b>con stock propio</b> (se configuran en el ABM de productos, pestaña de productos referenciados).
          Al armar salen los componentes del depósito de ventas y entra el combo; al desarmar, al revés.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} useFlexGap flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Combo</InputLabel>
            <Select label="Combo" value={idCombo} onChange={(e) => setIdCombo(e.target.value as number)}>
              {combos.map((c) => <MenuItem key={c.idProducto} value={c.idProducto}>{c.codigo} · {c.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Cantidad" value={cantidad} sx={{ width: 110 }}
            onChange={(e) => setCantidad(e.target.value.replace(/[^\d.,]/g, ''))} inputProps={{ inputMode: 'decimal' }} />
          <UppercaseTextField size="small" label="Observación" value={observacion} sx={{ minWidth: 240, flex: 1 }}
            onChange={(e) => setObservacion(e.target.value.slice(0, 200))} />
          <Button variant="contained" color="success" startIcon={<BuildIcon />} disabled={!combo || guardando} onClick={() => ejecutar(false)}>
            Armar
          </Button>
          <Button variant="outlined" color="warning" startIcon={<CallSplitIcon />} disabled={!combo || guardando} onClick={() => ejecutar(true)}>
            Desarmar
          </Button>
        </Stack>
        {combos.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>No hay combos con stock propio configurados.</Alert>
        )}

        {combo && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip label={`Armados: ${num(combo.stockArmado)}`} color="primary" variant="outlined" />
              <Chip label={`Se pueden armar: ${num(combo.armables)}`} color={combo.armables > 0 ? 'success' : 'default'} variant="outlined" />
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Componente</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Por combo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Necesario para {num(cant)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delCombo.map((c) => {
                    const necesario = c.cantidad * cant;
                    return (
                      <TableRow key={c.idProducto}>
                        <TableCell>{c.codigo}</TableCell>
                        <TableCell>{c.nombre}</TableCell>
                        <TableCell align="right">{num(c.cantidad)}</TableCell>
                        <TableCell align="right">{num(necesario)}</TableCell>
                        <TableCell align="right" sx={{ color: c.stock < necesario ? 'error.main' : undefined, fontWeight: 600 }}>{num(c.stock)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', mb: 1 }}>
          Últimos armados y desarmados
        </Typography>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Operación</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Combo</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Cantidad</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Observación</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Usuario</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historial.map((h) => (
                <TableRow key={h.idArmadoCombo}>
                  <TableCell>{new Date(h.fechaAlta).toLocaleString('es-PY')}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={h.tipo === 'A' ? 'Armado' : 'Desarmado'} color={h.tipo === 'A' ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell>{h.combo}</TableCell>
                  <TableCell align="right">{num(h.cantidad)}</TableCell>
                  <TableCell>{h.observacion}</TableCell>
                  <TableCell>{h.usuario}</TableCell>
                </TableRow>
              ))}
              {historial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="text.disabled">Sin movimientos.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
