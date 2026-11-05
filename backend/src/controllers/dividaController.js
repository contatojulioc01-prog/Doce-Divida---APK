import db from '../config/db.js';

export const obterTotais = (req, res) => {
  try {
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN pago = 1 THEN 0
            ELSE (quantidade - COALESCE(quantidade_paga, 0)) * COALESCE(valor_unitario, CASE WHEN quantidade > 0 THEN valor / quantidade ELSE valor END)
          END
        ), 0) AS total_pendente,
        COALESCE(SUM(
          COALESCE(quantidade_paga, CASE WHEN pago = 1 THEN quantidade ELSE 0 END) *
          COALESCE(valor_unitario, CASE WHEN quantidade > 0 THEN valor / quantidade ELSE valor END)
        ), 0) AS total_pago,
        COALESCE(SUM(valor), 0) AS total_geral,
        COUNT(CASE WHEN pago = 0 THEN 1 END) AS qtd_pendente,
        COUNT(CASE WHEN pago = 1 THEN 1 END) AS qtd_pago,
        COUNT(*) AS qtd_total,
        COALESCE(SUM(CASE WHEN pago = 1 THEN 0 ELSE (quantidade - COALESCE(quantidade_paga, 0)) END), 0) AS qtd_unidades_pendentes,
        COALESCE(SUM(COALESCE(quantidade_paga, CASE WHEN pago = 1 THEN quantidade ELSE 0 END)), 0) AS qtd_unidades_pagas
      FROM dividas
    `).get();

    const resultado = {
      total_pendente: parseFloat(row.total_pendente),
      total_pago: parseFloat(row.total_pago),
      total_geral: parseFloat(row.total_geral),
      qtd_pendente: Number(row.qtd_pendente),
      qtd_pago: Number(row.qtd_pago),
      qtd_total: Number(row.qtd_total),
      qtd_unidades_pendentes: Number(row.qtd_unidades_pendentes),
      qtd_unidades_pagas: Number(row.qtd_unidades_pagas)
    };

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Erro ao calcular totais no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao consultar totais acumulados.' });
  }
};

export const listarDividas = (req, res) => {
  const { status, vendedor } = req.query;

  try {
    let sql = `
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE 1=1
    `;
    const params = [];

    if (status !== undefined && status !== '') {
      const isPago = status === 'true' || status === '1' || status === 'pago';
      sql += ' AND d.pago = ?';
      params.push(isPago ? 1 : 0);
    }

    if (vendedor && vendedor.trim() !== '') {
      sql += ' AND d.vendedor_pessoa LIKE ?';
      params.push(`%${vendedor.trim()}%`);
    }

    sql += ' ORDER BY d.pago ASC, d.data_lancamento DESC, d.id DESC';

    const rows = db.prepare(sql).all(...params);

    const normalizado = rows.map((item) => ({
      ...item,
      pago: Boolean(item.pago),
      quantidade: Number(item.quantidade) || 1,
      quantidade_paga: Number(item.quantidade_paga) || (item.pago ? Number(item.quantidade) || 1 : 0),
      valor_unitario: parseFloat(item.valor_unitario) || parseFloat(item.valor),
      valor: parseFloat(item.valor)
    }));

    return res.status(200).json(normalizado);
  } catch (error) {
    console.error('Erro ao listar dívidas no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao consultar dívidas.' });
  }
};

export const obterDividaPorId = (req, res) => {
  const { id } = req.params;

  try {
    const row = db.prepare(`
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE d.id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ mensagem: 'Dívida não encontrada.' });
    }

    const item = {
      ...row,
      pago: Boolean(row.pago),
      quantidade: Number(row.quantidade) || 1,
      quantidade_paga: Number(row.quantidade_paga) || (row.pago ? Number(row.quantidade) || 1 : 0),
      valor_unitario: parseFloat(row.valor_unitario) || parseFloat(row.valor),
      valor: parseFloat(row.valor)
    };

    return res.status(200).json(item);
  } catch (error) {
    console.error('Erro ao buscar dívida por ID no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao obter dívida.' });
  }
};

