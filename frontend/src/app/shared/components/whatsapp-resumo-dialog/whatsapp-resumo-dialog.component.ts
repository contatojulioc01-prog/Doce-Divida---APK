import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Divida } from '../../../models/divida.model';

export interface WhatsappResumoData {
  vendedor_pessoa: string;
  periodoLabel?: string;
  itens: Divida[];
  filtroInicial?: 'pendentes' | 'pagos' | 'todos';
}

@Component({
  selector: 'app-whatsapp-resumo-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="whats-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>chat</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Resumo para WhatsApp</h2>
            <p>Enviar extrato para {{ data.vendedor_pessoa }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <!-- Seletor de quais itens incluir no resumo -->
        <div class="filtro-resumo-group">
          <button
            type="button"
            class="filtro-tab"
            [class.ativo]="tipoResumo === 'pendentes'"
            matRipple
            (click)="alterarFiltro('pendentes')">
            <mat-icon>schedule</mat-icon>
            <span>Pendentes</span>
          </button>
          <button
            type="button"
            class="filtro-tab"
            [class.ativo]="tipoResumo === 'pagos'"
            matRipple
            (click)="alterarFiltro('pagos')">
            <mat-icon>check_circle</mat-icon>
            <span>Já Pagos</span>
          </button>
          <button
            type="button"
            class="filtro-tab"
            [class.ativo]="tipoResumo === 'todos'"
            matRipple
            (click)="alterarFiltro('todos')">
            <mat-icon>list_alt</mat-icon>
            <span>Completo</span>
          </button>
        </div>

        <!-- Telefone opcional para abrir conversa direta -->
        <div class="campo-tel">
          <label>
            <mat-icon>phone_iphone</mat-icon>
            <span>WhatsApp do Vendedor (Opcional — deixe vazio para escolher na agenda)</span>
          </label>
          <input
            type="tel"
            placeholder="Ex: 11999998888"
            [(ngModel)]="telefoneDestino"
          />
        </div>

        <!-- Caixa de Pré-visualização / Edição da Mensagem -->
        <div class="preview-box">
          <div class="preview-header">
            <span>Prévia da Mensagem (editável):</span>
            <button
              type="button"
              class="btn-copiar-texto"
              [class.copiado]="copiado"
              matRipple
              (click)="copiarTexto()">
              <mat-icon>{{ copiado ? 'check' : 'content_copy' }}</mat-icon>
              <span>{{ copiado ? 'Copiado!' : 'Copiar Texto' }}</span>
            </button>
          </div>
          <textarea
            rows="9"
            [(ngModel)]="textoMensagem"
            class="textarea-whats">
          </textarea>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="dialogRef.close()">
          Fechar
        </button>
        <button type="button" class="btn-enviar-whats" matRipple (click)="enviarWhatsApp()">
          <mat-icon>send</mat-icon>
          <span>Abrir no WhatsApp</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .whats-modal-wrapper {
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
      background: linear-gradient(135deg, rgba(22, 163, 74, 0.12) 0%, rgba(255, 255, 255, 1) 100%);
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
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(22, 163, 74, 0.3);
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
      max-height: 72vh;
      overflow-y: auto;
    }

    .filtro-resumo-group {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 12px;
    }

    .filtro-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 6px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 0.74rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filtro-tab mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .filtro-tab.ativo {
      background: #ffffff;
      color: #16a34a;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }

    .campo-tel {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .campo-tel label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.74rem;
      font-weight: 600;
      color: #475569;
    }

    .campo-tel label mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #16a34a;
    }

    .campo-tel input {
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 0.85rem;
      color: #0f172a;
      outline: none;
    }

    .campo-tel input:focus {
      border-color: #22c55e;
    }

    .preview-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.76rem;
      font-weight: 700;
      color: #334155;
    }

    .btn-copiar-texto {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #334155;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-copiar-texto.copiado {
      background: #dcfce7;
      border-color: #86efac;
      color: #15803d;
    }

    .btn-copiar-texto mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .textarea-whats {
      width: 100%;
      border: 1.5px solid #bbf7d0;
      background: #f0fdf4;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 0.82rem;
      line-height: 1.45;
      color: #14532d;
      font-family: inherit;
      resize: vertical;
      outline: none;
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

    .btn-enviar-whats {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 18px;
      height: 42px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
    }

    .btn-enviar-whats mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class WhatsappResumoDialogComponent implements OnInit {
  tipoResumo: 'pendentes' | 'pagos' | 'todos' = 'todos';
  telefoneDestino: string = '';
  textoMensagem: string = '';
  copiado = false;

  constructor(
    public dialogRef: MatDialogRef<WhatsappResumoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: WhatsappResumoData
  ) {
    this.dialogRef.disableClose = true;
    this.tipoResumo = data.filtroInicial || 'todos';
  }

  ngOnInit(): void {
    this.gerarTextoResumo();
  }

  alterarFiltro(novo: 'pendentes' | 'pagos' | 'todos'): void {
    this.tipoResumo = novo;
    this.gerarTextoResumo();
  }

  private formatarDataCurta(iso: string): string {
    if (!iso) return '';
    const partes = iso.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}`;
    }
    return iso;
  }

  gerarTextoResumo(): void {
    const pessoa = this.data.vendedor_pessoa || 'Vendedor';
    const periodo = this.data.periodoLabel && this.data.periodoLabel !== 'Todos os Meses'
      ? ` (${this.data.periodoLabel})`
      : '';

    let itensFiltrados = [...(this.data.itens || [])];
    if (this.tipoResumo === 'pendentes') {
      itensFiltrados = itensFiltrados.filter(i => !i.pago);
    } else if (this.tipoResumo === 'pagos') {
      itensFiltrados = itensFiltrados.filter(i => i.pago || (Number(i.valor_pago) || 0) > 0);
    }

    itensFiltrados.sort((a, b) => (a.data_lancamento || '').localeCompare(b.data_lancamento || ''));

    const linhas: string[] = [];
    linhas.push(`Oi *${pessoa}*! Tudo bem?`);

    if (this.tipoResumo === 'pendentes') {
      linhas.push(`Segue o resumo dos meus pedidos pendentes${periodo}:`);
    } else if (this.tipoResumo === 'pagos') {
      linhas.push(`Segue o resumo dos meus pedidos pagos${periodo}:`);
    } else {
      linhas.push(`Segue o resumo dos meus pedidos${periodo}:`);
    }
    linhas.push('');

    let totalGeral = 0;
    let totalPago = 0;
    let totalPendente = 0;

    if (itensFiltrados.length === 0) {
      linhas.push('• Nenhum pedido encontrado neste filtro.');
    } else {
      for (const item of itensFiltrados) {
        const qtd = Number(item.quantidade) || 1;
        const vTotal = Number(item.valor) || 0;
        const vPago = item.pago ? vTotal : Math.min(vTotal, Number(item.valor_pago) || 0);
        const vResta = item.pago ? 0 : Math.max(0, vTotal - vPago);
        const dataCurta = this.formatarDataCurta(item.data_lancamento);

        totalGeral += vTotal;
        totalPago += vPago;
        totalPendente += vResta;

        if (this.tipoResumo === 'pendentes') {
          if (vPago > 0) {
            linhas.push(`- ${qtd}x ${item.descricao} (Dia ${dataCurta}): R$ ${vTotal.toFixed(2)} _(Pago R$ ${vPago.toFixed(2)}, falta R$ ${vResta.toFixed(2)})_`);
          } else {
            linhas.push(`- ${qtd}x ${item.descricao} (Dia ${dataCurta}): R$ ${vResta.toFixed(2)}`);
          }
        } else if (this.tipoResumo === 'pagos') {
          linhas.push(`- ${qtd}x ${item.descricao} (Dia ${dataCurta}): R$ ${vPago.toFixed(2)} ✅`);
        } else {
          const statusTxt = item.pago
            ? '✅ Pago'
            : (vPago > 0 ? `⏳ Parcial (Falta R$ ${vResta.toFixed(2)})` : '⏳ Pendente');
          linhas.push(`- ${qtd}x ${item.descricao} (Dia ${dataCurta}): R$ ${vTotal.toFixed(2)} — ${statusTxt}`);
        }
      }
    }

    linhas.push('');
    if (this.tipoResumo === 'pendentes') {
      linhas.push(`*Total a pagar: R$ ${totalPendente.toFixed(2)}*`);
    } else if (this.tipoResumo === 'pagos') {
      linhas.push(`*Total pago: R$ ${totalPago.toFixed(2)}*`);
    } else {
      linhas.push(`*Total dos pedidos:* R$ ${totalGeral.toFixed(2)}`);
      if (totalPago > 0) {
        linhas.push(`*Total já pago:* R$ ${totalPago.toFixed(2)}`);
      }
      linhas.push(`*Falta pagar:* R$ ${totalPendente.toFixed(2)}`);
    }

    this.textoMensagem = linhas.join('\n');
  }

  copiarTexto(): void {
    if (!this.textoMensagem) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this.textoMensagem).catch(() => {});
    }
    this.copiado = true;
    setTimeout(() => {
      this.copiado = false;
    }, 2500);
  }

  enviarWhatsApp(): void {
    const msgCodificada = encodeURIComponent(this.textoMensagem || '');
    const limpo = (this.telefoneDestino || '').replace(/\D/g, '');
    let fone = limpo;
    if (fone.length === 10 || fone.length === 11) {
      fone = `55${fone}`;
    }

    const url = fone
      ? `https://wa.me/${fone}?text=${msgCodificada}`
      : `https://wa.me/?text=${msgCodificada}`;

    window.open(url, '_blank');
  }
}

