import { useState } from 'react';
import {
    Alert,
    Box,
    Button,
    FormControl,
    IconButton,
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
    Tooltip,
    Typography,
} from '@mui/material';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import UppercaseTextField from '../../components/UppercaseTextField';
import CompraNotaCreditoPanel, {
    comprobanteVacio, formatGs, validarComprobante,
} from '../../components/NotaCreditoProveedor/CompraNotaCreditoPanel';
import type { ComprobanteForm } from '../../components/NotaCreditoProveedor/CompraNotaCreditoPanel';
import { useTerminal } from '../../hooks/useTerminal';
import { notaCreditoProveedorService } from '../../services/notaCreditoProveedor.service';
import type { CompraConsulta } from '../../services/compras.service';
import { getErrorMessage } from '../../services/httpError';

interface LineaMonto {
    clave: number;
    concepto: string;
    idImpuesto: number;
    monto: string;
}

const parseGs = (texto: string) => Number(texto.replace(/\D/g, '')) || 0;
let proximaClave = 1;
const lineaVacia = (idImpuesto: number): LineaMonto => ({ clave: proximaClave++, concepto: '', idImpuesto, monto: '' });

/**
 * Nota de crédito de proveedor por monto: descuentos, bonificaciones o diferencias de precio sobre una compra.
 * No mueve stock. Cada concepto va con su tasa de IVA, sin superar lo que queda por acreditar en esa tasa.
 */
export default function NotaCreditoProveedorMonto() {
    const { idTerminalWeb } = useTerminal();
    const [compra, setCompra] = useState<CompraConsulta | null>(null);
    const [comprobante, setComprobante] = useState<ComprobanteForm>(comprobanteVacio());
    const [lineas, setLineas] = useState<LineaMonto[]>([]);
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const impuestos = compra?.impuestos ?? [];

    const cargarCompra = (c: CompraConsulta | null) => {
        setCompra(c);
        setError('');
        const conSaldo = c?.impuestos.find((i) => i.disponible > 0) ?? c?.impuestos[0];
        setLineas(conSaldo ? [lineaVacia(conSaldo.idImpuesto)] : []);
    };

    const cambiar = (clave: number, campo: keyof LineaMonto, valor: string | number) =>
        setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)));

    const total = lineas.reduce((acc, l) => acc + parseGs(l.monto), 0);
    const porImpuesto = impuestos.map((i) => ({
        ...i,
        cargado: lineas.filter((l) => l.idImpuesto === i.idImpuesto).reduce((acc, l) => acc + parseGs(l.monto), 0),
    }));
    const excedidos = porImpuesto.filter((i) => i.cargado > i.disponible);

    const guardar = async () => {
        if (!compra || !idTerminalWeb) return;
        setError('');
        setSuccess('');
        const errorComprobante = validarComprobante(comprobante);
        if (errorComprobante) {
            setError(errorComprobante);
            return;
        }
        const detalle = lineas
            .filter((l) => parseGs(l.monto) > 0 || l.concepto.trim())
            .map((l) => ({ concepto: l.concepto.trim(), idImpuesto: l.idImpuesto, monto: parseGs(l.monto) }));
        if (detalle.length === 0) {
            setError('Cargue al menos un concepto con su monto.');
            return;
        }
        if (detalle.some((d) => !d.concepto || d.monto <= 0)) {
            setError('Cada concepto debe tener descripción y un monto mayor a cero.');
            return;
        }
        if (excedidos.length > 0) {
            setError(`El monto supera lo disponible en: ${excedidos.map((i) => i.nombreImpuesto).join(', ')}.`);
            return;
        }
        if (!motivo.trim()) {
            setError('Indique el motivo de la nota de crédito.');
            return;
        }

        setGuardando(true);
        try {
            const nota = await notaCreditoProveedorService.guardarMonto({
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
            setSuccess(`Nota de crédito ${nota.nroNotaCredito} del proveedor registrada por ${formatGs(nota.totalNotaCredito)}.`);
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
                <RequestQuoteIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>Nota de Crédito de Proveedor por Monto</Typography>
            </Box>

            {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

            <CompraNotaCreditoPanel compra={compra} onCompra={cargarCompra} comprobante={comprobante} onComprobante={setComprobante} />

            {compra && (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', mb: 1 }}>
                        Disponible por tasa de IVA
                    </Typography>
                    <Table size="small" sx={{ mb: 2, maxWidth: 640 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Tasa</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">Comprado</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">Ya acreditado</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">Disponible</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">En esta nota</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {porImpuesto.map((i) => (
                                <TableRow key={i.idImpuesto}>
                                    <TableCell>{i.nombreImpuesto}</TableCell>
                                    <TableCell align="right">{formatGs(i.comprado)}</TableCell>
                                    <TableCell align="right">{formatGs(i.acreditado)}</TableCell>
                                    <TableCell align="right">{formatGs(i.disponible)}</TableCell>
                                    <TableCell align="right" sx={{ color: i.cargado > i.disponible ? 'error.main' : undefined, fontWeight: 600 }}>
                                        {formatGs(i.cargado)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', flexGrow: 1 }}>
                            Conceptos
                        </Typography>
                        <Button size="small" startIcon={<AddIcon />} disabled={!habilitada || impuestos.length === 0}
                            onClick={() => setLineas((prev) => [...prev, lineaVacia(prev[prev.length - 1]?.idImpuesto ?? impuestos[0].idImpuesto)])}>
                            Agregar concepto
                        </Button>
                    </Stack>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Concepto</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} width={200}>Tasa de IVA</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} width={180} align="right">Monto (IVA incluido)</TableCell>
                                    <TableCell width={50} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lineas.map((l) => (
                                    <TableRow key={l.clave}>
                                        <TableCell>
                                            <UppercaseTextField
                                                size="small"
                                                fullWidth
                                                placeholder="Ej: DESCUENTO POR VOLUMEN"
                                                value={l.concepto}
                                                onChange={(e) => cambiar(l.clave, 'concepto', e.target.value.slice(0, 100))}
                                                disabled={!habilitada}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormControl fullWidth size="small">
                                                <Select value={l.idImpuesto} onChange={(e) => cambiar(l.clave, 'idImpuesto', Number(e.target.value))} disabled={!habilitada}>
                                                    {impuestos.map((i) => (
                                                        <MenuItem key={i.idImpuesto} value={i.idImpuesto}>{i.nombreImpuesto}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                value={l.monto ? formatGs(parseGs(l.monto)) : ''}
                                                onChange={(e) => cambiar(l.clave, 'monto', e.target.value.replace(/\D/g, ''))}
                                                disabled={!habilitada}
                                                inputProps={{ inputMode: 'numeric', style: { textAlign: 'right' } }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Quitar">
                                                <span>
                                                    <IconButton size="small" color="error" disabled={!habilitada || lineas.length === 1}
                                                        onClick={() => setLineas((prev) => prev.filter((x) => x.clave !== l.clave))}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }} alignItems={{ md: 'flex-start' }}>
                        <UppercaseTextField
                            label="Motivo de la nota de crédito"
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