export const criarDivida = (req, res) => {
  const { produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao } = req.body;

  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return res.status(400).json({ mensagem: 'A descrição ou nome do item é obrigatório.' });
  }

  if (!vendedor_pessoa || typeof vendedor_pessoa !== 'string' || !vendedor_pessoa.trim()) {
    return res.status(400).json({ mensagem: 'O nome da pessoa/vendedor é obrigatório.' });
  }

  const qtdNum = Math.max(1, Math.floor(Number(quantidade) || 1));
  const unitNum = Number(valor_unitario);
  const valorNumerico = Number(valor) || (!isNaN(unitNum) && unitNum > 0 ? qtdNum * unitNum : 0);

  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ mensagem: 'O valor da dívida deve ser maior que zero.' });
  }

  const valorUnitFinal = !isNaN(unitNum) && unitNum > 0 ? unitNum : Number((valorNumerico / qtdNum).toFixed(2));
  const statusPagoInicial = pago === true || pago === 1 || pago === 'true';
  const qtdPagaNum = Math.max(0, Math.min(qtdNum, Number(quantidade_paga) || (statusPagoInicial ? qtdNum : 0)));
  const statusPago = (statusPagoInicial || qtdPagaNum >= qtdNum) ? 1 : 0;

  const hoje = new Date();
  const dataValida = data_lancamento
    ? String(data_lancamento).substring(0, 10)
    : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const prodId = produto_id && !isNaN(Number(produto_id)) ? Number(produto_id) : null;
  const obsTexto = observacao && typeof observacao === 'string' ? observacao.trim() : null;

  try {
    const info = db.prepare(`
      INSERT INTO dividas
        (produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(prodId, descricao.trim(), vendedor_pessoa.trim(), qtdNum, qtdPagaNum, valorUnitFinal, valorNumerico, dataValida, statusPago, obsTexto);

    const novo = db.prepare(`
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE d.id = ?
    `).get(info.lastInsertRowid);

    const resposta = {
      ...novo,
      pago: Boolean(novo.pago),
      quantidade: Number(novo.quantidade) || 1,
      quantidade_paga: Number(novo.quantidade_paga) || 0,
      valor_unitario: parseFloat(novo.valor_unitario) || parseFloat(novo.valor),
      valor: parseFloat(novo.valor)
    };

    return res.status(201).json(resposta);
  } catch (error) {
    console.error('Erro ao cadastrar dívida no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao salvar lançamento de dívida.' });
  }
};

export const atualizarDivida = (req, res) => {
  const { id } = req.params;
  const { produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao } = req.body;

  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return res.status(400).json({ mensagem: 'A descrição é obrigatória.' });
  }

  if (!vendedor_pessoa || typeof vendedor_pessoa !== 'string' || !vendedor_pessoa.trim()) {
    return res.status(400).json({ mensagem: 'O nome da pessoa/vendedor é obrigatório.' });
  }

  const qtdNum = Math.max(1, Math.floor(Number(quantidade) || 1));
  const unitNum = Number(valor_unitario);
  const valorNumerico = Number(valor) || (!isNaN(unitNum) && unitNum > 0 ? qtdNum * unitNum : 0);

  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ mensagem: 'O valor da dívida deve ser maior que zero.' });
  }

  const valorUnitFinal = !isNaN(unitNum) && unitNum > 0 ? unitNum : Number((valorNumerico / qtdNum).toFixed(2));
  const prodId = produto_id && !isNaN(Number(produto_id)) ? Number(produto_id) : null;
  const obsTexto = observacao && typeof observacao === 'string' ? observacao.trim() : null;
  const dataValida = String(data_lancamento).substring(0, 10);

  const statusPagoInicial = pago === true || pago === 1 || pago === 'true';
  const qtdPagaNum = Math.max(0, Math.min(qtdNum, Number(quantidade_paga) || (statusPagoInicial ? qtdNum : 0)));
  const statusPago = (statusPagoInicial || qtdPagaNum >= qtdNum) ? 1 : 0;

  try {
    const info = db.prepare(`
      UPDATE dividas
      SET produto_id = ?,
          descricao = ?,
          vendedor_pessoa = ?,
          quantidade = ?,
          quantidade_paga = ?,
          valor_unitario = ?,
          valor = ?,
          data_lancamento = ?,
          pago = ?,
          observacao = ?
      WHERE id = ?
    `).run(prodId, descricao.trim(), vendedor_pessoa.trim(), qtdNum, qtdPagaNum, valorUnitFinal, valorNumerico, dataValida, statusPago, obsTexto, id);

    if (info.changes === 0) {
      return res.status(404).json({ mensagem: 'Dívida não encontrada para atualização.' });
    }

    const atualizado = db.prepare(`
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE d.id = ?
    `).get(id);

    const resposta = {
      ...atualizado,
      pago: Boolean(atualizado.pago),
      quantidade: Number(atualizado.quantidade) || 1,
      quantidade_paga: Number(atualizado.quantidade_paga) || 0,
      valor_unitario: parseFloat(atualizado.valor_unitario) || parseFloat(atualizado.valor),
      valor: parseFloat(atualizado.valor)
    };

    return res.status(200).json(resposta);
  } catch (error) {
    console.error('Erro ao atualizar dívida no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar dívida.' });
  }
};

export const pagarQuantidadeDivida = (req, res) => {
  const { id } = req.params;
  const { quantidade_pagar } = req.body;

  const qtdPagar = Math.max(1, Math.floor(Number(quantidade_pagar) || 1));

  try {
    const dividaAtual = db.prepare('SELECT id, quantidade, quantidade_paga, pago FROM dividas WHERE id = ?').get(id);
    if (!dividaAtual) {
      return res.status(404).json({ mensagem: 'Dívida não encontrada.' });
    }

    const qtdAtualPaga = Number(dividaAtual.quantidade_paga) || (dividaAtual.pago ? dividaAtual.quantidade : 0);
    const novaQtdPaga = Math.min(dividaAtual.quantidade, qtdAtualPaga + qtdPagar);
    const novoStatus = novaQtdPaga >= dividaAtual.quantidade ? 1 : 0;

    db.prepare('UPDATE dividas SET quantidade_paga = ?, pago = ? WHERE id = ?').run(novaQtdPaga, novoStatus, id);

    const atualizado = db.prepare(`
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE d.id = ?
    `).get(id);

    const resposta = {
      ...atualizado,
      pago: Boolean(atualizado.pago),
      quantidade: Number(atualizado.quantidade) || 1,
      quantidade_paga: Number(atualizado.quantidade_paga) || 0,
      valor_unitario: parseFloat(atualizado.valor_unitario) || parseFloat(atualizado.valor),
      valor: parseFloat(atualizado.valor)
    };

    return res.status(200).json(resposta);
  } catch (error) {
    console.error('Erro ao pagar quantidade da dívida no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao registrar pagamento parcial.' });
  }
};

export const alternarStatusDivida = (req, res) => {
  const { id } = req.params;
  const { pago } = req.body;

  try {
    const dividaAtual = db.prepare('SELECT id, quantidade, quantidade_paga, pago FROM dividas WHERE id = ?').get(id);
    if (!dividaAtual) {
      return res.status(404).json({ mensagem: 'Dívida não encontrada.' });
    }

    let novoStatus;
    let novaQtdPaga;

    if (pago !== undefined) {
      novoStatus = pago === true || pago === 1 || pago === 'true' ? 1 : 0;
      novaQtdPaga = novoStatus === 1 ? dividaAtual.quantidade : 0;
    } else {
      novoStatus = dividaAtual.pago === 1 ? 0 : 1;
      novaQtdPaga = novoStatus === 1 ? dividaAtual.quantidade : 0;
    }

    db.prepare('UPDATE dividas SET pago = ?, quantidade_paga = ? WHERE id = ?').run(novoStatus, novaQtdPaga, id);

    const atualizado = db.prepare(`
      SELECT
        d.id,
        d.produto_id,
        d.descricao,
        d.vendedor_pessoa,
        d.quantidade,
        d.quantidade_paga,
        d.valor_unitario,
        d.valor,
        d.data_lancamento,
        d.pago,
        d.observacao,
        d.criado_em,
        p.nome AS produto_nome
      FROM dividas d
      LEFT JOIN produtos p ON p.id = d.produto_id
      WHERE d.id = ?
    `).get(id);

    const resposta = {
      ...atualizado,
      pago: Boolean(atualizado.pago),
      quantidade: Number(atualizado.quantidade) || 1,
      quantidade_paga: Number(atualizado.quantidade_paga) || 0,
      valor_unitario: parseFloat(atualizado.valor_unitario) || parseFloat(atualizado.valor),
      valor: parseFloat(atualizado.valor)
    };

    return res.status(200).json(resposta);
  } catch (error) {
    console.error('Erro ao alternar status no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao alterar status.' });
  }
};

export const excluirDivida = (req, res) => {
  const { id } = req.params;

  try {
    const info = db.prepare('DELETE FROM dividas WHERE id = ?').run(id);

    if (info.changes === 0) {
      return res.status(404).json({ mensagem: 'Dívida não encontrada para exclusão.' });
    }

    return res.status(200).json({ mensagem: 'Dívida excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir dívida no SQLite:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao excluir dívida.' });
  }
};
