import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Divida } from '../../../models/divida.model';
import { PixQrScannerDialogComponent, PixQrScannerResult } from '../pix-qr-scanner-dialog/pix-qr-scanner-dialog.component';

export interface EditarDividaData {
  divida: Divida;
}

@Component({
  selector: 'app-editar-divida-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="editar-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>edit_note</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Editar Lançamento</h2>
            <p>Ajuste descrição, quantidade, valor ou data do pedido</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <div *ngIf="erroMsg" class="erro-box">
          <mat-icon>warning</mat-icon>
          <span>{{ erroMsg }}</span>
        </div>

        <!-- Descrição -->
        <div class="campo-box">
          <label>
            <mat-icon>label</mat-icon>
            <span>Descrição / Nome do Doce *</span>
          </label>
          <input
            type="text"
            [(ngModel)]="descricao"
            placeholder="Ex: Cone Trufado"
          />
        </div>

        <!-- Pessoa / Vendedor e PIX -->
        <div class="linha-dupla">
          <div class="campo-box">
            <label>
              <mat-icon>person</mat-icon>
              <span>Pessoa / Vendedor *</span>
            </label>
            <input
              type="text"
              [(ngModel)]="vendedorPessoa"
              placeholder="Ex: Patrícia"
            />
          </div>

          <div class="campo-box">
            <label>
              <mat-icon>qr_code_2</mat-icon>
              <span>Chave PIX</span>
            </label>
            <div class="pix-row-mini">
              <input
                type="text"
                [(ngModel)]="chavePix"
                placeholder="Opcional"
              />
              <button
                type="button"
                class="btn-qr-mini"
                matRipple
                title="Ler QR Code PIX"
                (click)="abrirScannerQrPix()">
                <mat-icon>qr_code_scanner</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Quantidade e Valor Unitário -->
        <div class="linha-dupla">
          <div class="campo-box">
            <label>
              <mat-icon>shopping_bag</mat-icon>
              <span>Quantidade *</span>
            </label>
            <div class="stepper-mini">
              <button type="button" class="st-btn" [disabled]="quantidade <= 1" (click)="alterarQtd(-1)">
                <mat-icon>remove</mat-icon>
              </button>
              <input
                type="number"
                min="1"
                step="1"
                [(ngModel)]="quantidade"
                (input)="recalcular()"
              />
              <button type="button" class="st-btn" (click)="alterarQtd(1)">
                <mat-icon>add</mat-icon>
              </button>
            </div>
          </div>

          <div class="campo-box">
            <label>
              <mat-icon>payments</mat-icon>
              <span>Valor Unitário (R$) *</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              [(ngModel)]="valorUnitario"
              (input)="recalcular()"
            />
          </div>
        </div>

        <!-- Resumo do Novo Total -->
        <div class="total-banner">
          <span>Novo Total do Pedido:</span>
          <strong>R$ {{ valorTotal.toFixed(2) }}</strong>
        </div>

        <!-- Data e Observação -->
        <div class="campo-box">
          <label>
            <mat-icon>calendar_today</mat-icon>
            <span>Data do Lançamento *</span>
          </label>
          <input type="date" [(ngModel)]="dataLancamento" />
        </div>

        <div class="campo-box">
          <label>
            <mat-icon>notes</mat-icon>
            <span>Observação (Opcional)</span>
          </label>
          <textarea rows="2" [(ngModel)]="observacao" placeholder="Alguma anotação..."></textarea>
        </div>

        <!-- Comprovante -->
        <div class="campo-box">
          <label>
            <mat-icon>attach_file</mat-icon>
            <span>Comprovante Anexado</span>
          </label>
          <input
            #editFileInput
            type="file"
            accept="image/*,application/pdf"
            style="display: none"
            (change)="onArquivoSelecionado($event)"
          />

          <div *ngIf="!comprovanteBase64" class="anexo-vazio" matRipple (click)="editFileInput.click()">
            <mat-icon>add_photo_alternate</mat-icon>
            <span>Toque para anexar Imagem ou PDF</span>
          </div>

          <div *ngIf="comprovanteBase64" class="anexo-preenchido">
            <div class="anexo-esq">
              <mat-icon>{{ comprovanteTipo === 'pdf' ? 'picture_as_pdf' : 'image' }}</mat-icon>
              <span>{{ comprovanteNome || 'Comprovante' }}</span>
            </div>
            <div class="anexo-btns">
              <button type="button" class="btn-mini-trocar" (click)="editFileInput.click()" title="Trocar">
                <mat-icon>sync</mat-icon>
              </button>
              <button type="button" class="btn-mini-remover" (click)="removerComprovante()" title="Remover">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="dialogRef.close()">
          Cancelar
        </button>
        <button type="button" class="btn-salvar" matRipple (click)="confirmar()">
          <mat-icon>check</mat-icon>
          <span>Salvar Alterações</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .editar-modal-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
    }

    .modal-header {
      padding: 16px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .header-icon-badge {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-title-box h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }

    .header-title-box p {
      margin: 2px 0 0;
      font-size: 0.76rem;
      color: #64748b;
    }

    .close-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: #f1f5f9;
      color: #64748b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .modal-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .erro-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 0.78rem;
      font-weight: 600;
    }

    .campo-box {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .campo-box label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.76rem;
      font-weight: 700;
      color: #334155;
    }

    .campo-box label mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #4f46e5;
    }

    .campo-box input, .campo-box textarea {
      width: 100%;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 0.86rem;
      color: #0f172a;
      outline: none;
      font-family: inherit;
    }

    .campo-box input:focus, .campo-box textarea:focus {
      border-color: #4f46e5;
    }

    .linha-dupla {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .pix-row-mini {
      display: flex;
      align-items: stretch;
      gap: 6px;
    }

    .pix-row-mini input {
      flex: 1;
      min-width: 0;
    }

    .btn-qr-mini {
      width: 36px;
      border-radius: 10px;
      border: 1.5px solid #99f6e4;
      background: #ccfbf1;
      color: #0f766e;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .btn-qr-mini mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .stepper-mini {
      display: flex;
      align-items: center;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
    }

    .stepper-mini input {
      border: none;
      text-align: center;
      font-weight: 700;
      padding: 8px 4px;
    }

    .st-btn {
      width: 34px;
      height: 36px;
      border: none;
      background: #f1f5f9;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .st-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .total-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 0.84rem;
      color: #3730a3;
      font-weight: 600;
    }

    .total-banner strong {
      font-size: 1.08rem;
      font-weight: 800;
      color: #1e1b4b;
    }

    .anexo-vazio {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1.5px dashed #cbd5e1;
      border-radius: 10px;
      padding: 10px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
    }

    .anexo-preenchido {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 8px 10px;
    }

    .anexo-esq {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #14532d;
      min-width: 0;
    }

    .anexo-esq span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .anexo-btns {
      display: flex;
      gap: 6px;
    }

    .btn-mini-trocar, .btn-mini-remover {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .btn-mini-trocar {
      background: #e0e7ff;
      color: #4338ca;
    }

    .btn-mini-remover {
      background: #fee2e2;
      color: #dc2626;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      border-top: 1px solid #f1f5f9;
    }

    .btn-cancel {
      padding: 0 16px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-salvar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 18px;
      height: 40px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
  `]
})
export class EditarDividaDialogComponent {
  descricao: string = '';
  vendedorPessoa: string = '';
  chavePix: string = '';
  quantidade: number = 1;
  valorUnitario: number = 0;
  valorTotal: number = 0;
  dataLancamento: string = '';
  observacao: string = '';

  comprovanteBase64: string | null = null;
  comprovanteNome: string | null = null;
  comprovanteTipo: string | null = null;

  erroMsg: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<EditarDividaDialogComponent, Divida>,
    @Inject(MAT_DIALOG_DATA) public data: EditarDividaData,
    private dialog: MatDialog
  ) {
    this.dialogRef.disableClose = true;
    const d = data.divida;
    this.descricao = d.descricao || '';
    this.vendedorPessoa = d.vendedor_pessoa || '';
    this.chavePix = d.chave_pix || '';
    this.quantidade = Math.max(1, Number(d.quantidade) || 1);
    this.valorTotal = Number(d.valor) || 0;
    this.valorUnitario = Number(d.valor_unitario) || Number((this.valorTotal / this.quantidade).toFixed(2));
    this.dataLancamento = d.data_lancamento || '';
    this.observacao = d.observacao || '';
    this.comprovanteBase64 = d.comprovante_base64 || null;
    this.comprovanteNome = d.comprovante_nome || null;
    this.comprovanteTipo = d.comprovante_tipo || null;
  }

  alterarQtd(delta: number): void {
    this.quantidade = Math.max(1, (Number(this.quantidade) || 1) + delta);
    this.recalcular();
  }

  abrirScannerQrPix(): void {
    const qrRef = this.dialog.open(PixQrScannerDialogComponent, {
      width: '94vw',
      maxWidth: '420px',
      disableClose: true
    });

    qrRef.afterClosed().subscribe((res?: PixQrScannerResult) => {
      if (res && res.chavePix) {
        this.chavePix = res.chavePix;
        if (res.nomeRecebedor && (!this.vendedorPessoa || !this.vendedorPessoa.trim())) {
          this.vendedorPessoa = res.nomeRecebedor;
        }
      }
    });
  }

  recalcular(): void {
    const q = Math.max(1, Math.floor(Number(this.quantidade) || 1));
    const u = Math.max(0, Number(this.valorUnitario) || 0);
    this.valorTotal = Number((q * u).toFixed(2));
  }

  onArquivoSelecionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const arquivo = input.files[0];
    if (arquivo.size > 10 * 1024 * 1024) {
      this.erroMsg = 'Arquivo muito grande (máx 10MB).';
      return;
    }

    const mime = arquivo.type.toLowerCase();
    const nome = arquivo.name;
    const tipo = (mime.includes('pdf') || nome.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'imagem';

    const reader = new FileReader();
    reader.onload = () => {
      this.comprovanteBase64 = reader.result as string;
      this.comprovanteNome = nome;
      this.comprovanteTipo = tipo;
      this.erroMsg = null;
    };
    reader.readAsDataURL(arquivo);
  }

  removerComprovante(): void {
    this.comprovanteBase64 = null;
    this.comprovanteNome = null;
    this.comprovanteTipo = null;
  }

  confirmar(): void {
    if (!this.descricao || !this.descricao.trim()) {
      this.erroMsg = 'Informe a descrição do pedido.';
      return;
    }
    if (!this.vendedorPessoa || !this.vendedorPessoa.trim()) {
      this.erroMsg = 'Informe o nome da pessoa/vendedor.';
      return;
    }
    this.recalcular();
    if (this.valorUnitario <= 0 || this.valorTotal <= 0) {
      this.erroMsg = 'O valor deve ser maior que zero.';
      return;
    }

    const d = this.data.divida;
    const valorJaPago = Math.min(this.valorTotal, Number(d.valor_pago) || 0);
    const pagoAtualizado = d.pago && valorJaPago >= this.valorTotal;

    const atualizada: Divida = {
      ...d,
      descricao: this.descricao.trim(),
      vendedor_pessoa: this.vendedorPessoa.trim(),
      chave_pix: this.chavePix && this.chavePix.trim() ? this.chavePix.trim() : null,
      quantidade: Math.max(1, Math.floor(Number(this.quantidade) || 1)),
      valor_unitario: Number(this.valorUnitario),
      valor: this.valorTotal,
      valor_pago: valorJaPago,
      pago: pagoAtualizado,
      data_lancamento: this.dataLancamento,
      observacao: this.observacao && this.observacao.trim() ? this.observacao.trim() : null,
      comprovante_base64: this.comprovanteBase64,
      comprovante_nome: this.comprovanteNome,
      comprovante_tipo: this.comprovanteTipo
    };

    this.dialogRef.close(atualizada);
  }
}

