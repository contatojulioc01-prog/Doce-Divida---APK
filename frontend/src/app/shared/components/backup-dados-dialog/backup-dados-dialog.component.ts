import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { ApiService, BackupDados } from '../../../services/api.service';

@Component({
  selector: 'app-backup-dados-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="backup-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>cloud_sync</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Backup &amp; Restauração</h2>
            <p>Proteja seus dados do banco SQLite local</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="dialogRef.close(houveAlteracao)" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Abas Exportar vs Importar -->
      <div class="tabs-bar">
        <button
          type="button"
          class="tab-btn"
          [class.ativo]="aba === 'exportar'"
          matRipple
          (click)="aba = 'exportar'; limparMensagens()">
          <mat-icon>cloud_download</mat-icon>
          <span>Exportar Backup</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.ativo]="aba === 'importar'"
          matRipple
          (click)="aba = 'importar'; limparMensagens()">
          <mat-icon>settings_backup_restore</mat-icon>
          <span>Restaurar Dados</span>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <!-- Alertas de Sucesso / Erro -->
        <div *ngIf="mensagemSucesso" class="alerta-box sucesso">
          <mat-icon>check_circle</mat-icon>
          <span>{{ mensagemSucesso }}</span>
        </div>
        <div *ngIf="mensagemErro" class="alerta-box erro">
          <mat-icon>error_outline</mat-icon>
          <span>{{ mensagemErro }}</span>
        </div>

        <!-- ABA 1: EXPORTAR BACKUP -->
        <div *ngIf="aba === 'exportar'" class="secao-aba">
          <div class="resumo-banco-card" *ngIf="backupAtual">
            <div class="resumo-banco-topo">
              <mat-icon>storage</mat-icon>
              <span>Dados armazenados neste aparelho:</span>
            </div>
            <div class="contadores-grid">
              <div class="contador-item">
                <strong>{{ backupAtual.produtos.length }}</strong>
                <small>Produtos</small>
              </div>
              <div class="contador-item">
                <strong>{{ backupAtual.dividas.length }}</strong>
                <small>Pedidos</small>
              </div>
              <div class="contador-item">
                <strong>{{ backupAtual.historico_pagamentos.length }}</strong>
                <small>Pagamentos</small>
              </div>
            </div>
          </div>

          <p class="explicacao-txt">
            Como o banco de dados fica salvo 100% no seu celular, gere um arquivo de backup para guardar no <strong>Google Drive</strong>, <strong>WhatsApp</strong> ou transferir para outro aparelho.
          </p>

          <div class="botoes-exportacao">
            <button
              type="button"
              class="btn-acao-principal"
              matRipple
              [disabled]="!backupAtual"
              (click)="baixarArquivoJson()">
              <mat-icon>download</mat-icon>
              <div>
                <strong>Baixar Arquivo de Backup (.json)</strong>
                <small>Salva o arquivo completo na pasta Downloads</small>
              </div>
            </button>

            <button
              type="button"
              class="btn-acao-secundaria"
              matRipple
              [disabled]="!backupAtual"
              (click)="compartilharNativo()">
              <mat-icon>share</mat-icon>
              <div>
                <strong>Compartilhar (WhatsApp / Drive)</strong>
                <small>Envia o arquivo de backup para onde preferir</small>
              </div>
            </button>

            <button
              type="button"
              class="btn-acao-secundaria"
              matRipple
              [disabled]="!backupAtual"
              (click)="copiarJsonBackup()">
              <mat-icon>{{ jsonCopiado ? 'check' : 'content_copy' }}</mat-icon>
              <div>
                <strong>{{ jsonCopiado ? 'Código de Backup Copiado!' : 'Copiar Código de Backup (Texto)' }}</strong>
                <small>Copia os dados para colar na restauração</small>
              </div>
            </button>
          </div>
        </div>

        <!-- ABA 2: IMPORTAR / RESTAURAR BACKUP -->
        <div *ngIf="aba === 'importar'" class="secao-aba">
          <input
            #inputFileBackup
            type="file"
            accept=".json,application/json"
            style="display: none"
            (change)="onArquivoBackupSelecionado($event)"
          />

          <div class="dropzone-backup" matRipple (click)="inputFileBackup.click()">
            <mat-icon class="up-icon">upload_file</mat-icon>
            <div class="up-texts">
              <strong>Selecionar Arquivo de Backup (.json)</strong>
              <span>Toque para escolher o arquivo salvo no celular</span>
            </div>
          </div>

          <!-- Alternativa: Colar código JSON -->
          <div class="colar-json-box">
            <label>Ou cole o código de backup copiado abaixo:</label>
            <textarea
              rows="3"
              placeholder='Cole aqui o conteúdo JSON do backup...'
              [(ngModel)]="jsonTextoImportacao"
              (input)="validarJsonColado()">
            </textarea>
          </div>

          <!-- Preview do Backup Carregado -->
          <div *ngIf="backupParaImportar" class="preview-import-card">
            <div class="prev-header">
              <mat-icon>verified</mat-icon>
              <span>Backup válido identificado!</span>
            </div>
            <div class="prev-detalhes">
              <span>Data do backup: <strong>{{ backupParaImportar.data_exportacao || 'Não informada' }}</strong></span>
              <span>Conteúdo: <strong>{{ backupParaImportar.produtos?.length || 0 }} produtos</strong>, <strong>{{ backupParaImportar.dividas?.length || 0 }} pedidos</strong> e <strong>{{ backupParaImportar.historico_pagamentos?.length || 0 }} pagamentos</strong>.</span>
            </div>

            <!-- Modo de Importação -->
            <div class="modo-import-group">
              <label class="modo-option" [class.selecionado]="modoImportacao === 'mesclar'" (click)="modoImportacao = 'mesclar'">
                <input type="radio" name="modoImp" value="mesclar" [(ngModel)]="modoImportacao" />
                <div>
                  <strong>Mesclar com dados atuais</strong>
                  <small>Mantém os registros atuais e adiciona os do backup</small>
                </div>
              </label>

              <label class="modo-option" [class.selecionado]="modoImportacao === 'substituir'" (click)="modoImportacao = 'substituir'">
                <input type="radio" name="modoImp" value="substituir" [(ngModel)]="modoImportacao" />
                <div>
                  <strong>Substituir tudo pelo backup</strong>
                  <small>Apaga os dados atuais e restaura exatamente o backup</small>
                </div>
              </label>
            </div>

            <button
              type="button"
              class="btn-confirmar-restauracao"
              matRipple
              [disabled]="importando"
              (click)="executarRestauracao()">
              <mat-icon>{{ importando ? 'sync' : 'restore' }}</mat-icon>
              <span>{{ importando ? 'Restaurando Banco SQLite...' : 'Restaurar Dados Agora' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-fechar" matRipple (click)="dialogRef.close(houveAlteracao)">
          Fechar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .backup-modal-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.24);
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
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.28);
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

    .tabs-bar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 10px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: #64748b;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .tab-btn.ativo {
      background: #ffffff;
      color: #4f46e5;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    }

    .modal-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .alerta-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .alerta-box mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .alerta-box.sucesso {
      background: #dcfce7;
      border: 1px solid #86efac;
      color: #166534;
    }

    .alerta-box.erro {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
    }

    .secao-aba {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .resumo-banco-card {
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid #c7d2fe;
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .resumo-banco-topo {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #3730a3;
    }

    .resumo-banco-topo mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .contadores-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .contador-item {
      background: #ffffff;
      border-radius: 10px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.04);
    }

    .contador-item strong {
      font-size: 1.15rem;
      font-weight: 800;
      color: #1e1b4b;
    }

    .contador-item small {
      font-size: 0.68rem;
      color: #64748b;
      font-weight: 600;
    }

    .explicacao-txt {
      margin: 0;
      font-size: 0.78rem;
      color: #475569;
      line-height: 1.45;
    }

    .botoes-exportacao {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-acao-principal, .btn-acao-secundaria {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-acao-principal {
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.28);
    }

    .btn-acao-principal div, .btn-acao-secundaria div {
      display: flex;
      flex-direction: column;
    }

    .btn-acao-principal strong {
      font-size: 0.86rem;
      font-weight: 700;
    }

    .btn-acao-principal small {
      font-size: 0.7rem;
      color: #e0e7ff;
    }

    .btn-acao-secundaria {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      color: #1e293b;
    }

    .btn-acao-secundaria mat-icon {
      color: #4f46e5;
    }

    .btn-acao-secundaria strong {
      font-size: 0.84rem;
      font-weight: 700;
    }

    .btn-acao-secundaria small {
      font-size: 0.7rem;
      color: #64748b;
    }

    /* Aba Importar */
    .dropzone-backup {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 2px dashed #94a3b8;
      border-radius: 14px;
      padding: 14px;
      cursor: pointer;
    }

    .dropzone-backup:hover {
      border-color: #4f46e5;
      background: #eef2ff;
    }

    .up-icon {
      color: #4f46e5;
      font-size: 28px;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }

    .up-texts {
      display: flex;
      flex-direction: column;
    }

    .up-texts strong {
      font-size: 0.84rem;
      color: #0f172a;
    }

    .up-texts span {
      font-size: 0.72rem;
      color: #64748b;
    }

    .colar-json-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .colar-json-box label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #475569;
    }

    .colar-json-box textarea {
      width: 100%;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 0.76rem;
      font-family: monospace;
      resize: vertical;
      outline: none;
    }

    .preview-import-card {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .prev-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #166534;
      font-weight: 700;
      font-size: 0.84rem;
    }

    .prev-detalhes {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.76rem;
      color: #14532d;
    }

    .modo-import-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .modo-option {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 10px;
      cursor: pointer;
    }

    .modo-option.selecionado {
      border-color: #16a34a;
      background: #dcfce7;
    }

    .modo-option div {
      display: flex;
      flex-direction: column;
    }

    .modo-option strong {
      font-size: 0.78rem;
      color: #0f172a;
    }

    .modo-option small {
      font-size: 0.68rem;
      color: #475569;
    }

    .btn-confirmar-restauracao {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      height: 42px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.86rem;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px 18px;
      border-top: 1px solid #f1f5f9;
    }

    .btn-fechar {
      padding: 0 18px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: transparent;
      color: #475569;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
  `]
})
export class BackupDadosDialogComponent implements OnInit {
  aba: 'exportar' | 'importar' = 'exportar';
  backupAtual: BackupDados | null = null;

  jsonTextoImportacao: string = '';
  backupParaImportar: BackupDados | null = null;
  modoImportacao: 'mesclar' | 'substituir' = 'mesclar';

  importando = false;
  jsonCopiado = false;
  houveAlteracao = false;

  mensagemSucesso: string | null = null;
  mensagemErro: string | null = null;

  constructor(
    public dialogRef: MatDialogRef<BackupDadosDialogComponent>,
    private apiService: ApiService
  ) {
    this.dialogRef.disableClose = true;
  }

  ngOnInit(): void {
    this.carregarBackupAtual();
  }

  carregarBackupAtual(): void {
    this.apiService.exportarBackup().subscribe({
      next: (dados) => {
        this.backupAtual = dados;
      },
      error: () => {
        this.mensagemErro = 'Não foi possível ler os dados atuais para backup.';
      }
    });
  }

  limparMensagens(): void {
    this.mensagemSucesso = null;
    this.mensagemErro = null;
  }

  private obterNomeArquivoBackup(): string {
    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return `doce-divida-backup-${data}.json`;
  }

  baixarArquivoJson(): void {
    if (!this.backupAtual) return;
    this.limparMensagens();

    const conteudo = JSON.stringify(this.backupAtual, null, 2);
    const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = this.obterNomeArquivoBackup();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.mensagemSucesso = 'Arquivo de backup gerado e enviado para download!';
  }

  async compartilharNativo(): Promise<void> {
    if (!this.backupAtual) return;
    this.limparMensagens();

    const conteudo = JSON.stringify(this.backupAtual, null, 2);
    const nomeArq = this.obterNomeArquivoBackup();

    try {
      const nav = navigator as any;
      if (nav.share) {
        const arquivo = new File([conteudo], nomeArq, { type: 'application/json' });
        if (nav.canShare && nav.canShare({ files: [arquivo] })) {
          await nav.share({
            title: 'Backup Doce Dívida',
            text: `Backup completo do app Doce Dívida (${this.backupAtual.data_exportacao})`,
            files: [arquivo]
          });
          this.mensagemSucesso = 'Backup compartilhado com sucesso!';
          return;
        } else {
          await nav.share({
            title: 'Backup Doce Dívida',
            text: conteudo
          });
          this.mensagemSucesso = 'Backup compartilhado com sucesso!';
          return;
        }
      }
    } catch {
      // Usuário cancelou ou share falhou; cai no download
    }

    this.baixarArquivoJson();
  }

  copiarJsonBackup(): void {
    if (!this.backupAtual) return;
    const conteudo = JSON.stringify(this.backupAtual);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(conteudo).catch(() => {});
    }
    this.jsonCopiado = true;
    this.mensagemSucesso = 'Código de backup copiado para a área de transferência!';
    setTimeout(() => {
      this.jsonCopiado = false;
    }, 2500);
  }

  onArquivoBackupSelecionado(event: Event): void {
    this.limparMensagens();
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const arquivo = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result || '');
      this.jsonTextoImportacao = texto;
      this.validarJsonColado();
    };
    reader.onerror = () => {
      this.mensagemErro = 'Erro ao ler o arquivo selecionado.';
    };
    reader.readAsText(arquivo, 'utf-8');
  }

  validarJsonColado(): void {
    this.limparMensagens();
    if (!this.jsonTextoImportacao || !this.jsonTextoImportacao.trim()) {
      this.backupParaImportar = null;
      return;
    }

    try {
      const obj = JSON.parse(this.jsonTextoImportacao.trim());
      if (obj && (Array.isArray(obj.produtos) || Array.isArray(obj.dividas))) {
        this.backupParaImportar = obj as BackupDados;
      } else {
        this.backupParaImportar = null;
        this.mensagemErro = 'O JSON informado não possui a estrutura de backup do Doce Dívida.';
      }
    } catch {
      this.backupParaImportar = null;
      this.mensagemErro = 'Formato JSON inválido. Verifique o arquivo ou texto colado.';
    }
  }

  executarRestauracao(): void {
    if (!this.backupParaImportar) return;
    this.limparMensagens();
    this.importando = true;

    this.apiService.importarBackup(this.backupParaImportar, this.modoImportacao).subscribe({
      next: (res) => {
        this.importando = false;
        this.houveAlteracao = true;
        this.carregarBackupAtual();
        this.mensagemSucesso = `Restauração concluída! ${res.produtosImportados} produtos e ${res.dividasImportadas} pedidos importados.`;
        this.backupParaImportar = null;
        this.jsonTextoImportacao = '';
      },
      error: (err) => {
        console.error('Erro ao importar backup:', err);
        this.importando = false;
        this.mensagemErro = 'Erro ao restaurar os dados no banco SQLite.';
      }
    });
  }
}

