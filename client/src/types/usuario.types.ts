export interface Usuario {
    idUsuario?: number;
    username: string;
    password?: string;
    idRol: number;
    nombreRol?: string;
    activo?: boolean;
    idPersona: number;
    idPersonal?: number;
    nombrePersona?: string;
    ruc?: string;
    idUsuarioAlta?: number;
    anularCompra?: boolean;
    anularVenta?: boolean;
    anularRemision?: boolean;
    anularRecepcion?: boolean;
    anularAjuste?: boolean;
    anularCargaProducto?: boolean;
    anularCobro?: boolean;
    anularNotaCredito?: boolean;
}

export interface UsuarioSearchResult {
    idUsuario: number;
    username: string;
    nombreCompleto: string;
    nombreRol: string;
    estado: string;
}
