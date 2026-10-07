import { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Divider,
    Alert,
    CircularProgress,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Grid,
} from '@mui/material';
import TextField from '../../components/UppercaseTextField';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import RequirePermission from '../../components/RequirePermission';
import { timbradoService } from '../../services/timbrado.service';
import { NOMBRE_TIPO_COMPROBANTE } from '../../services/timbrado.service';
import type { Timbrado, GuardarTimbradoRequest, TipoComprobante } from '../../services/timbrado.service';
import { pedidoInternoService } from '../../services/pedidoInterno.service';
import { getErrorMessage } from '../../services/httpError';

const FORM_VACIO: GuardarTimbradoRequest = {
    idFactura: 0,
    idTipoComprobante: 1,
    idSucursal: 0,
    dsuc: '001',
    dcaja: '001',
    timbrado: '',
    fechaInicio: '',
    fechaCaduca: '',
    nroDesde: 1,
    nroHasta: null,
    proximoNumero: 1,
    preImpreso: false,
    activo: true,
};

const COLOR_ESTADO: Record<Timbrado['estado'], 'success' | 'warning' | 'error' | 'default'> = {
    VIGENTE: 'success',
    POR_VENCER: 'warning',
    NO_VALIDO: 'error',
    INACTIVO: 'default',
};

const TEXTO_ESTADO: Record<Timbrado['estado'], string> = {
    VIGENTE: 'Vigente',
    POR_VENCER: 'Por vencer',
    NO_VALIDO: 'No válido',
    INACTIVO: 'Inactivo',
};

const soloFecha = (valor: string | null | undefined) => (valor ? String(valor).substring(0, 10) : '');

