import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPathConfig = process.env.DB_FILE || '../database/doce_divida.sqlite';
const resolvedDbPath = path.resolve(__dirname, '../../', dbPathConfig);

const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(resolvedDbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const inicializarBanco = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      vendedor_pessoa TEXT NOT NULL DEFAULT '',
      preco_padrao REAL NOT NULL DEFAULT 0.00,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos (nome);

    CREATE TABLE IF NOT EXISTS dividas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NULL,
      descricao TEXT NOT NULL,
      vendedor_pessoa TEXT NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      quantidade_paga INTEGER NOT NULL DEFAULT 0,
      valor_unitario REAL NOT NULL DEFAULT 0.00,
      valor REAL NOT NULL DEFAULT 0.00,
      data_lancamento TEXT NOT NULL,
      pago INTEGER NOT NULL DEFAULT 0,
      observacao TEXT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CONSTRAINT fk_dividas_produto
        FOREIGN KEY (produto_id)
        REFERENCES produtos (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dividas_pago ON dividas (pago);
    CREATE INDEX IF NOT EXISTS idx_dividas_vendedor ON dividas (vendedor_pessoa);
    CREATE INDEX IF NOT EXISTS idx_dividas_data ON dividas (data_lancamento);
  `);

  // Migrações seguras para bancos existentes
  const colunasProdutos = db.prepare('PRAGMA table_info(produtos)').all().map(c => c.name);
  if (!colunasProdutos.includes('vendedor_pessoa')) {
    db.exec(`ALTER TABLE produtos ADD COLUMN vendedor_pessoa TEXT NOT NULL DEFAULT '';`);
  }

  const colunasDividas = db.prepare('PRAGMA table_info(dividas)').all().map(c => c.name);
  if (!colunasDividas.includes('quantidade')) {
    db.exec(`ALTER TABLE dividas ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!colunasDividas.includes('quantidade_paga')) {
    db.exec(`ALTER TABLE dividas ADD COLUMN quantidade_paga INTEGER NOT NULL DEFAULT 0;`);
    db.exec(`UPDATE dividas SET quantidade_paga = quantidade WHERE pago = 1;`);
  }
  if (!colunasDividas.includes('valor_unitario')) {
    db.exec(`ALTER TABLE dividas ADD COLUMN valor_unitario REAL NOT NULL DEFAULT 0.00;`);
    db.exec(`UPDATE dividas SET valor_unitario = valor WHERE valor_unitario = 0;`);
  }

  const totalProdutos = db.prepare('SELECT COUNT(*) AS total FROM produtos').get().total;
  if (totalProdutos === 0) {
    const insertProd = db.prepare('INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES (?, ?, ?)');
    insertProd.run('Cone Trufado', 'Patrícia', 8.50);
    insertProd.run('Pão de Mel', 'Seu Zé', 6.00);
    insertProd.run('Bolo de Pote', 'Patrícia', 10.00);
    insertProd.run('Trufa Tradicional', 'Dona Maria', 4.50);
    insertProd.run('Marmita Doce', 'Patrícia', 15.00);

    const insertDivida = db.prepare(`
      INSERT INTO dividas (produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, date('now', 'localtime'), ?, ?)
    `);
    insertDivida.run(1, 'Cone Trufado (Ninho com Nutella)', 'Patrícia', 2, 0, 8.50, 17.00, 0, 'Peguei 2 depois do almoço');
    insertDivida.run(2, 'Pão de Mel de Doce de Leite', 'Seu Zé', 1, 0, 6.00, 6.00, 0, 'Comprei no intervalo');
    insertDivida.run(null, 'Café com torta salgada', 'Dona Maria', 1, 1, 12.00, 12.00, 1, 'Lançamento avulso pago via Pix');
  }
};

inicializarBanco();

export default db;
