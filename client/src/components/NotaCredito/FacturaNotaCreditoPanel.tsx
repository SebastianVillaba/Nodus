import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BuscarVentaNotaCreditoModal from './BuscarVentaNotaCreditoModal';
import { notaCreditoService } from '../../services/notaCredito.service';
import type { FacturaNotaCredito, VentaParaNotaCredito } from '../../services/notaCredito.service';
import { timbradoService } from '../../services/timbrado.service';
import type { EstadoTimbrado } from '../../services/timbrado.service';
import { getErrorMessage } from '../../services/httpError';

export const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);
const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-PY');

interface Props {
    idTerminalWeb: number | null | undefined;
    factura: FacturaNotaCredito | null;
    onFactura: (factura: FacturaNotaCredito | null) => void;
    /** Avisa si se puede emitir sobre la venta elegida (las no impresas no necesitan talonario) */
    onPuedeEmitir: (puede: boolean) => void;
    /** Permite elegir ventas no impresas (solo devoluciones) */
    permitirNoImp?: boolean;
}

/**
 * Cabecera común de las notas de crédito: estado del talonario de la terminal, búsqueda de la
 * venta (modal) y sus datos (condición, saldo por acreditar y notas ya emitidas).
 */
export default function FacturaNotaCreditoPanel({ idTerminalWeb, factura, onFactura, onPuedeEmitir, permitirNoImp = false }: Props) {
    const [estado, setEstado] = useState<EstadoTimbrado | null>(null);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!idTerminalWeb) return;
        timbradoService.estado(idTerminalWeb, 2)
            .then(setEstado)
            .catch((err) => setError(getErrorMessage(err, 'Error al consultar el talonario de notas de crédito')));
    }, [idTerminalWeb, factura?.notas.length]);

    const noImp = !!factura?.cabecera.noImp;
    useEffect(() => {
        onPuedeEmitir(noImp || (!!estado && !estado.bloquea));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noImp, estado]);

    const elegir = async (venta: VentaParaNotaCredito) => {
        setModalAbierto(false);
        setError('');
        setCargando(true);
        try {
            onFactura(await notaCreditoService.consultarFactura({ idVenta: venta.idVenta, noImp: venta.noImp }));
        } catch (err) {
            onFactura(null);
            setError(getErrorMessage(err, 'Error al cargar la venta'));
        } finally {
            setCargando(false);
        }
    };

    const c = factura?.cabecera;

    return (
        <Paper sx={{ p: 2 }}>
            {/* El talonario solo importa para notas sobre facturas */}
            {!noImp && estado?.bloquea && (
                <Alert severity="error" sx={{ mb: 2 }}>{estado.mensaje}</Alert>
            )}
            {!noImp && estado && !estado.bloquea && estado.mensaje && (
                <Alert severity="warning" sx={{ mb: 2 }}>{estado.mensaje}</Alert>
            )}
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setModalAbierto(true)} disabled={cargando}>
                    {factura ? 'Buscar otra venta' : 'Buscar venta'}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                {noImp ? (
                    <Typography variant="body2" color="text.secondary">
                        Venta no impresa: la devolución queda registrada <b>sin número ni timbrado</b>.
                    </Typography>
                ) : estado && !estado.bloquea && (
                    <Typography variant="body2" color="text.secondary">
                        Próxima nota de crédito: <b>{estado.proximoNumero}</b> · Timbrado {estado.timbrado}
                    </Typography>
                )}
            </Stack>

            {c && (
                <Box sx={{ mt: 2 }}>
                    {!c.activo && <Alert severity="error" sx={{ mb: 1 }}>La venta está anulada: no se le puede emitir una nota de crédito.</Alert>}
                    <Grid container spacing={1}>
                        {[
                            [c.noImp ? 'Venta no impresa' : 'Factura', `${c.noImp ? `Id ${c.idVenta}` : c.nroFactura} · ${fecha(c.fechaFactura)}`],
                            ['Cliente', `${c.cliente} · RUC ${c.ruc}`],
                            ['Condición', c.condicionVenta],
                            ['Total venta', formatGs(c.totalVenta)],
                            ['Ya acreditado', formatGs(c.totalAcreditado)],
                            ['Disponible para acreditar', formatGs(c.totalDisponible)],
                        ].map(([label, valor]) => (
                            <Grid key={label} size={{ xs: 12, sm: 6, md: 4 }}>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                                <Typography variant="body2" fontWeight={600}>{valor}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                    {c.idTipoVenta === 2 ? (
                        <Alert severity="info" sx={{ mt: 1.5 }}>
                            Factura a crédito: la nota rebaja el saldo de sus cuotas, empezando por la última (saldo actual {formatGs(c.saldoCuotas)}).
                            Lo que supere el saldo pendiente no se devuelve.
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mt: 1.5 }}>
                            {permitirNoImp
                                ? 'Venta contado: el dinero de la devolución sale de la caja abierta (es obligatorio tenerla abierta) y se descuenta en el arqueo.'
                                : 'Venta contado: la nota de crédito por monto no devuelve dinero de la caja.'}
                        </Alert>
                    )}
                    {factura!.notas.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                            <Typography variant="body2" color="text.secondary">Notas emitidas:</Typography>
                            {factura!.notas.map((n) => (
                                <Chip
                                    key={`${n.tipo}-${n.idDocumento}`}
                                    size="small"
                                    variant="outlined"
                                    color={n.activo ? 'primary' : 'default'}
                                    label={`${n.nroNotaCredito ?? `Interna ${n.idDocumento}`} · ${n.tipo === 'DEV' ? 'Devolución' : 'Monto'} · ${formatGs(n.totalNotaCredito)}${n.activo ? '' : ' (anulada)'}`}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>
            )}

            <BuscarVentaNotaCreditoModal
                open={modalAbierto}
                onClose={() => setModalAbierto(false)}
                onSelect={elegir}
                permitirNoImp={permitirNoImp}
            />
        </Paper>
    );
}
