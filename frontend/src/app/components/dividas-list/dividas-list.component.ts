import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService, ComprovanteAnexo } from '../../services/api.service';
import { Divida, GrupoDivida, HistoricoPagamento, TotaisDividas } from '../../models/divida.model';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PagamentoParcialDialogComponent, ResultadoPagamentoParcial } from '../../shared/components/pagamento-parcial-dialog/pagamento-parcial-dialog.component';
import { ComprovanteVisualizarDialogComponent } from '../../shared/components/comprovante-visualizar-dialog/comprovante-visualizar-dialog.component';
import { QuitarLoteDialogComponent, ResultadoQuitarLote } from '../../shared/components/quitar-lote-dialog/quitar-lote-dialog.component';
import { WhatsappResumoDialogComponent } from '../../shared/components/whatsapp-resumo-dialog/whatsapp-resumo-dialog.component';
import { EditarDividaDialogComponent } from '../../shared/components/editar-divida-dialog/editar-divida-dialog.component';

export interface ResumoPessoaPendente {
  vendedor_pessoa: string;
  chave_pix?: string | null;
  total_pendente: number;
  qtd_pedidos: number;
  itens: Divida[];
}

export interface OpcaoMes {
  chave: string; // 'YYYY-MM'
  label: string; // 'Novembro/2026'
  curto: string; // 'Nov/26'
}

@Component({
  selector: 'app-dividas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatRippleModule, MatDialogModule],
  templateUrl: './dividas-list.component.html',
  styleUrls: ['./dividas-list.component.css']
})
export class DividasListComponent implements OnInit {
  Math = Math;
  @Output() abrirNovo = new EventEmitter<void>();

  todasDividas: Divida[] = [];
  dividas: Divida[] = [];
  grupos: GrupoDivida[] = [];
  pessoasPendentes: ResumoPessoaPendente[] = [];
  mesesDisponiveis: OpcaoMes[] = [];
  mesSelecionado: string = 'todos'; // 'todos' ou 'YYYY-MM'

  totais: TotaisDividas = {
    total_pendente: 0,
    total_pago: 0,
    total_geral: 0,
    qtd_pendente: 0,
    qtd_pago: 0,
    qtd_total: 0,
    qtd_unidades_pendentes: 0,
    qtd_unidades_pagas: 0
  };

  carregando = false;
  filtroStatus: string = 'todas'; // 'todas' | 'pendentes' | 'pagas'
  buscaVendedor: string = '';
  mensagemFeedback: string | null = null;
  tipoFeedback: 'sucesso' | 'erro' = 'sucesso';

  // Conjunto de chaves de grupos abertos para preservar expansão do usuário após operações
  chavesExpandidas = new Set<string>();

  private readonly nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  private readonly nomesMesesCurtos = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  get labelPeriodoAtual(): string {
    if (this.mesSelecionado === 'todos') return 'Todos os Meses';
    const encontrado = this.mesesDisponiveis.find(m => m.chave === this.mesSelecionado);
    return encontrado ? encontrado.label : this.mesSelecionado;
  }

  carregarDados(): void {
    this.carregando = true;

    this.apiService.getDividas().subscribe({
      next: (dados) => {
        this.todasDividas = dados;
        this.construirMesesDisponiveis(dados);
        this.processarFiltrosLocais();
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar dívidas:', err);
        this.exibirFeedback('Erro ao carregar lista de dívidas do banco SQLite local.', 'erro');
        this.carregando = false;
      }
    });
  }

  private construirMesesDisponiveis(lista: Divida[]): void {
    const chavesSet = new Set<string>();

    // Sempre inclui o mês atual para facilitar
    const hoje = new Date();
    const chaveAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    chavesSet.add(chaveAtual);

    for (const d of lista) {
      if (d.data_lancamento && d.data_lancamento.length >= 7) {
        chavesSet.add(d.data_lancamento.substring(0, 7));
      }
    }

    const chavesOrdenadas = Array.from(chavesSet).sort((a, b) => b.localeCompare(a));
    this.mesesDisponiveis = chavesOrdenadas.map(chave => {
      const [anoStr, mesStr] = chave.split('-');
      const idx = Math.max(0, Math.min(11, (Number(mesStr) || 1) - 1));
      return {
        chave,
        label: `${this.nomesMeses[idx]}/${anoStr}`,
        curto: `${this.nomesMesesCurtos[idx]}/${anoStr.slice(-2)}`
      };
    });
  }

