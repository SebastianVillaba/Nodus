export interface InsertarPersonaRequest {
  nombre: string;
  ruc?: string;
  dv?: string;
  direccion?: string;
  idCiudad?: string;                 // varchar(30) según el SP
  pais?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  fechaNacimiento?: string;
  idUsuarioAlta: number;
  idTipoDocumento?: number;
  nombreFantasia?: string;
  codigo?: number;
  idGrupoCliente?: number;
  tipoPersonaJur: boolean;
  tipoProveedor: boolean;
  responsableProveedor?: string;
  timbrado?: string;
  tipoPersonaFis: boolean;
  tipoPersonaCli: boolean;
  tipoPersonal: boolean;
  tipoVendedor?: boolean;
}

export interface InsertarPersonaResponse {
  success: boolean;                  // Indica si la operación fue exitosa
  message: string;                   // Mensaje descriptivo del resultado
  rowsAffected?: number;             // Número de filas afectadas (opcional)
}

export interface BuscarPersonaRequest {
  tipoBusqueda: number;
  busqueda: string;
}

// Interface para la respuesta de sp_consultaInformacionPersona
export interface PersonaInfoCompleta {
  // Campos de persona
  idPersona: number;
  nombre: string;              // nombre de la persona
  ruc?: string;
  dv?: string;
  direccion?: string;
  fechaNacimiento?: Date;
  telefono?: string;
  celular?: string;
  email?: string;

  // Campos de ubicación
  idCiudad: number;
  nombreCiudad: string;
  idDistrito: number;
  nombreDistrito: string;      // Nombre del distrito
  idDepartamento: number;
  nombreDepartamento: string;  // Nombre del departamento

  // Campos de personaFis
  idPersonaFis?: number;

  // Campos de personaJur
  nombreFantasia?: string;

  // Campos de proveedor
  responsable?: string;
  timbrado?: string;

  // Campos de cliente
  codigo?: number;
  idGrupoCliente?: number;
  nombreGrupoCliente?: string;
}

export interface ModificarPersonaRequest {
  idPersona: number;
  nombre: string;
  ruc?: string;
  dv?: string;
  direccion?: string;
  idCiudad?: number;
  pais?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  fechaNacimiento?: string;
  idUsuarioMod: number;
  idTipoDocumento?: number;
  activo: number;
  nombreFantasia?: string;
  responsableProveedor?: string;
  timbrado?: string;
  tipoPersonal?: boolean;
  tipoPersonaJur?: boolean;
  tipoProveedor?: boolean;
  tipoPersonaFis?: boolean;
  tipoPersonaCli?: boolean;
  codigo?: number;
  idGrupoCliente?: number;
  tipoVendedor?: boolean;
  // Crédito del cliente (migración 002)
  acreditar?: boolean;
  limiteCredito?: number;
}