import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { Produto } from '../../models/produto.model';
import { Divida } from '../../models/divida.model';
import { ProdutoSelectDialogComponent } from '../../shared/components/produto-select-dialog/produto-select-dialog.component';
import { PixQrScannerDialogComponent, PixQrScannerResult } from '../../shared/components/pix-qr-scanner-dialog/pix-qr-scanner-dialog.component';

@Component({
  selector: 'app-divida-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatRippleModule, MatDialogModule],
  templateUrl: './divida-form.component.html',
  styleUrls: ['./divida-form.component.css']
})
export class DividaFormComponent implements OnInit {
  @Output() salvo = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  produtos: Produto[] = [];
  carregandoProdutos = false;
  salvando = false;
  mensagemErro: string | null = null;

  // Tipo de lançamento: 'com_produto' | 'avulso'
  tipoLancamento: 'com_produto' | 'avulso' = 'com_produto';

  // Campos do formulário
  produtoSelecionadoId: number | null = null;
  descricao: string = '';
  vendedorPessoa: string = '';
  chavePix: string = '';
  quantidade: number = 1;
  valorUnitario: number | null = null;
  valorTotal: number = 0;
  dataLancamento: string = '';
  pago: boolean = false;
  observacao: string = '';

  // Anexo de comprovante (Imagem ou PDF)
  comprovanteBase64: string | null = null;
  comprovanteNome: string | null = null;
  comprovanteTipo: string | null = null; // 'imagem' | 'pdf'

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.definirDataPadrao();
    this.carregarProdutos();
  }

  get produtoSelecionadoObjeto(): Produto | null {
    if (!this.produtoSelecionadoId) return null;
    return this.produtos.find(p => p.id === Number(this.produtoSelecionadoId)) || null;
  }

  definirDataPadrao(): void {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    this.dataLancamento = `${ano}-${mes}-${dia}`;
  }

  carregarProdutos(): void {
    this.carregandoProdutos = true;
    this.apiService.getProdutos().subscribe({
      next: (prods) => {
        this.produtos = prods;
        this.carregandoProdutos = false;
      },
      error: (err) => {
        console.error('Erro ao buscar produtos para o formulário:', err);
        this.carregandoProdutos = false;
      }
    });
  }

  trocarTipoLancamento(tipo: 'com_produto' | 'avulso'): void {
    this.tipoLancamento = tipo;
    if (tipo === 'avulso') {
      this.produtoSelecionadoId = null;
      this.descricao = '';
      this.valorUnitario = null;
      this.valorTotal = 0;
    }
  }

  abrirModalSelecaoProduto(): void {
    const dialogRef = this.dialog.open(ProdutoSelectDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true,
      data: {
        produtos: this.produtos,
        selecionadoId: this.produtoSelecionadoId
      }
    });

    dialogRef.afterClosed().subscribe((selecionado?: Produto) => {
      if (selecionado && selecionado.id) {
        this.produtoSelecionadoId = selecionado.id;
        this.descricao = selecionado.nome;
        if (selecionado.vendedor_pessoa) {
          this.vendedorPessoa = selecionado.vendedor_pessoa;
        }
        if (selecionado.chave_pix) {
          this.chavePix = selecionado.chave_pix;
        }
        this.valorUnitario = selecionado.preco_padrao;
        this.recalcularTotal();
      }
    });
  }

  onVendedorInput(): void {
    if (!this.vendedorPessoa || this.chavePix.trim()) return;
    const termo = this.vendedorPessoa.trim().toLowerCase();
    const existente = this.produtos.find(
      p => (p.vendedor_pessoa || '').trim().toLowerCase() === termo && p.chave_pix
    );
    if (existente && existente.chave_pix) {
      this.chavePix = existente.chave_pix;
    }
  }

  abrirScannerQrPix(): void {
    const dialogRef = this.dialog.open(PixQrScannerDialogComponent, {
      width: '94vw',
      maxWidth: '420px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((res?: PixQrScannerResult) => {
      if (res && res.chavePix) {
        this.chavePix = res.chavePix;
        if (res.nomeRecebedor && (!this.vendedorPessoa || !this.vendedorPessoa.trim())) {
          this.vendedorPessoa = res.nomeRecebedor;
        }
      }
    });
  }

  limparProdutoSelecionado(event: MouseEvent): void {
    event.stopPropagation();
    this.produtoSelecionadoId = null;
    this.descricao = '';
    this.valorUnitario = null;
    this.valorTotal = 0;
  }

  alterarQuantidade(delta: number): void {
    const novaQtd = (Number(this.quantidade) || 1) + delta;
    this.quantidade = Math.max(1, novaQtd);
    this.recalcularTotal();
  }

  onQuantidadeInput(): void {
    if (!this.quantidade || this.quantidade < 1) {
      this.quantidade = 1;
    } else {
      this.quantidade = Math.floor(this.quantidade);
    }
    this.recalcularTotal();
  }

  recalcularTotal(): void {
    const qtd = Math.max(1, Math.floor(Number(this.quantidade) || 1));
    const unit = Number(this.valorUnitario) || 0;
    this.valorTotal = Number((qtd * unit).toFixed(2));
  }

  onArquivoSelecionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const arquivo = input.files[0];
    const mime = arquivo.type.toLowerCase();
    const nome = arquivo.name;

    let tipo: 'imagem' | 'pdf' = 'imagem';
    if (mime.includes('pdf') || nome.toLowerCase().endsWith('.pdf')) {
      tipo = 'pdf';
    }

    // Limite máximo de segurança: 10MB
    if (arquivo.size > 10 * 1024 * 1024) {
      this.mensagemErro = 'O arquivo selecionado é muito grande. Escolha um anexo de até 10MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.comprovanteBase64 = reader.result as string;
      this.comprovanteNome = nome;
      this.comprovanteTipo = tipo;
      this.mensagemErro = null;
    };
    reader.onerror = () => {
      this.mensagemErro = 'Não foi possível ler o arquivo selecionado.';
    };
    reader.readAsDataURL(arquivo);
  }

  removerComprovante(event: MouseEvent): void {
    event.stopPropagation();
    this.comprovanteBase64 = null;
    this.comprovanteNome = null;
    this.comprovanteTipo = null;
  }

  salvar(): void {
    this.mensagemErro = null;

    if (!this.descricao || !this.descricao.trim()) {
      this.mensagemErro = 'Informe a descrição do produto ou do lançamento.';
      return;
    }

    if (!this.vendedorPessoa || !this.vendedorPessoa.trim()) {
      this.mensagemErro = 'Informe quem é a pessoa/vendedor a quem você deve.';
      return;
    }

    const qtdFinal = Math.max(1, Math.floor(Number(this.quantidade) || 1));
    const unitFinal = Number(this.valorUnitario) || 0;
    const totalFinal = Number((qtdFinal * unitFinal).toFixed(2));

    if (unitFinal <= 0 || totalFinal <= 0) {
      this.mensagemErro = 'O valor unitário deve ser maior que zero.';
      return;
    }

    const novaDivida: Divida = {
      produto_id: this.tipoLancamento === 'com_produto' && this.produtoSelecionadoId ? Number(this.produtoSelecionadoId) : null,
      descricao: this.descricao.trim(),
      vendedor_pessoa: this.vendedorPessoa.trim(),
      chave_pix: this.chavePix && this.chavePix.trim() ? this.chavePix.trim() : null,
      quantidade: qtdFinal,
      quantidade_paga: this.pago ? qtdFinal : 0,
      valor_unitario: unitFinal,
      valor: totalFinal,
      data_lancamento: this.dataLancamento,
      pago: this.pago,
      observacao: this.observacao && this.observacao.trim() ? this.observacao.trim() : null,
      comprovante_base64: this.comprovanteBase64,
      comprovante_nome: this.comprovanteNome,
      comprovante_tipo: this.comprovanteTipo
    };

    this.salvando = true;
    this.apiService.criarDivida(novaDivida).subscribe({
      next: () => {
        this.salvando = false;
        this.salvo.emit();
      },
      error: (err) => {
        console.error('Erro ao salvar dívida:', err);
        this.mensagemErro = err?.error?.mensagem || 'Erro ao persistir dívida no banco SQLite.';
        this.salvando = false;
      }
    });
  }
}
