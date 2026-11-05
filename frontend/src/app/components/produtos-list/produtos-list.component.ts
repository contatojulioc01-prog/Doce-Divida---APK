import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { Produto } from '../../models/produto.model';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PixQrScannerDialogComponent, PixQrScannerResult } from '../../shared/components/pix-qr-scanner-dialog/pix-qr-scanner-dialog.component';

@Component({
  selector: 'app-produtos-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatRippleModule, MatDialogModule],
  templateUrl: './produtos-list.component.html',
  styleUrls: ['./produtos-list.component.css']
})
export class ProdutosListComponent implements OnInit {
  produtos: Produto[] = [];
  carregando = false;
  salvando = false;
  buscaCatalogo: string = '';

  // Formulário de novo / edição
  modoEdicao = false;
  produtoEmEdicaoId: number | null = null;
  novoNome: string = '';
  novoVendedor: string = '';
  novaChavePix: string = '';
  novoPreco: number | null = null;

  feedback: { texto: string; tipo: 'sucesso' | 'erro' } | null = null;

  constructor(
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.carregarProdutos();
  }

  get produtosFiltrados(): Produto[] {
    if (!this.buscaCatalogo || !this.buscaCatalogo.trim()) {
      return this.produtos;
    }
    const termo = this.buscaCatalogo.trim().toLowerCase();
    return this.produtos.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.vendedor_pessoa && p.vendedor_pessoa.toLowerCase().includes(termo))
    );
  }

  carregarProdutos(): void {
    this.carregando = true;
    this.apiService.getProdutos().subscribe({
      next: (lista) => {
        this.produtos = lista;
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar produtos:', err);
        this.mostrarFeedback('Erro ao carregar catálogo de produtos.', 'erro');
        this.carregando = false;
      }
    });
  }

  salvarProduto(): void {
    if (!this.novoNome || !this.novoNome.trim()) {
      this.mostrarFeedback('Informe o nome do doce ou produto.', 'erro');
      return;
    }

    if (!this.novoVendedor || !this.novoVendedor.trim()) {
      this.mostrarFeedback('Informe o nome da pessoa/vendedor vinculada ao produto.', 'erro');
      return;
    }

    if (this.novoPreco === null || this.novoPreco < 0) {
      this.mostrarFeedback('Informe um preço padrão válido.', 'erro');
      return;
    }

    const payload: Produto = {
      nome: this.novoNome.trim(),
      vendedor_pessoa: this.novoVendedor.trim(),
      chave_pix: this.novaChavePix && this.novaChavePix.trim() ? this.novaChavePix.trim() : null,
      preco_padrao: Number(this.novoPreco)
    };

    this.salvando = true;

    if (this.modoEdicao && this.produtoEmEdicaoId) {
      this.apiService.atualizarProduto(this.produtoEmEdicaoId, payload).subscribe({
        next: (atualizado) => {
          this.salvando = false;
          this.cancelarEdicao();
          this.carregarProdutos();
          this.mostrarFeedback(`Produto "${atualizado.nome}" atualizado!`, 'sucesso');
        },
        error: (err) => {
          console.error('Erro ao atualizar produto:', err);
          this.salvando = false;
          this.mostrarFeedback('Erro ao atualizar produto no SQLite.', 'erro');
        }
      });
    } else {
      this.apiService.criarProduto(payload).subscribe({
        next: (criado) => {
          this.salvando = false;
          this.cancelarEdicao();
          this.carregarProdutos();
          this.mostrarFeedback(`Produto "${criado.nome}" cadastrado e vinculado a ${criado.vendedor_pessoa}!`, 'sucesso');
        },
        error: (err) => {
          console.error('Erro ao cadastrar produto:', err);
          this.salvando = false;
          this.mostrarFeedback('Erro ao gravar produto no SQLite.', 'erro');
        }
      });
    }
  }

  iniciarEdicao(produto: Produto): void {
    this.modoEdicao = true;
    this.produtoEmEdicaoId = produto.id || null;
    this.novoNome = produto.nome;
    this.novoVendedor = produto.vendedor_pessoa || '';
    this.novaChavePix = produto.chave_pix || '';
    this.novoPreco = produto.preco_padrao;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicao(): void {
    this.modoEdicao = false;
    this.produtoEmEdicaoId = null;
    this.novoNome = '';
    this.novoVendedor = '';
    this.novaChavePix = '';
    this.novoPreco = null;
  }

  onVendedorInput(): void {
    if (!this.novaChavePix && this.novoVendedor && this.novoVendedor.trim()) {
      const existente = this.produtos.find(p =>
        p.vendedor_pessoa.toLowerCase() === this.novoVendedor.trim().toLowerCase() && p.chave_pix
      );
      if (existente && existente.chave_pix) {
        this.novaChavePix = existente.chave_pix;
      }
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
        this.novaChavePix = res.chavePix;
        if (res.nomeRecebedor && (!this.novoVendedor || !this.novoVendedor.trim())) {
          this.novoVendedor = res.nomeRecebedor;
        }
        this.mostrarFeedback('Chave PIX lida do QR Code com sucesso!', 'sucesso');
      }
    });
  }

  copiarPix(chave: string | null | undefined, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!chave) return;
    navigator.clipboard?.writeText(chave).then(() => {
      this.mostrarFeedback(`Chave PIX "${chave}" copiada!`, 'sucesso');
    }).catch(() => {
      this.mostrarFeedback(`Chave PIX: ${chave}`, 'sucesso');
    });
  }

  excluir(produto: Produto): void {
    if (!produto.id) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '92vw',
      maxWidth: '400px',
      disableClose: true,
      data: {
        title: 'Excluir Produto',
        subtitle: 'Catálogo de Produtos',
        message: `Deseja realmente excluir <strong>${produto.nome}</strong> (${produto.vendedor_pessoa || 'Sem vínculo'})?<br><br>Dívidas já lançadas serão mantidas no histórico.`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (!confirmado || !produto.id) return;

      this.apiService.excluirProduto(produto.id).subscribe({
        next: () => {
          this.produtos = this.produtos.filter(p => p.id !== produto.id);
          this.mostrarFeedback('Produto excluído com sucesso!', 'sucesso');
        },
        error: (err) => {
          console.error('Erro ao excluir produto:', err);
          this.mostrarFeedback('Erro ao excluir produto no banco.', 'erro');
        }
      });
    });
  }

  mostrarFeedback(texto: string, tipo: 'sucesso' | 'erro'): void {
    this.feedback = { texto, tipo };
    setTimeout(() => {
      this.feedback = null;
    }, 3500);
  }
}
