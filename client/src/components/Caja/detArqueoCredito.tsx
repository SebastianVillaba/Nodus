import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { cajaService } from '../../services/caja.service';
import type { ResumenCreditoCaja } from '../../services/caja.service';
import { getErrorMessage } from '../../services/httpError';

interface DetArqueoCreditoProps {
    idTerminalWeb: number;
    // Ventas a crédito: solo informativas (no entra dinero, no suman al arqueo)
    onTotalVentasCreditoChange?: (total: number) => void;
    // Cobros de créditos del turno: el dinero está en el cajón; el sistema los suma a lo esperado
    onTotalCobrosChange?: (total: number) => void;
    // Devoluciones de ventas al contado: el dinero ya salió del cajón (se restan de lo esperado)
    onTotalDevolucionesChange?: (total: number) => void;
}

const formatGs = (valor: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(valor || 0);

/**
 * Ventas a crédito (informativas), cobros de créditos (dinero que entró) y devoluciones (dinero que salió)
 * de la caja abierta. Solo lectura.
 */
const DetArqueoCredito: React.FC<DetArqueoCreditoProps> = ({ idTerminalWeb, onTotalVentasCreditoChange, onTotalCobrosChange, onTotalDevolucionesChange }) => {
    const [resumen, setResumen] = useState<ResumenCreditoCaja>({ ventasCredito: [], cobros: [], devoluciones: [] });
    const [error, setError] = useState('');

    const cargar = useCallback(async () => {
        if (!idTerminalWeb) return;
        try {
            setError('');
            const datos = await cajaService.resumenCreditoCaja(idTerminalWeb);
            setResumen(datos);
            onTotalVentasCreditoChange?.(datos.ventasCredito.reduce((sum, v) => sum + v.totalVenta, 0));
            onTotalCobrosChange?.(datos.cobros.reduce((sum, c) => sum + c.totalCobrado, 0));
            onTotalDevolucionesChange?.(datos.devoluciones.reduce((sum, d) => sum + d.montoDevueltoCaja, 0));
        } catch (err) {
            setError(getErrorMessage(err, 'Error al cargar las ventas a crédito'));
        }
    }, [idTerminalWeb, onTotalVentasCreditoChange, onTotalCobrosChange, onTotalDevolucionesChange]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const totalVentas = resumen.ventasCredito.reduce((sum, v) => sum + v.totalVenta, 0);
    const totalCobros = resumen.cobros.reduce((sum, c) => sum + c.totalCobrado, 0);
    const totalDevoluciones = resumen.devoluciones.reduce((sum, d) => sum + d.montoDevueltoCaja, 0);

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight="bold">
                    Ventas a crédito
                </Typography>
                <Tooltip title="Actualizar">
                    <IconButton size="small" onClick={cargar}><RefreshIcon fontSize="small" /></IconButton>
                </Tooltip>
            </Box>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Factura</TableCell>
                        <TableCell>Cliente</TableCell>
                        <TableCell align="right">Monto</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {resumen.ventasCredito.map((v) => (
                        <TableRow key={v.idVenta}>
                            <TableCell>{v.nroFactura}</TableCell>
                            <TableCell>{v.cliente}</TableCell>
                            <TableCell align="right">{formatGs(v.totalVenta)}</TableCell>
                        </TableRow>
                    ))}
                    {resumen.ventasCredito.length === 0 && (
                        <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">Sin ventas a crédito</Typography></TableCell></TableRow>
                    )}
                    <TableRow>
                        <TableCell colSpan={2}><strong>Total crédito</strong></TableCell>
                        <TableCell align="right"><strong>{formatGs(totalVentas)}</strong></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2 }}>
                Cobros de créditos
            </Typography>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Recibo</TableCell>
                        <TableCell>Cliente</TableCell>
                        <TableCell align="right">Monto</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {resumen.cobros.map((c) => (
                        <TableRow key={c.idCobroCredito}>
                            <TableCell>{c.nroRecibo}</TableCell>
                            <TableCell>{c.cliente}</TableCell>
                            <TableCell align="right">{formatGs(c.totalCobrado)}</TableCell>
                        </TableRow>
                    ))}
                    {resumen.cobros.length === 0 && (
                        <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">Sin cobros</Typography></TableCell></TableRow>
                    )}
                    <TableRow>
                        <TableCell colSpan={2}><strong>Total cobros</strong></TableCell>
                        <TableCell align="right"><strong>{formatGs(totalCobros)}</strong></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2 }}>
                Devoluciones
            </Typography>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Nota</TableCell>
                        <TableCell>Cliente</TableCell>
                        <TableCell align="right">Monto</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {resumen.devoluciones.map((d) => (
                        <TableRow key={d.idNotaCredito}>
                            <TableCell>{d.nroNotaCredito}</TableCell>
                            <TableCell>{d.cliente}</TableCell>
                            <TableCell align="right">{formatGs(d.montoDevueltoCaja)}</TableCell>
                        </TableRow>
                    ))}
                    {resumen.devoluciones.length === 0 && (
                        <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">Sin devoluciones</Typography></TableCell></TableRow>
                    )}
                    <TableRow>
                        <TableCell colSpan={2}><strong>Total devoluciones</strong></TableCell>
                        <TableCell align="right"><strong>{formatGs(totalDevoluciones)}</strong></TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </Box>
    );
};

export default DetArqueoCredito;
