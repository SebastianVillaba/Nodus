import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import TextField from './UppercaseTextField';
import { servicioService } from '../services/servicio.service';
import type { Servicio } from '../services/servicio.service';

interface SearchServicioModalProps {
  open: boolean;
  onClose: () => void;
  onSelectServicio: (servicio: Servicio) => void;
}

const formatGs = (v: number) => Math.round(v || 0).toLocaleString('es-PY');

/**
 * Búsqueda de servicios activos para agregarlos a la venta. Filtra por código o nombre mientras se escribe;
 * flechas para moverse y Enter para elegir.
 */
export default function SearchServicioModal({ open, onClose, onSelectServicio }: SearchServicioModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [seleccionado, setSeleccionado] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      setCargando(true);
      setError('');
      try {
        const lista = await servicioService.listar(busqueda);
        if (!cancelado) {
          setServicios(lista);
          setSeleccionado(0);
        }
      } catch (err: any) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }, 250);
    return () => { cancelado = true; clearTimeout(t); };
  }, [busqueda, open]);

  useEffect(() => {
    if (open) {
      setBusqueda('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const elegir = (s: Servicio | undefined) => {
    if (s) onSelectServicio(s);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSeleccionado((i) => Math.min(i + 1, servicios.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSeleccionado((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      elegir(servicios[seleccionado]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HomeRepairServiceIcon color="primary" /> Buscar servicio
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          fullWidth
          size="small"
          label="Código o nombre del servicio"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          sx={{ mt: 1, mb: 2 }}
        />
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Servicio</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>IVA</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Precio</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {servicios.map((s, i) => (
                <TableRow
                  key={s.idServicio}
                  hover
                  selected={i === seleccionado}
                  onClick={() => elegir(s)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{s.codigo}</TableCell>
                  <TableCell>
                    {s.nombreServicio}
                    {s.descripcion && <Typography variant="caption" color="text.secondary" display="block">{s.descripcion}</Typography>}
                  </TableCell>
                  <TableCell>{s.porcentajeImpuesto ? `${s.porcentajeImpuesto}%` : 'Exenta'}</TableCell>
                  <TableCell align="right">₲{formatGs(s.precio)}</TableCell>
                </TableRow>
              ))}
              {!cargando && servicios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay servicios{busqueda ? ' que coincidan' : ''}. Se cargan en ABM → Servicios.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Box sx={{ flexGrow: 1, pl: 2 }}>
          <Typography variant="caption" color="text.secondary">↑ ↓ para moverse · Enter para elegir</Typography>
        </Box>
        <Button onClick={onClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
}
