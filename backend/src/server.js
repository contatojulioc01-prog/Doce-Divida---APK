import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/db.js';
import produtoRoutes from './routes/produtoRoutes.js';
import dividaRoutes from './routes/dividaRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/produtos', produtoRoutes);
app.use('/api/dividas', dividaRoutes);

// Rota de status/healthcheck
app.get('/api/health', (req, res) => {
  try {
    const teste = db.prepare('SELECT 1 AS ok').get();
    res.json({
      status: 'ok',
      banco: 'SQLite conectado',
      arquivo: process.env.DB_FILE || '../database/doce_divida.sqlite',
      timestamp: new Date().toLocaleString('pt-BR')
    });
  } catch (error) {
    res.status(500).json({ status: 'erro', mensagem: 'Falha na conexão com o SQLite.', erro: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[API DOCE DIVIDA] Servidor rodando na porta ${PORT}`);
  console.log(`[API DOCE DIVIDA] Banco de Dados: SQLite (${process.env.DB_FILE || '../database/doce_divida.sqlite'})`);
  console.log(`[API DOCE DIVIDA] Endpoint Produtos: http://localhost:${PORT}/api/produtos`);
  console.log(`[API DOCE DIVIDA] Endpoint Dívidas:  http://localhost:${PORT}/api/dividas`);
  console.log(`[API DOCE DIVIDA] Endpoint Totais:   http://localhost:${PORT}/api/dividas/totais`);
  console.log('[API DOCE DIVIDA] SQLite inicializado com sucesso e pronto para uso!');
});
