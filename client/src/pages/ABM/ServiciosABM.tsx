import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField as MuiTextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import HomeRepairServiceIcon from '@mui/icons-material/HomeRepairService';
import TextField from '../../components/UppercaseTextField';
import { servicioService } from '../../services/servicio.service';
import type { Servicio, ServicioGuardar } from '../../services/servicio.service';
import { impuestoService } from '../../services/impuesto.service';

interface Impuesto { idImpuesto: number; nombreImpuesto: string }

const VACIO: ServicioGuardar = {
  idServicio: null,
  codigo: '',
  nombreServicio: '',
  descripcion: '',
  precio: 0,
  idImpuesto: 0,
  permiteDecimal: false,
  activo: true,
};

const formatGs = (v: number) => Math.round(v || 0).toLocaleString('es-PY');

/**
 * ABM de servicios: conceptos que se facturan sin stock (mano de obra, envíos, instalaciones...).
 * Se venden desde Facturación con el botón "Servicio" (F3).
 */
export default function ServiciosABM() {
  const [busqueda, setBusqueda] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [impuestos, setImpuestos] = useState<Impuesto[]>([]);
  const [form, setForm] = useState<ServicioGuardar | null>(null);
  const [precioTexto, setPrecioTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cargar = useCallback(async () => {
    try {
      setServicios(await servicioService.listar(busqueda, incluirInactivos));
    } catch (err: any) {
      setError(err.message);
    }
  }, [busqueda, incluirInactivos]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  useEffect(() => {
    impuestoService.consultaImpuesto()
      .then((lista: Impuesto[]) => setImpuestos(lista ?? []))
      .catch(() => setError('No se pudieron cargar los impuestos'));
  }, []);

  const editar = (s: Servicio) => {
    setError('');
    setSuccess('');
    setForm({
      idServicio: s.idServicio,
      codigo: s.codigo ?? '',
      nombreServicio: s.nombreServicio,
      descripcion: s.descripcion ?? '',
      precio: s.precio,
      idImpuesto: s.idImpuesto,
      permiteDecimal: !!s.permiteDecimal,
      activo: !!s.activo,
    });
    setPrecioTexto(String(Math.round(s.precio)));
  };

  const nuevo = () => {
    setError('');
    setSuccess('');
    // Por defecto IVA 10% si existe
    const iva10 = impuestos.find((i) => /10/.test(i.nombreImpuesto));
    setForm({ ...VACIO, idImpuesto: iva10?.idImpuesto ?? impuestos[0]?.idImpuesto ?? 0 });
    setPrecioTexto('');
  };

  const guardar = async () => {
    if (!form) return;
    setError('');
    setSuccess('');
    const precio = Number(precioTexto.replace(/\./g, '').replace(',', '.'));
    if (!form.nombreServicio.trim()) {
      setError('Indique el nombre del servicio.');
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setError('Indique un precio válido.');
      return;
    }
    if (!form.idImpuesto) {
      setError('Seleccione el impuesto.');
      return;
    }
    setGuardando(true);
    try {
      await servicioService.guardar({ ...form, precio });
      setSuccess(form.idServicio ? 'Servicio actualizado.' : 'Servicio creado.');
      setForm(null);
      await cargar();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HomeRepairServiceIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Servicios</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField fullWidth size="small" label="Buscar (código o nombre)" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)} />
              <Button variant="contained" startIcon={<AddIcon />} onClick={nuevo} sx={{ whiteSpace: 'nowrap' }}>
                Nuevo
              </Button>
            </Stack>
            <FormControlLabel sx={{ mt: 0.5 }} label={<Typography variant="body2">Mostrar inactivos</Typography>}
              control={<Checkbox size="small" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} />} />
            <List dense sx={{ maxHeight: 480, overflow: 'auto' }}>
              {servicios.map((s) => (
                <ListItemButton key={s.idServicio} selected={form?.idServicio === s.idServicio} onClick={() => editar(s)}>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{s.nombreServicio}</span>
                        {!s.activo && <Chip size="small" label="Inactivo" />}
                      </Stack>
                    }
                    secondary={`${s.codigo ? `${s.codigo} · ` : ''}₲${formatGs(s.precio)} · ${s.porcentajeImpuesto ? `IVA ${s.porcentajeImpuesto}%` : 'Exenta'}`}
                  />
                </ListItemButton>
              ))}
              {servicios.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No hay servicios{busqueda ? ' que coincidan' : ' cargados'}.
                </Typography>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2, minHeight: 300 }}>
            {!form ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
                <Typography color="text.secondary">Seleccione un servicio o haga clic en "Nuevo".</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {form.idServicio ? 'Editar servicio' : 'Nuevo servicio'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth size="small" label="Código (opcional)" value={form.codigo ?? ''}
                      onChange={(e) => setForm({ ...form, codigo: e.target.value.slice(0, 20) })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField fullWidth size="small" label="Nombre del servicio" required value={form.nombreServicio}
                      onChange={(e) => setForm({ ...form, nombreServicio: e.target.value.slice(0, 150) })} />
                  </Grid>
                  <Grid size={12}>
                    <MuiTextField fullWidth size="small" label="Descripción (opcional)" multiline minRows={2} value={form.descripcion ?? ''}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value.slice(0, 300) })} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <MuiTextField fullWidth size="small" label="Precio (IVA incluido)" required value={precioTexto}
                      onChange={(e) => setPrecioTexto(e.target.value.replace(/[^\d.,]/g, ''))}
                      inputProps={{ inputMode: 'decimal' }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Impuesto</InputLabel>
                      <Select label="Impuesto" value={form.idImpuesto || ''}
                        onChange={(e) => setForm({ ...form, idImpuesto: Number(e.target.value) })}>
                        {impuestos.map((i) => <MenuItem key={i.idImpuesto} value={i.idImpuesto}>{i.nombreImpuesto}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControlLabel label="Cantidad con decimales"
                      control={<Checkbox size="small" checked={form.permiteDecimal}
                        onChange={(e) => setForm({ ...form, permiteDecimal: e.target.checked })} />} />
                  </Grid>
                  <Grid size={12}>
                    <FormControlLabel label={form.activo ? 'Activo (se puede facturar)' : 'Inactivo (no aparece en facturación)'}
                      control={<Switch checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />} />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  El precio es el sugerido: en facturación se puede modificar. Los servicios no tienen stock ni costo.
                  "Cantidad con decimales" sirve para servicios por hora o por metro (ej: 1,5).
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" color="inherit" startIcon={<CancelIcon />} onClick={() => setForm(null)}>Cancelar</Button>
                  <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={guardar} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
