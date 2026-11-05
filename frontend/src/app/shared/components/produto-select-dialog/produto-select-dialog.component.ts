import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { Produto } from '../../../models/produto.model';

export interface ProdutoSelectDialogData {
  produtos: Produto[];
  selecionadoId?: number | null;
}

@Component({
  selector: 'app-produto-select-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="produto-select-modal-wrapper">
      <!-- Cabeçalho Fixo -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>cake</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Selecionar Produto</h2>
            <p>Escolha um item cadastrado no catálogo</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Barra de Busca Rápida -->
      <div class="busca-container" *ngIf="data.produtos.length > 0">
        <div class="busca-input-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            placeholder="Pesquisar por nome ou pessoa..."
            [(ngModel)]="termoBusca"
          />
          <button *ngIf="termoBusca" type="button" class="clear-search-btn" (click)="termoBusca = ''">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Corpo com Lista Rolável -->
      <div class="modal-body">
        <div *ngIf="data.produtos.length === 0" class="sem-produtos-box">
          <div class="empty-icon-circle">
            <mat-icon>inventory_2</mat-icon>
          </div>
          <h4>Nenhum produto cadastrado</h4>
          <p>Você pode cadastrar produtos na aba "Catálogo" ou optar por "Lançamento Avulso".</p>
        </div>

        <div *ngIf="data.produtos.length > 0 && produtosFiltrados.length === 0" class="sem-resultados-box">
          <mat-icon>search_off</mat-icon>
          <p>Nenhum produto encontrado para "<strong>{{ termoBusca }}</strong>".</p>
        </div>

        <div *ngIf="produtosFiltrados.length > 0" class="produtos-list">
          <div
            *ngFor="let item of produtosFiltrados"
            class="produto-item-card"
            matRipple
            [class.item-selecionado]="item.id === data.selecionadoId"
            (click)="selecionar(item)">

            <div class="item-avatar">
              <mat-icon>lunch_dining</mat-icon>
            </div>

            <div class="item-info">
              <span class="item-nome">{{ item.nome }}</span>
              <div class="item-tags">
                <span class="vendedor-tag" *ngIf="item.vendedor_pessoa">
                  <mat-icon>person</mat-icon>
                  {{ item.vendedor_pessoa }}
                </span>
                <span class="preco-tag">
                  R$ {{ item.preco_padrao.toFixed(2) }}
                </span>
              </div>
            </div>

            <div class="item-radio">
              <div class="custom-radio-circle" [class.ativo]="item.id === data.selecionadoId">
                <mat-icon *ngIf="item.id === data.selecionadoId">check</mat-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rodapé Fixo -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="dialogRef.close()">
          Cancelar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .produto-select-modal-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-height: 82vh;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
    }

    .modal-header {
      padding: 16px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(255, 255, 255, 1) 100%);
      flex-shrink: 0;
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
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
      flex-shrink: 0;
    }
    .header-icon-badge mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #fde047;
    }

    .header-title-box h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }
    .header-title-box p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .close-btn {
      background: #f1f5f9;
      border: none;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      transition: all 0.2s;
    }
    .close-btn:hover {
      background: #fee2e2;
      color: #ef4444;
    }

    /* Busca */
    .busca-container {
      padding: 12px 18px 6px;
      flex-shrink: 0;
      background: #ffffff;
    }
    .busca-input-box {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 0 12px;
      height: 44px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .busca-input-box:focus-within {
      border-color: #6366f1;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    }
    .search-icon {
      color: #94a3b8;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-right: 8px;
    }
    .busca-input-box input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 15px;
      color: #0f172a;
      outline: none;
    }
    .clear-search-btn {
      border: none;
      background: #e2e8f0;
      color: #475569;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .clear-search-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Corpo */
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px 18px 16px;
      -webkit-overflow-scrolling: touch;
    }

    .produtos-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .produto-item-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.18s ease;
      user-select: none;
    }
    .produto-item-card:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .produto-item-card.item-selecionado {
      background: #eef2ff;
      border-color: #818cf8;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.16);
    }

    .item-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #ede9fe;
      color: #6d28d9;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .item-avatar mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .item-selecionado .item-avatar {
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
    }

    .item-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .item-nome {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .vendedor-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11.5px;
      font-weight: 600;
      color: #4338ca;
      background: #e0e7ff;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .vendedor-tag mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .preco-tag {
      font-size: 12.5px;
      font-weight: 800;
      color: #059669;
    }

    .item-radio {
      flex-shrink: 0;
    }
    .custom-radio-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      transition: all 0.2s;
    }
    .custom-radio-circle.ativo {
      border-color: #4f46e5;
      background: #4f46e5;
      color: #ffffff;
    }
    .custom-radio-circle mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .sem-produtos-box, .sem-resultados-box {
      text-align: center;
      padding: 30px 16px;
      color: #64748b;
    }
    .empty-icon-circle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px auto;
    }
    .empty-icon-circle mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .sem-produtos-box h4 {
      margin: 0 0 6px 0;
      font-size: 15px;
      color: #1e293b;
    }
    .sem-produtos-box p, .sem-resultados-box p {
      margin: 0;
      font-size: 13px;
    }
    .sem-resultados-box mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    /* Rodapé */
    .modal-footer {
      padding: 12px 18px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .btn-cancel {
      padding: 0 16px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: #ffffff;
      color: #475569;
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
    }
  `]
})
export class ProdutoSelectDialogComponent implements OnInit {
  termoBusca: string = '';

  constructor(
    public dialogRef: MatDialogRef<ProdutoSelectDialogComponent, Produto>,
    @Inject(MAT_DIALOG_DATA) public data: ProdutoSelectDialogData
  ) {
    this.dialogRef.disableClose = true;
  }

  ngOnInit(): void {}

  get produtosFiltrados(): Produto[] {
    if (!this.termoBusca || !this.termoBusca.trim()) {
      return this.data.produtos;
    }
    const t = this.termoBusca.trim().toLowerCase();
    return this.data.produtos.filter(p =>
      p.nome.toLowerCase().includes(t) ||
      (p.vendedor_pessoa && p.vendedor_pessoa.toLowerCase().includes(t))
    );
  }

  selecionar(produto: Produto): void {
    this.dialogRef.close(produto);
  }
}

