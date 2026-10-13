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
import CompraNotaCreditoPanel, {
    comprobanteVacio, formatGs, validarComprobante,
} from '../../components/NotaCreditoProveedor/CompraNotaCreditoPanel';
import type { ComprobanteForm } from '../../components/NotaCreditoProveedor/CompraNotaCreditoPanel';
import { useTerminal } from '../../hooks/useTerminal';
import { notaCreditoProveedorService } from '../../services/notaCreditoProveedor.service';
import type { CompraConsulta } from '../../services/compras.service';
import { getErrorMessage } from '../../services/httpError';

const cantidadTexto = (valor: number) => String(Number(valor));

/** Subtotal estimado de una línea; el servidor hace el cálculo definitivo (mismo criterio). */
const subtotalLinea = (linea: CompraConsulta['detalle'][number], cantidad: number) => {
    if (cantidad <= 0) return 0;
    if (cantidad === Number(linea.disponible)) {
        const yaDevuelto = Math.round(linea.subtotal * Number(linea.devuelto) / Number(linea.unidades));
        return linea.subtotal - yaDevuelto;
    }
    return Math.round(linea.subtotal * cantidad / Number(linea.unidades));
};

/**
 * Nota de crédito de proveedor por devolución de mercadería: se elige la compra, se cargan los datos del
 * comprobante del proveedor y las cantidades devueltas. La mercadería sale del depósito donde entró con la compra.
 */
export default function NotaCreditoProveedorDevolucion() {
    const { idTerminalWeb } = useTerminal();
    const [compra, setCompra] = useState<CompraConsulta | null>(null);
    const [comprobante, setComprobante] = useState<ComprobanteForm>(comprobanteVacio());
    const [cantidades, setCantidades] = useState<Record<number, string>>({});
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const cargarCompra = (c: CompraConsulta | null) => {
        setCompra(c);
        setCantidades({});
        setError('');
    };

    const lineas = useMemo(() => (compra?.detalle ?? []).map((d) => {
        const cantidad = Number((cantidades[d.idDetCompra] ?? '').replace(',', '.')) || 0;
        return { ...d, cantidad, subtotalNc: subtotalLinea(d, cantidad) };
    }), [compra, cantidades]);

    const total = lineas.reduce((acc, l) => acc + l.subtotalNc, 0);
    const excedidas = lineas.filter((l) => l.cantidad > Number(l.disponible));
    const sinStock = lineas.filter((l) => !l.gasto && l.cantidad > Number(l.stockActual));

    const devolverTodo = () => {
        const todo: Record<number, string> = {};
        (compra?.detalle ?? []).forEach((d) => {
            if (Number(d.disponible) > 0) todo[d.idDetCompra] = cantidadTexto(d.disponible);
        });
        setCantidades(todo);
    };

    const guardar = async () => {
        if (!compra || !idTerminalWeb) return;
        setError('');
        setSuccess('');
        const errorComprobante = validarComprobante(comprobante);
        if (errorComprobante) {
            setError(errorComprobante);
            return;
        }
        const detalle = lineas.filter((l) => l.cantidad > 0).map((l) => ({ idDetCompra: l.idDetCompra, cantidad: l.cantidad }));
        if (detalle.length === 0) {
            setError('Indique la cantidad devuelta de al menos un artículo.');
            return;
        }
        if (excedidas.length > 0) {
            setError(`No se puede devolver más de lo disponible en: ${excedidas.map((l) => l.producto).join(', ')}.`);
            return;
        }
        if (sinStock.length > 0) {
            setError(`No hay stock suficiente en el depósito de: ${sinStock.map((l) => l.producto).join(', ')}.`);
            return;
        }
        if (!motivo.trim()) {
            setError('Indique el motivo de la nota de crédito.');
            return;
        }

        setGuardando(true);
        try {
            const nota = await notaCreditoProveedorService.guardarDevolucion({
                idCompra: compra.cabecera.idCompra,
                idTerminalWeb,
                timbrado: comprobante.timbrado,
                dsuc: Number(comprobante.dsuc),
                dcaja: Number(comprobante.dcaja),
                nroNotaCredito: Number(comprobante.numero),
                fecha: comprobante.fecha,
                motivo: motivo.trim(),
                detalle,
            });
            setSuccess(`Nota de crédito ${nota.nroNotaCredito} del proveedor registrada por ${formatGs(nota.totalNotaCredito)}. La mercadería salió del stock.`);
            setMotivo('');
            setComprobante({ ...comprobanteVacio(), timbrado: comprobante.timbrado });
            cargarCompra(await notaCreditoProveedorService.consultarCompra(compra.cabecera.idCompra));
        } catch (err) {
            setError(getErrorMessage(err, 'Error al registrar la nota de crédito'));
        } finally {
            setGuardando(false);
        }
    };

    const habilitada = !!compra && compra.cabecera.activo;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentReturnIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>Nota de Crédito de Proveedor por Devolución</Typography>
            </Box>

            {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

            <CompraNotaCreditoPanel compra={compra} onCompra={cargarCompra} comprobante={comprobante} onComprobante={setComprobante} />

            {compra && (
                <Paper sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', flexGrow: 1 }}>
                            Artículos de la compra
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
                                    <TableCell sx={{ fontWeight: 700 }}>Depósito</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">IVA</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Comprado</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Ya devuelto</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Stock</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Costo unit.</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center" width={130}>A devolver</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Subtotal</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lineas.map((l) => {
                                    const sinSaldo = Number(l.disponible) <= 0;
                                    const excedida = l.cantidad > Number(l.disponible);
                                    const faltaStock = !l.gasto && l.cantidad > Number(l.stockActual);
                                    return (
                                        <TableRow key={l.idDetCompra} sx={{ opacity: sinSaldo ? 0.5 : 1 }}>
                                            <TableCell>{l.codigo}</TableCell>
                                            <TableCell>{l.producto}</TableCell>
                                            <TableCell>{l.deposito}</TableCell>
                                            <TableCell align="center">{l.impuesto}</TableCell>
                                            <TableCell align="right">
                                                {cantidadTexto(l.unidades)}
                                                {Number(l.bonificacion) > 0 && (
                                                    <Typography component="span" variant="caption" color="text.secondary"> (bonif. {cantidadTexto(l.bonificacion)})</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">{cantidadTexto(l.devuelto)}</TableCell>
                                            <TableCell align="right" sx={{ color: faltaStock ? 'error.main' : undefined }}>
                                                {l.gasto ? '—' : cantidadTexto(l.stockActual)}
                                            </TableCell>
                                            <TableCell align="right">{formatGs(l.costoUnitario)}</TableCell>
                                            <TableCell align="center">
                                                <TextField
                                                    size="small"
                                                    value={cantidades[l.idDetCompra] ?? ''}
                                                    onChange={(e) => setCantidades((prev) => ({ ...prev, [l.idDetCompra]: e.target.value.replace(/[^\d.,]/g, '') }))}
                                                    disabled={!habilitada || sinSaldo}
                                                    error={excedida || faltaStock}
                                                    helperText={excedida ? `Máx. ${cantidadTexto(l.disponible)}` : faltaStock ? 'Sin stock' : undefined}
                                                    placeholder={sinSaldo ? '—' : `0 / ${cantidadTexto(l.disponible)}`}
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
                                Registrar nota de crédito
                            </Button>
                        </Box>
                    </Stack>
                    {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
                </Paper>
            )}
        </Box>
    );
}
