import { Request, Response } from "express";
import { executeRequest, sql } from "../utils/dbHandler";
import { sendError } from '../utils/errorResponse';
import { BuscarPersonaRequest, InsertarPersonaRequest, InsertarPersonaResponse, ModificarPersonaRequest } from "../types/Persona/persona.type";

/**
 * Controller para insertar una nueva persona en el sistema.
 * 
 * FLUJO DE EJECUCIÓN:
 * 1. Recibe los datos del body de la petición HTTP
 * 2. Valida que los campos obligatorios estén presentes
 * 3. Prepara los parámetros para el stored procedure
 * 4. Ejecuta el SP 'sp_insertarPersona' en la base de datos
 * 5. Retorna una respuesta exitosa o maneja los errores
 * 
 * LÓGICA DEL STORED PROCEDURE:
 * - Valida que el RUC no esté duplicado (si se proporciona)
 * - Inserta el registro base en la tabla 'persona'
 * - Si tipoPersonaJur=true: inserta en 'personaJur' y opcionalmente en 'proveedor'
 * - Si tipoPersonaFis=true: inserta en 'personaFis'
 * - Si tipoPersonaCli=true: inserta en 'cliente' (valida código único)
 * - Todo se ejecuta en una transacción (si algo falla, se revierte todo)
 * 
 * @param req - Objeto Request de Express que contiene los datos en req.body
 * @param res - Objeto Response de Express para enviar la respuesta HTTP
 */
export const insertarPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    // PASO 1: Extraer todos los datos del body de la petición
    // Usamos destructuring para obtener cada campo del objeto req.body
    const {
      nombre,
      ruc,
      dv,
      direccion,
      idCiudad,
      pais,
      telefono,
      celular,
      email,
      fechaNacimiento,
      idUsuarioAlta,
      idTipoDocumento,
      nombreFantasia,
      codigo,
      idGrupoCliente,
      tipoPersonaJur,
      tipoProveedor,
      responsableProveedor,
      timbrado,
      tipoPersonaFis,
      tipoPersonaCli,
      tipoPersonal,
      tipoVendedor
    } = req.body as InsertarPersonaRequest;

    // PASO 2: Validar campos obligatorios
    // El nombre y el ID del usuario que da de alta son obligatorios
    if (!nombre || !idUsuarioAlta) {
      res.status(400).json({
        success: false,
        message: "Los campos 'nombre' e 'idUsuarioAlta' son obligatorios"
      });
      return;
    }

    // PASO 3: Validar que al menos un tipo de persona esté seleccionado
    // Una persona debe ser al menos Jurídica o Física
    if (!tipoPersonaJur && !tipoPersonaFis) {
      res.status(400).json({
        success: false,
        message: "Debe especificar al menos un tipo de persona (Jurídica o Física)"
      });
      return;
    }

    // PASO 4: Validaciones específicas según el tipo de persona
    // Si es Persona Jurídica, debe tener nombre de fantasía
    if (tipoPersonaJur && !nombreFantasia) {
      res.status(400).json({
        success: false,
        message: "Las Personas Jurídicas requieren 'nombreFantasia'"
      });
      return;
    }

    // Validation for funcionario sector is removed

    // Map pais string to idPais int
    let idPaisVal = 1;
    if (pais) {
      const paisUpper = pais.toUpperCase();
      if (paisUpper.includes("ARGENTINA")) idPaisVal = 2;
      else if (paisUpper.includes("BRASIL")) idPaisVal = 3;
    }

    // PASO 5: Preparar los parámetros para el stored procedure
    const inputs = [
      { name: 'nombre', type: sql.VarChar, value: nombre },
      { name: 'ruc', type: sql.VarChar, value: ruc || '' },
      { name: 'dv', type: sql.VarChar, value: dv || '' },
      { name: 'direccion', type: sql.VarChar, value: direccion || '' },
      { name: 'idCiudad', type: sql.VarChar, value: idCiudad || '' },
      { name: 'pais', type: sql.VarChar, value: pais || '' },
      { name: 'telefono', type: sql.VarChar, value: telefono || '' },
      { name: 'celular', type: sql.VarChar, value: celular || '' },
      { name: 'email', type: sql.VarChar, value: email || '' },
      { name: 'fechaNacimiento', type: sql.VarChar, value: fechaNacimiento || '' },
      { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta },
      { name: 'idTipoDocumento', type: sql.Int, value: idTipoDocumento || 0 },
      { name: 'nombreFantasia', type: sql.VarChar, value: nombreFantasia || '' },
      { name: 'codigo', type: sql.Int, value: codigo || 0 },
      { name: 'idGrupoCliente', type: sql.Int, value: idGrupoCliente || 0 },
      { name: 'tipoPersonaJur', type: sql.Bit, value: tipoPersonaJur ? 1 : 0 },
      { name: 'tipoProveedor', type: sql.Bit, value: tipoProveedor ? 1 : 0 },
      { name: 'responsableProveedor', type: sql.VarChar, value: responsableProveedor || '' },
      { name: 'timbrado', type: sql.VarChar, value: timbrado || '' },
      { name: 'tipoPersonaFis', type: sql.Bit, value: tipoPersonaFis ? 1 : 0 },
      { name: 'tipoPersonaCli', type: sql.Bit, value: tipoPersonaCli ? 1 : 0 },
      { name: 'idPais', type: sql.Int, value: idPaisVal },
      { name: 'tipoPersonal', type: sql.Bit, value: tipoPersonal ? 1 : 0 },
      { name: 'tipoVendedor', type: sql.Bit, value: tipoVendedor ? 1 : 0 }
    ];

    // PASO 6: Ejecutar el stored procedure
    // executeRequest es una función helper que maneja la conexión a la BD
    // - query: nombre del stored procedure
    // - inputs: array de parámetros de entrada
    // - isStoredProcedure: true indica que es un SP y no una query normal
    // Nota: usamos 'as any' porque TypeScript tiene problemas con los tipos de mssql
    // pero en runtime funcionará correctamente
    const result = await executeRequest({
      query: 'sp_insertarPersona',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    // PASO 7: Verificar el resultado y enviar respuesta exitosa
    // rowsAffected indica cuántas filas fueron modificadas en la BD
    const rowsAffected = result.rowsAffected[0];

    res.status(201).json({
      success: true,
      message: "Persona insertada exitosamente",
      rowsAffected: rowsAffected
    } as InsertarPersonaResponse);

  } catch (error: any) {
    sendError(res, error, 'Error al insertar la persona en el servidor');
  }
};

