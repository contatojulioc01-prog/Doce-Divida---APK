import db from '../config/db.js';

export const listarProdutos = (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT id, nome, vendedor_pessoa, preco_padrao, criado_em FROM produtos ORDER BY nome ASC'
    ).all();
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao listar produtos no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao consultar produtos.' });
  }
};

export const obterProdutoPorId = (req, res) => {
  const { id } = req.params;
  try {
    const row = db.prepare(
      'SELECT id, nome, vendedor_pessoa, preco_padrao, criado_em FROM produtos WHERE id = ?'
    ).get(id);

    if (!row) {
      return res.status(404).json({ mensagem: 'Produto não encontrado.' });
    }

    return res.status(200).json(row);
  } catch (error) {
    console.error('Erro ao buscar produto por ID no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao buscar produto.' });
  }
};

export const criarProduto = (req, res) => {
  const { nome, vendedor_pessoa, preco_padrao } = req.body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({ mensagem: 'O nome do produto é obrigatório.' });
  }

  const vendedorLimpo = vendedor_pessoa && typeof vendedor_pessoa === 'string' ? vendedor_pessoa.trim() : '';

  const precoNumerico = Number(preco_padrao);
  if (isNaN(precoNumerico) || precoNumerico < 0) {
    return res.status(400).json({ mensagem: 'O preço padrão deve ser um número válido e maior ou igual a zero.' });
  }

  try {
    const info = db.prepare(
      'INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES (?, ?, ?)'
    ).run(nome.trim(), vendedorLimpo, precoNumerico);

    const novo = db.prepare(
      'SELECT id, nome, vendedor_pessoa, preco_padrao, criado_em FROM produtos WHERE id = ?'
    ).get(info.lastInsertRowid);

    return res.status(201).json(novo);
  } catch (error) {
    console.error('Erro ao criar produto no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao salvar produto.' });
  }
};

export const atualizarProduto = (req, res) => {
  const { id } = req.params;
  const { nome, vendedor_pessoa, preco_padrao } = req.body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({ mensagem: 'O nome do produto é obrigatório.' });
  }

  const vendedorLimpo = vendedor_pessoa && typeof vendedor_pessoa === 'string' ? vendedor_pessoa.trim() : '';

  const precoNumerico = Number(preco_padrao);
  if (isNaN(precoNumerico) || precoNumerico < 0) {
    return res.status(400).json({ mensagem: 'O preço padrão deve ser um número válido e maior ou igual a zero.' });
  }

  try {
    const info = db.prepare(
      'UPDATE produtos SET nome = ?, vendedor_pessoa = ?, preco_padrao = ? WHERE id = ?'
    ).run(nome.trim(), vendedorLimpo, precoNumerico, id);

    if (info.changes === 0) {
      return res.status(404).json({ mensagem: 'Produto não encontrado para atualização.' });
    }

    const atualizado = db.prepare(
      'SELECT id, nome, vendedor_pessoa, preco_padrao, criado_em FROM produtos WHERE id = ?'
    ).get(id);

    return res.status(200).json(atualizado);
  } catch (error) {
    console.error('Erro ao atualizar produto no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar produto.' });
  }
};

export const excluirProduto = (req, res) => {
  const { id } = req.params;

  try {
    const info = db.prepare('DELETE FROM produtos WHERE id = ?').run(id);

    if (info.changes === 0) {
      return res.status(404).json({ mensagem: 'Produto não encontrado para exclusão.' });
    }

    return res.status(200).json({ mensagem: 'Produto excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir produto no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao excluir produto.' });
  }
};
