import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Produto } from '../models/produto.model';
import { Divida, HistoricoPagamento, TotaisDividas } from '../models/divida.model';

export interface ComprovanteAnexo {
  comprovante_base64?: string | null;
  comprovante_nome?: string | null;
  comprovante_tipo?: string | null;
  observacao?: string | null;
}

export interface BackupDados {
  app: string;
  versao: number;
  data_exportacao: string;
  produtos: Produto[];
  dividas: Divida[];
  historico_pagamentos: HistoricoPagamento[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private sqlite!: SQLiteConnection;
  private db!: SQLiteDBConnection;
  private dbInicializado = false;
  private promessaInicializacao: Promise<void> | null = null;
  private isNative = Capacitor.isNativePlatform();

  // Armazenamento em memória / localStorage para fallback quando rodar no navegador (ng serve)
  private webProdutos: Produto[] = [];
  private webDividas: Divida[] = [];
  private webHistorico: HistoricoPagamento[] = [];

  constructor() {
    this.iniciarBanco();
  }

  private obterDataLocalString(): string {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private async iniciarBanco(): Promise<void> {
    if (this.dbInicializado) return;
    if (this.promessaInicializacao) return this.promessaInicializacao;

    this.promessaInicializacao = (async () => {
      if (this.isNative) {
        try {
          this.sqlite = new SQLiteConnection(CapacitorSQLite);
          await this.sqlite.checkConnectionsConsistency();

          const isConn = (await this.sqlite.isConnection('doce_divida_db', false)).result;
          if (isConn) {
            this.db = await this.sqlite.retrieveConnection('doce_divida_db', false);
          } else {
            this.db = await this.sqlite.createConnection(
              'doce_divida_db',
              false,
              'no-encryption',
              1,
              false
            );
          }

          await this.db.open();

          // Criação das tabelas no SQLite Nativo do Celular
          await this.db.execute(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS produtos (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nome TEXT NOT NULL,
              vendedor_pessoa TEXT NOT NULL DEFAULT '',
              chave_pix TEXT NULL,
              preco_padrao REAL NOT NULL DEFAULT 0.00,
              criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos (nome);

            CREATE TABLE IF NOT EXISTS dividas (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              produto_id INTEGER NULL,
              descricao TEXT NOT NULL,
              vendedor_pessoa TEXT NOT NULL,
              chave_pix TEXT NULL,
              quantidade INTEGER NOT NULL DEFAULT 1,
              quantidade_paga INTEGER NOT NULL DEFAULT 0,
              valor_unitario REAL NOT NULL DEFAULT 0.00,
              valor REAL NOT NULL DEFAULT 0.00,
              valor_pago REAL NOT NULL DEFAULT 0.00,
              data_lancamento TEXT NOT NULL,
              pago INTEGER NOT NULL DEFAULT 0,
              observacao TEXT NULL,
              comprovante_base64 TEXT NULL,
              comprovante_nome TEXT NULL,
              comprovante_tipo TEXT NULL,
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

            CREATE TABLE IF NOT EXISTS historico_pagamentos (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              divida_id INTEGER NOT NULL,
              valor_pago REAL NOT NULL DEFAULT 0.00,
              quantidade_paga INTEGER NOT NULL DEFAULT 0,
              data_pagamento TEXT NOT NULL DEFAULT (date('now', 'localtime')),
              observacao TEXT NULL,
              comprovante_base64 TEXT NULL,
              comprovante_nome TEXT NULL,
              comprovante_tipo TEXT NULL,
              criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
              CONSTRAINT fk_historico_divida
                FOREIGN KEY (divida_id)
                REFERENCES dividas (id)
                ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_historico_divida ON historico_pagamentos (divida_id);
          `);

          // Migrações seguras para instalações existentes no celular
          const infoProds = await this.db.query('PRAGMA table_info(produtos);');
          const colsProds = (infoProds.values || []).map((c: any) => c.name);
          if (!colsProds.includes('vendedor_pessoa')) {
            await this.db.execute(`ALTER TABLE produtos ADD COLUMN vendedor_pessoa TEXT NOT NULL DEFAULT '';`);
          }
          if (!colsProds.includes('chave_pix')) {
            await this.db.execute(`ALTER TABLE produtos ADD COLUMN chave_pix TEXT NULL;`);
          }

          const infoDivs = await this.db.query('PRAGMA table_info(dividas);');
          const colsDivs = (infoDivs.values || []).map((c: any) => c.name);
          if (!colsDivs.includes('chave_pix')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN chave_pix TEXT NULL;`);
          }
          if (!colsDivs.includes('quantidade')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN quantidade INTEGER NOT NULL DEFAULT 1;`);
          }
          if (!colsDivs.includes('quantidade_paga')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN quantidade_paga INTEGER NOT NULL DEFAULT 0;`);
            await this.db.execute(`UPDATE dividas SET quantidade_paga = quantidade WHERE pago = 1;`);
          }
          if (!colsDivs.includes('valor_unitario')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN valor_unitario REAL NOT NULL DEFAULT 0.00;`);
            await this.db.execute(`UPDATE dividas SET valor_unitario = valor WHERE valor_unitario = 0;`);
          }
          if (!colsDivs.includes('valor_pago')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN valor_pago REAL NOT NULL DEFAULT 0.00;`);
            await this.db.execute(`
              UPDATE dividas
              SET valor_pago = CASE
                WHEN pago = 1 THEN valor
                WHEN quantidade_paga > 0 AND quantidade > 0 THEN (CAST(quantidade_paga AS REAL) / quantidade) * valor
                ELSE 0.00
              END;
            `);
          }
          if (!colsDivs.includes('comprovante_base64')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN comprovante_base64 TEXT NULL;`);
          }
          if (!colsDivs.includes('comprovante_nome')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN comprovante_nome TEXT NULL;`);
          }
          if (!colsDivs.includes('comprovante_tipo')) {
            await this.db.execute(`ALTER TABLE dividas ADD COLUMN comprovante_tipo TEXT NULL;`);
          }

          // Seed inicial no primeiro uso caso esteja vazio
          const checkProds = await this.db.query('SELECT COUNT(*) AS total FROM produtos;');
          const totalProds = checkProds.values && checkProds.values[0] ? checkProds.values[0].total : 0;

          if (totalProds === 0) {
            await this.db.execute(`
              INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES ('Cone Trufado', 'Patrícia', 8.50);
              INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES ('Pão de Mel', 'Seu Zé', 6.00);
              INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES ('Bolo de Pote', 'Patrícia', 10.00);
              INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES ('Trufa Tradicional', 'Dona Maria', 4.50);
              INSERT INTO produtos (nome, vendedor_pessoa, preco_padrao) VALUES ('Marmita Doce', 'Patrícia', 15.00);

              INSERT INTO dividas (produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao)
              VALUES (1, 'Cone Trufado (Ninho com Nutella)', 'Patrícia', 2, 0, 8.50, 17.00, date('now', 'localtime'), 0, 'Peguei 2 depois do almoço');
              INSERT INTO dividas (produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao)
              VALUES (2, 'Pão de Mel de Doce de Leite', 'Seu Zé', 1, 0, 6.00, 6.00, date('now', 'localtime'), 0, 'Comprei no intervalo');
              INSERT INTO dividas (produto_id, descricao, vendedor_pessoa, quantidade, quantidade_paga, valor_unitario, valor, data_lancamento, pago, observacao)
              VALUES (NULL, 'Café com torta salgada', 'Dona Maria', 1, 1, 12.00, 12.00, date('now', 'localtime'), 1, 'Lançamento avulso pago');
            `);
          }

          this.dbInicializado = true;
          console.log('[SQLite Nativo] Banco inicializado com sucesso no celular!');
        } catch (erro) {
          console.error('[SQLite Nativo] Erro ao inicializar SQLite nativo:', erro);
          this.inicializarWebFallback();
        }
      } else {
        this.inicializarWebFallback();
      }
    })();

    return this.promessaInicializacao;
  }

  private inicializarWebFallback(): void {
    const prodsSalvos = localStorage.getItem('doce_divida_produtos');
    const dividasSalvas = localStorage.getItem('doce_divida_dividas');
    const historicoSalvo = localStorage.getItem('doce_divida_historico');

    if (historicoSalvo) {
      this.webHistorico = JSON.parse(historicoSalvo);
    } else {
      this.webHistorico = [];
    }

    if (prodsSalvos) {
      this.webProdutos = JSON.parse(prodsSalvos).map((p: any) => ({
        ...p,
        vendedor_pessoa: p.vendedor_pessoa || '',
        chave_pix: p.chave_pix || null
      }));
    } else {
      this.webProdutos = [
        { id: 1, nome: 'Cone Trufado', vendedor_pessoa: 'Patrícia', chave_pix: 'patricia.doces@pix.com', preco_padrao: 8.50 },
        { id: 2, nome: 'Pão de Mel', vendedor_pessoa: 'Seu Zé', chave_pix: '11999998888', preco_padrao: 6.00 },
        { id: 3, nome: 'Bolo de Pote', vendedor_pessoa: 'Patrícia', chave_pix: 'patricia.doces@pix.com', preco_padrao: 10.00 },
        { id: 4, nome: 'Trufa Tradicional', vendedor_pessoa: 'Dona Maria', chave_pix: null, preco_padrao: 4.50 },
        { id: 5, nome: 'Marmita Doce', vendedor_pessoa: 'Patrícia', chave_pix: 'patricia.doces@pix.com', preco_padrao: 15.00 }
      ];
      this.salvarWeb();
    }

    if (dividasSalvas) {
      this.webDividas = JSON.parse(dividasSalvas).map((d: any) => {
        const qtd = Number(d.quantidade) || 1;
        const pago = Boolean(d.pago);
        const qtdPaga = d.quantidade_paga !== undefined ? Number(d.quantidade_paga) : (pago ? qtd : 0);
        const total = Number(d.valor) || 0;
        const vPago = pago ? total : (d.valor_pago !== undefined ? Number(d.valor_pago) : (qtdPaga * (Number(d.valor_unitario) || (total / qtd))));
        return {
          ...d,
          quantidade: qtd,
          quantidade_paga: qtdPaga,
          valor_unitario: Number(d.valor_unitario) || (qtd > 0 ? total / qtd : total),
          valor_pago: vPago,
          pago: pago || vPago >= total
        };
      });
    } else {
      const hoje = this.obterDataLocalString();
      this.webDividas = [
        { id: 1, produto_id: 1, descricao: 'Cone Trufado (Ninho com Nutella)', vendedor_pessoa: 'Patrícia', chave_pix: 'patricia.doces@pix.com', quantidade: 2, quantidade_paga: 0, valor_unitario: 8.50, valor: 17.00, valor_pago: 0, data_lancamento: hoje, pago: false, observacao: 'Peguei 2 depois do almoço' },
        { id: 2, produto_id: 2, descricao: 'Pão de Mel de Doce de Leite', vendedor_pessoa: 'Seu Zé', chave_pix: '11999998888', quantidade: 1, quantidade_paga: 0, valor_unitario: 6.00, valor: 6.00, valor_pago: 0, data_lancamento: hoje, pago: false, observacao: 'Comprei no intervalo' },
        { id: 3, produto_id: null, descricao: 'Café com torta salgada', vendedor_pessoa: 'Dona Maria', chave_pix: null, quantidade: 1, quantidade_paga: 1, valor_unitario: 12.00, valor: 12.00, valor_pago: 12.00, data_lancamento: hoje, pago: true, observacao: 'Lançamento avulso' }
      ];
      this.salvarWeb();
    }

    this.dbInicializado = true;
    console.log('[SQLite Fallback Web] Dados carregados no navegador.');
  }

  private salvarWeb(): void {
    localStorage.setItem('doce_divida_produtos', JSON.stringify(this.webProdutos));
    localStorage.setItem('doce_divida_dividas', JSON.stringify(this.webDividas));
    localStorage.setItem('doce_divida_historico', JSON.stringify(this.webHistorico));
  }

  // ==========================================
  // PRODUTOS
  // ==========================================

  getProdutos(): Observable<Produto[]> {
    return from(this.execGetProdutos());
  }

  private async execGetProdutos(): Promise<Produto[]> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      const res = await this.db.query('SELECT id, nome, vendedor_pessoa, chave_pix, preco_padrao, criado_em FROM produtos ORDER BY nome ASC;');
      return (res.values || []).map((row: any) => ({
        id: Number(row.id),
        nome: row.nome,
        vendedor_pessoa: row.vendedor_pessoa || '',
        chave_pix: row.chave_pix || null,
        preco_padrao: parseFloat(row.preco_padrao),
        criado_em: row.criado_em
      }));
    } else {
      return [...this.webProdutos].sort((a, b) => a.nome.localeCompare(b.nome));
    }
  }

  getProduto(id: number): Observable<Produto> {
    return from(this.execGetProduto(id));
  }

  private async execGetProduto(id: number): Promise<Produto> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      const res = await this.db.query('SELECT id, nome, vendedor_pessoa, chave_pix, preco_padrao, criado_em FROM produtos WHERE id = ?;', [id]);
      if (!res.values || res.values.length === 0) {
        throw new Error('Produto não encontrado');
      }
      const row = res.values[0];
      return {
        id: Number(row.id),
        nome: row.nome,
        vendedor_pessoa: row.vendedor_pessoa || '',
        chave_pix: row.chave_pix || null,
        preco_padrao: parseFloat(row.preco_padrao),
        criado_em: row.criado_em
      };
    } else {
      const prod = this.webProdutos.find(p => p.id === id);
      if (!prod) throw new Error('Produto não encontrado');
      return { ...prod };
    }
  }

  criarProduto(produto: Produto): Observable<Produto> {
    return from(this.execCriarProduto(produto));
  }

  private async execCriarProduto(produto: Produto): Promise<Produto> {
    await this.iniciarBanco();
    const preco = Number(produto.preco_padrao) || 0;
    const vendedor = (produto.vendedor_pessoa || '').trim();
    const chavePix = produto.chave_pix && produto.chave_pix.trim() ? produto.chave_pix.trim() : null;

    if (this.isNative && this.db) {
      const res = await this.db.run(
        'INSERT INTO produtos (nome, vendedor_pessoa, chave_pix, preco_padrao) VALUES (?, ?, ?, ?);',
        [produto.nome.trim(), vendedor, chavePix, preco]
      );
      const novoId = res.changes?.lastId || 0;
      if (chavePix && vendedor) {
        await this.db.run('UPDATE produtos SET chave_pix = ? WHERE LOWER(vendedor_pessoa) = LOWER(?) AND (chave_pix IS NULL OR chave_pix = "");', [chavePix, vendedor]);
      }
      return { id: novoId, nome: produto.nome.trim(), vendedor_pessoa: vendedor, chave_pix: chavePix, preco_padrao: preco };
    } else {
      const novoId = this.webProdutos.length > 0 ? Math.max(...this.webProdutos.map(p => p.id || 0)) + 1 : 1;
      const novo: Produto = { id: novoId, nome: produto.nome.trim(), vendedor_pessoa: vendedor, chave_pix: chavePix, preco_padrao: preco };
      this.webProdutos.push(novo);
      if (chavePix && vendedor) {
        this.webProdutos.forEach(p => {
          if (p.vendedor_pessoa.toLowerCase() === vendedor.toLowerCase() && !p.chave_pix) {
            p.chave_pix = chavePix;
          }
        });
      }
      this.salvarWeb();
      return novo;
    }
  }

  atualizarProduto(id: number, produto: Produto): Observable<Produto> {
    return from(this.execAtualizarProduto(id, produto));
  }

  private async execAtualizarProduto(id: number, produto: Produto): Promise<Produto> {
    await this.iniciarBanco();
    const preco = Number(produto.preco_padrao) || 0;
    const vendedor = (produto.vendedor_pessoa || '').trim();
    const chavePix = produto.chave_pix && produto.chave_pix.trim() ? produto.chave_pix.trim() : null;

    if (this.isNative && this.db) {
      await this.db.run(
        'UPDATE produtos SET nome = ?, vendedor_pessoa = ?, chave_pix = ?, preco_padrao = ? WHERE id = ?;',
        [produto.nome.trim(), vendedor, chavePix, preco, id]
      );
      if (chavePix && vendedor) {
        await this.db.run('UPDATE produtos SET chave_pix = ? WHERE LOWER(vendedor_pessoa) = LOWER(?);', [chavePix, vendedor]);
      }
      return { id, nome: produto.nome.trim(), vendedor_pessoa: vendedor, chave_pix: chavePix, preco_padrao: preco };
    } else {
      const idx = this.webProdutos.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.webProdutos[idx] = { id, nome: produto.nome.trim(), vendedor_pessoa: vendedor, chave_pix: chavePix, preco_padrao: preco };
        if (chavePix && vendedor) {
          this.webProdutos.forEach(p => {
            if (p.vendedor_pessoa.toLowerCase() === vendedor.toLowerCase()) {
              p.chave_pix = chavePix;
            }
          });
        }
        this.salvarWeb();
      }
      return { id, nome: produto.nome.trim(), vendedor_pessoa: vendedor, chave_pix: chavePix, preco_padrao: preco };
    }
  }

  excluirProduto(id: number): Observable<{ mensagem: string }> {
    return from(this.execExcluirProduto(id));
  }

  private async execExcluirProduto(id: number): Promise<{ mensagem: string }> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      await this.db.run('DELETE FROM produtos WHERE id = ?;', [id]);
    } else {
      this.webProdutos = this.webProdutos.filter(p => p.id !== id);
      this.salvarWeb();
    }
    return { mensagem: 'Produto excluído com sucesso.' };
  }

  // ==========================================
  // DÍVIDAS
  // ==========================================

  getTotais(): Observable<TotaisDividas> {
    return from(this.execGetTotais());
  }

  private async execGetTotais(): Promise<TotaisDividas> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      const res = await this.db.query(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN pago = 1 THEN 0
              ELSE MAX(0, valor - COALESCE(valor_pago, 0))
            END
          ), 0) AS total_pendente,
          COALESCE(SUM(
            CASE
              WHEN pago = 1 THEN valor
              ELSE COALESCE(valor_pago, 0)
            END
          ), 0) AS total_pago,
          COALESCE(SUM(valor), 0) AS total_geral,
          COUNT(CASE WHEN pago = 0 THEN 1 END) AS qtd_pendente,
          COUNT(CASE WHEN pago = 1 THEN 1 END) AS qtd_pago,
          COUNT(*) AS qtd_total,
          COALESCE(SUM(CASE WHEN pago = 1 THEN 0 ELSE (quantidade - COALESCE(quantidade_paga, 0)) END), 0) AS qtd_unidades_pendentes,
          COALESCE(SUM(COALESCE(quantidade_paga, CASE WHEN pago = 1 THEN quantidade ELSE 0 END)), 0) AS qtd_unidades_pagas
        FROM dividas;
      `);

      const r = (res.values && res.values[0]) || {};
      return {
        total_pendente: parseFloat(r.total_pendente || 0),
        total_pago: parseFloat(r.total_pago || 0),
        total_geral: parseFloat(r.total_geral || 0),
        qtd_pendente: Number(r.qtd_pendente || 0),
        qtd_pago: Number(r.qtd_pago || 0),
        qtd_total: Number(r.qtd_total || 0),
        qtd_unidades_pendentes: Number(r.qtd_unidades_pendentes || 0),
        qtd_unidades_pagas: Number(r.qtd_unidades_pagas || 0)
      };
    } else {
      let totalPendente = 0;
      let totalPago = 0;
      let totalGeral = 0;
      let pendentesCount = 0;
      let pagasCount = 0;
      let unidadesPendentes = 0;
      let unidadesPagas = 0;

      for (const d of this.webDividas) {
        const qtd = Number(d.quantidade) || 1;
        const total = Number(d.valor) || 0;
        const isPago = Boolean(d.pago);
        const vPago = isPago ? total : Math.min(total, Number(d.valor_pago) || 0);
        const vPendente = isPago ? 0 : Math.max(0, total - vPago);

        totalPendente += vPendente;
        totalPago += vPago;
        totalGeral += total;

        const qtdPaga = Math.min(qtd, Number(d.quantidade_paga) || (isPago ? qtd : 0));
        const qtdRestante = Math.max(0, qtd - qtdPaga);

        if (vPendente > 0) {
          pendentesCount++;
        } else {
          pagasCount++;
        }

        unidadesPendentes += qtdRestante;
        unidadesPagas += qtdPaga;
      }

      return {
        total_pendente: totalPendente,
        total_pago: totalPago,
        total_geral: totalGeral,
        qtd_pendente: pendentesCount,
        qtd_pago: pagasCount,
        qtd_total: this.webDividas.length,
        qtd_unidades_pendentes: unidadesPendentes,
        qtd_unidades_pagas: unidadesPagas
      };
    }
  }

  getDividas(status?: boolean | string, vendedor?: string): Observable<Divida[]> {
    return from(this.execGetDividas(status, vendedor));
  }

  private async execGetDividas(status?: boolean | string, vendedor?: string): Promise<Divida[]> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      let sql = `
        SELECT
          d.id,
          d.produto_id,
          d.descricao,
          d.vendedor_pessoa,
          COALESCE(NULLIF(d.chave_pix, ''), p.chave_pix, (SELECT MAX(chave_pix) FROM produtos WHERE LOWER(vendedor_pessoa) = LOWER(d.vendedor_pessoa) AND chave_pix IS NOT NULL AND chave_pix != '')) AS chave_pix,
          d.quantidade,
          d.quantidade_paga,
          d.valor_unitario,
          d.valor,
          d.valor_pago,
          d.data_lancamento,
          d.pago,
          d.observacao,
          d.comprovante_base64,
          d.comprovante_nome,
          d.comprovante_tipo,
          d.criado_em,
          p.nome AS produto_nome
        FROM dividas d
        LEFT JOIN produtos p ON p.id = d.produto_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status !== undefined && status !== null && status !== '') {
        const isPago = status === 'true' || status === '1' || status === true || status === 'pago';
        sql += ' AND d.pago = ?';
        params.push(isPago ? 1 : 0);
      }

      if (vendedor && vendedor.trim() !== '') {
        sql += ' AND d.vendedor_pessoa LIKE ?';
        params.push(`%${vendedor.trim()}%`);
      }

      sql += ' ORDER BY d.pago ASC, d.data_lancamento DESC, d.id DESC;';

      const res = await this.db.query(sql, params);
      const resHist = await this.db.query('SELECT * FROM historico_pagamentos ORDER BY id DESC;');
      const histMap = new Map<number, HistoricoPagamento[]>();
      for (const h of (resHist.values || [])) {
        const divId = Number(h.divida_id);
        if (!histMap.has(divId)) histMap.set(divId, []);
        histMap.get(divId)!.push({
          id: Number(h.id),
          divida_id: divId,
          valor_pago: parseFloat(h.valor_pago) || 0,
          quantidade_paga: Number(h.quantidade_paga) || 0,
          data_pagamento: h.data_pagamento,
          observacao: h.observacao || null,
          comprovante_base64: h.comprovante_base64 || null,
          comprovante_nome: h.comprovante_nome || null,
          comprovante_tipo: h.comprovante_tipo || null,
          criado_em: h.criado_em
        });
      }

      return (res.values || []).map((row: any) => {
        const idNum = Number(row.id);
        const qtd = Number(row.quantidade) || 1;
        const total = parseFloat(row.valor) || 0;
        const isPagoBool = Boolean(row.pago);
        const vPago = isPagoBool ? total : (row.valor_pago !== undefined && row.valor_pago !== null ? parseFloat(row.valor_pago) : 0);
        const qtdPaga = row.quantidade_paga !== undefined ? Number(row.quantidade_paga) : (isPagoBool ? qtd : 0);
        const realmentePago = isPagoBool || vPago >= total;

        return {
          id: idNum,
          produto_id: row.produto_id ? Number(row.produto_id) : null,
          descricao: row.descricao,
          vendedor_pessoa: row.vendedor_pessoa,
          chave_pix: row.chave_pix || null,
          quantidade: qtd,
          quantidade_paga: qtdPaga,
          valor_unitario: parseFloat(row.valor_unitario) || parseFloat(row.valor),
          valor: total,
          valor_pago: vPago,
          data_lancamento: row.data_lancamento,
          pago: realmentePago,
          observacao: row.observacao,
          comprovante_base64: row.comprovante_base64 || null,
          comprovante_nome: row.comprovante_nome || null,
          comprovante_tipo: row.comprovante_tipo || null,
          criado_em: row.criado_em,
          produto_nome: row.produto_nome,
          historico_pagamentos: histMap.get(idNum) || []
        };
      });
    } else {
      let lista = this.webDividas.map(d => {
        const pixProd = this.webProdutos.find(p => p.id === d.produto_id)?.chave_pix ||
                        this.webProdutos.find(p => p.vendedor_pessoa.toLowerCase() === (d.vendedor_pessoa || '').toLowerCase() && p.chave_pix)?.chave_pix ||
                        null;
        return {
          ...d,
          chave_pix: d.chave_pix || pixProd,
          historico_pagamentos: this.webHistorico
            .filter(h => h.divida_id === d.id)
            .sort((a, b) => (b.id || 0) - (a.id || 0))
        };
      });

      if (status !== undefined && status !== null && status !== '') {
        const isPago = status === 'true' || status === '1' || status === true || status === 'pago';
        lista = lista.filter(d => Boolean(d.pago) === isPago);
      }

      if (vendedor && vendedor.trim() !== '') {
        const busca = vendedor.trim().toLowerCase();
        lista = lista.filter(d => d.vendedor_pessoa.toLowerCase().includes(busca));
      }

      lista.sort((a, b) => {
        if (a.pago !== b.pago) return a.pago ? 1 : -1;
        return (b.id || 0) - (a.id || 0);
      });

      return lista;
    }
  }

  getDivida(id: number): Observable<Divida> {
    return from(this.execGetDivida(id));
  }

  private async execGetDivida(id: number): Promise<Divida> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      const res = await this.db.query(`
        SELECT
          d.id,
          d.produto_id,
          d.descricao,
          d.vendedor_pessoa,
          COALESCE(NULLIF(d.chave_pix, ''), p.chave_pix, (SELECT MAX(chave_pix) FROM produtos WHERE LOWER(vendedor_pessoa) = LOWER(d.vendedor_pessoa) AND chave_pix IS NOT NULL AND chave_pix != '')) AS chave_pix,
          d.quantidade,
          d.quantidade_paga,
          d.valor_unitario,
          d.valor,
          d.valor_pago,
          d.data_lancamento,
          d.pago,
          d.observacao,
          d.comprovante_base64,
          d.comprovante_nome,
          d.comprovante_tipo,
          d.criado_em,
          p.nome AS produto_nome
        FROM dividas d
        LEFT JOIN produtos p ON p.id = d.produto_id
        WHERE d.id = ?;
      `, [id]);

      if (!res.values || res.values.length === 0) {
        throw new Error('Dívida não encontrada');
      }
      const row = res.values[0];
      const qtd = Number(row.quantidade) || 1;
      const total = parseFloat(row.valor) || 0;
      const isPagoBool = Boolean(row.pago);
      const vPago = isPagoBool ? total : (row.valor_pago !== undefined && row.valor_pago !== null ? parseFloat(row.valor_pago) : 0);
      const qtdPaga = row.quantidade_paga !== undefined ? Number(row.quantidade_paga) : (isPagoBool ? qtd : 0);
      const realmentePago = isPagoBool || vPago >= total;

      const resHist = await this.db.query('SELECT * FROM historico_pagamentos WHERE divida_id = ? ORDER BY id DESC;', [id]);
      const historico: HistoricoPagamento[] = (resHist.values || []).map((h: any) => ({
        id: Number(h.id),
        divida_id: Number(h.divida_id),
        valor_pago: parseFloat(h.valor_pago) || 0,
        quantidade_paga: Number(h.quantidade_paga) || 0,
        data_pagamento: h.data_pagamento,
        observacao: h.observacao || null,
        comprovante_base64: h.comprovante_base64 || null,
        comprovante_nome: h.comprovante_nome || null,
        comprovante_tipo: h.comprovante_tipo || null,
        criado_em: h.criado_em
      }));

      return {
        id: Number(row.id),
        produto_id: row.produto_id ? Number(row.produto_id) : null,
        descricao: row.descricao,
        vendedor_pessoa: row.vendedor_pessoa,
        chave_pix: row.chave_pix || null,
        quantidade: qtd,
        quantidade_paga: qtdPaga,
        valor_unitario: parseFloat(row.valor_unitario) || parseFloat(row.valor),
        valor: total,
        valor_pago: vPago,
        data_lancamento: row.data_lancamento,
        pago: realmentePago,
        observacao: row.observacao,
        comprovante_base64: row.comprovante_base64 || null,
        comprovante_nome: row.comprovante_nome || null,
        comprovante_tipo: row.comprovante_tipo || null,
        criado_em: row.criado_em,
        produto_nome: row.produto_nome,
        historico_pagamentos: historico
      };
    } else {
      const item = this.webDividas.find(d => d.id === id);
      if (!item) throw new Error('Dívida não encontrada');
      const pixProd = this.webProdutos.find(p => p.id === item.produto_id)?.chave_pix ||
                      this.webProdutos.find(p => p.vendedor_pessoa.toLowerCase() === (item.vendedor_pessoa || '').toLowerCase() && p.chave_pix)?.chave_pix ||
                      null;
      return {
        ...item,
        chave_pix: item.chave_pix || pixProd,
        historico_pagamentos: this.webHistorico
          .filter(h => h.divida_id === id)
          .sort((a, b) => (b.id || 0) - (a.id || 0))
      };
    }
  }

  criarDivida(divida: Divida): Observable<Divida> {
    return from(this.execCriarDivida(divida));
  }

  private async execCriarDivida(divida: Divida): Promise<Divida> {
    await this.iniciarBanco();
    const prodId = divida.produto_id ? Number(divida.produto_id) : null;
    const qtd = Math.max(1, Math.floor(Number(divida.quantidade) || 1));
    const valorTotal = Number(divida.valor) || 0;
    const valorUnit = Number(divida.valor_unitario) || Number((valorTotal / qtd).toFixed(2));

    const statusPagoInicial = Boolean(divida.pago);
    const valorPagoInformado = divida.valor_pago !== undefined ? Number(divida.valor_pago) : (statusPagoInicial ? valorTotal : 0);
    const valorPagoFinal = Math.max(0, Math.min(valorTotal, valorPagoInformado));
    const pagoFinal = (statusPagoInicial || valorPagoFinal >= valorTotal);
    const pagoNum = pagoFinal ? 1 : 0;
    const qtdPaga = Math.max(0, Math.min(qtd, Number(divida.quantidade_paga) || (pagoFinal ? qtd : (valorUnit > 0 ? Math.floor(valorPagoFinal / valorUnit) : 0))));
    const obs = divida.observacao ? divida.observacao.trim() : null;
    const chavePix = divida.chave_pix && divida.chave_pix.trim() ? divida.chave_pix.trim() : null;
    const comprovanteBase64 = divida.comprovante_base64 || null;
    const comprovanteNome = divida.comprovante_nome ? divida.comprovante_nome.trim() : null;
    const comprovanteTipo = divida.comprovante_tipo ? divida.comprovante_tipo.trim() : null;
    const hoje = this.obterDataLocalString();

    if (this.isNative && this.db) {
      const res = await this.db.run(`
        INSERT INTO dividas
          (produto_id, descricao, vendedor_pessoa, chave_pix, quantidade, quantidade_paga, valor_unitario, valor, valor_pago, data_lancamento, pago, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [prodId, divida.descricao.trim(), divida.vendedor_pessoa.trim(), chavePix, qtd, qtdPaga, valorUnit, valorTotal, valorPagoFinal, divida.data_lancamento, pagoNum, obs, comprovanteBase64, comprovanteNome, comprovanteTipo]);

      const novoId = res.changes?.lastId || 0;
      if (valorPagoFinal > 0 && novoId > 0) {
        await this.db.run(
          `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [novoId, valorPagoFinal, qtdPaga, hoje, 'Pagamento no ato do lançamento', comprovanteBase64, comprovanteNome, comprovanteTipo]
        );
      }
      return await this.execGetDivida(novoId);
    } else {
      const novoId = this.webDividas.length > 0 ? Math.max(...this.webDividas.map(d => d.id || 0)) + 1 : 1;
      const novo: Divida = {
        ...divida,
        id: novoId,
        produto_id: prodId,
        chave_pix: chavePix,
        quantidade: qtd,
        quantidade_paga: qtdPaga,
        valor_unitario: valorUnit,
        valor: valorTotal,
        valor_pago: valorPagoFinal,
        pago: pagoFinal,
        observacao: obs,
        comprovante_base64: comprovanteBase64,
        comprovante_nome: comprovanteNome,
        comprovante_tipo: comprovanteTipo
      };
      this.webDividas.push(novo);
      if (valorPagoFinal > 0) {
        const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(h => h.id || 0)) + 1 : 1;
        this.webHistorico.push({
          id: novoHistId,
          divida_id: novoId,
          valor_pago: valorPagoFinal,
          quantidade_paga: qtdPaga,
          data_pagamento: hoje,
          observacao: 'Pagamento no ato do lançamento',
          comprovante_base64: comprovanteBase64,
          comprovante_nome: comprovanteNome,
          comprovante_tipo: comprovanteTipo
        });
      }
      this.salvarWeb();
      return await this.execGetDivida(novoId);
    }
  }

  atualizarDivida(id: number, divida: Divida): Observable<Divida> {
    return from(this.execAtualizarDivida(id, divida));
  }

  private async execAtualizarDivida(id: number, divida: Divida): Promise<Divida> {
    await this.iniciarBanco();
    const prodId = divida.produto_id ? Number(divida.produto_id) : null;
    const qtd = Math.max(1, Math.floor(Number(divida.quantidade) || 1));
    const valorTotal = Number(divida.valor) || 0;
    const valorUnit = Number(divida.valor_unitario) || Number((valorTotal / qtd).toFixed(2));

    const statusPagoInicial = divida.pago === true;
    const valorPagoInformado = divida.valor_pago !== undefined ? Number(divida.valor_pago) : (statusPagoInicial ? valorTotal : 0);
    const valorPagoFinal = Math.max(0, Math.min(valorTotal, valorPagoInformado));
    const pagoFinal = (statusPagoInicial || valorPagoFinal >= valorTotal);
    const pagoNum = pagoFinal ? 1 : 0;
    const qtdPaga = Math.max(0, Math.min(qtd, Number(divida.quantidade_paga) || (pagoFinal ? qtd : (valorUnit > 0 ? Math.floor(valorPagoFinal / valorUnit) : 0))));
    const obs = divida.observacao ? divida.observacao.trim() : null;
    const chavePix = divida.chave_pix && divida.chave_pix.trim() ? divida.chave_pix.trim() : null;
    const comprovanteBase64 = divida.comprovante_base64 || null;
    const comprovanteNome = divida.comprovante_nome ? divida.comprovante_nome.trim() : null;
    const comprovanteTipo = divida.comprovante_tipo ? divida.comprovante_tipo.trim() : null;

    if (this.isNative && this.db) {
      await this.db.run(`
        UPDATE dividas
        SET produto_id = ?,
            descricao = ?,
            vendedor_pessoa = ?,
            chave_pix = ?,
            quantidade = ?,
            quantidade_paga = ?,
            valor_unitario = ?,
            valor = ?,
            valor_pago = ?,
            data_lancamento = ?,
            pago = ?,
            observacao = ?,
            comprovante_base64 = ?,
            comprovante_nome = ?,
            comprovante_tipo = ?
        WHERE id = ?;
      `, [prodId, divida.descricao.trim(), divida.vendedor_pessoa.trim(), chavePix, qtd, qtdPaga, valorUnit, valorTotal, valorPagoFinal, divida.data_lancamento, pagoNum, obs, comprovanteBase64, comprovanteNome, comprovanteTipo, id]);

      return await this.execGetDivida(id);
    } else {
      const idx = this.webDividas.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.webDividas[idx] = {
          ...this.webDividas[idx],
          ...divida,
          id,
          produto_id: prodId,
          chave_pix: chavePix,
          quantidade: qtd,
          quantidade_paga: qtdPaga,
          valor_unitario: valorUnit,
          valor: valorTotal,
          valor_pago: valorPagoFinal,
          pago: pagoFinal,
          observacao: obs,
          comprovante_base64: comprovanteBase64,
          comprovante_nome: comprovanteNome,
          comprovante_tipo: comprovanteTipo
        };
        this.salvarWeb();
      }
      return await this.execGetDivida(id);
    }
  }

  pagarQuantidade(id: number, quantidadePagar: number, anexo?: ComprovanteAnexo): Observable<Divida> {
    return from(this.execPagarQuantidade(id, quantidadePagar, anexo));
  }

  private async execPagarQuantidade(id: number, quantidadePagar: number, anexo?: ComprovanteAnexo): Promise<Divida> {
    await this.iniciarBanco();
    const qtdPagar = Math.max(1, Math.floor(Number(quantidadePagar) || 1));
    const hoje = this.obterDataLocalString();

    if (this.isNative && this.db) {
      const res = await this.db.query('SELECT id, quantidade, quantidade_paga, valor_unitario, valor, valor_pago, pago FROM dividas WHERE id = ?;', [id]);
      if (!res.values || res.values.length === 0) {
        throw new Error('Dívida não encontrada');
      }
      const item = res.values[0];
      const qtdTotal = Number(item.quantidade) || 1;
      const valorTotal = Number(item.valor) || 0;
      const unitario = Number(item.valor_unitario) || (qtdTotal > 0 ? valorTotal / qtdTotal : valorTotal);
      const qtdJaPaga = Number(item.quantidade_paga) || (item.pago ? qtdTotal : 0);
      const vJaPago = item.pago ? valorTotal : (item.valor_pago !== undefined && item.valor_pago !== null ? Number(item.valor_pago) : (qtdJaPaga * unitario));
      const novaQtdPaga = Math.min(qtdTotal, qtdJaPaga + qtdPagar);
      const qtdEfetiva = Math.max(0, novaQtdPaga - qtdJaPaga);
      const novoValorPago = Math.min(valorTotal, novaQtdPaga * unitario);
      const valorEfetivo = Math.max(0, Number((novoValorPago - vJaPago).toFixed(2)));
      const novoStatus = (novaQtdPaga >= qtdTotal || novoValorPago >= valorTotal) ? 1 : 0;

      if (anexo?.comprovante_base64) {
        await this.db.run(
          'UPDATE dividas SET quantidade_paga = ?, valor_pago = ?, pago = ?, comprovante_base64 = ?, comprovante_nome = ?, comprovante_tipo = ? WHERE id = ?;',
          [novaQtdPaga, novoValorPago, novoStatus, anexo.comprovante_base64, anexo.comprovante_nome || 'Comprovante', anexo.comprovante_tipo || 'imagem', id]
        );
      } else {
        await this.db.run('UPDATE dividas SET quantidade_paga = ?, valor_pago = ?, pago = ? WHERE id = ?;', [novaQtdPaga, novoValorPago, novoStatus, id]);
      }

      if (valorEfetivo > 0 || qtdEfetiva > 0) {
        await this.db.run(
          `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [id, valorEfetivo, qtdEfetiva, hoje, anexo?.observacao || `Pagamento de ${qtdEfetiva} un.`, anexo?.comprovante_base64 || null, anexo?.comprovante_nome || null, anexo?.comprovante_tipo || null]
        );
      }

      return await this.execGetDivida(id);
    } else {
      const item = this.webDividas.find(d => d.id === id);
      if (item) {
        const qtdTotal = Number(item.quantidade) || 1;
        const valorTotal = Number(item.valor) || 0;
        const unitario = Number(item.valor_unitario) || (qtdTotal > 0 ? valorTotal / qtdTotal : valorTotal);
        const qtdJaPaga = Number(item.quantidade_paga) || (item.pago ? qtdTotal : 0);
        const vJaPago = item.pago ? valorTotal : (item.valor_pago !== undefined && item.valor_pago !== null ? Number(item.valor_pago) : (qtdJaPaga * unitario));
        const novaQtdPaga = Math.min(qtdTotal, qtdJaPaga + qtdPagar);
        const qtdEfetiva = Math.max(0, novaQtdPaga - qtdJaPaga);
        const novoValorPago = Math.min(valorTotal, novaQtdPaga * unitario);
        const valorEfetivo = Math.max(0, Number((novoValorPago - vJaPago).toFixed(2)));

        item.quantidade_paga = novaQtdPaga;
        item.valor_pago = novoValorPago;
        item.pago = (novaQtdPaga >= qtdTotal || novoValorPago >= valorTotal);
        if (anexo?.comprovante_base64) {
          item.comprovante_base64 = anexo.comprovante_base64;
          item.comprovante_nome = anexo.comprovante_nome || 'Comprovante';
          item.comprovante_tipo = anexo.comprovante_tipo || 'imagem';
        }

        if (valorEfetivo > 0 || qtdEfetiva > 0) {
          const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(h => h.id || 0)) + 1 : 1;
          this.webHistorico.push({
            id: novoHistId,
            divida_id: id,
            valor_pago: valorEfetivo,
            quantidade_paga: qtdEfetiva,
            data_pagamento: hoje,
            observacao: anexo?.observacao || `Pagamento de ${qtdEfetiva} un.`,
            comprovante_base64: anexo?.comprovante_base64 || null,
            comprovante_nome: anexo?.comprovante_nome || null,
            comprovante_tipo: anexo?.comprovante_tipo || null
          });
        }

        this.salvarWeb();
        return await this.execGetDivida(id);
      }
      throw new Error('Dívida não encontrada');
    }
  }

  pagarValor(id: number, valorPagar: number, anexo?: ComprovanteAnexo): Observable<Divida> {
    return from(this.execPagarValor(id, valorPagar, anexo));
  }

  private async execPagarValor(id: number, valorPagar: number, anexo?: ComprovanteAnexo): Promise<Divida> {
    await this.iniciarBanco();
    const vPagar = Math.max(0.01, Number(valorPagar) || 0);
    const hoje = this.obterDataLocalString();

    if (this.isNative && this.db) {
      const res = await this.db.query('SELECT id, quantidade, quantidade_paga, valor_unitario, valor, valor_pago, pago FROM dividas WHERE id = ?;', [id]);
      if (!res.values || res.values.length === 0) {
        throw new Error('Dívida não encontrada');
      }
      const item = res.values[0];
      const qtdTotal = Number(item.quantidade) || 1;
      const valorTotal = Number(item.valor) || 0;
      const unitario = Number(item.valor_unitario) || (qtdTotal > 0 ? valorTotal / qtdTotal : valorTotal);
      const vJaPago = item.pago ? valorTotal : (item.valor_pago !== undefined && item.valor_pago !== null ? Number(item.valor_pago) : 0);
      const novoValorPago = Math.min(valorTotal, Number((vJaPago + vPagar).toFixed(2)));
      const valorEfetivo = Math.max(0, Number((novoValorPago - vJaPago).toFixed(2)));
      const novoStatus = novoValorPago >= valorTotal ? 1 : 0;
      const novaQtdPaga = novoStatus === 1 ? qtdTotal : (unitario > 0 ? Math.min(qtdTotal, Math.floor(novoValorPago / unitario)) : 0);
      const qtdJaPaga = Number(item.quantidade_paga) || 0;
      const qtdEfetiva = Math.max(0, novaQtdPaga - qtdJaPaga);

      if (anexo?.comprovante_base64) {
        await this.db.run(
          'UPDATE dividas SET valor_pago = ?, quantidade_paga = ?, pago = ?, comprovante_base64 = ?, comprovante_nome = ?, comprovante_tipo = ? WHERE id = ?;',
          [novoValorPago, novaQtdPaga, novoStatus, anexo.comprovante_base64, anexo.comprovante_nome || 'Comprovante', anexo.comprovante_tipo || 'imagem', id]
        );
      } else {
        await this.db.run('UPDATE dividas SET valor_pago = ?, quantidade_paga = ?, pago = ? WHERE id = ?;', [novoValorPago, novaQtdPaga, novoStatus, id]);
      }

      if (valorEfetivo > 0) {
        await this.db.run(
          `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [id, valorEfetivo, qtdEfetiva, hoje, anexo?.observacao || `Amortização de R$ ${valorEfetivo.toFixed(2)}`, anexo?.comprovante_base64 || null, anexo?.comprovante_nome || null, anexo?.comprovante_tipo || null]
        );
      }

      return await this.execGetDivida(id);
    } else {
      const item = this.webDividas.find(d => d.id === id);
      if (item) {
        const qtdTotal = Number(item.quantidade) || 1;
        const valorTotal = Number(item.valor) || 0;
        const unitario = Number(item.valor_unitario) || (qtdTotal > 0 ? valorTotal / qtdTotal : valorTotal);
        const vJaPago = item.pago ? valorTotal : (item.valor_pago !== undefined && item.valor_pago !== null ? Number(item.valor_pago) : 0);
        const novoValorPago = Math.min(valorTotal, Number((vJaPago + vPagar).toFixed(2)));
        const valorEfetivo = Math.max(0, Number((novoValorPago - vJaPago).toFixed(2)));
        const novoStatus = novoValorPago >= valorTotal;
        const novaQtdPaga = novoStatus ? qtdTotal : (unitario > 0 ? Math.min(qtdTotal, Math.floor(novoValorPago / unitario)) : 0);
        const qtdJaPaga = Number(item.quantidade_paga) || 0;
        const qtdEfetiva = Math.max(0, novaQtdPaga - qtdJaPaga);

        item.valor_pago = novoValorPago;
        item.quantidade_paga = novaQtdPaga;
        item.pago = novoStatus;
        if (anexo?.comprovante_base64) {
          item.comprovante_base64 = anexo.comprovante_base64;
          item.comprovante_nome = anexo.comprovante_nome || 'Comprovante';
          item.comprovante_tipo = anexo.comprovante_tipo || 'imagem';
        }

        if (valorEfetivo > 0) {
          const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(h => h.id || 0)) + 1 : 1;
          this.webHistorico.push({
            id: novoHistId,
            divida_id: id,
            valor_pago: valorEfetivo,
            quantidade_paga: qtdEfetiva,
            data_pagamento: hoje,
            observacao: anexo?.observacao || `Amortização de R$ ${valorEfetivo.toFixed(2)}`,
            comprovante_base64: anexo?.comprovante_base64 || null,
            comprovante_nome: anexo?.comprovante_nome || null,
            comprovante_tipo: anexo?.comprovante_tipo || null
          });
        }

        this.salvarWeb();
        return await this.execGetDivida(id);
      }
      throw new Error('Dívida não encontrada');
    }
  }

  quitarLote(ids: number[], anexo?: ComprovanteAnexo): Observable<{ quitados: number; valorTotalQuitado: number }> {
    return from(this.execQuitarLote(ids, anexo));
  }

  private async execQuitarLote(ids: number[], anexo?: ComprovanteAnexo): Promise<{ quitados: number; valorTotalQuitado: number }> {
    await this.iniciarBanco();
    const hoje = this.obterDataLocalString();
    let quitados = 0;
    let valorTotalQuitado = 0;

    if (!ids || ids.length === 0) {
      return { quitados: 0, valorTotalQuitado: 0 };
    }

    if (this.isNative && this.db) {
      for (const id of ids) {
        const res = await this.db.query('SELECT id, quantidade, quantidade_paga, valor, valor_pago, pago FROM dividas WHERE id = ?;', [id]);
        if (!res.values || res.values.length === 0) continue;
        const item = res.values[0];
        if (item.pago) continue;

        const qtdTotal = Number(item.quantidade) || 1;
        const qtdJaPaga = Number(item.quantidade_paga) || 0;
        const valorTotal = Number(item.valor) || 0;
        const vJaPago = Number(item.valor_pago) || 0;
        const restanteValor = Math.max(0, Number((valorTotal - vJaPago).toFixed(2)));
        const restanteQtd = Math.max(0, qtdTotal - qtdJaPaga);

        if (anexo?.comprovante_base64) {
          await this.db.run(
            'UPDATE dividas SET pago = 1, quantidade_paga = ?, valor_pago = ?, comprovante_base64 = ?, comprovante_nome = ?, comprovante_tipo = ? WHERE id = ?;',
            [qtdTotal, valorTotal, anexo.comprovante_base64, anexo.comprovante_nome || 'Comprovante Lote', anexo.comprovante_tipo || 'imagem', id]
          );
        } else {
          await this.db.run(
            'UPDATE dividas SET pago = 1, quantidade_paga = ?, valor_pago = ? WHERE id = ?;',
            [qtdTotal, valorTotal, id]
          );
        }

        if (restanteValor > 0) {
          await this.db.run(
            `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [id, restanteValor, restanteQtd, hoje, anexo?.observacao || 'Quitação em lote', anexo?.comprovante_base64 || null, anexo?.comprovante_nome || null, anexo?.comprovante_tipo || null]
          );
        }

        quitados++;
        valorTotalQuitado += restanteValor;
      }
      return { quitados, valorTotalQuitado: Number(valorTotalQuitado.toFixed(2)) };
    } else {
      for (const id of ids) {
        const item = this.webDividas.find(d => d.id === id);
        if (!item || item.pago) continue;

        const qtdTotal = Number(item.quantidade) || 1;
        const qtdJaPaga = Number(item.quantidade_paga) || 0;
        const valorTotal = Number(item.valor) || 0;
        const vJaPago = Number(item.valor_pago) || 0;
        const restanteValor = Math.max(0, Number((valorTotal - vJaPago).toFixed(2)));
        const restanteQtd = Math.max(0, qtdTotal - qtdJaPaga);

        item.pago = true;
        item.quantidade_paga = qtdTotal;
        item.valor_pago = valorTotal;
        if (anexo?.comprovante_base64) {
          item.comprovante_base64 = anexo.comprovante_base64;
          item.comprovante_nome = anexo.comprovante_nome || 'Comprovante Lote';
          item.comprovante_tipo = anexo.comprovante_tipo || 'imagem';
        }

        if (restanteValor > 0) {
          const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(h => h.id || 0)) + 1 : 1;
          this.webHistorico.push({
            id: novoHistId,
            divida_id: id,
            valor_pago: restanteValor,
            quantidade_paga: restanteQtd,
            data_pagamento: hoje,
            observacao: anexo?.observacao || 'Quitação em lote',
            comprovante_base64: anexo?.comprovante_base64 || null,
            comprovante_nome: anexo?.comprovante_nome || null,
            comprovante_tipo: anexo?.comprovante_tipo || null
          });
        }

        quitados++;
        valorTotalQuitado += restanteValor;
      }
      this.salvarWeb();
      return { quitados, valorTotalQuitado: Number(valorTotalQuitado.toFixed(2)) };
    }
  }

  alternarStatus(id: number, pago?: boolean): Observable<Divida> {
    return from(this.execAlternarStatus(id, pago));
  }

  private async execAlternarStatus(id: number, pago?: boolean): Promise<Divida> {
    await this.iniciarBanco();
    const hoje = this.obterDataLocalString();
    if (this.isNative && this.db) {
      const res = await this.db.query('SELECT id, quantidade, quantidade_paga, valor, valor_pago, pago FROM dividas WHERE id = ?;', [id]);
      if (!res.values || res.values.length === 0) {
        throw new Error('Dívida não encontrada');
      }
      const item = res.values[0];
      const qtdTotal = Number(item.quantidade) || 1;
      const valorTotal = Number(item.valor) || 0;
      const vJaPago = Number(item.valor_pago) || 0;
      const qtdJaPaga = Number(item.quantidade_paga) || 0;

      let novoStatus: number;
      let novaQtdPaga: number;
      let novoValorPago: number;

      if (pago !== undefined) {
        novoStatus = pago ? 1 : 0;
      } else {
        novoStatus = item.pago ? 0 : 1;
      }
      novaQtdPaga = novoStatus === 1 ? qtdTotal : 0;
      novoValorPago = novoStatus === 1 ? valorTotal : 0;

      await this.db.run('UPDATE dividas SET pago = ?, quantidade_paga = ?, valor_pago = ? WHERE id = ?;', [novoStatus, novaQtdPaga, novoValorPago, id]);

      if (novoStatus === 1) {
        const diffVal = Math.max(0, Number((valorTotal - vJaPago).toFixed(2)));
        const diffQtd = Math.max(0, qtdTotal - qtdJaPaga);
        if (diffVal > 0) {
          await this.db.run(
            `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao)
             VALUES (?, ?, ?, ?, ?);`,
            [id, diffVal, diffQtd, hoje, 'Quitação total do pedido']
          );
        }
      } else {
        await this.db.run('DELETE FROM historico_pagamentos WHERE divida_id = ?;', [id]);
      }

      return await this.execGetDivida(id);
    } else {
      const item = this.webDividas.find(d => d.id === id);
      if (item) {
        const qtdTotal = Number(item.quantidade) || 1;
        const valorTotal = Number(item.valor) || 0;
        const vJaPago = Number(item.valor_pago) || 0;
        const qtdJaPaga = Number(item.quantidade_paga) || 0;
        const novoStatus = pago !== undefined ? pago : !item.pago;

        item.pago = novoStatus;
        item.quantidade_paga = novoStatus ? qtdTotal : 0;
        item.valor_pago = novoStatus ? valorTotal : 0;

        if (novoStatus) {
          const diffVal = Math.max(0, Number((valorTotal - vJaPago).toFixed(2)));
          const diffQtd = Math.max(0, qtdTotal - qtdJaPaga);
          if (diffVal > 0) {
            const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(h => h.id || 0)) + 1 : 1;
            this.webHistorico.push({
              id: novoHistId,
              divida_id: id,
              valor_pago: diffVal,
              quantidade_paga: diffQtd,
              data_pagamento: hoje,
              observacao: 'Quitação total do pedido'
            });
          }
        } else {
          this.webHistorico = this.webHistorico.filter(h => h.divida_id !== id);
        }

        this.salvarWeb();
        return await this.execGetDivida(id);
      }
      throw new Error('Dívida não encontrada');
    }
  }

  excluirDivida(id: number): Observable<{ mensagem: string }> {
    return from(this.execExcluirDivida(id));
  }

  private async execExcluirDivida(id: number): Promise<{ mensagem: string }> {
    await this.iniciarBanco();
    if (this.isNative && this.db) {
      await this.db.run('DELETE FROM dividas WHERE id = ?;', [id]);
    } else {
      this.webDividas = this.webDividas.filter(d => d.id !== id);
      this.webHistorico = this.webHistorico.filter(h => h.divida_id !== id);
      this.salvarWeb();
    }
    return { mensagem: 'Dívida excluída com sucesso.' };
  }

  // ==========================================
  // BACKUP E RESTAURAÇÃO (SEGURANÇA DOS DADOS)
  // ==========================================

  exportarBackup(): Observable<BackupDados> {
    return from(this.execExportarBackup());
  }

  private async execExportarBackup(): Promise<BackupDados> {
    await this.iniciarBanco();
    const agora = new Date();
    const dataExportacao = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    const produtos = await this.execGetProdutos();
    const dividas = await this.execGetDividas();

    let historico: HistoricoPagamento[] = [];
    if (this.isNative && this.db) {
      const resHist = await this.db.query('SELECT * FROM historico_pagamentos ORDER BY id ASC;');
      historico = (resHist.values || []).map((h: any) => ({
        id: Number(h.id),
        divida_id: Number(h.divida_id),
        valor_pago: Number(h.valor_pago) || 0,
        quantidade_paga: Number(h.quantidade_paga) || 0,
        data_pagamento: h.data_pagamento || '',
        observacao: h.observacao || null,
        comprovante_base64: h.comprovante_base64 || null,
        comprovante_nome: h.comprovante_nome || null,
        comprovante_tipo: h.comprovante_tipo || null,
        criado_em: h.criado_em || ''
      }));
    } else {
      historico = [...this.webHistorico];
    }

    return {
      app: 'Doce Dívida SQLite',
      versao: 2,
      data_exportacao: dataExportacao,
      produtos,
      dividas,
      historico_pagamentos: historico
    };
  }

  importarBackup(
    backup: BackupDados,
    modo: 'substituir' | 'mesclar' = 'substituir'
  ): Observable<{ produtosImportados: number; dividasImportadas: number; historicoImportado: number }> {
    return from(this.execImportarBackup(backup, modo));
  }

  private async execImportarBackup(
    backup: BackupDados,
    modo: 'substituir' | 'mesclar'
  ): Promise<{ produtosImportados: number; dividasImportadas: number; historicoImportado: number }> {
    await this.iniciarBanco();

    if (!backup || (!Array.isArray(backup.produtos) && !Array.isArray(backup.dividas))) {
      throw new Error('Arquivo de backup inválido ou corrompido.');
    }

    const prodsIn = Array.isArray(backup.produtos) ? backup.produtos : [];
    const divsIn = Array.isArray(backup.dividas) ? backup.dividas : [];
    const histIn = Array.isArray(backup.historico_pagamentos) ? backup.historico_pagamentos : [];

    let produtosImportados = 0;
    let dividasImportadas = 0;
    let historicoImportado = 0;

    if (this.isNative && this.db) {
      if (modo === 'substituir') {
        await this.db.execute('DELETE FROM historico_pagamentos; DELETE FROM dividas; DELETE FROM produtos;');
      }

      const mapaProdutoIds = new Map<number, number>();
      for (const p of prodsIn) {
        if (!p.nome) continue;
        const resP = await this.db.run(
          'INSERT INTO produtos (nome, vendedor_pessoa, chave_pix, preco_padrao) VALUES (?, ?, ?, ?);',
          [
            String(p.nome).trim(),
            String(p.vendedor_pessoa || '').trim(),
            p.chave_pix ? String(p.chave_pix).trim() : null,
            Number(p.preco_padrao) || 0
          ]
        );
        const novoId = resP.changes?.lastId || 0;
        if (p.id && novoId) {
          mapaProdutoIds.set(Number(p.id), novoId);
        }
        produtosImportados++;
      }

      const mapaDividaIds = new Map<number, number>();
      for (const d of divsIn) {
        if (!d.descricao) continue;
        const prodIdMapeado = d.produto_id ? (mapaProdutoIds.get(Number(d.produto_id)) || null) : null;
        const qtd = Math.max(1, Number(d.quantidade) || 1);
        const vTotal = Number(d.valor) || 0;
        const vUnit = Number(d.valor_unitario) || Number((vTotal / qtd).toFixed(2));
        const isPago = Boolean(d.pago);
        const vPago = isPago ? vTotal : Math.min(vTotal, Number(d.valor_pago) || 0);
        const qPaga = isPago ? qtd : Math.min(qtd, Number(d.quantidade_paga) || 0);

        const resD = await this.db.run(
          `INSERT INTO dividas
            (produto_id, descricao, vendedor_pessoa, chave_pix, quantidade, quantidade_paga, valor_unitario, valor, valor_pago, data_lancamento, pago, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            prodIdMapeado,
            String(d.descricao).trim(),
            String(d.vendedor_pessoa || '').trim(),
            d.chave_pix ? String(d.chave_pix).trim() : null,
            qtd,
            qPaga,
            vUnit,
            vTotal,
            vPago,
            d.data_lancamento || this.obterDataLocalString(),
            isPago ? 1 : 0,
            d.observacao || null,
            d.comprovante_base64 || null,
            d.comprovante_nome || null,
            d.comprovante_tipo || null
          ]
        );
        const novaDivId = resD.changes?.lastId || 0;
        if (d.id && novaDivId) {
          mapaDividaIds.set(Number(d.id), novaDivId);
        }
        dividasImportadas++;
      }

      for (const h of histIn) {
        const divIdNovo = mapaDividaIds.get(Number(h.divida_id));
        if (!divIdNovo) continue;
        await this.db.run(
          `INSERT INTO historico_pagamentos (divida_id, valor_pago, quantidade_paga, data_pagamento, observacao, comprovante_base64, comprovante_nome, comprovante_tipo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            divIdNovo,
            Number(h.valor_pago) || 0,
            Number(h.quantidade_paga) || 0,
            h.data_pagamento || this.obterDataLocalString(),
            h.observacao || null,
            h.comprovante_base64 || null,
            h.comprovante_nome || null,
            h.comprovante_tipo || null
          ]
        );
        historicoImportado++;
      }
    } else {
      if (modo === 'substituir') {
        this.webProdutos = [];
        this.webDividas = [];
        this.webHistorico = [];
      }

      const mapaProdutoIds = new Map<number, number>();
      for (const p of prodsIn) {
        if (!p.nome) continue;
        const novoId = this.webProdutos.length > 0 ? Math.max(...this.webProdutos.map(x => x.id || 0)) + 1 : 1;
        this.webProdutos.push({
          id: novoId,
          nome: String(p.nome).trim(),
          vendedor_pessoa: String(p.vendedor_pessoa || '').trim(),
          chave_pix: p.chave_pix ? String(p.chave_pix).trim() : null,
          preco_padrao: Number(p.preco_padrao) || 0
        });
        if (p.id) mapaProdutoIds.set(Number(p.id), novoId);
        produtosImportados++;
      }

      const mapaDividaIds = new Map<number, number>();
      for (const d of divsIn) {
        if (!d.descricao) continue;
        const novaDivId = this.webDividas.length > 0 ? Math.max(...this.webDividas.map(x => x.id || 0)) + 1 : 1;
        const prodIdMapeado = d.produto_id ? (mapaProdutoIds.get(Number(d.produto_id)) || null) : null;
        const qtd = Math.max(1, Number(d.quantidade) || 1);
        const vTotal = Number(d.valor) || 0;
        const vUnit = Number(d.valor_unitario) || Number((vTotal / qtd).toFixed(2));
        const isPago = Boolean(d.pago);
        const vPago = isPago ? vTotal : Math.min(vTotal, Number(d.valor_pago) || 0);
        const qPaga = isPago ? qtd : Math.min(qtd, Number(d.quantidade_paga) || 0);

        this.webDividas.push({
          id: novaDivId,
          produto_id: prodIdMapeado,
          descricao: String(d.descricao).trim(),
          vendedor_pessoa: String(d.vendedor_pessoa || '').trim(),
          chave_pix: d.chave_pix ? String(d.chave_pix).trim() : null,
          quantidade: qtd,
          quantidade_paga: qPaga,
          valor_unitario: vUnit,
          valor: vTotal,
          valor_pago: vPago,
          data_lancamento: d.data_lancamento || this.obterDataLocalString(),
          pago: isPago,
          observacao: d.observacao || null,
          comprovante_base64: d.comprovante_base64 || null,
          comprovante_nome: d.comprovante_nome || null,
          comprovante_tipo: d.comprovante_tipo || null
        });
        if (d.id) mapaDividaIds.set(Number(d.id), novaDivId);
        dividasImportadas++;
      }

      for (const h of histIn) {
        const divIdNovo = mapaDividaIds.get(Number(h.divida_id));
        if (!divIdNovo) continue;
        const novoHistId = this.webHistorico.length > 0 ? Math.max(...this.webHistorico.map(x => x.id || 0)) + 1 : 1;
        this.webHistorico.push({
          id: novoHistId,
          divida_id: divIdNovo,
          valor_pago: Number(h.valor_pago) || 0,
          quantidade_paga: Number(h.quantidade_paga) || 0,
          data_pagamento: h.data_pagamento || this.obterDataLocalString(),
          observacao: h.observacao || null,
          comprovante_base64: h.comprovante_base64 || null,
          comprovante_nome: h.comprovante_nome || null,
          comprovante_tipo: h.comprovante_tipo || null
        });
        historicoImportado++;
      }

      this.salvarWeb();
    }

    return { produtosImportados, dividasImportadas, historicoImportado };
  }
}
