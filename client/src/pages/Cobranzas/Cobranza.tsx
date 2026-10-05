import { useCallback, useMemo, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Alert,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Stack,
    IconButton,
    Tooltip,
    CircularProgress,
} from '@mui/material';
import TextField from '../../components/UppercaseTextField';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PaymentsIcon from '@mui/icons-material/Payments';
import PrintIcon from '@mui/icons-material/Print';
import BlockIcon from '@mui/icons-material/Block';
import SearchClienteModal from '../../components/SearchClienteModal';
import AnulacionModal from '../../components/AnulacionModal';
import RequirePermission from '../../components/RequirePermission';
import { useTerminal } from '../../hooks/useTerminal';
import { consultarCreditoCliente } from '../../services/persona.service';
import type { CreditoCliente } from '../../services/persona.service';
import { cobroCreditoService, distribuirMonto } from '../../services/cobroCredito.service';
import type { CuotaPendiente, ReciboCobro } from '../../services/cobroCredito.service';
import { ticketService } from '../../services/ticket.service';
import { getErrorMessage } from '../../services/httpError';

const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);
const parseGs = (texto: string) => Number(texto.replace(/\D/g, '')) || 0;
const fecha = (valor: string) => new Date(valor).toLocaleDateString('es-PY', { timeZone: 'UTC' });

interface ClienteSeleccionado {
    idCliente: number;
    nombre: string;
    ruc: string;
}

/**
 * Cobro de créditos: el cajero elige el cliente, ingresa el monto recibido y el sistema lo reparte
 * entre las cuotas más antiguas; se puede ajustar cuota por cuota antes de registrar el recibo.
 */
