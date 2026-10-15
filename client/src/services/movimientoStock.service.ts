import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/seguimiento-stock`;

export interface ProductoSeguimiento {
    idProducto: number;
    codigo: number;
    codigoBarra: string | null;
    nombre: string;
    activo: boolean;
    stock: number | null;
}

export interface DepositoSeguimiento {
    idDeposito: number;
    nombreDeposito: string;
}

export interface SaldoDeposito {
    idDeposito: number;
    deposito: string;
    saldo: number;
    /** Solo en el saldo final: lo que hay hoy en la tabla stock */
    stockActual?: number | null;
}

export interface MovimientoStock {
    idMovimientoStock: number;
    fecha: string;
    tipo: string;
    tipoDescripcion: string;
    origen: string;
    idDocumento: number | null;
    nroDocumento: string | null;
    idDeposito: number;
    deposito: string;
    idStock: number;
    entrada: number;
    salida: number;
    costo: number | null;
    /** Saldo del producto en el depósito después del movimiento */
    saldo: number;
    usuario: string | null;
    observacion: string | null;
}

export interface ConsultaMovimientos {
    saldoInicial: SaldoDeposito[];
    movimientos: MovimientoStock[];
    saldoFinal: SaldoDeposito[];
}

export interface DiferenciaStock {
    idStock: number;
    idProducto: number;
    codigo: number;
    producto: string;
    idDeposito: number;
    deposito: string;
    stockActual: number;
    saldoRegistrado: number | null;
    diferencia: number;
    fechaUltimoMovimiento: string | null;
}

export interface FiltroMovimientos {
    idProducto: number;
    idDeposito?: number;
    desde?: string;
    hasta?: string;
}

export const movimientoStockService = {
    buscarProductos: async (busqueda: string): Promise<ProductoSeguimiento[]> => {
        const { data } = await axios.get(`${API_URL}/productos`, { params: { busqueda } });
        return data.productos;
    },

    listarDepositos: async (): Promise<DepositoSeguimiento[]> => {
        const { data } = await axios.get(`${API_URL}/depositos`);
        return data.depositos;
    },

    consultarMovimientos: async (filtro: FiltroMovimientos): Promise<ConsultaMovimientos> => {
        const { data } = await axios.get(`${API_URL}/movimientos`, { params: filtro });
        return { saldoInicial: data.saldoInicial, movimientos: data.movimientos, saldoFinal: data.saldoFinal };
    },

    conciliacion: async (): Promise<DiferenciaStock[]> => {
        const { data } = await axios.get(`${API_URL}/conciliacion`);
        return data.diferencias;
    },
};
