import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { Divida } from '../../models/divida.model';
import { WhatsappResumoDialogComponent } from '../../shared/components/whatsapp-resumo-dialog/whatsapp-resumo-dialog.component';
import { BackupDadosDialogComponent } from '../../shared/components/backup-dados-dialog/backup-dados-dialog.component';

export interface RankingPessoa {
  vendedor_pessoa: string;
  chave_pix?: string | null;
  total_geral: number;
  total_pago: number;
  total_pendente: number;
  qtd_pedidos: number;
  qtd_unidades: number;
  percentual_barra: number;
  percentual_pago: number;
  itens: Divida[];
}

export interface RankingProduto {
  descricao: string;
  vendedor_pessoa: string;
  qtd_unidades: number;
  qtd_pedidos: number;
  total_geral: number;
  percentual_barra: number;
}

export interface ResumoMensal {
  chave: string; // 'YYYY-MM'
  label: string; // 'Novembro/2026'
  curto: string; // 'Nov/26'
  total_geral: number;
  total_pago: number;
  total_pendente: number;
  qtd_pedidos: number;
  qtd_unidades: number;
  percentual_barra: number;
}

@Component({
  selector: 'app-relatorios-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule, MatDialogModule],
  templateUrl: './relatorios-dashboard.component.html',
  styleUrls: ['./relatorios-dashboard.component.css']
})
export class RelatoriosDashboardComponent implements OnInit {
  todasDividas: Divida[] = [];
  carregando = false;

  mesSelecionado: string = 'todos';
  mesesFiltro: { chave: string; label: string }[] = [];

  // Métricas do Período Selecionado
  totalGeral = 0;
  totalPago = 0;
  totalPendente = 0;
  totalPedidos = 0;
  totalUnidades = 0;
  ticketMedio = 0;
  taxaQuitacao = 0;

