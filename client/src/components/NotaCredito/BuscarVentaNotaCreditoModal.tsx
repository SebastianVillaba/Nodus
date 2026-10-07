import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Radio,
    RadioGroup,
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
import SearchIcon from '@mui/icons-material/Search';
import UppercaseTextField from '../UppercaseTextField';
import { notaCreditoService } from '../../services/notaCredito.service';
import type { FiltroVentaNotaCredito, VentaParaNotaCredito } from '../../services/notaCredito.service';
import { getErrorMessage } from '../../services/httpError';

type Criterio = 'factura' | 'cliente' | 'id';

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (venta: VentaParaNotaCredito) => void;
    /** Si se muestra el check Imp/NoImp (las notas por monto solo van sobre facturas) */
    permitirNoImp?: boolean;
}

const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);
const soloDigitos = (texto: string, largo: number) => texto.replace(/\D/g, '').slice(0, largo);

/**
 * Búsqueda de la venta a la que se le emite la nota de crédito: impresa (factura) o no impresa,
 * por número de factura (establecimiento, punto de expedición y número), por cliente (nombre o RUC) o por id de venta.
 */
export default function BuscarVentaNotaCreditoModal({ open, onClose, onSelect, permitirNoImp = true }: Props) {
    const [impresa, setImpresa] = useState(true);
    const [criterio, setCriterio] = useState<Criterio>('factura');
    const [dsuc, setDsuc] = useState('1');
    const [dcaja, setDcaja] = useState('1');
    const [dfactu, setDfactu] = useState('');
    const [cliente, setCliente] = useState('');
    const [idVenta, setIdVenta] = useState('');
    const [ventas, setVentas] = useState<VentaParaNotaCredito[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [buscado, setBuscado] = useState(false);
    const [error, setError] = useState('');
    const dsucRef = useRef<HTMLInputElement>(null);
    const dcajaRef = useRef<HTMLInputElement>(null);
    const dfactuRef = useRef<HTMLInputElement>(null);
    const clienteRef = useRef<HTMLInputElement>(null);
    const idVentaRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setVentas([]);
        setBuscado(false);
        setError('');
        if (!permitirNoImp) setImpresa(true);
    }, [open, permitirNoImp]);

    // Las ventas no impresas no tienen número de factura
    useEffect(() => {
        if (!impresa && criterio === 'factura') setCriterio('cliente');
    }, [impresa, criterio]);

    // Foco en el campo principal de cada criterio
    useEffect(() => {
        if (!open) return;
        const ref = criterio === 'factura' ? dsucRef : criterio === 'cliente' ? clienteRef : idVentaRef;
        setTimeout(() => ref.current?.focus(), 100);
    }, [open, criterio]);

    const buscar = async () => {
        setError('');
        const filtro: FiltroVentaNotaCredito = { noImp: !impresa };
        if (criterio === 'factura') {
            if (!Number(dfactu)) {
                setError('Ingrese el número de factura.');
                return;
            }
            filtro.dsuc = Number(dsuc) || undefined;
            filtro.dcaja = Number(dcaja) || undefined;
            filtro.dfactu = Number(dfactu);
        } else if (criterio === 'cliente') {
            if (cliente.trim().length < 2) {
                setError('Ingrese al menos 2 letras del nombre o el RUC del cliente.');
                return;
            }
            filtro.cliente = cliente.trim();
        } else {
            if (!Number(idVenta)) {
                setError('Ingrese el id de la venta.');
                return;
            }
            filtro.idVenta = Number(idVenta);
        }

        setBuscando(true);
        try {
            const resultado = await notaCreditoService.buscarVentas(filtro);
            setVentas(resultado);
            setBuscado(true);
            if (resultado.length === 1 && resultado[0].activo) onSelect(resultado[0]);
        } catch (err) {
            setError(getErrorMessage(err, 'Error al buscar las ventas'));
        } finally {
            setBuscando(false);
        }
    };

    const alEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') buscar();
    };

    // Enter en establecimiento / punto de expedición pasa al siguiente campo sin buscar
    const alEnterIrA = (e: React.KeyboardEvent, siguiente: React.RefObject<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        siguiente.current?.focus();
    };

    const seleccionarTodo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Buscar venta</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                        {permitirNoImp && (
                            <FormControlLabel
                                control={<Checkbox checked={impresa} onChange={(e) => { setImpresa(e.target.checked); setVentas([]); setBuscado(false); }} />}
                                label={impresa ? 'Imp (factura)' : 'NoImp (no impresa)'}
                            />
                        )}
                        <RadioGroup row value={criterio} onChange={(e) => { setCriterio(e.target.value as Criterio); setError(''); }}>
                            <FormControlLabel value="factura" control={<Radio size="small" />} label="Nro. de factura" disabled={!impresa} />
                            <FormControlLabel value="cliente" control={<Radio size="small" />} label="RUC o nombre del cliente" />
                            <FormControlLabel value="id" control={<Radio size="small" />} label="Id de venta" />
                        </RadioGroup>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                        {criterio === 'factura' && (
                            <>
                                <TextField size="small" label="Est." value={dsuc} onChange={(e) => setDsuc(soloDigitos(e.target.value, 3))}
                                    onKeyDown={(e) => alEnterIrA(e, dcajaRef)} onFocus={seleccionarTodo} sx={{ width: 80 }}
                                    inputRef={dsucRef} inputProps={{ inputMode: 'numeric' }} />
                                <Typography>-</Typography>
                                <TextField size="small" label="Pto." value={dcaja} onChange={(e) => setDcaja(soloDigitos(e.target.value, 3))}
                                    onKeyDown={(e) => alEnterIrA(e, dfactuRef)} onFocus={seleccionarTodo} sx={{ width: 80 }}
                                    inputRef={dcajaRef} inputProps={{ inputMode: 'numeric' }} />
                                <Typography>-</Typography>
                                <TextField size="small" label="Nro. factura" value={dfactu} onChange={(e) => setDfactu(soloDigitos(e.target.value, 7))}
                                    onKeyDown={alEnter} onFocus={seleccionarTodo} sx={{ width: 160 }} inputRef={dfactuRef} inputProps={{ inputMode: 'numeric' }} />
                            </>
                        )}
                        {criterio === 'cliente' && (
                            <UppercaseTextField size="small" fullWidth label="RUC o nombre del cliente" value={cliente}
                                onChange={(e) => setCliente(e.target.value.slice(0, 60))} onKeyDown={alEnter} inputRef={clienteRef} />
                        )}
                        {criterio === 'id' && (
                            <TextField size="small" label="Id de venta" value={idVenta} onChange={(e) => setIdVenta(soloDigitos(e.target.value, 9))}
                                onKeyDown={alEnter} sx={{ width: 200 }} inputRef={idVentaRef} inputProps={{ inputMode: 'numeric' }} />
                        )}
                        <Button variant="contained" startIcon={<SearchIcon />} onClick={buscar} disabled={buscando} sx={{ flexShrink: 0 }}>
                            Buscar
                        </Button>
                    </Stack>

                    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

                    <TableContainer sx={{ maxHeight: 340 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Id</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Factura</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>RUC</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Condición</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ventas.map((v) => (
                                    <TableRow
                                        key={`${v.noImp ? 'n' : 'i'}-${v.idVenta}`}
                                        hover={v.activo}
                                        onClick={() => v.activo && onSelect(v)}
                                        sx={{ cursor: v.activo ? 'pointer' : 'not-allowed', opacity: v.activo ? 1 : 0.5 }}
                                    >
                                        <TableCell>{v.idVenta}</TableCell>
                                        <TableCell>{v.nroFactura ?? 'No impresa'}</TableCell>
                                        <TableCell>{new Date(v.fechaAlta).toLocaleString('es-PY')}</TableCell>
                                        <TableCell>{v.cliente}</TableCell>
                                        <TableCell>{v.ruc}</TableCell>
                                        <TableCell>{v.condicionVenta}</TableCell>
                                        <TableCell align="right">{formatGs(v.totalVenta)}</TableCell>
                                        <TableCell align="center">
                                            <Chip size="small" variant="outlined" label={v.activo ? 'ACTIVA' : 'ANULADA'} color={v.activo ? 'success' : 'error'} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {ventas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                            <Typography variant="body2" color="text.disabled">
                                                {buscando ? 'Buscando...' : buscado ? 'No se encontraron ventas.' : 'Ingrese un criterio y presione Buscar'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {ventas.length >= 100 && (
                        <Box><Typography variant="caption" color="text.secondary">Se muestran las 100 ventas más recientes: afine la búsqueda.</Typography></Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}
