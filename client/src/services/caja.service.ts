import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ArqueoCajaTmpItem {
    idArqueoTmp: number;
    idDenominacion: number;
    nombreBillete: string;
    valor: number;
    cantidad: number;
    subtotal: number;
}

export interface ListarArqueoResponse {
    success: boolean;
    result: ArqueoCajaTmpItem[];
    totalArqueo?: number;
}

export interface GastoCajaTmpItem {
    idGastoCajaTmp: number;
    concepto: string;
    montoGasto: number;
}

export interface ListarGastoCajaTmpResponse {
    success: boolean;
    result: GastoCajaTmpItem[];
    totalGastos?: number;
}

/**
 * Denominaciones de billetes en Guaraníes
 * Los IDs corresponden a la base de datos
 */
export const DENOMINACIONES = [
    { id: 1, nombre: 'Billete 100.000', valor: 100000 },
    { id: 2, nombre: 'Billete 50.000', valor: 50000 },
    { id: 3, nombre: 'Billete 20.000', valor: 20000 },
    { id: 4, nombre: 'Billete 10.000', valor: 10000 },
    { id: 5, nombre: 'Billete 5.000', valor: 5000 },
    { id: 6, nombre: 'Billete 2.000', valor: 2000 },
];

export const cajaService = {
    /**
     * Agrega una denominación al arqueo temporal
     */
    agregarArqueoCajaTmp: async (
        idTerminalWeb: number,
        idDenominacion: number,
        cantidad: number
    ): Promise<{ success: boolean; message: string }> => {
        const response = await axios.post(`${API_URL}/caja/agregarArqueoCajaTmp`, {
            idTerminalWeb,
            idDenominacion,
            cantidad,
        });
        return response.data;
    },

    /**
     * Lista los items del arqueo temporal y el total
     */
    listarArqueoCajaTmp: async (idTerminalWeb: number): Promise<ListarArqueoResponse> => {
        const response = await axios.get(`${API_URL}/caja/listarArqueoCajaTmp`, {
            params: { idTerminalWeb },
        });

        // El SP devuelve dos recordsets: items y totalArqueo
        const data = response.data;

        // Si el backend devuelve el totalArqueo separado, lo extraemos
        let totalArqueo = 0;
        if (data.result && data.result.length > 0) {
            // Calcular el total sumando los subtotales
            totalArqueo = data.result.reduce((sum: number, item: ArqueoCajaTmpItem) =>
                sum + (item.subtotal || 0), 0
            );
        }

        return {
            success: data.success,
            result: data.result || [],
            totalArqueo,
        };
    },

    /**
     * Abre una caja con el monto del arqueo
     */
    abrirCaja: async (
        idUsuario: number,
        idTerminalWeb: number
    ): Promise<{ success: boolean; idMovimientoCaja?: number; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/abrir`, {
            idUsuario,
            idTerminalWeb
        });
        return response.data;
    },

    /**
     * Cierra una caja con el monto del arqueo
     */
    cerrarCaja: async (
        idUsuarioCierre: number,
        idTerminalWeb: number
    ): Promise<{ success: boolean; message?: string; idMovimientoCaja?: number }> => {
        const response = await axios.post(`${API_URL}/caja/cerrar`, {
            idUsuarioCierre,
            idTerminalWeb,
        });
        return response.data;
    },

    /**
     * Elimina una denominación del arqueo temporal
     */
    eliminarArqueoCajaTmp: async (
        idTerminalWeb: number,
        idArqueoTmp: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarArqueoCajaTmp`, {
            params: { idTerminalWeb, idArqueoTmp }
        });
        return response.data;
    },

    /**
     * Agrega un gasto a la caja
     */
    agregarGastoCaja: async (
        idTerminalWeb: number,
        idMovimientoCaja: number,
        concepto: string,
        montoGasto: number,
        factura: number,
        idGastoCajaTmp: number | null = null
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/gasto`, {
            idGastoCajaTmp,
            idTerminalWeb,
            idMovimientoCaja,
            concepto,
            montoGasto,
            factura
        });
        return response.data;
    },

    /**
     * Lista los gastos temporales de la caja
     */
    listarGastoCajaTmp: async (
        idTerminalWeb: number
    ): Promise<ListarGastoCajaTmpResponse> => {
        const response: ListarGastoCajaTmpResponse = await axios.get(`${API_URL}/caja/gasto`, {
            params: { idTerminalWeb },
        });

        console.log(response.data);


        return response.data;
    },

    /**
     * Elimina un gasto temporal de la caja
     */
    eliminarGastoCajaTmp: async (
        idGastoCajaTmp: number,
        idTerminalWeb: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarGastoCajaTmp`, {
            params: { idGastoCajaTmp, idTerminalWeb }
        });
        return response.data;
    },

    /**
     * Lista las tarjetas disponibles para el selector
     */
    listarTarjetas: async (): Promise<{ success: boolean; result: any[] }> => {
        const response = await axios.get(`${API_URL}/caja/tarjetas`);
        return response.data;
    },

    /**
     * Lista las monedas activas para el selector
     */
    listarMonedas: async (): Promise<{ success: boolean; result: any[] }> => {
        const response = await axios.get(`${API_URL}/caja/monedas`);
        return response.data;
    },

    /**
     * Agrega un detalle de tarjeta de crédito al arqueo temporal
     */
    agregarDetArqueoTarjetaCreditoTmp: async (
        idTerminalWeb: number,
        idTarjetaDebito: number,
        monto: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/agregarDetArqueoTarjetaCreditoTmp`, {
            idTerminalWeb,
            idTarjetaDebito,
            monto
        });
        return response.data;
    },

    /**
     * Lista los detalles de tarjeta de crédito temporal y su total
     */
    listarDetArqueoTarjetaCreditoTmp: async (
        idTerminalWeb: number
    ): Promise<{ success: boolean; result: any[]; totalArqueo: number }> => {
        const response = await axios.get(`${API_URL}/caja/listarDetArqueoTarjetaCreditoTmp`, {
            params: { idTerminalWeb }
        });
        return response.data;
    },

    /**
     * Elimina un detalle de tarjeta de crédito temporal
     */
    eliminarDetArqueoTarjetaCreditoTmp: async (
        idTerminalWeb: number,
        idTarjetaDebito: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarDetArqueoTarjetaCreditoTmp`, {
            params: { idTerminalWeb, idTarjetaDebito }
        });
        return response.data;
    },

    /**
     * Agrega un detalle de tarjeta de débito al arqueo temporal
     */
    agregarDetArqueoTarjetaDebitoTmp: async (
        idTerminalWeb: number,
        idTarjetaDebito: number,
        monto: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/agregarDetArqueoTarjetaDebitoTmp`, {
            idTerminalWeb,
            idTarjetaDebito,
            monto
        });
        return response.data;
    },

    /**
     * Lista los detalles de tarjeta de débito temporal y su total
     */
    listarDetArqueoTarjetaDebitoTmp: async (
        idTerminalWeb: number
    ): Promise<{ success: boolean; result: any[]; totalArqueo: number }> => {
        const response = await axios.get(`${API_URL}/caja/listarDetArqueoTarjetaDebitoTmp`, {
            params: { idTerminalWeb }
        });
        return response.data;
    },

    /**
     * Elimina un detalle de tarjeta de débito temporal
     */
    eliminarDetArqueoTarjetaDebitoTmp: async (
        idTerminalWeb: number,
        idTarjetaDebito: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarDetArqueoTarjetaDebitoTmp`, {
            params: { idTerminalWeb, idTarjetaDebito }
        });
        return response.data;
    },

    /**
     * Agrega un detalle de transferencia al arqueo temporal
     */
    agregarDetArqueoTransferenciaTmp: async (
        idTerminalWeb: number,
        concepto: string,
        monto: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/agregarDetArqueoTransferenciaTmp`, {
            idTerminalWeb,
            concepto,
            monto
        });
        return response.data;
    },

    /**
     * Lista los detalles de transferencia temporal y su total
     */
    listarDetArqueoTransferenciaTmp: async (
        idTerminalWeb: number
    ): Promise<{ success: boolean; result: any[]; totalArqueo: number }> => {
        const response = await axios.get(`${API_URL}/caja/listarDetArqueoTransferenciaTmp`, {
            params: { idTerminalWeb }
        });
        return response.data;
    },

    /**
     * Elimina un detalle de transferencia temporal
     */
    eliminarDetArqueoTransferenciaTmp: async (
        idTerminalWeb: number,
        concepto: string
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarDetArqueoTransferenciaTmp`, {
            params: { idTerminalWeb, concepto }
        });
        return response.data;
    },

    /**
     * Agrega un detalle de moneda extranjera al arqueo temporal
     */
    agregarDetArqueoMonedaTmp: async (
        idTerminalWeb: number,
        idMoneda: number,
        montoMoneda: number,
        total: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.post(`${API_URL}/caja/agregarDetArqueoMonedaTmp`, {
            idTerminalWeb,
            idMoneda,
            montoMoneda,
            total
        });
        return response.data;
    },

    /**
     * Lista los detalles de moneda extranjera temporal y su total
     */
    listarDetArqueoMonedaTmp: async (
        idTerminalWeb: number
    ): Promise<{ success: boolean; result: any[]; totalArqueo: number }> => {
        const response = await axios.get(`${API_URL}/caja/listarDetArqueoMonedaTmp`, {
            params: { idTerminalWeb }
        });
        return response.data;
    },

    /**
     * Elimina un detalle de moneda temporal
     */
    eliminarDetArqueoMonedaTmp: async (
        idTerminalWeb: number,
        idMoneda: number
    ): Promise<{ success: boolean; message?: string }> => {
        const response = await axios.delete(`${API_URL}/caja/eliminarDetArqueoMonedaTmp`, {
            params: { idTerminalWeb, idMoneda }
        });
        return response.data;
    },

    /**
     * Ventas a crédito y cobros de créditos de la caja abierta de la terminal.
     * Las ventas a crédito son informativas; los cobros suman a lo esperado por el sistema.
     */
    resumenCreditoCaja: async (idTerminalWeb: number): Promise<ResumenCreditoCaja> => {
        const response = await axios.get(`${API_URL}/caja/resumen-credito`, { params: { idTerminalWeb } });
        return { ventasCredito: response.data.ventasCredito, cobros: response.data.cobros };
    },
};

export interface ResumenCreditoCaja {
    ventasCredito: { idVenta: number; nroFactura: string; cliente: string; fechaAlta: string; totalVenta: number }[];
    cobros: { idCobroCredito: number; nroRecibo: number; cliente: string; fechaCobro: string; totalCobrado: number }[];
}

export default cajaService;

