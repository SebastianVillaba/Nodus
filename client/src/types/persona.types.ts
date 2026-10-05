export interface Persona {
  idPersona?: number;
  nombre: string;
  ruc?: string;
  dv?: string;
  direccion?: string;
  idDepartamento?: number;           // ID del departamento seleccionado
  idDistrito?: number;               // ID del distrito seleccionado
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
  acreditar?: boolean;               // Cliente habilitado para comprar a crédito
  limiteCredito?: number;            // Tope de deuda del cliente
  tipoPersonaJur: boolean;           
  tipoProveedor: boolean;            
  responsableProveedor?: string;    
  timbrado?: string;                 
  tipoPersonaFis: boolean;           
  tipoPersonaCli: boolean;           
  tipoPersonal: boolean;
  tipoVendedor: boolean;
}

export interface PersonaFormData extends Persona {}

export interface PersonaSearchParams {
  searchTerm?: string;
  searchBy?: 'nombre' | 'codigo' | 'ruc';
}

export interface GrupoCliente {
  idGrupoCliente: number;
  nombreGrupoCliente: string;
}
