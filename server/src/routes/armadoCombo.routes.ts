import { Router } from 'express';
import { listarCombos, armarCombo } from '../controllers/armadoCombo.controller';

const router = Router();

// GET /api/armado-combo?idTerminalWeb=1
router.get('/', listarCombos);
// POST /api/armado-combo  { idProducto, cantidad, desarmar, idTerminalWeb, observacion }
router.post('/', armarCombo);

export default router;
