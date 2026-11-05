import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

export interface ComprovanteDialogData {
  titulo: string;
  descricao?: string;
  comprovante_nome: string;
  comprovante_tipo: string; // 'imagem' | 'pdf'
  comprovante_base64: string;
}

@Component({
  selector: 'app-comprovante-visualizar-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="comprovante-modal-container">
      <!-- Cabeçalho -->
      <header class="modal-header">
        <div class="header-left">
          <div class="header-icon-box" [class.is-pdf]="data.comprovante_tipo === 'pdf'">
            <mat-icon>{{ data.comprovante_tipo === 'pdf' ? 'picture_as_pdf' : 'image' }}</mat-icon>
          </div>
          <div class="header-texts">
            <h2>Comprovante de Pagamento</h2>
            <p>{{ data.comprovante_nome || data.titulo }}</p>
          </div>
        </div>
        <button type="button" class="btn-fechar" (click)="fechar()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <!-- Corpo com a visualização do comprovante -->
      <div class="modal-body">
        <!-- Visualizador de Imagem -->
        <div *ngIf="data.comprovante_tipo !== 'pdf'" class="imagem-viewer-container">
          <img
            [src]="data.comprovante_base64"
            [alt]="data.comprovante_nome"
            class="comprovante-img"
          />
        </div>

        <!-- Visualizador de PDF -->
        <div *ngIf="data.comprovante_tipo === 'pdf'" class="pdf-viewer-container">
          <iframe
            [src]="data.comprovante_base64"
            class="pdf-iframe"
            title="Visualizador de PDF">
          </iframe>
          <div class="pdf-fallback-hint">
            <mat-icon>info</mat-icon>
            <span>Se o PDF não carregar na tela, utilize o botão abaixo para baixar/abrir o arquivo.</span>
          </div>
        </div>
      </div>

      <!-- Rodapé de Ações -->
      <footer class="modal-footer">
        <button
          type="button"
          class="btn-baixar"
          matRipple
          (click)="baixarArquivo()">
          <mat-icon>download</mat-icon>
          <span>Baixar Comprovante</span>
        </button>

        <button
          type="button"
          class="btn-fechar-footer"
          matRipple
          (click)="fechar()">
          <span>Fechar</span>
        </button>
      </footer>
    </div>
  `,
  styles: [`
    .comprovante-modal-container {
      display: flex;
      flex-direction: column;
      max-height: 88vh;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      background: #ffffff;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .header-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
    }

    .header-icon-box.is-pdf {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 4px 10px rgba(220, 38, 38, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-texts {
      min-width: 0;
    }

    .header-texts h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
    }

    .header-texts p {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
    }

    .btn-fechar {
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
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .btn-fechar:active {
      transform: scale(0.92);
      background: #e2e8f0;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      max-height: 60vh;
    }

    .imagem-viewer-container {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .comprovante-img {
      max-width: 100%;
      max-height: 56vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .pdf-viewer-container {
      width: 100%;
      height: 56vh;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pdf-iframe {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 8px;
      background: #ffffff;
    }

    .pdf-fallback-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      padding: 6px 10px;
      border-radius: 6px;
    }

    .pdf-fallback-hint mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #38bdf8;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    .btn-baixar {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      background: #4f46e5;
      color: #ffffff;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-baixar mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .btn-fechar-footer {
      padding: 10px 16px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class ComprovanteVisualizarDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ComprovanteVisualizarDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ComprovanteDialogData
  ) {}

  fechar(): void {
    this.dialogRef.close();
  }

  baixarArquivo(): void {
    if (!this.data.comprovante_base64) return;
    const a = document.createElement('a');
    a.href = this.data.comprovante_base64;
    a.download = this.data.comprovante_nome || (this.data.comprovante_tipo === 'pdf' ? 'comprovante.pdf' : 'comprovante.png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

