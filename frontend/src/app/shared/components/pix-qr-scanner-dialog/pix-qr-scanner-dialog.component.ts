import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import jsQR from 'jsqr';

export interface ResultadoQrPix {
  chavePix: string;
  nomeRecebedor?: string | null;
  payloadBruto?: string;
}

export type PixQrScannerResult = ResultadoQrPix;

@Component({
  selector: 'app-pix-qr-scanner-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatRippleModule],
  template: `
    <div class="qr-modal-wrapper">
      <!-- Cabeçalho -->
      <div class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge">
            <mat-icon>qr_code_scanner</mat-icon>
          </div>
          <div class="header-title-box">
            <h2>Ler QR Code PIX</h2>
            <p>Aponte a câmera ou envie um print do QR Code</p>
          </div>
        </div>
        <button type="button" class="close-btn" matRipple (click)="fechar()" title="Fechar">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Corpo -->
      <div class="modal-body">
        <!-- Visor da Câmera ao Vivo (quando ainda não leu um código) -->
        <div *ngIf="!resultadoExtraido" class="scanner-area">
          <div class="camera-viewport" [class.camera-inativa]="!cameraAtiva">
            <video
              #videoEl
              autoplay
              playsinline
              muted
              class="video-preview"
              [style.display]="cameraAtiva ? 'block' : 'none'">
            </video>

            <!-- Moldura de Foco com Laser Animado -->
            <div *ngIf="cameraAtiva" class="scanner-overlay">
              <div class="scan-frame">
                <span class="corner tl"></span>
                <span class="corner tr"></span>
                <span class="corner bl"></span>
                <span class="corner br"></span>
                <div class="scan-laser"></div>
              </div>
              <span class="scan-hint">Posicione o QR Code do PIX dentro do quadrado</span>
            </div>

            <!-- Estado quando a câmera não está ativa ou sem permissão -->
            <div *ngIf="!cameraAtiva" class="camera-fallback-box">
              <div class="fallback-icon-circle">
                <mat-icon>{{ carregandoCamera ? 'hourglass_top' : 'photo_camera' }}</mat-icon>
              </div>
              <strong>{{ carregandoCamera ? 'Iniciando câmera...' : (erroCamera || 'Câmera pronta para leitura') }}</strong>
              <p>Você também pode ler um print do QR Code salvo na galeria ou tirar uma foto direta.</p>
              <button
                *ngIf="!carregandoCamera"
                type="button"
                class="btn-tentar-camera"
                matRipple
                (click)="iniciarCamera()">
                <mat-icon>videocam</mat-icon>
                <span>Ativar Câmera ao Vivo</span>
              </button>
            </div>
          </div>

          <!-- Controles de Câmera e Upload de Imagem/Print -->
          <div class="controles-scanner">
            <button
              *ngIf="cameraAtiva"
              type="button"
              class="btn-trocar-cam"
              matRipple
              (click)="alternarCamera()">
              <mat-icon>flip_camera_ios</mat-icon>
              <span>Inverter Câmera</span>
            </button>

            <input
              #fileQrInput
              type="file"
              accept="image/*"
              style="display: none"
              (change)="onImagemQrSelecionada($event)"
            />

            <button
              type="button"
              class="btn-ler-galeria"
              matRipple
              (click)="fileQrInput.click()">
              <mat-icon>image_search</mat-icon>
              <span>Ler Print / Foto da Galeria</span>
            </button>
          </div>
        </div>

        <!-- Erro de Leitura de Imagem -->
        <div *ngIf="erroLeitura" class="alerta-erro-qr">
          <mat-icon>error_outline</mat-icon>
          <span>{{ erroLeitura }}</span>
        </div>

        <!-- Resultado Extraído do QR Code PIX -->
        <div *ngIf="resultadoExtraido" class="resultado-qr-card">
          <div class="res-header">
            <div class="res-ok-badge">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div>
              <h3>QR Code PIX Identificado!</h3>
              <p *ngIf="nomeRecebedorDetectado">Recebedor: <strong>{{ nomeRecebedorDetectado }}</strong></p>
            </div>
          </div>

          <!-- Se extraiu uma Chave PIX limpa do EMVCo BR Code -->
          <div class="opcoes-chave-box" *ngIf="chaveExtraidaLimpa && chaveExtraidaLimpa !== payloadBrutoLido">
            <label class="opcao-radio" [class.selecionada]="modoSelecionado === 'chave'" (click)="modoSelecionado = 'chave'">
              <input type="radio" name="modoPix" value="chave" [(ngModel)]="modoSelecionado" />
              <div class="opcao-info">
                <span class="opcao-titulo">Chave PIX Extraída (Recomendado)</span>
                <strong class="opcao-valor">{{ chaveExtraidaLimpa }}</strong>
              </div>
            </label>

            <label class="opcao-radio" [class.selecionada]="modoSelecionado === 'copia_cola'" (click)="modoSelecionado = 'copia_cola'">
              <input type="radio" name="modoPix" value="copia_cola" [(ngModel)]="modoSelecionado" />
              <div class="opcao-info">
                <span class="opcao-titulo">Código PIX Copia e Cola Completo</span>
                <small class="opcao-valor-bruto">{{ payloadBrutoLido }}</small>
              </div>
            </label>
          </div>

          <!-- Caso seja uma chave simples direta -->
          <div class="chave-direta-box" *ngIf="!chaveExtraidaLimpa || chaveExtraidaLimpa === payloadBrutoLido">
            <span class="lbl-lido">Chave / Código Lido:</span>
            <strong class="val-lido">{{ chaveExtraidaLimpa || payloadBrutoLido }}</strong>
          </div>

          <button type="button" class="btn-ler-outro" matRipple (click)="resetarLeitura()">
            <mat-icon>refresh</mat-icon>
            <span>Ler outro QR Code</span>
          </button>
        </div>

        <canvas #canvasEl style="display: none;"></canvas>
      </div>

      <!-- Rodapé -->
      <div class="modal-footer">
        <button type="button" class="btn-cancel" matRipple (click)="fechar()">
          Cancelar
        </button>
        <button
          *ngIf="resultadoExtraido"
          type="button"
          class="btn-confirmar-qr"
          matRipple
          (click)="confirmarChave()">
          <mat-icon>check</mat-icon>
          <span>Usar esta Chave PIX</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .qr-modal-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: var(--surface, #ffffff);
      color: var(--text-main, #0f172a);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
    }

    .modal-header {
      padding: 16px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border, #f1f5f9);
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, transparent 100%);
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

    .header-title-box h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main, #0f172a);
    }

    .header-title-box p {
      margin: 2px 0 0;
      font-size: 0.76rem;
      color: var(--text-muted, #64748b);
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted, #64748b);
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
      max-height: 74vh;
      overflow-y: auto;
    }

    .scanner-area {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .camera-viewport {
      position: relative;
      width: 100%;
      height: 250px;
      background: #090d16;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #10b981;
    }

    .camera-viewport.camera-inativa {
      border-color: var(--border, #cbd5e1);
      background: #0f172a;
    }

    .video-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .scanner-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.28);
      pointer-events: none;
    }

    .scan-frame {
      position: relative;
      width: 175px;
      height: 175px;
      border-radius: 16px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.42);
    }

    .corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #34d399;
      border-style: solid;
      border-width: 0;
    }
    .corner.tl { top: 0; left: 0; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 12px; }
    .corner.tr { top: 0; right: 0; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 12px; }
    .corner.bl { bottom: 0; left: 0; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 12px; }
    .corner.br { bottom: 0; right: 0; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 12px; }

    .scan-laser {
      position: absolute;
      left: 8px;
      right: 8px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #34d399, #10b981, #34d399, transparent);
      box-shadow: 0 0 8px #10b981;
      animation: scanMove 2.2s infinite ease-in-out;
    }

    @keyframes scanMove {
      0% { top: 12px; opacity: 0.6; }
      50% { top: 160px; opacity: 1; }
      100% { top: 12px; opacity: 0.6; }
    }

    .scan-hint {
      position: absolute;
      bottom: 10px;
      background: rgba(15, 23, 42, 0.82);
      color: #ecfdf5;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
    }

    .camera-fallback-box {
      padding: 20px;
      text-align: center;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .fallback-icon-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .camera-fallback-box strong {
      font-size: 0.88rem;
      color: #ffffff;
    }

    .camera-fallback-box p {
      margin: 0;
      font-size: 0.75rem;
      color: #94a3b8;
      max-width: 260px;
    }

    .btn-tentar-camera {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px solid #34d399;
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .controles-scanner {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-trocar-cam, .btn-ler-galeria {
      flex: 1;
      min-width: 140px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-trocar-cam {
      background: var(--bg-app, #f1f5f9);
      border: 1.5px solid var(--border, #cbd5e1);
      color: var(--text-main, #334155);
    }

    .btn-ler-galeria {
      background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
      border: none;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
    }

    .alerta-erro-qr {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--danger-bg, #fee2e2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #ef4444;
      font-size: 0.78rem;
      font-weight: 600;
    }

    /* Card de Resultado Extraído */
    .resultado-qr-card {
      background: rgba(16, 185, 129, 0.08);
      border: 1.5px solid rgba(16, 185, 129, 0.4);
      border-radius: 16px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .res-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .res-ok-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #10b981;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .res-header h3 {
      margin: 0;
      font-size: 0.94rem;
      font-weight: 800;
      color: var(--text-main, #065f46);
    }

    .res-header p {
      margin: 2px 0 0;
      font-size: 0.76rem;
      color: var(--text-muted, #047857);
    }

    .opcoes-chave-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .opcao-radio {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1.5px solid var(--border, #cbd5e1);
      background: var(--surface, #ffffff);
      cursor: pointer;
    }

    .opcao-radio.selecionada {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.12);
    }

    .opcao-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .opcao-titulo {
      font-size: 0.72rem;
      color: var(--text-muted, #64748b);
      font-weight: 600;
    }

    .opcao-valor {
      font-size: 0.92rem;
      color: var(--text-main, #0f172a);
      font-weight: 800;
      word-break: break-all;
    }

    .opcao-valor-bruto {
      font-size: 0.7rem;
      color: var(--text-muted, #475569);
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .chave-direta-box {
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, #cbd5e1);
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .lbl-lido {
      font-size: 0.72rem;
      color: var(--text-muted, #64748b);
      font-weight: 600;
    }

    .val-lido {
      font-size: 0.9rem;
      color: var(--text-main, #0f172a);
      word-break: break-all;
    }

    .btn-ler-outro {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid var(--border, #cbd5e1);
      background: var(--surface, #ffffff);
      color: var(--text-main, #334155);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      border-top: 1px solid var(--border, #f1f5f9);
    }

    .btn-cancel {
      padding: 0 16px;
      height: 40px;
      border-radius: 10px;
      border: 1.5px solid var(--border, #cbd5e1);
      background: transparent;
      color: var(--text-muted, #475569);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-confirmar-qr {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 18px;
      height: 40px;
      border-radius: 10px;
      border: none;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
    }
  `]
})
export class PixQrScannerDialogComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  cameraAtiva = false;
  carregandoCamera = false;
  facingMode: 'environment' | 'user' = 'environment';
  erroCamera: string | null = null;
  erroLeitura: string | null = null;

  resultadoExtraido = false;
  chaveExtraidaLimpa: string = '';
  nomeRecebedorDetectado: string | null = null;
  payloadBrutoLido: string = '';
  modoSelecionado: 'chave' | 'copia_cola' = 'chave';

  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<PixQrScannerDialogComponent, ResultadoQrPix>
  ) {
    this.dialogRef.disableClose = true;
  }

  ngOnInit(): void {
    this.iniciarCamera();
  }

  ngOnDestroy(): void {
    this.pararCamera();
  }

  async iniciarCamera(): Promise<void> {
    this.pararCamera();
    this.erroCamera = null;
    this.erroLeitura = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.erroCamera = 'Câmera ao vivo indisponível neste modo. Use o botão abaixo para ler um print ou foto.';
      return;
    }

    this.carregandoCamera = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      this.carregandoCamera = false;
      this.cameraAtiva = true;

      setTimeout(() => {
        if (this.videoEl?.nativeElement && this.stream) {
          const video = this.videoEl.nativeElement;
          video.srcObject = this.stream;
          video.play().then(() => {
            this.escanearQuadroContinuo();
          }).catch(() => {
            this.escanearQuadroContinuo();
          });
        }
      }, 100);
    } catch {
      this.carregandoCamera = false;
      this.cameraAtiva = false;
      this.erroCamera = 'Permissão de câmera não concedida. Use "Ler Print / Foto da Galeria" abaixo.';
    }
  }

  alternarCamera(): void {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.iniciarCamera();
  }

  pararCamera(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.cameraAtiva = false;
  }

  private escanearQuadroContinuo(): void {
    if (!this.cameraAtiva || this.resultadoExtraido) return;

    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const largura = video.videoWidth;
      const altura = video.videoHeight;
      if (largura > 0 && altura > 0) {
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, largura, altura);
          const imageData = ctx.getImageData(0, 0, largura, altura);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data && code.data.trim()) {
            this.processarTextoQrLido(code.data.trim());
            return;
          }
        }
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.escanearQuadroContinuo());
  }

  onImagemQrSelecionada(event: Event): void {
    this.erroLeitura = null;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const arquivo = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = this.canvasEl?.nativeElement || document.createElement('canvas');
        // Redimensiona se for imagem muito grande para melhorar a detecção do QR Code
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data && code.data.trim()) {
          this.processarTextoQrLido(code.data.trim());
        } else {
          this.erroLeitura = 'Não foi possível localizar um QR Code válido nesta imagem. Tente aproximar ou escolher outra imagem.';
        }
        input.value = '';
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(arquivo);
  }

  private processarTextoQrLido(conteudo: string): void {
    this.pararCamera();
    this.erroLeitura = null;
    this.payloadBrutoLido = conteudo;

    const extraido = this.extrairDadosPixBrCode(conteudo);
    this.chaveExtraidaLimpa = extraido.chavePix;
    this.nomeRecebedorDetectado = extraido.nomeRecebedor;
    this.modoSelecionado = 'chave';
    this.resultadoExtraido = true;
  }

  /**
   * Faz o parse do padrão EMVCo BR Code do Banco Central (000201...)
   * extraindo a Chave PIX real (Tag 26 -> Subtag 01) e o Nome do Recebedor (Tag 59).
   */
  private extrairDadosPixBrCode(raw: string): { chavePix: string; nomeRecebedor: string | null } {
    const limpo = raw.trim();
    if (!limpo.startsWith('000201')) {
      return { chavePix: limpo, nomeRecebedor: null };
    }

    try {
      const topTags = this.parseTlv(limpo);
      const merchantAccount = topTags.get('26');
      const nomeMerchant = topTags.get('59') || null;

      if (merchantAccount) {
        const subTags = this.parseTlv(merchantAccount);
        const chave = subTags.get('01');
        if (chave && chave.trim()) {
          return {
            chavePix: chave.trim(),
            nomeRecebedor: nomeMerchant ? nomeMerchant.trim() : null
          };
        }
      }
      return {
        chavePix: limpo,
        nomeRecebedor: nomeMerchant ? nomeMerchant.trim() : null
      };
    } catch {
      return { chavePix: limpo, nomeRecebedor: null };
    }
  }

  private parseTlv(str: string): Map<string, string> {
    const mapa = new Map<string, string>();
    let pos = 0;
    while (pos + 4 <= str.length) {
      const id = str.substring(pos, pos + 2);
      const tam = parseInt(str.substring(pos + 2, pos + 4), 10);
      if (isNaN(tam) || tam < 0 || pos + 4 + tam > str.length) {
        break;
      }
      const valor = str.substring(pos + 4, pos + 4 + tam);
      mapa.set(id, valor);
      pos += 4 + tam;
    }
    return mapa;
  }

  resetarLeitura(): void {
    this.resultadoExtraido = false;
    this.chaveExtraidaLimpa = '';
    this.nomeRecebedorDetectado = null;
    this.payloadBrutoLido = '';
    this.iniciarCamera();
  }

  confirmarChave(): void {
    const escolhida = this.modoSelecionado === 'copia_cola'
      ? this.payloadBrutoLido
      : (this.chaveExtraidaLimpa || this.payloadBrutoLido);

    this.dialogRef.close({
      chavePix: escolhida,
      nomeRecebedor: this.nomeRecebedorDetectado,
      payloadBruto: this.payloadBrutoLido
    });
  }

  fechar(): void {
    this.pararCamera();
    this.dialogRef.close();
  }
}

