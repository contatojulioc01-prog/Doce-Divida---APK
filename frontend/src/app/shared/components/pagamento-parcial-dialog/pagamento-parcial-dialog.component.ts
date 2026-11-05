import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Divida } from '../../../models/divida.model';

export interface PagamentoParcialData {
  divida: Divida;
}

export interface ResultadoPagamentoParcial {
  modo: 'valor' | 'quantidade';
  valor?: number;
  quantidade?: number;
  observacao?: string | null;
  comprovante_base64?: string | null;
  comprovante_nome?: string | null;
  comprovante_tipo?: string | null;
}

@Component({
  selector: 'app-pagamento-parcial-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="pagamento-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>payments</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Registrar Pagamento</h2>
            <p>{{ data.divida.descricao }} • {{ data.divida.vendedor_pessoa }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <!-- Card de Chave PIX (se existir) -->
        <div *ngIf="data.divida.chave_pix" class="pix-banner-card">
          <div class="pix-left">
            <div class="pix-icon-box">
              <mat-icon>qr_code_2</mat-icon>
            </div>
            <div class="pix-info">
              <span class="pix-lbl">Chave PIX de {{ data.divida.vendedor_pessoa }}</span>
              <strong class="pix-valor">{{ data.divida.chave_pix }}</strong>
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

        <!-- Card de Status do Pedido (Ex: Já pago R$ 25 de R$ 50, falta R$ 25) -->
        <div class="pedido-status-box">
          <div class="status-row">
            <span class="status-label">Total do Pedido:</span>
            <strong>R$ {{ valorTotalPedido.toFixed(2) }} <small class="sub-item-qtd">({{ totalPedido }} un.)</small></strong>
          </div>
          <div class="status-row">
            <span class="status-label">Já Pago:</span>
            <span class="texto-verde">R$ {{ jaPagoValor.toFixed(2) }} <small *ngIf="jaPagoQtd > 0">({{ jaPagoQtd }} un.)</small></span>
          </div>
          <div class="status-row destaque-pendente">
            <span class="status-label">Falta Pagar:</span>
            <strong class="texto-vermelho">R$ {{ pendenteValor.toFixed(2) }} <small *ngIf="pendenteQtd > 0">({{ pendenteQtd }} un.)</small></strong>
          </div>
        </div>

        <!-- Abas de Alternância: Pagar por VALOR ou QUANTIDADE -->
        <div class="modo-tabs">
          <button
            type="button"
            class="tab-btn"
            [class.ativo]="modo === 'valor'"
            matRipple
            (click)="trocarModo('valor')">
            <mat-icon>attach_money</mat-icon>
            <span>Pagar por Valor (R$)</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.ativo]="modo === 'quantidade'"
            matRipple
            (click)="trocarModo('quantidade')">
            <mat-icon>inventory_2</mat-icon>
            <span>Pagar por Quantidade</span>
          </button>
        </div>

        <!-- MODO 1: PAGAR POR VALOR (Ex: Pago 25 de 50, resta 25) -->
        <div *ngIf="modo === 'valor'" class="secao-modo">
          <label class="campo-rotulo">Quanto deseja pagar agora? (R$)</label>
          <div class="input-valor-wrapper">
            <span class="prefixo-moeda">R$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              [max]="pendenteValor"
              [(ngModel)]="valorPagar"
              (input)="onValorInput()"
              class="input-valor-grande"
              placeholder="0,00"
            />
          </div>

          <!-- Atalhos rápidos de valores -->
          <div class="atalhos-valores">
            <button
              *ngIf="pendenteValor >= 10 && pendenteValor > 10"
              type="button"
              class="chip-valor"
              (click)="definirValor(10)">
              + R$ 10
            </button>
            <button
              *ngIf="pendenteValor >= 20 && pendenteValor > 20"
              type="button"
              class="chip-valor"
              (click)="definirValor(20)">
              + R$ 20
            </button>
            <button
              *ngIf="pendenteValor >= 50 && pendenteValor > 50"
              type="button"
              class="chip-valor"
              (click)="definirValor(50)">
              + R$ 50
            </button>
            <button
              type="button"
              class="chip-valor chip-metade"
              (click)="definirMetade()">
              Metade (R$ {{ (pendenteValor / 2).toFixed(2) }})
            </button>
            <button
              type="button"
              class="chip-valor chip-tudo"
              (click)="definirValorTotal()">
              Tudo (R$ {{ pendenteValor.toFixed(2) }})
            </button>
          </div>

          <!-- Banner Informativo do Saldo Restante -->
          <div class="saldo-restante-card">
            <div class="saldo-calc-left">
              <mat-icon>calculate</mat-icon>
              <div class="saldo-textos">
                <span>Após este pagamento:</span>
                <small>Pagando R$ {{ (valorPagar || 0).toFixed(2) }} de R$ {{ pendenteValor.toFixed(2) }}</small>
              </div>
            </div>
            <div class="saldo-valor-restante">
              <span class="lbl-resta">Restará a pagar:</span>
              <strong [class.quitado-badge]="valorRestanteApos <= 0">
                {{ valorRestanteApos <= 0 ? 'Quitado!' : ('R$ ' + valorRestanteApos.toFixed(2)) }}
              </strong>
            </div>
          </div>
        </div>

        <!-- MODO 2: PAGAR POR QUANTIDADE -->
        <div *ngIf="modo === 'quantidade'" class="secao-modo">
          <label class="campo-rotulo">Quantas unidades deseja pagar agora?</label>
          <div class="stepper-controls">
            <button
              type="button"
              class="step-btn"
              matRipple
              [disabled]="quantidadePagar <= 1"
              (click)="alterarQtd(-1)">
              <mat-icon>remove</mat-icon>
            </button>
            <div class="step-display">
              <span class="step-num">{{ quantidadePagar }}</span>
              <small class="step-unit">unidade(s)</small>
            </div>
            <button
              type="button"
              class="step-btn"
              matRipple
              [disabled]="quantidadePagar >= pendenteQtd"
              (click)="alterarQtd(1)">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <!-- Total a pagar calculado da quantidade -->
          <div class="total-pagar-card">
            <div class="total-info-esq">
              <span class="label-pagar">Valor correspondente:</span>
              <small>{{ quantidadePagar }} un. &times; R$ {{ unitario.toFixed(2) }}</small>
            </div>
            <div class="total-valor-destaque">
              R$ {{ (quantidadePagar * unitario).toFixed(2) }}
            </div>
          </div>
        </div>

        <!-- Seção de Comprovante e Observação no Momento do Pagamento -->
        <div class="secao-anexo-pagamento">
          <label class="campo-rotulo">
            <mat-icon>attach_file</mat-icon>
            <span>Comprovante deste pagamento (Opcional)</span>
          </label>

          <input
            #filePayInput
            type="file"
            accept="image/*,application/pdf"
            style="display: none"
            (change)="onArquivoSelecionado($event)"
          />

          <div
            *ngIf="!comprovanteBase64"
            class="anexo-dropzone-mini"
            matRipple
            (click)="filePayInput.click()">
            <mat-icon class="up-icon">add_photo_alternate</mat-icon>
            <div class="up-texts">
              <strong>Anexar Comprovante (Foto ou PDF)</strong>
              <span>Ficará salvo no histórico e no pedido</span>
            </div>
            <span class="up-btn">Escolher</span>
          </div>

          <div *ngIf="comprovanteBase64" class="anexo-preview-mini">
            <div class="prev-left">
              <mat-icon [class.pdf-ic]="comprovanteTipo === 'pdf'">
                {{ comprovanteTipo === 'pdf' ? 'picture_as_pdf' : 'image' }}
              </mat-icon>
              <div class="prev-info">
                <strong>{{ comprovanteNome }}</strong>
                <span>{{ comprovanteTipo === 'pdf' ? 'Documento PDF' : 'Imagem / Foto' }}</span>
              </div>
            </div>
            <button type="button" class="btn-del-anexo" (click)="removerAnexo()" title="Remover">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <div *ngIf="erroArquivo" class="erro-anexo-msg">
            {{ erroArquivo }}
          </div>

          <input
            type="text"
            class="input-obs-pagamento"
            placeholder="Observação do pagamento (ex: Pago via PIX)..."
            [(ngModel)]="observacaoPagamento"
          />
        </div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="dialogRef.close()">
          Cancelar
        </button>

        <button
          type="button"
          class="btn-confirmar-pagamento"
          matRipple
          [disabled]="modo === 'valor' ? (!valorPagar || valorPagar <= 0) : (!quantidadePagar || quantidadePagar <= 0)"
          (click)="confirmar()">
          <mat-icon>check</mat-icon>
          <span>{{ modo === 'valor' ? ('Pagar R$ ' + (valorPagar || 0).toFixed(2)) : ('Pagar ' + quantidadePagar + ' un.') }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pagamento-modal-wrapper {
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
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(255, 255, 255, 1) 100%);
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
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
      flex-shrink: 0;
    }

    .header-icon-badge mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .header-title-box {
      min-width: 0;
    }

    .header-title-box h2 {
      margin: 0;
      font-size: 1.08rem;
      font-weight: 700;
      color: #0f172a;
    }

    .header-title-box p {
      margin: 2px 0 0;
      font-size: 0.78rem;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
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
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .close-btn:active {
      transform: scale(0.92);
      background: #e2e8f0;
    }

    .modal-body {
      padding: 16px 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 72vh;
      overflow-y: auto;
    }

    /* Banner PIX */
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
      transition: all 0.2s;
    }

    .btn-copiar-pix-modal.copiado {
      background: #047857;
    }

    .btn-copiar-pix-modal mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Card de Status do Pedido */
    .pedido-status-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.84rem;
      color: #334155;
    }

    .status-row.destaque-pendente {
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
      margin-top: 2px;
      font-size: 0.92rem;
    }

    .status-label {
      font-weight: 500;
      color: #64748b;
    }

    .sub-item-qtd {
      font-size: 0.76rem;
      color: #94a3b8;
      font-weight: 500;
    }

    .texto-verde {
      color: #059669;
      font-weight: 700;
    }

    .texto-vermelho {
      color: #dc2626;
      font-weight: 800;
    }

    /* Abas de Modo */
    .modo-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 12px;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 600;
      border-radius: 9px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .tab-btn.ativo {
      background: #ffffff;
      color: #059669;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      font-weight: 700;
    }

    /* Seção de Modo */
    .secao-modo {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .campo-rotulo {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
    }

    .campo-rotulo mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #059669;
    }

    /* Campo de Input Grande de Valor */
    .input-valor-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 2px solid #a7f3d0;
      border-radius: 14px;
      padding: 6px 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-valor-wrapper:focus-within {
      border-color: #059669;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.16);
    }

    .prefixo-moeda {
      font-size: 1.25rem;
      font-weight: 700;
      color: #059669;
      margin-right: 8px;
      user-select: none;
    }

    .input-valor-grande {
      flex: 1;
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      font-family: inherit;
    }

    /* Chips e Atalhos de Valores */
    .atalhos-valores {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip-valor {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .chip-valor:hover, .chip-valor:active {
      background: #e2e8f0;
    }

    .chip-metade {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1d4ed8;
    }

    .chip-tudo {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
      font-weight: 700;
    }

    /* Card de Saldo Restante */
    .saldo-restante-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 9px 12px;
    }

    .saldo-calc-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .saldo-calc-left mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #6366f1;
    }

    .saldo-textos {
      display: flex;
      flex-direction: column;
    }

    .saldo-textos span {
      font-size: 0.76rem;
      font-weight: 600;
      color: #1e293b;
    }

    .saldo-textos small {
      font-size: 0.68rem;
      color: #64748b;
    }

    .saldo-valor-restante {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .lbl-resta {
      font-size: 0.66rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }

    .saldo-valor-restante strong {
      font-size: 0.94rem;
      color: #dc2626;
      font-weight: 800;
    }

    .quitado-badge {
      color: #059669 !important;
      background: #d1fae5;
      padding: 1px 6px;
      border-radius: 4px;
    }

    /* Stepper para Modo Quantidade */
    .stepper-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 10px;
    }

    .step-btn {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: 1.5px solid #cbd5e1;
      background: #ffffff;
      color: #1e293b;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: all 0.2s;
    }

    .step-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .step-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 90px;
    }

    .step-num {
      font-size: 1.7rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .step-unit {
      font-size: 0.72rem;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }

    .total-pagar-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1.5px solid #a7f3d0;
      border-radius: 12px;
      padding: 12px 14px;
    }

    .total-info-esq {
      display: flex;
      flex-direction: column;
    }

    .label-pagar {
      font-size: 0.78rem;
      font-weight: 700;
      color: #065f46;
    }

    .total-info-esq small {
      font-size: 0.7rem;
      color: #047857;
    }

    .total-valor-destaque {
      font-size: 1.25rem;
      font-weight: 800;
      color: #065f46;
    }

    /* Seção de Anexo no Pagamento */
    .secao-anexo-pagamento {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px dashed #e2e8f0;
      padding-top: 12px;
    }

    .anexo-dropzone-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      padding: 8px 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .anexo-dropzone-mini:hover {
      border-color: #10b981;
      background: #f0fdf4;
    }

    .up-icon {
      color: #059669;
      font-size: 22px;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }

    .up-texts {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .up-texts strong {
      font-size: 0.78rem;
      color: #1e293b;
    }

    .up-texts span {
      font-size: 0.68rem;
      color: #64748b;
    }

    .up-btn {
      background: #e2e8f0;
      color: #334155;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .anexo-preview-mini {
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
      font-size: 20px;
      width: 20px;
      height: 20px;
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

    .btn-del-anexo {
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

    .btn-del-anexo mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .erro-anexo-msg {
      font-size: 0.74rem;
      color: #dc2626;
      font-weight: 600;
    }

    .input-obs-pagamento {
      width: 100%;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 0.82rem;
      color: #1e293b;
      outline: none;
      font-family: inherit;
    }

    .input-obs-pagamento:focus {
      border-color: #10b981;
    }

    /* Rodapé */
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      background: #ffffff;
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

    .btn-confirmar-pagamento {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 20px;
      height: 42px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.2s;
    }

    .btn-confirmar-pagamento:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-confirmar-pagamento mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `]
})
export class PagamentoParcialDialogComponent {
  modo: 'valor' | 'quantidade' = 'valor';
  valorPagar: number | null = null;
  quantidadePagar: number = 1;

  observacaoPagamento: string = '';
  comprovanteBase64: string | null = null;
  comprovanteNome: string | null = null;
  comprovanteTipo: string | null = null;
  erroArquivo: string | null = null;
  pixCopiado = false;

  constructor(
    public dialogRef: MatDialogRef<PagamentoParcialDialogComponent, ResultadoPagamentoParcial>,
    @Inject(MAT_DIALOG_DATA) public data: PagamentoParcialData
  ) {
    this.dialogRef.disableClose = true;
    this.quantidadePagar = Math.min(1, this.pendenteQtd);
    this.valorPagar = Number(this.pendenteValor.toFixed(2));
  }

  get totalPedido(): number {
    return Number(this.data.divida.quantidade) || 1;
  }

  get unitario(): number {
    if (this.data.divida.valor_unitario && this.data.divida.valor_unitario > 0) {
      return Number(this.data.divida.valor_unitario);
    }
    return this.totalPedido > 0 ? Number(this.data.divida.valor) / this.totalPedido : Number(this.data.divida.valor);
  }

  get valorTotalPedido(): number {
    return Number(this.data.divida.valor) || (this.totalPedido * this.unitario);
  }

  get jaPagoValor(): number {
    if (this.data.divida.pago) return this.valorTotalPedido;
    if (this.data.divida.valor_pago !== undefined && this.data.divida.valor_pago !== null) {
      return Number(this.data.divida.valor_pago);
    }
    if (this.data.divida.quantidade_paga !== undefined) {
      return Number(this.data.divida.quantidade_paga) * this.unitario;
    }
    return 0;
  }

  get pendenteValor(): number {
    return Math.max(0, Number((this.valorTotalPedido - this.jaPagoValor).toFixed(2)));
  }

  get jaPagoQtd(): number {
    if (this.data.divida.quantidade_paga !== undefined) {
      return Number(this.data.divida.quantidade_paga);
    }
    return this.data.divida.pago ? this.totalPedido : (this.unitario > 0 ? Math.floor(this.jaPagoValor / this.unitario) : 0);
  }

  get pendenteQtd(): number {
    return Math.max(1, this.totalPedido - this.jaPagoQtd);
  }

  get valorRestanteApos(): number {
    const p = Number(this.valorPagar) || 0;
    return Math.max(0, Number((this.pendenteValor - p).toFixed(2)));
  }

  copiarPix(): void {
    const pix = this.data.divida.chave_pix;
    if (!pix) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pix).catch(() => {});
    }
    this.pixCopiado = true;
    setTimeout(() => {
      this.pixCopiado = false;
    }, 2500);
  }

  trocarModo(modo: 'valor' | 'quantidade'): void {
    this.modo = modo;
  }

  onValorInput(): void {
    if (this.valorPagar !== null && this.valorPagar !== undefined) {
      if (this.valorPagar > this.pendenteValor) {
        this.valorPagar = Number(this.pendenteValor.toFixed(2));
      }
    }
  }

  definirValor(acrescimo: number): void {
    const atual = Number(this.valorPagar) || 0;
    this.valorPagar = Math.min(this.pendenteValor, Number((atual + acrescimo).toFixed(2)));
  }

  definirMetade(): void {
    this.valorPagar = Number((this.pendenteValor / 2).toFixed(2));
  }

  definirValorTotal(): void {
    this.valorPagar = Number(this.pendenteValor.toFixed(2));
  }

  alterarQtd(delta: number): void {
    const nova = this.quantidadePagar + delta;
    if (nova >= 1 && nova <= this.pendenteQtd) {
      this.quantidadePagar = nova;
    }
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
    const extras = {
      observacao: this.observacaoPagamento && this.observacaoPagamento.trim() ? this.observacaoPagamento.trim() : null,
      comprovante_base64: this.comprovanteBase64,
      comprovante_nome: this.comprovanteNome,
      comprovante_tipo: this.comprovanteTipo
    };

    if (this.modo === 'valor') {
      const v = Number(this.valorPagar) || 0;
      if (v <= 0) return;
      this.dialogRef.close({ modo: 'valor', valor: v, ...extras });
    } else {
      const q = Math.max(1, Math.floor(Number(this.quantidadePagar) || 1));
      this.dialogRef.close({ modo: 'quantidade', quantidade: q, ...extras });
    }
  }
}
