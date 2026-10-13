import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Grid,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BuscarCompraModal from './BuscarCompraModal';
import { notaCreditoProveedorService } from '../../services/notaCreditoProveedor.service';
import type { CompraConsulta, CompraListado } from '../../services/compras.service';
import { getErrorMessage } from '../../services/httpError';

export const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);
/** Fechas sin hora (DATE / DATETIME a medianoche) que llegan en UTC */
export const fechaCorta = (valor: string) => new Date(valor).toLocaleDateString('es-PY', { timeZone: 'UTC' });
export const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Datos del comprobante del proveedor tal como se cargan en pantalla */
export interface ComprobanteForm {
    timbrado: string;
    dsuc: string;
    dcaja: string;
    numero: string;
    fecha: string;
}

export const comprobanteVacio = (): ComprobanteForm => ({ timbrado: '', dsuc: '', dcaja: '', numero: '', fecha: hoyISO() });

/** Mensaje de error del comprobante, o null si está completo */
export const validarComprobante = (c: ComprobanteForm): string | null => {
    if (!/^\d{8}$/.test(c.timbrado)) return 'El timbrado de la nota de crédito del proveedor debe tener 8 dígitos.';
    if (!Number(c.dsuc) || !Number(c.dcaja) || !Number(c.numero)) return 'Ingrese el número de la nota de crédito completo.';
    if (!c.fecha) return 'Ingrese la fecha de la nota de crédito.';
    return null;
};

const soloDigitos = (texto: string, largo: number) => texto.replace(/\D/g, '').slice(0, largo);

interface Props {
    compra: CompraConsulta | null;
    onCompra: (compra: CompraConsulta | null) => void;
    comprobante: ComprobanteForm;
    onComprobante: (comprobante: ComprobanteForm) => void;
}

/**
 * Cabecera común de las notas de crédito de proveedor: búsqueda de la compra (modal), sus datos y notas ya
 * registradas, y los datos del comprobante que emitió el proveedor (timbrado, número y fecha).
 */
export default function CompraNotaCreditoPanel({ compra, onCompra, comprobante, onComprobante }: Props) {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const elegir = async (c: CompraListado) => {
        setModalAbierto(false);
        setError('');
        setCargando(true);
        try {
            const datos = await notaCreditoProveedorService.consultarCompra(c.idCompra);
            onCompra(datos);
            // El timbrado de la nota suele ser el mismo de la factura: se propone
            if (!comprobante.timbrado) onComprobante({ ...comprobante, timbrado: datos.cabecera.timbrado ?? '' });
        } catch (err) {
            onCompra(null);
            setError(getErrorMessage(err, 'Error al cargar la compra'));
        } finally {
            setCargando(false);
        }
    };

    const cambiar = (campo: keyof ComprobanteForm, valor: string) => onComprobante({ ...comprobante, [campo]: valor });
    const c = compra?.cabecera;

    return (
        <Paper sx={{ p: 2 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setModalAbierto(true)} disabled={cargando}>
                    {compra ? 'Buscar otra compra' : 'Buscar compra'}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="body2" color="text.secondary">
                    La nota la emite el proveedor: se registra con <b>su</b> timbrado y <b>su</b> número.
                </Typography>
            </Stack>

            {c && (
                <Box sx={{ mt: 2 }}>
                    {!c.activo && <Alert severity="error" sx={{ mb: 1 }}>La compra está anulada: no se le puede registrar una nota de crédito.</Alert>}
                    <Grid container spacing={1}>
                        {[
                            ['Factura de compra', `${c.nroFactura} · ${fechaCorta(c.fecha)}`],
                            ['Proveedor', `${c.proveedor} · RUC ${c.ruc}`],
                            ['Timbrado factura', c.timbrado],
                            ['Total compra', formatGs(c.total)],
                            ['Ya acreditado', formatGs(c.totalAcreditado)],
                            ['Disponible para acreditar', formatGs(c.totalDisponible)],
                        ].map(([label, valor]) => (
                            <Grid key={label} size={{ xs: 12, sm: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                                <Typography variant="body2" fontWeight={600}>{valor}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                    {compra!.notas.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                            <Typography variant="body2" color="text.secondary">Notas registradas:</Typography>
                            {compra!.notas.map((n) => (
                                <Chip
                                    key={`${n.tipo}-${n.idDocumento}`}
                                    size="small"
                                    variant="outlined"
                                    color={n.activo ? 'primary' : 'default'}
                                    label={`${n.nroNotaCredito} · ${n.tipo === 'DEV' ? 'Devolución' : 'Monto'} · ${formatGs(n.totalNotaCredito)}${n.activo ? '' : ' (anulada)'}`}
                                />
                            ))}
                        </Stack>
                    )}

                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', mt: 2, mb: 1 }}>
                        Comprobante del proveedor
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
                        <TextField size="small" label="Timbrado" value={comprobante.timbrado} sx={{ width: 150 }}
                            onChange={(e) => cambiar('timbrado', soloDigitos(e.target.value, 8))} disabled={!c.activo}
                            inputProps={{ inputMode: 'numeric' }} required />
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField size="small" label="Est." value={comprobante.dsuc} sx={{ width: 80 }}
                                onChange={(e) => cambiar('dsuc', soloDigitos(e.target.value, 3))} disabled={!c.activo}
                                inputProps={{ inputMode: 'numeric' }} required />
                            <Typography>-</Typography>
                            <TextField size="small" label="Pto." value={comprobante.dcaja} sx={{ width: 80 }}
                                onChange={(e) => cambiar('dcaja', soloDigitos(e.target.value, 3))} disabled={!c.activo}
                                inputProps={{ inputMode: 'numeric' }} required />
                            <Typography>-</Typography>
                            <TextField size="small" label="Nro. nota de crédito" value={comprobante.numero} sx={{ width: 170 }}
                                onChange={(e) => cambiar('numero', soloDigitos(e.target.value, 7))} disabled={!c.activo}
                                inputProps={{ inputMode: 'numeric' }} required />
                        </Stack>
                        <TextField size="small" label="Fecha de la nota" type="date" value={comprobante.fecha} sx={{ width: 170 }}
                            onChange={(e) => cambiar('fecha', e.target.value)} disabled={!c.activo}
                            InputLabelProps={{ shrink: true }} inputProps={{ max: hoyISO() }} required />
                    </Stack>
                </Box>
            )}

            <BuscarCompraModal open={modalAbierto} onClose={() => setModalAbierto(false)} onSelect={elegir} />
        </Paper>
    );
}