export const buscarPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipoBusqueda, busqueda } = req.query;

    // Validar que los parámetros existan
    if (!tipoBusqueda || !busqueda) {
      res.status(400).json({
        success: false,
        message: 'Los parámetros tipoBusqueda y busqueda son requeridos'
      });
      return;
    }

    // Convertir tipoBusqueda a número
    const tipoBusquedaNum = parseInt(tipoBusqueda as string, 10);
    if (isNaN(tipoBusquedaNum)) {
      res.status(400).json({
        success: false,
        message: 'El parámetro tipoBusqueda debe ser un número válido'
      });
      return;
    }

    // TODO: Implementar lógica de búsqueda con tipoBusquedaNum y busquedaStr
    const result = await executeRequest({
      query: 'sp_consultaPersona',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'tipoBusqueda',
          type: sql.Int,
          value: tipoBusquedaNum
        },
        {
          name: 'busqueda',
          type: sql.VarChar,
          value: busqueda
        }
      ]
    });

    const rowsAffected = result.rowsAffected[0];
    console.log(result.recordsets);
    

    res.status(200).json({
      succes: true,
      message: 'Busqueda exitosa!',
      result: result.recordset,
      rowsAffected: rowsAffected
    })

  } catch (error) {
    sendError(res, error, 'Error al buscar persona');
  }
}

export const buscarInfoPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idPersona } = req.query;

    // Validar que el parámetro exista
    if (!idPersona) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idPersona es requeridos'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_consultaInformacionPersona',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'idPersona',
          type: sql.Int,
          value: idPersona
        }
      ]
    });

    const rowsAffected = result.rowsAffected[0];

    // Datos de crédito del cliente (migración 002), si la persona es cliente
    const credito = await executeRequest({
      query: 'SELECT acreditar, limiteCredito FROM dbo.cliente WHERE idPersona = @idPersona',
      inputs: [{ name: 'idPersona', type: sql.Int, value: Number(idPersona) }],
    });
    if (result.recordset[0] && credito.recordset[0]) {
      Object.assign(result.recordset[0], credito.recordset[0]);
    }

    res.status(200).json({
      succes: true,
      message: 'Busqueda exitosa!',
      result: result.recordset,
      rowsAffected: rowsAffected
    })
  } catch (error) {
    sendError(res, error, 'Error al buscar persona');
  }
}

/**
 * Controller para buscar un cliente por su RUC
 * Si la persona existe pero no es cliente, lo crea automáticamente
 * @param req - Request con el parámetro ruc en query y idUsuario
 * @param res - Response con la información del cliente
 */