export default function Timbrados(): JSX.Element {
    const [timbrados, setTimbrados] = useState<Timbrado[]>([]);
    const [sucursales, setSucursales] = useState<{ idSucursal: number; nombreSucursal: string }[]>([]);
    const [seleccionado, setSeleccionado] = useState<Timbrado | null>(null);
    const [esNuevo, setEsNuevo] = useState(false);
    const [form, setForm] = useState<GuardarTimbradoRequest>(FORM_VACIO);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const cargar = async () => {
        setLoading(true);
        try {
            setTimbrados(await timbradoService.listar());
        } catch (err) {
            setError(getErrorMessage(err, 'Error al cargar los timbrados'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
        pedidoInternoService.consultaSucursales()
            .then(setSucursales)
            .catch((err) => setError(getErrorMessage(err, 'Error al cargar las sucursales')));
    }, []);

    const seleccionar = (t: Timbrado) => {
        setSeleccionado(t);
        setEsNuevo(false);
        setError('');
        setSuccess('');
        setForm({
            idFactura: t.idFactura,
            idTipoComprobante: t.idTipoComprobante,
            idSucursal: t.idSucursal,
            dsuc: t.dsuc,
            dcaja: t.dcaja,
            timbrado: t.timbrado,
            fechaInicio: soloFecha(t.fechaInicio),
            fechaCaduca: soloFecha(t.fechaCaduca),
            nroDesde: t.nroDesde,
            nroHasta: t.nroHasta,
            proximoNumero: t.proximoNumero,
            preImpreso: t.preImpreso,
            activo: t.activo,
        });
    };

    const nuevo = () => {
        setSeleccionado(null);
        setEsNuevo(true);
        setError('');
        setSuccess('');
        setForm({ ...FORM_VACIO, idSucursal: sucursales[0]?.idSucursal || 0 });
    };

    const cancelar = () => {
        setSeleccionado(null);
        setEsNuevo(false);
        setForm(FORM_VACIO);
    };

    const guardar = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const idFactura = await timbradoService.guardar(form);
            const lista = await timbradoService.listar();
            setTimbrados(lista);
            const guardado = lista.find((t) => t.idFactura === idFactura);
            if (guardado) seleccionar(guardado);
            setSuccess('Timbrado guardado correctamente');
        } catch (err) {
            setError(getErrorMessage(err, 'Error al guardar el timbrado'));
        } finally {
            setLoading(false);
        }
    };

    const set = <K extends keyof GuardarTimbradoRequest>(campo: K, valor: GuardarTimbradoRequest[K]) =>
        setForm((prev) => ({ ...prev, [campo]: valor }));

    const numero = (valor: string) => (valor === '' ? 0 : Number(valor.replace(/\D/g, '')));
    const mostrarForm = esNuevo || seleccionado;

    return (
        <RequirePermission permission="ACCESO_TIMBRADOS">
            <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', gap: 2, p: 2 }}>
                {/* Lista de timbrados */}
                <Paper sx={{ width: 340, p: 2, display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" gutterBottom>
                        Timbrados
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                        <List dense>
                            {timbrados.map((t) => (
                                <ListItem key={t.idFactura} disablePadding>
                                    <ListItemButton selected={seleccionado?.idFactura === t.idFactura} onClick={() => seleccionar(t)}>
                                        <ListItemText
                                            primary={`${NOMBRE_TIPO_COMPROBANTE[t.idTipoComprobante] ?? t.tipoComprobante} · ${t.puntoExpedicion} · ${t.timbrado}`}
                                            secondary={`${t.nombreSucursal} · vence ${new Date(soloFecha(t.fechaCaduca) + 'T00:00:00').toLocaleDateString('es-PY')}`}
                                        />
                                        <Chip size="small" label={TEXTO_ESTADO[t.estado]} color={COLOR_ESTADO[t.estado]} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                            {!loading && timbrados.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                    No hay timbrados cargados.
                                </Typography>
                            )}
                        </List>
                    </Box>
                </Paper>

                {/* Formulario */}
                <Paper sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
                    <Typography variant="h5" sx={{ mb: 3 }}>
                        {esNuevo ? 'Nuevo Timbrado' : seleccionado ? `Timbrado ${seleccionado.timbrado}` : 'Detalle de Timbrado'}
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
                    {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box>}

                    {mostrarForm ? (
                        <Grid container spacing={2} sx={{ maxWidth: 760 }}>
                            <Grid size={{ xs: 12 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tipo de comprobante</InputLabel>
                                    <Select label="Tipo de comprobante" value={form.idTipoComprobante}
                                        onChange={(e) => set('idTipoComprobante', Number(e.target.value) as TipoComprobante)}
                                        disabled={!!seleccionado && (seleccionado.ultimoEmitido > 0 || seleccionado.terminalesAsignadas > 0)}>
                                        {([1, 2] as TipoComprobante[]).map((tipo) => (
                                            <MenuItem key={tipo} value={tipo}>{NOMBRE_TIPO_COMPROBANTE[tipo]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Nº de timbrado" value={form.timbrado}
                                    onChange={(e) => set('timbrado', e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    inputProps={{ maxLength: 8, inputMode: 'numeric' }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Sucursal</InputLabel>
                                    <Select label="Sucursal" value={form.idSucursal || ''} onChange={(e) => set('idSucursal', Number(e.target.value))}>
                                        {sucursales.map((s) => (
                                            <MenuItem key={s.idSucursal} value={s.idSucursal}>{s.nombreSucursal}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" label="Establecimiento" value={form.dsuc}
                                    onChange={(e) => set('dsuc', e.target.value.replace(/\D/g, '').slice(0, 3))} helperText="Ej: 001" />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" label="Punto de expedición" value={form.dcaja}
                                    onChange={(e) => set('dcaja', e.target.value.replace(/\D/g, '').slice(0, 3))} helperText="Ej: 001" />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Vigencia desde" value={form.fechaInicio}
                                    onChange={(e) => set('fechaInicio', e.target.value)} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Vigencia hasta" value={form.fechaCaduca}
                                    onChange={(e) => set('fechaCaduca', e.target.value)} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <TextField fullWidth size="small" label="Nº desde" value={form.nroDesde || ''}
                                    onChange={(e) => set('nroDesde', numero(e.target.value))} />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <TextField fullWidth size="small" label="Nº hasta" value={form.nroHasta ?? ''}
                                    onChange={(e) => set('nroHasta', e.target.value === '' ? null : numero(e.target.value))}
                                    helperText="Vacío = sin límite" />
                            </Grid>
                            <Grid size={{ xs: 4 }}>
                                <TextField fullWidth size="small" label="Próximo número a emitir" value={form.proximoNumero || ''}
                                    onChange={(e) => set('proximoNumero', numero(e.target.value))}
                                    helperText={seleccionado ? `Último emitido: ${seleccionado.ultimoEmitido || 'ninguno'}` : ' '} />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <FormControlLabel control={<Switch checked={form.preImpreso} onChange={(e) => set('preImpreso', e.target.checked)} />} label="Formulario preimpreso" />
                                <FormControlLabel control={<Switch checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />} label="Activo" />
                            </Grid>
                            {seleccionado && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Terminales que lo usan: {seleccionado.terminalesAsignadas}
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60%' }}>
                            <Typography variant="h6" color="text.secondary">
                                Seleccione un timbrado o haga clic en "Nuevo" para cargar uno
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 5 }}>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={nuevo}>Nuevo</Button>
                        {mostrarForm && (
                            <>
                                <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={guardar} disabled={loading}>
                                    Guardar
                                </Button>
                                <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={cancelar}>
                                    Cancelar
                                </Button>
                            </>
                        )}
                    </Box>
                </Paper>
            </Box>
        </RequirePermission>
    );
}