export default function Cobranza() {
    const { idTerminalWeb } = useTerminal();
    const [openClienteModal, setOpenClienteModal] = useState(false);
    const [cliente, setCliente] = useState<ClienteSeleccionado | null>(null);
    const [credito, setCredito] = useState<CreditoCliente | null>(null);
    const [cuotas, setCuotas] = useState<CuotaPendiente[]>([]);
    const [recibos, setRecibos] = useState<ReciboCobro[]>([]);
    const [aCobrar, setACobrar] = useState<Record<number, number>>({});
    const [montoRecibido, setMontoRecibido] = useState('');
    const [observacion, setObservacion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [anulando, setAnulando] = useState<ReciboCobro | null>(null);

    const totalACobrar = useMemo(() => Object.values(aCobrar).reduce((sum, m) => sum + m, 0), [aCobrar]);

    const cargarCliente = useCallback(async (idCliente: number) => {
        setLoading(true);
        try {
            const [creditoData, cuotasData, recibosData] = await Promise.all([
                consultarCreditoCliente(idCliente),
                cobroCreditoService.cuotasPendientes(idCliente),
                cobroCreditoService.listar({ idCliente }),
            ]);
            setCredito(creditoData);
            setCuotas(cuotasData);
            setRecibos(recibosData);
            setACobrar({});
            setMontoRecibido('');
            setObservacion('');
        } catch (err) {
            setError(getErrorMessage(err, 'Error al cargar los datos del cliente'));
        } finally {
            setLoading(false);
        }
    }, []);

    const handleClienteSelected = (clienteData: any) => {
        setError('');
        setSuccess('');
        const seleccionado = {
            idCliente: clienteData.idCliente,
            nombre: clienteData.nombreCliente,
            ruc: [clienteData.ruc, clienteData.dv].filter(Boolean).join('-'),
        };
        setCliente(seleccionado);
        cargarCliente(seleccionado.idCliente);
    };

    const handleDistribuir = () => {
        const monto = parseGs(montoRecibido);
        const totalDeuda = cuotas.reduce((sum, c) => sum + c.saldo, 0);
        if (monto <= 0) {
            setError('Ingrese el monto recibido.');
            return;
        }
        setError(monto > totalDeuda ? `El monto supera la deuda total (Gs. ${formatGs(totalDeuda)}); se aplica hasta cubrirla.` : '');
        setACobrar(distribuirMonto(cuotas, monto));
    };

    const handleMontoCuota = (cuota: CuotaPendiente, texto: string) => {
        const monto = Math.min(parseGs(texto), cuota.saldo);
        setACobrar((prev) => {
            const nuevo = { ...prev };
            if (monto > 0) nuevo[cuota.idCuotaVenta] = monto;
            else delete nuevo[cuota.idCuotaVenta];
            return nuevo;
        });
    };

    const imprimirRecibo = async (idCobroCredito: number) => {
        const datos = await cobroCreditoService.recibo(idCobroCredito);
        await ticketService.generarTicketReciboCobro(datos);
    };

    const handleRegistrar = async () => {
        if (!cliente || !idTerminalWeb) return;
        const detalle = Object.entries(aCobrar).map(([idCuotaVenta, monto]) => ({ idCuotaVenta: Number(idCuotaVenta), monto }));
        if (detalle.length === 0) {
            setError('Indique cuánto se cobra de cada cuota (o use "Distribuir").');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const resultado = await cobroCreditoService.guardar({ idCliente: cliente.idCliente, idTerminalWeb, observacion, detalle });
            setSuccess(`Recibo Nº ${resultado.nroRecibo} registrado por Gs. ${formatGs(resultado.totalCobrado)}`);
            await cargarCliente(cliente.idCliente);
            try {
                await imprimirRecibo(resultado.idCobroCredito);
            } catch (err) {
                setError(getErrorMessage(err, 'El cobro se registró pero no se pudo imprimir el recibo'));
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Error al registrar el cobro'));
        } finally {
            setLoading(false);
        }
    };

    const handleAnulacionSuccess = async () => {
        if (!anulando || !cliente) return;
        setSuccess(`Recibo Nº ${anulando.nroRecibo} anulado`);
        setAnulando(null);
        await cargarCliente(cliente.idCliente);
    };

    return (
        <RequirePermission permission="ACCESO_COBRANZAS">
            <Box sx={{ p: 2 }}>
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                    Cobro de Créditos
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

                {/* Cliente y situación de crédito */}
                <Paper sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Button variant="contained" startIcon={<PersonSearchIcon />} onClick={() => setOpenClienteModal(true)}>
                                    Cliente
                                </Button>
                                <Box>
                                    <Typography fontWeight="bold">{cliente?.nombre || 'Seleccione un cliente'}</Typography>
                                    {cliente && <Typography variant="body2" color="text.secondary">RUC/CI: {cliente.ruc}</Typography>}
                                </Box>
                            </Stack>
                        </Grid>
                        {credito && (
                            <Grid size={{ xs: 12, md: 7 }}>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip label={`Deuda: Gs. ${formatGs(credito.deuda)}`} color="primary" />
                                    <Chip label={`Límite: Gs. ${formatGs(credito.limiteCredito)}`} variant="outlined" />
                                    <Chip label={`Disponible: Gs. ${formatGs(credito.disponible)}`} variant="outlined" />
                                    {credito.montoVencido > 0 && (
                                        <Chip label={`Vencido: Gs. ${formatGs(credito.montoVencido)} (${credito.cuotasVencidas} cuota/s)`} color="error" />
                                    )}
                                </Stack>
                            </Grid>
                        )}
                    </Grid>
                </Paper>

                {cliente && (
                    <>
                        {/* Cuotas pendientes */}
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                                <TextField
                                    label="Monto recibido (Gs.)"
                                    size="small"
                                    value={montoRecibido}
                                    onChange={(e) => setMontoRecibido(parseGs(e.target.value) ? formatGs(parseGs(e.target.value)) : '')}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDistribuir()}
                                    inputProps={{ inputMode: 'numeric' }}
                                />
                                <Button variant="outlined" onClick={handleDistribuir} disabled={cuotas.length === 0}>
                                    Distribuir (más antiguas primero)
                                </Button>
                                <Button variant="text" onClick={() => setACobrar({})} disabled={totalACobrar === 0}>
                                    Limpiar
                                </Button>
                            </Stack>

                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Factura</TableCell>
                                            <TableCell>Cuota</TableCell>
                                            <TableCell>Vencimiento</TableCell>
                                            <TableCell align="right">Monto cuota</TableCell>
                                            <TableCell align="right">Saldo</TableCell>
                                            <TableCell align="right" sx={{ width: 180 }}>A cobrar</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {cuotas.map((c) => (
                                            <TableRow key={c.idCuotaVenta} selected={!!aCobrar[c.idCuotaVenta]}>
                                                <TableCell>{c.nroFactura}</TableCell>
                                                <TableCell>{c.nroCuota}/{c.cantidadCuotas}</TableCell>
                                                <TableCell>
                                                    {fecha(c.fechaVencimiento)}
                                                    {c.diasAtraso > 0 && <Chip size="small" color="error" label={`${c.diasAtraso} días de atraso`} sx={{ ml: 1 }} />}
                                                </TableCell>
                                                <TableCell align="right">{formatGs(c.monto)}</TableCell>
                                                <TableCell align="right">{formatGs(c.saldo)}</TableCell>
                                                <TableCell align="right">
                                                    <TextField
                                                        size="small"
                                                        value={aCobrar[c.idCuotaVenta] ? formatGs(aCobrar[c.idCuotaVenta]) : ''}
                                                        onChange={(e) => handleMontoCuota(c, e.target.value)}
                                                        placeholder="0"
                                                        inputProps={{ inputMode: 'numeric', style: { textAlign: 'right' } }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {!loading && cuotas.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6}>
                                                    <Typography color="text.secondary">El cliente no tiene cuotas pendientes.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mt: 2 }}>
                                <TextField
                                    label="Observación"
                                    size="small"
                                    value={observacion}
                                    onChange={(e) => setObservacion(e.target.value)}
                                    sx={{ flexGrow: 1, maxWidth: 480 }}
                                    inputProps={{ maxLength: 200 }}
                                />
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Typography variant="h6">Total: Gs. {formatGs(totalACobrar)}</Typography>
                                    <Button
                                        variant="contained"
                                        color="success"
                                        size="large"
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PaymentsIcon />}
                                        onClick={handleRegistrar}
                                        disabled={loading || totalACobrar === 0}
                                    >
                                        Registrar cobro
                                    </Button>
                                </Stack>
                            </Stack>
                        </Paper>

                        {/* Recibos del cliente */}
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                Recibos del cliente
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Recibo</TableCell>
                                        <TableCell>Fecha</TableCell>
                                        <TableCell>Cajero</TableCell>
                                        <TableCell align="right">Monto</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell align="right" />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {recibos.map((r) => (
                                        <TableRow key={r.idCobroCredito}>
                                            <TableCell>{r.nroRecibo}</TableCell>
                                            <TableCell>{new Date(r.fechaCobro).toLocaleString('es-PY')}</TableCell>
                                            <TableCell>{r.usuario}</TableCell>
                                            <TableCell align="right">{formatGs(r.totalCobrado)}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={r.activo ? 'Vigente' : 'Anulado'} color={r.activo ? 'success' : 'default'} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Reimprimir">
                                                    <IconButton size="small" onClick={() => imprimirRecibo(r.idCobroCredito).catch((err) => setError(getErrorMessage(err)))}>
                                                        <PrintIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {r.activo && (
                                                    <Tooltip title="Anular (requiere usuario autorizador)">
                                                        <IconButton size="small" color="error" onClick={() => setAnulando(r)}>
                                                            <BlockIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {recibos.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6}>
                                                <Typography color="text.secondary">Sin recibos.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </Paper>
                    </>
                )}

                <SearchClienteModal
                    open={openClienteModal}
                    onClose={() => setOpenClienteModal(false)}
                    onClienteSelected={handleClienteSelected}
                />

                <AnulacionModal
                    open={!!anulando}
                    onClose={() => setAnulando(null)}
                    tipoMovimiento="COBRO"
                    idCobroCredito={anulando?.idCobroCredito}
                    onSuccess={handleAnulacionSuccess}
                />
            </Box>
        </RequirePermission>
    );
}
