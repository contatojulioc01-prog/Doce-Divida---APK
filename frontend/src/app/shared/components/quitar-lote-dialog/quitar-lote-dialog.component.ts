import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Divida } from '../../../models/divida.model';

export interface QuitarLoteData {
  titulo: string;
  subtitulo: string;
  vendedor_pessoa: string;
  chave_pix?: string | null;
  itens: Divida[];
  total_pendente: number;
}

export interface ResultadoQuitarLote {
  confirmado: boolean;
  observacao?: string | null;
  comprovante_base64?: string | null;
  comprovante_nome?: string | null;
  comprovante_tipo?: string | null;
}

@Component({
  selector: 'app-quitar-lote-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="lote-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>done_all</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>{{ data.titulo }}</h2>
            <p>{{ data.subtitulo }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <!-- Banner de Valor Total da Quitação em Lote -->
        <div class="resumo-lote-card">
          <div class="resumo-topo">
            <span class="lbl-total">Valor Total a Quitar</span>
            <span class="badge-qtd">{{ data.itens.length }} pedido(s) pendente(s)</span>
          </div>
          <div class="valor-gigante">R$ {{ data.total_pendente.toFixed(2) }}</div>
          <span class="pessoa-ref">
            <mat-icon>person</mat-icon>
            Favorecido: <strong>{{ data.vendedor_pessoa }}</strong>
          </span>
        </div>

        <!-- Card de Chave PIX (se existir) -->
        <div *ngIf="data.chave_pix" class="pix-banner-card">
          <div class="pix-left">
            <div class="pix-icon-box">
              <mat-icon>qr_code_2</mat-icon>
            </div>
            <div class="pix-info">
              <span class="pix-lbl">Chave PIX de {{ data.vendedor_pessoa }}</span>
              <strong class="pix-valor">{{ data.chave_pix }}</strong>
            </div>
          </div>
          <button
            type="button"
            class="btn-copiar-pix-modal"
            [class.copiado]="pixCopiado"
            matRipple
            (click)="copiarPix()">
            <mat-icon>{{ pixCopiado ? 'check' : 'content_copy' }}</mat-icon>
            <span>{{ pixCopiado ? 'Copiado!' : 'Copiar PIX' }}</span>
          </button>
        </div>

        <!-- Lista resumida dos itens incluídos no lote -->
        <div class="itens-lote-box">
          <span class="sec-title">Pedidos que serão quitados:</span>
          <div class="itens-scroll">
            <div *ngFor="let item of data.itens" class="item-linha">
              <div class="item-esq">
                <strong>{{ item.quantidade }}x {{ item.descricao }}</strong>
                <small>Dia {{ item.data_lancamento }}</small>
              </div>
              <span class="item-val">
                R$ {{ calcularRestanteItem(item).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Anexo Único de Comprovante para todos os itens do lote -->
        <div class="secao-anexo-lote">
          <label class="sec-title">
            <mat-icon>attach_file</mat-icon>
            <span>Anexar Comprovante Único (Opcional)</span>
          </label>

          <input
            #fileLoteInput
            type="file"
            accept="image/*,application/pdf"
            style="display: none"
            (change)="onArquivoSelecionado($event)"
          />

          <div
            *ngIf="!comprovanteBase64"
            class="anexo-dropzone"
            matRipple
            (click)="fileLoteInput.click()">
            <mat-icon class="up-ic">cloud_upload</mat-icon>
            <div class="up-txt">
              <strong>Anexar Foto ou PDF do PIX</strong>
              <span>Será vinculado a todos os {{ data.itens.length }} pedidos</span>
            </div>
            <span class="up-pill">Escolher</span>
          </div>

          <div *ngIf="comprovanteBase64" class="anexo-preview">
            <div class="prev-left">
              <mat-icon [class.pdf-ic]="comprovanteTipo === 'pdf'">
                {{ comprovanteTipo === 'pdf' ? 'picture_as_pdf' : 'image' }}
              </mat-icon>
              <div class="prev-info">
                <strong>{{ comprovanteNome }}</strong>
                <span>{{ comprovanteTipo === 'pdf' ? 'Documento PDF' : 'Imagem / Foto' }}</span>
              </div>
            </div>
            <button type="button" class="btn-del" (click)="removerAnexo()">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <div *ngIf="erroArquivo" class="erro-msg">{{ erroArquivo }}</div>

          <input
            type="text"
            class="input-obs"
            placeholder="Observação (ex: Quitação mensal via PIX)..."
            [(ngModel)]="observacao"
          />
        </div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="dialogRef.close()">
          Cancelar
        </button>
        <button type="button" class="btn-confirmar" matRipple (click)="confirmar()">
          <mat-icon>done_all</mat-icon>
          <span>Quitar R$ {{ data.total_pendente.toFixed(2) }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .lote-modal-wrapper {
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
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);
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
      font-size: 0.78rem;
      color: #64748b;
    }

    .close-btn {
      width: 36px;
      height: 36px;
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
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .resumo-lote-card {
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1.5px solid #c7d2fe;
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .resumo-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .lbl-total {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #4338ca;
    }

    .badge-qtd {
      background: #4f46e5;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .valor-gigante {
      font-size: 1.6rem;
      font-weight: 800;
      color: #1e1b4b;
    }

    .pessoa-ref {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: #3730a3;
    }

    .pessoa-ref mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* PIX */
    .pix-banner-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 12px;
      padding: 8px 12px;
    }

    .pix-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    .pix-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #16a34a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .pix-icon-box mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .pix-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .pix-lbl {
      font-size: 0.68rem;
      color: #15803d;
      font-weight: 600;
    }

    .pix-valor {
      font-size: 0.82rem;
      color: #14532d;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-copiar-pix-modal {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }

    .btn-copiar-pix-modal mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Lista de itens */
    .itens-lote-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sec-title {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #334155;
    }

    .sec-title mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #4f46e5;
    }

    .itens-scroll {
      max-height: 130px;
      overflow-y: auto;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .item-linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 5px;
      font-size: 0.78rem;
    }

    .item-linha:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .item-esq {
      display: flex;
      flex-direction: column;
    }

    .item-esq strong {
      color: #1e293b;
    }

    .item-esq small {
      font-size: 0.68rem;
      color: #64748b;
    }

    .item-val {
      font-weight: 700;
      color: #dc2626;
    }

    /* Anexo */
    .secao-anexo-lote {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .anexo-dropzone {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
    }

    .up-ic {
      color: #4f46e5;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .up-txt {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .up-txt strong {
      font-size: 0.78rem;
      color: #1e293b;
    }

    .up-txt span {
      font-size: 0.68rem;
      color: #64748b;
    }

    .up-pill {
      background: #e0e7ff;
      color: #4338ca;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .anexo-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 8px 10px;
    }

    .prev-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    .prev-left mat-icon {
      color: #16a34a;
    }

    .prev-left mat-icon.pdf-ic {
      color: #dc2626;
    }

    .prev-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .prev-info strong {
      font-size: 0.76rem;
      color: #14532d;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .prev-info span {
      font-size: 0.66rem;
      color: #15803d;
    }

    .btn-del {
      border: none;
      background: #fee2e2;
      color: #dc2626;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .input-obs {
      width: 100%;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 0.82rem;
      outline: none;
      font-family: inherit;
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
      height: 42px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-confirmar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 18px;
      height: 42px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .btn-confirmar mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `]
})
export class QuitarLoteDialogComponent {
  observacao: string = '';
  comprovanteBase64: string | null = null;
  comprovanteNome: string | null = null;
  comprovanteTipo: string | null = null;
  erroArquivo: string | null = null;
  pixCopiado = false;

  constructor(
    public dialogRef: MatDialogRef<QuitarLoteDialogComponent, ResultadoQuitarLote>,
    @Inject(MAT_DIALOG_DATA) public data: QuitarLoteData
  ) {
    this.dialogRef.disableClose = true;
  }

  calcularRestanteItem(item: Divida): number {
    if (item.pago) return 0;
    const vTotal = Number(item.valor) || 0;
    const vPago = Number(item.valor_pago) || 0;
    return Math.max(0, Number((vTotal - vPago).toFixed(2)));
  }

  copiarPix(): void {
    if (!this.data.chave_pix) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.data.chave_pix).catch(() => {});
    }
    this.pixCopiado = true;
    setTimeout(() => {
      this.pixCopiado = false;
    }, 2500);
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

    if (arquivo.size > 10 * 1024 * 1024) {
      this.erroArquivo = 'Arquivo muito grande (máx 10MB).';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.comprovanteBase64 = reader.result as string;
      this.comprovanteNome = nome;
      this.comprovanteTipo = tipo;
      this.erroArquivo = null;
    };
    reader.readAsDataURL(arquivo);
  }

  removerAnexo(): void {
    this.comprovanteBase64 = null;
    this.comprovanteNome = null;
    this.comprovanteTipo = null;
  }

  confirmar(): void {
    this.dialogRef.close({
      confirmado: true,
      observacao: this.observacao && this.observacao.trim() ? this.observacao.trim() : null,
      comprovante_base64: this.comprovanteBase64,
      comprovante_nome: this.comprovanteNome,
      comprovante_tipo: this.comprovanteTipo
    });
  }
}

