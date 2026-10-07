export interface TerminalWeb {
    idTerminalWeb?: number;
    nombreTerminal: string;
    terminalToken: string;
    idSucursal: number;
    idFactura: number;
    idFacturaNotaCredito?: number | null;
    idDepositoVenta: number;
    idDepositoCompra: number;
    idDepositoRemision: number;
    activo?: boolean;
    idUsuarioAlta?: number;
    idUsuarioMod?: number;

    // Campos informativos
    nombreSucursal?: string;
    timbradoFactura?: string;
    timbradoNotaCredito?: string | null;
    depVenta?: string;
    depCompra?: string;
    depRemision?: string;
}

export interface TerminalWebSearchResult {
    idTerminalWeb: number;
    nombreTerminal: string;
    terminalToken: string;
    nombreSucursal: string;
    estado: string;
}