  rankingPessoas: RankingPessoa[] = [];
  rankingProdutos: RankingProduto[] = [];
  evolucaoMensal: ResumoMensal[] = [];

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
    this.carregarRelatorios();
  }

  get labelPeriodoAtual(): string {
    if (this.mesSelecionado === 'todos') return 'Todos os Meses';
    const m = this.mesesFiltro.find(x => x.chave === this.mesSelecionado);
    return m ? m.label : this.mesSelecionado;
  }

  carregarRelatorios(): void {
    this.carregando = true;
    this.apiService.getDividas().subscribe({
      next: (dados) => {
        this.todasDividas = dados;
        this.construirMeses(dados);
        this.calcularEvolucaoMensal(dados);
        this.recalcularDashboard();
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar dados para relatórios:', err);
        this.carregando = false;
      }
    });
  }

  private construirMeses(lista: Divida[]): void {
    const setChaves = new Set<string>();
    const hoje = new Date();
    setChaves.add(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);

    for (const d of lista) {
      if (d.data_lancamento && d.data_lancamento.length >= 7) {
        setChaves.add(d.data_lancamento.substring(0, 7));
      }
    }

    this.mesesFiltro = Array.from(setChaves)
      .sort((a, b) => b.localeCompare(a))
      .map(chave => {
        const [ano, mes] = chave.split('-');
        const idx = Math.max(0, Math.min(11, (Number(mes) || 1) - 1));
        return {
          chave,
          label: `${this.nomesMeses[idx]}/${ano}`
        };
      });
  }

  selecionarMes(chave: string): void {
    this.mesSelecionado = chave;
    this.recalcularDashboard();
  }

  recalcularDashboard(): void {
    const filtradas = this.mesSelecionado === 'todos'
      ? this.todasDividas
      : this.todasDividas.filter(d => (d.data_lancamento || '').startsWith(this.mesSelecionado));

    let tGeral = 0;
    let tPago = 0;
    let tPendente = 0;
    let tUnidades = 0;

    const mapaPessoas = new Map<string, RankingPessoa>();
    const mapaProdutos = new Map<string, RankingProduto>();

    for (const item of filtradas) {
      const qtd = Number(item.quantidade) || 1;
      const vGeral = Number(item.valor) || 0;
      const isPago = Boolean(item.pago);
      const vPago = isPago ? vGeral : Math.min(vGeral, Number(item.valor_pago) || 0);
      const vPendente = isPago ? 0 : Math.max(0, vGeral - vPago);

      tGeral += vGeral;
      tPago += vPago;
      tPendente += vPendente;
      tUnidades += qtd;

      // Agrupamento por Pessoa
      const chavePessoa = (item.vendedor_pessoa || 'Sem Nome').trim().toLowerCase();
      if (!mapaPessoas.has(chavePessoa)) {
        mapaPessoas.set(chavePessoa, {
          vendedor_pessoa: item.vendedor_pessoa || 'Sem Nome',
          chave_pix: item.chave_pix || null,
          total_geral: vGeral,
          total_pago: vPago,
          total_pendente: vPendente,
          qtd_pedidos: 1,
          qtd_unidades: qtd,
          percentual_barra: 100,
          percentual_pago: vGeral > 0 ? Math.round((vPago / vGeral) * 100) : 0,
          itens: [item]
        });
      } else {
        const p = mapaPessoas.get(chavePessoa)!;
        p.total_geral = Number((p.total_geral + vGeral).toFixed(2));
        p.total_pago = Number((p.total_pago + vPago).toFixed(2));
        p.total_pendente = Number((p.total_pendente + vPendente).toFixed(2));
        p.qtd_pedidos += 1;
        p.qtd_unidades += qtd;
        if (!p.chave_pix && item.chave_pix) {
          p.chave_pix = item.chave_pix;
        }
        p.percentual_pago = p.total_geral > 0 ? Math.round((p.total_pago / p.total_geral) * 100) : 0;
        p.itens.push(item);
      }

      // Agrupamento por Produto
      const chaveProd = `${(item.descricao || '').trim().toLowerCase()}__${chavePessoa}`;
      if (!mapaProdutos.has(chaveProd)) {
        mapaProdutos.set(chaveProd, {
          descricao: item.descricao,
          vendedor_pessoa: item.vendedor_pessoa,
          qtd_unidades: qtd,
          qtd_pedidos: 1,
          total_geral: vGeral,
          percentual_barra: 100
        });
      } else {
        const pr = mapaProdutos.get(chaveProd)!;
        pr.qtd_unidades += qtd;
        pr.qtd_pedidos += 1;
        pr.total_geral = Number((pr.total_geral + vGeral).toFixed(2));
      }
    }

    this.totalGeral = Number(tGeral.toFixed(2));
    this.totalPago = Number(tPago.toFixed(2));
    this.totalPendente = Number(tPendente.toFixed(2));
    this.totalPedidos = filtradas.length;
    this.totalUnidades = tUnidades;
    this.ticketMedio = filtradas.length > 0 ? Number((tGeral / filtradas.length).toFixed(2)) : 0;
    this.taxaQuitacao = tGeral > 0 ? Math.round((tPago / tGeral) * 100) : 0;

    // Ordenar Pessoas por valor total gasto
    const listaPessoas = Array.from(mapaPessoas.values()).sort((a, b) => b.total_geral - a.total_geral);
    const maiorGastoPessoa = listaPessoas.length > 0 ? listaPessoas[0].total_geral : 1;
    for (const p of listaPessoas) {
      p.percentual_barra = maiorGastoPessoa > 0 ? Math.max(8, Math.round((p.total_geral / maiorGastoPessoa) * 100)) : 0;
    }
    this.rankingPessoas = listaPessoas;

    // Ordenar Produtos por quantidade comprada (desempate por valor total)
    const listaProdutos = Array.from(mapaProdutos.values()).sort((a, b) => {
      if (b.qtd_unidades !== a.qtd_unidades) return b.qtd_unidades - a.qtd_unidades;
      return b.total_geral - a.total_geral;
    });
    const maiorQtdProd = listaProdutos.length > 0 ? listaProdutos[0].qtd_unidades : 1;
    for (const pr of listaProdutos) {
      pr.percentual_barra = maiorQtdProd > 0 ? Math.max(8, Math.round((pr.qtd_unidades / maiorQtdProd) * 100)) : 0;
    }
    this.rankingProdutos = listaProdutos;
  }

  private calcularEvolucaoMensal(lista: Divida[]): void {
    const mapaMes = new Map<string, ResumoMensal>();

    for (const item of lista) {
      if (!item.data_lancamento || item.data_lancamento.length < 7) continue;
      const chave = item.data_lancamento.substring(0, 7);
      const [ano, mes] = chave.split('-');
      const idx = Math.max(0, Math.min(11, (Number(mes) || 1) - 1));

      const qtd = Number(item.quantidade) || 1;
      const vGeral = Number(item.valor) || 0;
      const isPago = Boolean(item.pago);
      const vPago = isPago ? vGeral : Math.min(vGeral, Number(item.valor_pago) || 0);
      const vPendente = isPago ? 0 : Math.max(0, vGeral - vPago);

      if (!mapaMes.has(chave)) {
        mapaMes.set(chave, {
          chave,
          label: `${this.nomesMeses[idx]}/${ano}`,
          curto: `${this.nomesMesesCurtos[idx]}/${ano.slice(-2)}`,
          total_geral: vGeral,
          total_pago: vPago,
          total_pendente: vPendente,
          qtd_pedidos: 1,
          qtd_unidades: qtd,
          percentual_barra: 100
        });
      } else {
        const m = mapaMes.get(chave)!;
        m.total_geral = Number((m.total_geral + vGeral).toFixed(2));
        m.total_pago = Number((m.total_pago + vPago).toFixed(2));
        m.total_pendente = Number((m.total_pendente + vPendente).toFixed(2));
        m.qtd_pedidos += 1;
        m.qtd_unidades += qtd;
      }
    }

    const meses = Array.from(mapaMes.values()).sort((a, b) => b.chave.localeCompare(a.chave));
    const maiorValorMes = meses.length > 0 ? Math.max(...meses.map(m => m.total_geral)) : 1;
    for (const m of meses) {
      m.percentual_barra = maiorValorMes > 0 ? Math.max(8, Math.round((m.total_geral / maiorValorMes) * 100)) : 0;
    }

    this.evolucaoMensal = meses;
  }

  abrirResumoWhatsApp(pessoa: RankingPessoa): void {
    const temPendentes = pessoa.itens.some(i => !i.pago);
    this.dialog.open(WhatsappResumoDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        vendedor_pessoa: pessoa.vendedor_pessoa,
        periodoLabel: this.labelPeriodoAtual,
        itens: pessoa.itens,
        filtroInicial: temPendentes ? 'pendentes' : 'todos'
      }
    });
  }

  abrirModalBackup(): void {
    const ref = this.dialog.open(BackupDadosDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true
    });
    ref.afterClosed().subscribe((alterado?: boolean) => {
      if (alterado) {
        this.carregarRelatorios();
      }
    });
  }
}