export const buscarClientePorRuc = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruc, idUsuario } = req.query;

    // Validar que los parámetros existan
    if (!ruc) {
      res.status(400).json({
        success: false,
        message: 'El parámetro ruc es requerido'
      });
      return;
    }

    if (!idUsuario) {
      res.status(400).json({
        success: false,
        message: 'El parámetro idUsuario es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_buscarClientePorRuc',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'ruc',
          type: sql.VarChar(10),
          value: ruc
        },
        {
          name: 'idUsuario',
          type: sql.Int,
          value: parseInt(idUsuario as string)
        }
      ]
    });

    const rowsAffected = result.rowsAffected[0];

    res.status(200).json({
      success: true,
      message: 'Consulta exitosa',
      result: result.recordset,
      rowsAffected: rowsAffected
    });
  } catch (error) {
    sendError(res, error, 'Error al buscar cliente por RUC');
  }
};

/**
 * Controller para agregar un cliente rápidamente
 * @param req - Request con los datos del cliente
 * @param res - Response con el cliente creado
 */
export const agregarClienteRapido = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      ruc,
      dv,
      nombre,
      direccion,
      fechaNacimiento,
      celular,
      email,
      idCiudad,
      idUsuarioAlta,
      idTipoDocumento
    } = req.body;

    // Validar parámetros obligatorios
    if (!nombre || !idCiudad || !idUsuarioAlta || !idTipoDocumento) {
      res.status(400).json({
        success: false,
        message: 'Faltan parámetros obligatorios: nombre, idCiudad, idUsuarioAlta, idTipoDocumento'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_agregarClienteRapido',
      isStoredProcedure: true,
      inputs: [
        { name: 'ruc', type: sql.VarChar(10), value: ruc || ''},
        { name: 'dv', type: sql.VarChar(1), value: dv || '' },
        { name: 'nombre', type: sql.VarChar(40), value: nombre },
        { name: 'direccion', type: sql.VarChar(100), value: direccion || null },
        { name: 'fechaNacimiento', type: sql.Date, value: fechaNacimiento || null },
        { name: 'celular', type: sql.VarChar(20), value: celular || null },
        { name: 'email', type: sql.VarChar(50), value: email || null },
        { name: 'idCiudad', type: sql.Int, value: idCiudad },
        { name: 'idUsuarioAlta', type: sql.Int, value: idUsuarioAlta },
        { name: 'idTipoDocumento', type: sql.Int, value: idTipoDocumento }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Cliente agregado exitosamente',
      result: result.recordset[0]
    });
  } catch (error) {
    sendError(res, error, 'Error al agregar cliente');
  }
};

/**
 * Controller para consultar clientes por nombre
 * @param req - Request con el parámetro busqueda en query
 * @param res - Response con la lista de clientes encontrados
 */
export const consultaCliente = async (req: Request, res: Response): Promise<void> => {
  try {
    const { busqueda } = req.query;

    // Validar que el parámetro exista
    if (!busqueda) {
      res.status(400).json({
        success: false,
        message: 'El parámetro busqueda es requerido'
      });
      return;
    }

    const result = await executeRequest({
      query: 'sp_consultaCliente',
      isStoredProcedure: true,
      inputs: [
        {
          name: 'busqueda',
          type: sql.VarChar(20),
          value: busqueda
        }
      ]
    });

    const rowsAffected = result.rowsAffected[0];

    res.status(200).json({
      success: true,
      message: 'Consulta exitosa',
      result: result.recordset,
      rowsAffected: rowsAffected
    });
  } catch (error) {
    sendError(res, error, 'Error al consultar cliente');
  }
};


/**
 * Controller para modificar una persona existente.
 * 
 * @param req - Objeto Request de Express que contiene los datos en req.body
 * @param res - Objeto Response de Express para enviar la respuesta HTTP
 */
