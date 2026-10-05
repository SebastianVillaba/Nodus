import express from 'express';
import { buscarInfoPersona, buscarPersona, buscarClientePorRuc, agregarClienteRapido, insertarPersona, consultaCliente, modificarPersona, obtenerGruposCliente } from '../controllers/persona.controller';

import { requierePermiso, PERMISOS } from '../Middlewares/permisos.middleware';

const router = express.Router();

// La ruta base ya es '/persona' desde index.ts
// Entonces '/' aquí se traduce a '/api/persona'
router.post('/', requierePermiso(PERMISOS.ABM), insertarPersona);
router.put('/', requierePermiso(PERMISOS.ABM), modificarPersona);
router.get('/consulta', buscarPersona);
router.get('/consultaCliente', consultaCliente);
router.get('/info', buscarInfoPersona);
router.get('/buscarCliente', buscarClientePorRuc);
router.get('/gruposCliente', obtenerGruposCliente);
// Alta rápida de cliente desde Facturación o Pedidos
router.post('/agregarClienteRapido', requierePermiso(PERMISOS.ABM, PERMISOS.VENTAS, PERMISOS.PEDIDOS), agregarClienteRapido);

export default router;