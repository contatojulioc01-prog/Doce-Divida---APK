import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DividasListComponent } from './components/dividas-list/dividas-list.component';
import { DividaFormComponent } from './components/divida-form/divida-form.component';
import { ProdutosListComponent } from './components/produtos-list/produtos-list.component';
import { RelatoriosDashboardComponent } from './components/relatorios-dashboard/relatorios-dashboard.component';
import { BackupDadosDialogComponent } from './shared/components/backup-dados-dialog/backup-dados-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatRippleModule,
    MatDialogModule,
    DividasListComponent,
    DividaFormComponent,
    ProdutosListComponent,
    RelatoriosDashboardComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  abaAtiva: 'extrato' | 'novo' | 'produtos' | 'relatorios' = 'extrato';
  modoEscuro = false;

  @ViewChild(DividasListComponent) dividasList?: DividasListComponent;
  @ViewChild(ProdutosListComponent) produtosList?: ProdutosListComponent;
  @ViewChild(RelatoriosDashboardComponent) relatoriosComp?: RelatoriosDashboardComponent;

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    const salvo = localStorage.getItem('doce_divida_dark_mode');
    this.modoEscuro = salvo === 'true';
    this.aplicarClasseTema();
  }

  alternarModoEscuro(): void {
    this.modoEscuro = !this.modoEscuro;
    localStorage.setItem('doce_divida_dark_mode', String(this.modoEscuro));
    this.aplicarClasseTema();
  }

  private aplicarClasseTema(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('dark-theme', this.modoEscuro);
    }
  }

  selecionarAba(aba: 'extrato' | 'novo' | 'produtos' | 'relatorios'): void {
    this.abaAtiva = aba;
    if (aba === 'extrato' && this.dividasList) {
      this.dividasList.carregarDados();
    }
    if (aba === 'relatorios' && this.relatoriosComp) {
      this.relatoriosComp.carregarRelatorios();
    }
  }

  abrirModalBackup(): void {
    const dialogRef = this.dialog.open(BackupDadosDialogComponent, {
      width: '94vw',
      maxWidth: '460px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((houveAlteracao?: boolean) => {
      if (houveAlteracao) {
        if (this.dividasList) this.dividasList.carregarDados();
        if (this.produtosList) this.produtosList.carregarProdutos();
        if (this.relatoriosComp) this.relatoriosComp.carregarRelatorios();
      }
    });
  }

  onDividaSalva(): void {
    this.abaAtiva = 'extrato';
    setTimeout(() => {
      if (this.dividasList) {
        this.dividasList.carregarDados();
        this.dividasList.exibirFeedback('Lançamento registrado com sucesso!', 'sucesso');
      }
    }, 100);
  }
}