export const modificarPersona = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      idPersona,
      nombre,
      ruc,
      dv,
      direccion,
      idCiudad,
      pais,
      telefono,
      celular,
      email,
      fechaNacimiento,
      idUsuarioMod,
      idTipoDocumento,
      activo,
      nombreFantasia,
      responsableProveedor,
      timbrado,
      tipoPersonal,
      tipoPersonaJur,
      tipoProveedor,
      tipoPersonaFis,
      tipoPersonaCli,
      codigo,
      idGrupoCliente,
      tipoVendedor,
      acreditar,
      limiteCredito
    } = req.body as ModificarPersonaRequest;

    // Validar campos obligatorios CRÍTICOS
    if (!idPersona || !nombre || !idUsuarioMod) {
      res.status(400).json({
        success: false,
        message: "Los campos 'idPersona', 'nombre' e 'idUsuarioMod' son obligatorios"
      });
      return;
    }

    const inputs = [
      { name: 'idPersona', type: sql.Int, value: idPersona },
      { name: 'nombre', type: sql.VarChar(40), value: nombre },
      { name: 'ruc', type: sql.VarChar(15), value: ruc || '' },
      { name: 'dv', type: sql.VarChar(2), value: dv || '' },
      { name: 'direccion', type: sql.VarChar(50), value: direccion || '' },
      { name: 'idCiudad', type: sql.Int, value: idCiudad || 0 },
      { name: 'pais', type: sql.VarChar(25), value: pais || '' },
      { name: 'telefono', type: sql.VarChar(20), value: telefono || '' },
      { name: 'celular', type: sql.VarChar(20), value: celular || '' },
      { name: 'email', type: sql.VarChar(50), value: email || '' },
      { name: 'fechaNacimiento', type: sql.VarChar(15), value: fechaNacimiento || '' },
      { name: 'idUsuarioMod', type: sql.Int, value: idUsuarioMod },
      { name: 'idTipoDocumento', type: sql.Int, value: idTipoDocumento || 0 },
      { name: 'activo', type: sql.TinyInt, value: activo !== undefined ? activo : 1 },
      { name: 'nombreFantasia', type: sql.VarChar(50), value: nombreFantasia || null },
      { name: 'responsableProveedor', type: sql.VarChar(30), value: responsableProveedor || null },
      { name: 'timbrado', type: sql.VarChar(20), value: timbrado || null },
      { name: 'tipoPersonal', type: sql.Bit, value: tipoPersonal ? 1 : 0 },
      { name: 'tipoPersonaJur', type: sql.Bit, value: tipoPersonaJur ? 1 : 0 },
      { name: 'tipoProveedor', type: sql.Bit, value: tipoProveedor ? 1 : 0 },
      { name: 'tipoPersonaFis', type: sql.Bit, value: tipoPersonaFis ? 1 : 0 },
      { name: 'tipoPersonaCli', type: sql.Bit, value: tipoPersonaCli ? 1 : 0 },
      { name: 'codigo', type: sql.Int, value: codigo || 0 },
      { name: 'idGrupoCliente', type: sql.Int, value: idGrupoCliente || 0 },
      { name: 'tipoVendedor', type: sql.Bit, value: tipoVendedor ? 1 : 0 }
    ];

    const result = await executeRequest({
      query: 'sp_modificarPersona',
      inputs: inputs as any,
      isStoredProcedure: true
    });

    const rowsAffected = result.rowsAffected[0];

    // Configuración de crédito del cliente (migración 002)
    if (tipoPersonaCli && acreditar !== undefined) {
      await executeRequest({
        query: 'sp_actualizarCreditoCliente',
        isStoredProcedure: true,
        inputs: [
          { name: 'idPersona', type: sql.Int, value: idPersona },
          { name: 'acreditar', type: sql.Bit, value: Boolean(acreditar) },
          { name: 'limiteCredito', type: sql.Money, value: Number(limiteCredito) || 0 },
          { name: 'idUsuario', type: sql.Int, value: idUsuarioMod },
        ],
      });
    }

    res.status(200).json({
      success: true,
      message: "Persona modificada exitosamente",
      rowsAffected: rowsAffected
    });

  } catch (error: any) {
    sendError(res, error, 'Error al modificar la persona en el servidor');
  }
};

export const obtenerGruposCliente = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await executeRequest({
      query: 'select idGrupoCliente, nombreGrupoCliente from grupoCliente',
      isStoredProcedure: false
    });
    res.status(200).json({
      success: true,
      result: result.recordset
    });
  } catch (error: any) {
    sendError(res, error, 'Error al obtener grupos de clientes');
  }
};


/**
 * Situación de crédito de un cliente: habilitado, límite, deuda, disponible y vencidos.
 */
export const consultarCreditoCliente = async (req: Request, res: Response): Promise<void> => {
  const idCliente = Number(req.query.idCliente);
  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    res.status(400).json({ success: false, message: "El parámetro 'idCliente' es obligatorio" });
    return;
  }

  try {
    const result = await executeRequest({
      query: 'sp_consultaCreditoCliente',
      isStoredProcedure: true,
      inputs: [{ name: 'idCliente', type: sql.Int, value: idCliente }],
    });
    res.status(200).json({ success: true, credito: result.recordset[0] ?? null });
  } catch (error) {
    sendError(res, error, 'Error al consultar el crédito del cliente');
  }
};
