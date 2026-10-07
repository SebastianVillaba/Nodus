import { useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Paper,
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
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import SaveIcon from '@mui/icons-material/Save';
import UppercaseTextField from '../../components/UppercaseTextField';
import FacturaNotaCreditoPanel, { formatGs } from '../../components/NotaCredito/FacturaNotaCreditoPanel';
import { useTerminal } from '../../hooks/useTerminal';
import { notaCreditoService } from '../../services/notaCredito.service';
import type { FacturaNotaCredito } from '../../services/notaCredito.service';
import { facturaService } from '../../services/ticket.service';
import { getErrorMessage } from '../../services/httpError';

const cantidadTexto = (valor: number) => String(Number(valor));

/** Subtotal estimado de una línea; el servidor hace el cálculo definitivo (mismo criterio). */
const subtotalLinea = (linea: FacturaNotaCredito['detalle'][number], cantidad: number) => {
    if (cantidad <= 0) return 0;
    if (cantidad === Number(linea.cantidadDisponible)) {
        const yaDevuelto = Math.round(linea.subtotal * Number(linea.cantidadDevuelta) / Number(linea.cantidadVendida));
        return linea.subtotal - yaDevuelto;
    }
    return Math.round(linea.subtotal * cantidad / Number(linea.cantidadVendida));
};

/**
 * Nota de crédito por devolución de mercadería: se elige la factura, las cantidades a devolver y el motivo.
 * La mercadería vuelve al stock; si la factura es a crédito se rebaja el saldo de sus cuotas.
 */
export default function NotaCreditoDevolucion() {
    const { idTerminalWeb } = useTerminal();
    const [factura, setFactura] = useState<FacturaNotaCredito | null>(null);
    const [puedeEmitir, setPuedeEmitir] = useState(false);
    const [cantidades, setCantidades] = useState<Record<number, string>>({});
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const cargarFactura = (f: FacturaNotaCredito | null) => {
        setFactura(f);
        setCantidades({});
        setError('');
    };

    const lineas = useMemo(() => (factura?.detalle ?? []).map((d) => {
        const cantidad = Number((cantidades[d.idDetVenta] ?? '').replace(',', '.')) || 0;
        return { ...d, cantidad, subtotalNc: subtotalLinea(d, cantidad) };
    }), [factura, cantidades]);

    const total = lineas.reduce((acc, l) => acc + l.subtotalNc, 0);
    const excedidas = lineas.filter((l) => l.cantidad > Number(l.cantidadDisponible));

    const devolverTodo = () => {
        const todo: Record<number, string> = {};
        (factura?.detalle ?? []).forEach((d) => {
            if (Number(d.cantidadDisponible) > 0) todo[d.idDetVenta] = cantidadTexto(d.cantidadDisponible);
        });
        setCantidades(todo);
    };

    const guardar = async () => {
        if (!factura || !idTerminalWeb) return;
        setError('');
        setSuccess('');
        const detalle = lineas.filter((l) => l.cantidad > 0).map((l) => ({ idDetVenta: l.idDetVenta, cantidad: l.cantidad }));
        if (detalle.length === 0) {
            setError('Indique la cantidad a devolver de al menos un artículo.');
            return;
        }
        if (excedidas.length > 0) {
            setError(`No se puede devolver más de lo disponible en: ${excedidas.map((l) => l.nombreProducto).join(', ')}.`);
            return;
        }
        if (!motivo.trim()) {
            setError('Indique el motivo de la nota de crédito.');
            return;
        }

        setGuardando(true);
        try {
            const nota = await notaCreditoService.guardarDevolucion({
                idVenta: factura.cabecera.idVenta, idTerminalWeb, motivo: motivo.trim(), detalle, noImp: factura.cabecera.noImp,
            });
            setSuccess(`${nota.nroNotaCredito ? `Nota de crédito ${nota.nroNotaCredito}` : `Devolución interna ${nota.idDocumento}`} registrada por ${formatGs(nota.totalNotaCredito)}.`
                + (nota.montoAplicadoCredito > 0 ? ` Se rebajaron ${formatGs(nota.montoAplicadoCredito)} de las cuotas.` : '')
                + (nota.montoDevueltoCaja ? ` Entregue ${formatGs(nota.montoDevueltoCaja)} al cliente desde la caja.` : ''));
            setMotivo('');
            cargarFactura(await notaCreditoService.consultarFactura({ idVenta: factura.cabecera.idVenta, noImp: factura.cabecera.noImp }));
            try {
                await facturaService.generarNotaCredito(await notaCreditoService.reporte('DEV', nota.idDocumento));
            } catch (err) {
                setError(getErrorMessage(err, 'La nota se guardó pero no se pudo imprimir. Reimprímala desde la consulta.'));
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Error al registrar la nota de crédito'));
        } finally {
            setGuardando(false);
        }
    };

    const habilitada = !!factura && factura.cabecera.activo && puedeEmitir;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentReturnIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>Nota de Crédito por Devolución</Typography>
            </Box>

            {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

            <FacturaNotaCreditoPanel idTerminalWeb={idTerminalWeb} factura={factura} onFactura={cargarFactura} onPuedeEmitir={setPuedeEmitir} permitirNoImp />

            {factura && (
                <Paper sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', flexGrow: 1 }}>
                            Artículos de la venta
                        </Typography>
                        <Button size="small" onClick={devolverTodo} disabled={!habilitada}>Devolver todo</Button>
                        <Button size="small" onClick={() => setCantidades({})} disabled={!habilitada}>Limpiar</Button>
                    </Stack>
                    <TableContainer sx={{ maxHeight: 360 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">IVA</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Vendido</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Ya devuelto</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Precio unit.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center" width={130}>A devolver</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Subtotal</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lineas.map((l) => {
                                    const sinSaldo = Number(l.cantidadDisponible) <= 0;
                                    const excedida = l.cantidad > Number(l.cantidadDisponible);
                                    return (
                                        <TableRow key={l.idDetVenta} sx={{ opacity: sinSaldo ? 0.5 : 1 }}>
                                            <TableCell>{l.codigo}</TableCell>
                                            <TableCell>{l.nombreProducto}</TableCell>
                                            <TableCell align="center">{Number(l.porcentajeImpuesto)}%</TableCell>
                                            <TableCell align="right">{cantidadTexto(l.cantidadVendida)}</TableCell>
                                            <TableCell align="right">{cantidadTexto(l.cantidadDevuelta)}</TableCell>
                                            <TableCell align="right">{formatGs(l.precioUnitario)}</TableCell>
                                            <TableCell align="center">
                                                <TextField
                                                    size="small"
                                                    value={cantidades[l.idDetVenta] ?? ''}
                                                    onChange={(e) => setCantidades((prev) => ({ ...prev, [l.idDetVenta]: e.target.value.replace(/[^\d.,]/g, '') }))}
                                                    disabled={!habilitada || sinSaldo}
                                                    error={excedida}
                                                    helperText={excedida ? `Máx. ${cantidadTexto(l.cantidadDisponible)}` : undefined}
                                                    placeholder={sinSaldo ? '—' : `0 / ${cantidadTexto(l.cantidadDisponible)}`}
                                                    inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                                                />
                                            </TableCell>
                                            <TableCell align="right">{l.subtotalNc ? formatGs(l.subtotalNc) : ''}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }} alignItems={{ md: 'flex-start' }}>
                        <UppercaseTextField
                            label="Motivo de la devolución"
                            size="small"
                            fullWidth
                            multiline
                            minRows={2}
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
                            disabled={!habilitada}
                            required
                        />
                        <Box sx={{ minWidth: 240, textAlign: 'right' }}>
                            <Typography variant="body2" color="text.secondary">Total nota de crédito</Typography>
                            <Typography variant="h5" fontWeight={700} color="primary.main">{formatGs(total)}</Typography>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<SaveIcon />}
                                sx={{ mt: 1 }}
                                onClick={guardar}
                                disabled={!habilitada || guardando || total <= 0}
                            >
                                Emitir nota de crédito
                            </Button>
                        </Box>
                    </Stack>
                    {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
                </Paper>
            )}
        </Box>
    );
}
