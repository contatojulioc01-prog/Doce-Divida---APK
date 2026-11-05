import { Router } from 'express';
import {
  listarProdutos,
  obterProdutoPorId,
  criarProduto,
  atualizarProduto,
  excluirProduto
} from '../controllers/produtoController.js';

const router = Router();

router.get('/', listarProdutos);
router.get('/:id', obterProdutoPorId);
router.post('/', criarProduto);
router.put('/:id', atualizarProduto);
router.delete('/:id', excluirProduto);

export default router;