  selecionarMes(chaveMes: string): void {
    this.mesSelecionado = chaveMes;
    this.processarFiltrosLocais();
  }

  processarFiltrosLocais(): void {
    // 1. Filtra por período (mês)
    const doPeriodo = this.mesSelecionado === 'todos'
      ? [...this.todasDividas]
      : this.todasDividas.filter(d => (d.data_lancamento || '').startsWith(this.mesSelecionado));

    // 2. Calcula os totais com base no período selecionado
    this.totais = this.calcularTotaisLista(doPeriodo);

    // 3. Filtra por busca (pessoa ou produto)
    const termo = (this.buscaVendedor || '').trim().toLowerCase();
    const aposBusca = termo
      ? doPeriodo.filter(d =>
          (d.descricao || '').toLowerCase().includes(termo) ||
          (d.vendedor_pessoa || '').toLowerCase().includes(termo)
        )
      : doPeriodo;

    // 4. Calcula pessoas pendentes no período/busca
    this.pessoasPendentes = this.calcularPessoasPendentes(aposBusca);

    // 5. Filtra por status (todas | pendentes | pagas)
    if (this.filtroStatus === 'pendentes') {
      this.dividas = aposBusca.filter(d => !d.pago);
    } else if (this.filtroStatus === 'pagas') {
      this.dividas = aposBusca.filter(d => d.pago);
    } else {
      this.dividas = aposBusca;
    }

    // 6. Agrupa por produto/descrição
    this.grupos = this.agruparDividas(this.dividas);
  }

  private calcularTotaisLista(lista: Divida[]): TotaisDividas {
    let totalPendente = 0;
    let totalPago = 0;
    let totalGeral = 0;
    let qtdPendente = 0;
    let qtdPago = 0;
    let unidadesPendentes = 0;
    let unidadesPagas = 0;

    for (const d of lista) {
      const qtd = Number(d.quantidade) || 1;
      const vTotal = Number(d.valor) || 0;
      const unit = Number(d.valor_unitario) || (qtd > 0 ? vTotal / qtd : vTotal);
      const isPago = Boolean(d.pago);
      const vPago = isPago ? vTotal : Math.min(vTotal, Number(d.valor_pago) || 0);
      const vPendente = isPago ? 0 : Math.max(0, vTotal - vPago);

      const qPaga = d.quantidade_paga !== undefined ? Number(d.quantidade_paga) : (isPago ? qtd : (unit > 0 ? Math.floor(vPago / unit) : 0));
      const qPend = isPago ? 0 : Math.max(0, qtd - qPaga);

      totalGeral += vTotal;
      totalPago += vPago;
      totalPendente += vPendente;

      if (isPago) {
        qtdPago += 1;
      } else {
        qtdPendente += 1;
      }
      unidadesPagas += qPaga;
      unidadesPendentes += qPend;
    }

    return {
      total_pendente: Number(totalPendente.toFixed(2)),
      total_pago: Number(totalPago.toFixed(2)),
      total_geral: Number(totalGeral.toFixed(2)),
      qtd_pendente: qtdPendente,
      qtd_pago: qtdPago,
      qtd_total: lista.length,
      qtd_unidades_pendentes: unidadesPendentes,
      qtd_unidades_pagas: unidadesPagas
    };
  }

