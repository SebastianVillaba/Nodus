import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
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
import { notaCreditoProveedorService } from '../../services/notaCreditoProveedor.service';
import type { CompraListado, FiltroCompras } from '../../services/compras.service';
import { getErrorMessage } from '../../services/httpError';

type Criterio = 'factura' | 'proveedor' | 'id';

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (compra: CompraListado) => void;
}

const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);
const soloDigitos = (texto: string, largo: number) => texto.replace(/\D/g, '').slice(0, largo);

/**
 * Búsqueda de la compra fiscal sobre la que el proveedor emitió la nota de crédito:
 * por número de factura del proveedor, por proveedor (nombre o RUC) o por id de compra.
 */
export default function BuscarCompraModal({ open, onClose, onSelect }: Props) {
    const [criterio, setCriterio] = useState<Criterio>('factura');
    const [dsuc, setDsuc] = useState('1');
    const [dcaja, setDcaja] = useState('1');
    const [dfactu, setDfactu] = useState('');
    const [proveedor, setProveedor] = useState('');
    const [idCompra, setIdCompra] = useState('');
    const [compras, setCompras] = useState<CompraListado[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [buscado, setBuscado] = useState(false);
    const [error, setError] = useState('');
    const dsucRef = useRef<HTMLInputElement>(null);
    const dcajaRef = useRef<HTMLInputElement>(null);
    const dfactuRef = useRef<HTMLInputElement>(null);
    const proveedorRef = useRef<HTMLInputElement>(null);
    const idCompraRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setCompras([]);
        setBuscado(false);
        setError('');
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const ref = criterio === 'factura' ? dsucRef : criterio === 'proveedor' ? proveedorRef : idCompraRef;
        setTimeout(() => ref.current?.focus(), 100);
    }, [open, criterio]);

    const buscar = async () => {
        setError('');
        const filtro: FiltroCompras = {};
        if (criterio === 'factura') {
            if (!Number(dfactu)) {
                setError('Ingrese el número de factura.');
                return;
            }
            filtro.dsuc = Number(dsuc) || undefined;
            filtro.dcaja = Number(dcaja) || undefined;
            filtro.dfactu = Number(dfactu);
        } else if (criterio === 'proveedor') {
            if (proveedor.trim().length < 2) {
                setError('Ingrese al menos 2 letras del nombre o el RUC del proveedor.');
                return;
            }
            filtro.proveedor = proveedor.trim();
        } else {
            if (!Number(idCompra)) {
                setError('Ingrese el id de la compra.');
                return;
            }
            filtro.idCompra = Number(idCompra);
        }

        setBuscando(true);
        try {
            const resultado = await notaCreditoProveedorService.buscarCompras(filtro);
            setCompras(resultado);
            setBuscado(true);
            if (resultado.length === 1 && resultado[0].activo) onSelect(resultado[0]);
        } catch (err) {
            setError(getErrorMessage(err, 'Error al buscar las compras'));
        } finally {
            setBuscando(false);
        }
    };

    const alEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') buscar();
    };

    const alEnterIrA = (e: React.KeyboardEvent, siguiente: React.RefObject<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        siguiente.current?.focus();
    };

    const seleccionarTodo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Buscar compra</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <RadioGroup row value={criterio} onChange={(e) => { setCriterio(e.target.value as Criterio); setError(''); }}>
                        <FormControlLabel value="factura" control={<Radio size="small" />} label="Nro. de factura" />
                        <FormControlLabel value="proveedor" control={<Radio size="small" />} label="RUC o nombre del proveedor" />
                        <FormControlLabel value="id" control={<Radio size="small" />} label="Id de compra" />
                    </RadioGroup>

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
                        {criterio === 'proveedor' && (
                            <UppercaseTextField size="small" fullWidth label="RUC o nombre del proveedor" value={proveedor}
                                onChange={(e) => setProveedor(e.target.value.slice(0, 60))} onKeyDown={alEnter} inputRef={proveedorRef} />
                        )}
                        {criterio === 'id' && (
                            <TextField size="small" label="Id de compra" value={idCompra} onChange={(e) => setIdCompra(soloDigitos(e.target.value, 9))}
                                onKeyDown={alEnter} sx={{ width: 200 }} inputRef={idCompraRef} inputProps={{ inputMode: 'numeric' }} />
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
                                    <TableCell sx={{ fontWeight: 700 }}>Proveedor</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>RUC</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }} align="center">Estado</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {compras.map((c) => (
                                    <TableRow
                                        key={c.idCompra}
                                        hover={c.activo}
                                        onClick={() => c.activo && onSelect(c)}
                                        sx={{ cursor: c.activo ? 'pointer' : 'not-allowed', opacity: c.activo ? 1 : 0.5 }}
                                    >
                                        <TableCell>{c.idCompra}</TableCell>
                                        <TableCell>{c.nroFactura}</TableCell>
                                        <TableCell>{new Date(c.fecha).toLocaleDateString('es-PY', { timeZone: 'UTC' })}</TableCell>
                                        <TableCell>{c.proveedor}</TableCell>
                                        <TableCell>{c.ruc}</TableCell>
                                        <TableCell align="right">{formatGs(c.total)}</TableCell>
                                        <TableCell align="center">
                                            <Chip size="small" variant="outlined" label={c.activo ? 'ACTIVA' : 'ANULADA'} color={c.activo ? 'success' : 'error'} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {compras.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                            <Typography variant="body2" color="text.disabled">
                                                {buscando ? 'Buscando...' : buscado ? 'No se encontraron compras.' : 'Ingrese un criterio y presione Buscar'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            Solo se listan compras fiscales: las no fiscales no admiten notas de crédito.
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}
