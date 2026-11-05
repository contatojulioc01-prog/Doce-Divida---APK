import { Router } from 'express';
import {
  obterTotais,
  listarDividas,
  obterDividaPorId,
  criarDivida,
  atualizarDivida,
  pagarQuantidadeDivida,
  alternarStatusDivida,
  excluirDivida
} from '../controllers/dividaController.js';

const router = Router();

router.get('/totais', obterTotais);
router.get('/', listarDividas);
router.get('/:id', obterDividaPorId);
router.post('/', criarDivida);
router.put('/:id', atualizarDivida);
router.patch('/:id/pagar-quantidade', pagarQuantidadeDivida);
router.patch('/:id/status', alternarStatusDivida);
router.delete('/:id', excluirDivida);

export default router;
