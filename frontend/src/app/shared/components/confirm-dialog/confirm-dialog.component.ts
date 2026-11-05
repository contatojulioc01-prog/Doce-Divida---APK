import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type GlobalAlertModalType = 'confirm' | 'alert' | 'warning' | 'danger' | 'info' | 'success';

export interface ConfirmDialogData {
  title: string;
  subtitle?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  type?: GlobalAlertModalType;
  hideCancel?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="modal-wrapper">
      <!-- Fixed Header -->
      <div class="modal-header" [ngClass]="resolvedType">
        <div class="header-main">
          <div class="header-icon-badge" [ngClass]="resolvedType">
            <mat-icon>{{ resolvedIcon }}</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>{{ data.title }}</h2>
            <p *ngIf="data.subtitle">{{ data.subtitle }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" (click)="dialogRef.close(false)" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <p [innerHTML]="data.message"></p>
      </div>

      <!-- Fixed Footer -->
      <div class="modal-footer">
        <button *ngIf="!shouldHideCancel" type="button" class="btn-cancel" (click)="dialogRef.close(false)">
          {{ data.cancelText || 'Cancelar' }}
        </button>
        <button type="button" class="btn-confirm" [ngClass]="resolvedType" (click)="dialogRef.close(true)">
          {{ data.confirmText || (shouldHideCancel ? 'Entendi' : 'Confirmar') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .modal-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: var(--color-surface, #ffffff);
      border-radius: 16px;
      overflow: hidden;
    }

    .modal-header {
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 18px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .modal-header.danger {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.07) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .modal-header.warning {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .modal-header.success {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.07) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .modal-header.info,
    .modal-header.alert {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.07) 0%, rgba(255, 255, 255, 1) 100%);
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-badge {
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    }

    .header-icon-badge.danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
    }

    .header-icon-badge.warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
    }

    .header-icon-badge.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
    }

    .header-icon-badge.info,
    .header-icon-badge.alert {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
    }

    .header-icon-badge mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .header-title-box h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
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
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .close-btn:hover {
      background: #fee2e2;
      color: #ef4444;
      transform: rotate(90deg);
    }

    .modal-body {
      flex: 1;
      padding: 20px;
      font-size: 14px;
      color: #334155;
      line-height: 1.55;
    }

    .modal-body p {
      margin: 0;
    }

    .modal-footer {
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    .btn-cancel {
      padding: 0 16px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: #ffffff;
      color: #475569;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: #f1f5f9;
      color: #1e293b;
    }

    .btn-confirm {
      padding: 0 20px;
      height: 40px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
      transition: all 0.2s ease;
    }

    .btn-confirm.danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
    }

    .btn-confirm.warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
    }

    .btn-confirm.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
    }

    .btn-confirm.info,
    .btn-confirm.alert {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {
    this.dialogRef.disableClose = true;
  }

  get resolvedType(): GlobalAlertModalType {
    if (this.data.type) {
      return this.data.type;
    }
    return this.data.isDestructive ? 'danger' : 'confirm';
  }

  get shouldHideCancel(): boolean {
    if (this.data.hideCancel !== undefined) {
      return this.data.hideCancel;
    }
    return this.data.type === 'alert' || this.data.type === 'info' || this.data.type === 'success';
  }

  get resolvedIcon(): string {
    if (this.data.icon) {
      return this.data.icon;
    }
    switch (this.resolvedType) {
      case 'danger':
        return 'warning';
      case 'warning':
        return 'report_problem';
      case 'success':
        return 'check_circle';
      case 'info':
      case 'alert':
        return 'info';
      default:
        return 'help_outline';
    }
  }
}

