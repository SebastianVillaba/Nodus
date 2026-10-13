import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || '/api'}/compras`;

export interface DetalleCompraTmp {
    idDetCompraTmp: number;
    idProducto: number;
    codigo: string;
    mercaderia: string;
    cantidad: number;
    costo: number; // This might be unit cost or total cost depending on backend, checking controller... controller uses costoTotal and precio. Let's align with controller.
    bonificacion: number;
    lote: string;
    vencimiento: string;
    exenta: number;
    gravada5: number;
    gravada10: number;
    totalCosto: number;
    precio: number;
    porcentajeIva: number;
}

/** Compra en la consulta (fiscal: compra; no fiscal: cco) */
export interface CompraListado {
    noFiscal: boolean;
    idCompra: number;
    fecha: string;
    fechaAlta: string;
    nroFactura: string;
    timbrado: string;
    idProveedor: number;
    proveedor: string;
    ruc: string;
    idTipoCompra: number;
    condicion: string;
    total: number;
    totalNotasCredito: number;
    activo: boolean;
    usuario: string;
}

export interface FiltroCompras {
    desde?: string;
    hasta?: string;
    proveedor?: string;
    dsuc?: number;
    dcaja?: number;
    dfactu?: number;
    idCompra?: number;
    /** true = no fiscales, false = fiscales, sin enviar = todas */
    noFiscal?: boolean;
    soloActivas?: boolean;
}

export interface CompraConsulta {
    cabecera: {
        noFiscal: boolean;
        idCompra: number;
        nroFactura: string;
        timbrado: string;
        fecha: string;
        vence: string;
        idProveedor: number;
        proveedor: string;
        ruc: string;
        responsable: string | null;
        idTipoCompra: number;
        condicion: string;
        total: number;
        activo: boolean;
        usuario: string;
        fechaAlta: string;
        terminal: string | null;
        totalAcreditado: number;
        totalDisponible: number;
        motivoAnulacion: string | null;
        usuarioAnulacion: string | null;
        fechaAnulacion: string | null;
    };
    detalle: {
        idDetCompra: number;
        idProducto: number;
        codigo: string;
        producto: string;
        idDeposito: number;
        deposito: string;
        idImpuesto: number;
        impuesto: string;
        cantidad: number;
        bonificacion: number;
        /** cantidad + bonificación */
        unidades: number;
        costo: number;
        /** subtotal / unidades */
        costoUnitario: number;
        precio: number;
        subtotal: number;
        devuelto: number;
        disponible: number;
        stockActual: number;
        gasto: boolean;
    }[];
    impuestos: {
        idImpuesto: number;
        nombreImpuesto: string;
        porcentajeImpuesto: number;
        comprado: number;
        acreditado: number;
        disponible: number;
    }[];
    notas: {
        tipo: 'DEV' | 'MONTO';
        idDocumento: number;
        nroNotaCredito: string;
        timbrado: string;
        fecha: string;
        totalNotaCredito: number;
        activo: boolean;
    }[];
}

export const comprasService = {
    buscarProducto: async (query: string) => {
        const response = await axios.get(`${API_URL}/productos`, { params: { busqueda: query } });
        return response.data;
    },

    agregarDetalleCompra: async (detalle: any) => {
        const response = await axios.post(`${API_URL}/detalle/tmp`, detalle);
        return response.data;
    },

    consultarDetalleTemporal: async (idTerminalWeb: number) => {
        const response = await axios.get(`${API_URL}/detalle/tmp`, { params: { idTerminalWeb } });
        return response.data;
    },

    eliminarItemTemporal: async (idTerminalWeb: number, idDetCompraTmp: number) => {
        const response = await axios.delete(`${API_URL}/detalle/tmp`, { params: { idTerminalWeb, idDetCompraTmp } });
        return response.data;
    },

    limpiarTemporal: async (idTerminalWeb: number) => {
        const response = await axios.delete(`${API_URL}/detalle/tmp/all`, { params: { idTerminalWeb } });
        return response.data;
    },

    guardarCompra: async (compra: any) => {
        const response = await axios.post(`${API_URL}`, compra);
        return response.data;
    },

    buscarProveedores: async () => {
        const response = await axios.get(`${API_URL}/proveedor`);
        return response.data;
    },

    listar: async (filtro: FiltroCompras): Promise<CompraListado[]> => {
        const response = await axios.get(`${API_URL}/consulta`, { params: filtro });
        return response.data.compras;
    },

    consultar: async (idCompra: number, noFiscal: boolean): Promise<CompraConsulta> => {
        const response = await axios.get(`${API_URL}/consulta/${idCompra}`, { params: { noFiscal: noFiscal ? 1 : 0 } });
        const { cabecera, detalle, impuestos, notas } = response.data;
        return { cabecera, detalle, impuestos, notas };
    }
};