  calcularPessoasPendentes(lista: Divida[]): ResumoPessoaPendente[] {
    const mapa = new Map<string, ResumoPessoaPendente>();

    for (const item of lista) {
      if (item.pago) continue;
      const vTotal = Number(item.valor) || 0;
      const vPago = Number(item.valor_pago) || 0;
      const vPendente = Math.max(0, Number((vTotal - vPago).toFixed(2)));
      if (vPendente <= 0) continue;

      const chave = (item.vendedor_pessoa || 'Sem Nome').trim().toLowerCase();
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          vendedor_pessoa: item.vendedor_pessoa || 'Sem Nome',
          chave_pix: item.chave_pix || null,
          total_pendente: vPendente,
          qtd_pedidos: 1,
          itens: [item]
        });
      } else {
        const p = mapa.get(chave)!;
        p.total_pendente = Number((p.total_pendente + vPendente).toFixed(2));
        p.qtd_pedidos += 1;
        if (!p.chave_pix && item.chave_pix) {
          p.chave_pix = item.chave_pix;
        }
        p.itens.push(item);
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.total_pendente - a.total_pendente);
  }

  agruparDividas(lista: Divida[]): GrupoDivida[] {
    const mapa = new Map<string, GrupoDivida>();

    for (const item of lista) {
      const chave = item.produto_id
        ? `prod_${item.produto_id}`
        : `avulso_${(item.descricao || '').trim().toLowerCase()}__${(item.vendedor_pessoa || '').trim().toLowerCase()}`;

      const qtdTotal = Number(item.quantidade) || 1;
      const vGeral = Number(item.valor) || 0;
      const unit = Number(item.valor_unitario) || (qtdTotal > 0 ? vGeral / qtdTotal : vGeral);
      const isPago = Boolean(item.pago);
      const vPago = isPago ? vGeral : Math.min(vGeral, Number(item.valor_pago) || 0);
      const vPendente = isPago ? 0 : Math.max(0, vGeral - vPago);

      const qtdPaga = item.quantidade_paga !== undefined ? Number(item.quantidade_paga) : (isPago ? qtdTotal : (unit > 0 ? Math.floor(vPago / unit) : 0));
      const qtdPendente = isPago ? 0 : Math.max(0, qtdTotal - qtdPaga);

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          descricao: item.descricao,
          vendedor_pessoa: item.vendedor_pessoa,
          chave_pix: item.chave_pix || null,
          produto_id: item.produto_id,
          valor_unitario: unit,
          total_pedidos: 1,
          total_quantidade: qtdTotal,
          total_quantidade_paga: qtdPaga,
          total_quantidade_pendente: qtdPendente,
          total_valor_pendente: vPendente,
          total_valor_pago: vPago,
          total_valor_geral: vGeral,
          todos_pagos: vPendente <= 0,
          parcialmente_pago: vPago > 0 && vPendente > 0,
          expandido: this.chavesExpandidas.has(chave),
          itens: [item]
        });
      } else {
        const g = mapa.get(chave)!;
        g.total_pedidos += 1;
        g.total_quantidade += qtdTotal;
        g.total_quantidade_paga += qtdPaga;
        g.total_quantidade_pendente += qtdPendente;
        g.total_valor_pendente += vPendente;
        g.total_valor_pago += vPago;
        g.total_valor_geral += vGeral;
        if (!g.chave_pix && item.chave_pix) {
          g.chave_pix = item.chave_pix;
        }
        g.todos_pagos = g.total_valor_pendente <= 0;
        g.parcialmente_pago = g.total_valor_pago > 0 && g.total_valor_pendente > 0;
        g.itens.push(item);
      }
    }

    const grupos = Array.from(mapa.values());
    for (const g of grupos) {
      g.itens.sort((a, b) => {
        if (a.pago !== b.pago) return a.pago ? 1 : -1;
        return (b.data_lancamento || '').localeCompare(a.data_lancamento || '');
      });
    }

    // Ordenação inteligente dos grupos: os que têm valor pendente primeiro
    grupos.sort((a, b) => {
      if (a.todos_pagos !== b.todos_pagos) return a.todos_pagos ? 1 : -1;
      return b.total_valor_pendente - a.total_valor_pendente;
    });

    return grupos;
  }

  toggleGrupo(grupo: GrupoDivida): void {
    grupo.expandido = !grupo.expandido;
    if (grupo.expandido) {
      this.chavesExpandidas.add(grupo.chave);
    } else {
      this.chavesExpandidas.delete(grupo.chave);
    }
  }

  expandirTodos(): void {
    for (const g of this.grupos) {
      g.expandido = true;
      this.chavesExpandidas.add(g.chave);
    }
  }

  recolherTodos(): void {
    for (const g of this.grupos) {
      g.expandido = false;
    }
    this.chavesExpandidas.clear();
  }

  aplicarFiltroStatus(status: 'todas' | 'pendentes' | 'pagas'): void {
    this.filtroStatus = status;
    this.processarFiltrosLocais();
  }

  onBuscaChange(): void {
    this.processarFiltrosLocais();
  }

  limparBusca(): void {
    this.buscaVendedor = '';
    this.processarFiltrosLocais();
  }

  copiarPix(chavePix: string | null | undefined, nomePessoa: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!chavePix) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(chavePix).then(() => {
        this.exibirFeedback(`PIX de ${nomePessoa} copiado: ${chavePix}`, 'sucesso');
      }).catch(() => {
        this.exibirFeedback(`Chave PIX: ${chavePix}`, 'sucesso');
      });
    } else {
      this.exibirFeedback(`Chave PIX: ${chavePix}`, 'sucesso');
    }
  }

  abrirResumoWhatsAppPessoa(nomePessoa: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const doPeriodo = this.mesSelecionado === 'todos'
      ? this.todasDividas
      : this.todasDividas.filter(d => (d.data_lancamento || '').startsWith(this.mesSelecionado));

    const itensDaPessoa = doPeriodo.filter(
      d => (d.vendedor_pessoa || '').trim().toLowerCase() === (nomePessoa || '').trim().toLowerCase()
    );

    const temPendentes = itensDaPessoa.some(i => !i.pago);

    this.dialog.open(WhatsappResumoDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        vendedor_pessoa: nomePessoa,
        periodoLabel: this.labelPeriodoAtual,
        itens: itensDaPessoa,
        filtroInicial: temPendentes ? 'pendentes' : 'todos'
      }
    });
  }

  abrirResumoWhatsAppGrupo(grupo: GrupoDivida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.dialog.open(WhatsappResumoDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        vendedor_pessoa: grupo.vendedor_pessoa,
        periodoLabel: this.labelPeriodoAtual,
        itens: grupo.itens,
        filtroInicial: grupo.todos_pagos ? 'pagos' : 'pendentes'
      }
    });
  }

  repetirPedidoRapido(grupo: GrupoDivida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const hoje = new Date();
    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const unit = Number(grupo.valor_unitario) || 1;

    const novoPedido: Divida = {
      produto_id: grupo.produto_id || null,
      descricao: grupo.descricao,
      vendedor_pessoa: grupo.vendedor_pessoa,
      chave_pix: grupo.chave_pix || null,
      quantidade: 1,
      quantidade_paga: 0,
      valor_unitario: Number(unit.toFixed(2)),
      valor: Number(unit.toFixed(2)),
      valor_pago: 0,
      data_lancamento: dataHoje,
      pago: false,
      observacao: 'Lançamento rápido (+1)'
    };

    this.apiService.criarDivida(novoPedido).subscribe({
      next: () => {
        this.exibirFeedback(
          `+1x "${grupo.descricao}" (R$ ${unit.toFixed(2)}) lançado para hoje!`,
          'sucesso'
        );
        this.carregarDados();
      },
      error: (err) => {
        console.error('Erro ao repetir pedido rápido:', err);
        this.exibirFeedback('Erro ao lançar pedido rápido.', 'erro');
      }
    });
  }

  abrirModalEditarDivida(divida: Divida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!divida.id) return;

    const dialogRef = this.dialog.open(EditarDividaDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: { divida }
    });

    dialogRef.afterClosed().subscribe((editada?: Divida) => {
      if (!editada || !divida.id) return;
      this.apiService.atualizarDivida(divida.id, editada).subscribe({
        next: (res) => {
          this.exibirFeedback(`Pedido de "${res.descricao}" atualizado com sucesso!`, 'sucesso');
          this.carregarDados();
        },
        error: (err) => {
          console.error('Erro ao atualizar dívida:', err);
          this.exibirFeedback('Erro ao salvar alterações do pedido.', 'erro');
        }
      });
    });
  }

  abrirModalQuitarPessoa(pessoa: ResumoPessoaPendente, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const ids = pessoa.itens.map(i => i.id!).filter(Boolean);
    if (ids.length === 0) return;

    const dialogRef = this.dialog.open(QuitarLoteDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        titulo: `Quitar Tudo — ${pessoa.vendedor_pessoa}`,
        subtitulo: `Quitação em lote de todos os pedidos pendentes`,
        vendedor_pessoa: pessoa.vendedor_pessoa,
        chave_pix: pessoa.chave_pix,
        itens: pessoa.itens,
        total_pendente: pessoa.total_pendente
      }
    });

    dialogRef.afterClosed().subscribe((res?: ResultadoQuitarLote) => {
      if (!res || !res.confirmado) return;
      const anexo: ComprovanteAnexo = {
        observacao: res.observacao,
        comprovante_base64: res.comprovante_base64,
        comprovante_nome: res.comprovante_nome,
        comprovante_tipo: res.comprovante_tipo
      };

      this.apiService.quitarLote(ids, anexo).subscribe({
        next: (r) => {
          this.exibirFeedback(
            `Quitados ${r.quitados} pedido(s) de ${pessoa.vendedor_pessoa} (R$ ${r.valorTotalQuitado.toFixed(2)})!`,
            'sucesso'
          );
          this.carregarDados();
        },
        error: (err) => {
          console.error('Erro ao quitar pessoa em lote:', err);
          this.exibirFeedback('Erro ao realizar quitação em lote.', 'erro');
        }
      });
    });
  }

  abrirModalQuitarGrupo(grupo: GrupoDivida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const itensPendentes = grupo.itens.filter(i => !i.pago && i.id);
    const ids = itensPendentes.map(i => i.id!);
    if (ids.length === 0) return;

    const dialogRef = this.dialog.open(QuitarLoteDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        titulo: `Quitar Grupo — ${grupo.descricao}`,
        subtitulo: `Vendedor: ${grupo.vendedor_pessoa}`,
        vendedor_pessoa: grupo.vendedor_pessoa,
        chave_pix: grupo.chave_pix,
        itens: itensPendentes,
        total_pendente: grupo.total_valor_pendente
      }
    });

    dialogRef.afterClosed().subscribe((res?: ResultadoQuitarLote) => {
      if (!res || !res.confirmado) return;
      const anexo: ComprovanteAnexo = {
        observacao: res.observacao,
        comprovante_base64: res.comprovante_base64,
        comprovante_nome: res.comprovante_nome,
        comprovante_tipo: res.comprovante_tipo
      };

      this.apiService.quitarLote(ids, anexo).subscribe({
        next: (r) => {
          this.exibirFeedback(
            `Grupo "${grupo.descricao}" totalmente quitado (R$ ${r.valorTotalQuitado.toFixed(2)})!`,
            'sucesso'
          );
          this.carregarDados();
        },
        error: (err) => {
          console.error('Erro ao quitar grupo em lote:', err);
          this.exibirFeedback('Erro ao quitar grupo.', 'erro');
        }
      });
    });
  }

  abrirModalPagamentoParcial(divida: Divida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!divida.id) return;

    const dialogRef = this.dialog.open(PagamentoParcialDialogComponent, {
      width: '94vw',
      maxWidth: '440px',
      disableClose: true,
      data: { divida }
    });

    dialogRef.afterClosed().subscribe((res?: ResultadoPagamentoParcial) => {
      if (!res || !divida.id) return;

      const anexo: ComprovanteAnexo = {
        observacao: res.observacao,
        comprovante_base64: res.comprovante_base64,
        comprovante_nome: res.comprovante_nome,
        comprovante_tipo: res.comprovante_tipo
      };

      if (res.modo === 'valor' && res.valor && res.valor > 0) {
        this.apiService.pagarValor(divida.id, res.valor, anexo).subscribe({
          next: (atualizada) => {
            const vPagoAgora = res.valor || 0;
            const restante = Math.max(0, atualizada.valor - (atualizada.valor_pago || 0));
            this.exibirFeedback(
              atualizada.pago
                ? `Pedido quitado! Pago R$ ${vPagoAgora.toFixed(2)}.`
                : `Pago R$ ${vPagoAgora.toFixed(2)} de "${atualizada.descricao}". Falta pagar R$ ${restante.toFixed(2)}!`,
              'sucesso'
            );
            this.carregarDados();
          },
          error: (err) => {
            console.error('Erro ao pagar valor:', err);
            this.exibirFeedback('Erro ao registrar pagamento por valor.', 'erro');
          }
        });
      } else if (res.modo === 'quantidade' && res.quantidade && res.quantidade > 0) {
        this.apiService.pagarQuantidade(divida.id, res.quantidade, anexo).subscribe({
          next: (atualizada) => {
            this.exibirFeedback(
              atualizada.pago
                ? `Pedido de "${atualizada.descricao}" totalmente quitado!`
                : `Pagamento de ${res.quantidade} un. de "${atualizada.descricao}" registrado!`,
              'sucesso'
            );
            this.carregarDados();
          },
          error: (err) => {
            console.error('Erro ao pagar quantidade:', err);
            this.exibirFeedback('Erro ao registrar pagamento por quantidade.', 'erro');
          }
        });
      }
    });
  }

  visualizarComprovante(divida: Divida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!divida.comprovante_base64) return;

    this.dialog.open(ComprovanteVisualizarDialogComponent, {
      width: '94vw',
      maxWidth: '520px',
      data: {
        titulo: divida.descricao,
        comprovante_nome: divida.comprovante_nome || 'Comprovante',
        comprovante_tipo: divida.comprovante_tipo || 'imagem',
        comprovante_base64: divida.comprovante_base64
      }
    });
  }

  visualizarComprovanteHistorico(hist: HistoricoPagamento, descricaoPedido: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!hist.comprovante_base64) return;

    this.dialog.open(ComprovanteVisualizarDialogComponent, {
      width: '94vw',
      maxWidth: '520px',
      data: {
        titulo: `${descricaoPedido} (Pago R$ ${hist.valor_pago.toFixed(2)})`,
        comprovante_nome: hist.comprovante_nome || 'Comprovante de Amortização',
        comprovante_tipo: hist.comprovante_tipo || 'imagem',
        comprovante_base64: hist.comprovante_base64
      }
    });
  }

  alternarStatus(divida: Divida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!divida.id) return;

    const novoStatus = !divida.pago;
    this.apiService.alternarStatus(divida.id, novoStatus).subscribe({
      next: (atualizada) => {
        this.exibirFeedback(
          atualizada.pago ? 'Pedido marcado como TOTALMENTE PAGO!' : 'Pedido reaberto como PENDENTE.',
          'sucesso'
        );
        this.carregarDados();
      },
      error: (err) => {
        console.error('Erro ao alternar status:', err);
        this.exibirFeedback('Não foi possível alterar o status.', 'erro');
      }
    });
  }

  excluir(divida: Divida, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!divida.id) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '92vw',
      maxWidth: '400px',
      disableClose: true,
      data: {
        title: 'Excluir Pedido',
        subtitle: 'Extrato de Lançamentos',
        message: `Deseja realmente excluir o pedido de <strong>${divida.quantidade || 1}x ${divida.descricao}</strong> do dia ${divida.data_lancamento}?<br><br>Valor: R$ ${divida.valor.toFixed(2)}`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado || !divida.id) return;

      this.apiService.excluirDivida(divida.id).subscribe({
        next: () => {
          this.exibirFeedback('Pedido excluído com sucesso!', 'sucesso');
          this.carregarDados();
        },
        error: (err) => {
          console.error('Erro ao excluir:', err);
          this.exibirFeedback('Erro ao excluir registro no banco.', 'erro');
        }
      });
    });
  }

  exibirFeedback(msg: string, tipo: 'sucesso' | 'erro'): void {
    this.mensagemFeedback = msg;
    this.tipoFeedback = tipo;
    setTimeout(() => {
      this.mensagemFeedback = null;
    }, 3500);
  }
}
