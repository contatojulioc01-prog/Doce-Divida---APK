-- ============================================================
-- Script de Criação do Banco de Dados: Doce Dívida
-- Banco: SQLite 3
-- Codificação: UTF-8 | Horário: Local
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Tabela: produtos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  vendedor_pessoa TEXT NOT NULL DEFAULT '',
  preco_padrao REAL NOT NULL DEFAULT 0.00,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos (nome);
CREATE INDEX IF NOT EXISTS idx_produtos_vendedor ON produtos (vendedor_pessoa);

-- ------------------------------------------------------------
-- Tabela: dividas
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Dados Iniciais de Demonstração (Seed Opcional)
-- ------------------------------------------------------------
INSERT OR IGNORE INTO produtos (id, nome, vendedor_pessoa, preco_padrao) VALUES
  (1, 'Cone Trufado', 'Patrícia', 8.50),
  (2, 'Pão de Mel', 'Seu Zé', 6.00),
  (3, 'Bolo de Pote', 'Patrícia', 10.00),
  (4, 'Trufa Tradicional', 'Dona Maria', 4.50),
  (5, 'Marmita Doce', 'Patrícia', 15.00);

INSERT OR IGNORE INTO dividas (id, produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao) VALUES
  (1, 1, 'Cone Trufado (Ninho com Nutella)', 'Patrícia', 2, 0, 8.50, 17.00, date('now', 'localtime'), 0, 'Peguei 2 depois do almoço'),
  (2, 2, 'Pão de Mel de Doce de Leite', 'Seu Zé', 1, 0, 6.00, 6.00, date('now', 'localtime'), 0, 'Comprei no intervalo'),
  (3, NULL, 'Café com torta salgada', 'Dona Maria', 1, 1, 12.00, 12.00, date('now', 'localtime'), 1, 'Lançamento avulso pago via Pix');
