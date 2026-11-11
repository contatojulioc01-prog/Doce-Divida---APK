# 💸 Doce Dívida — Gestão Inteligente de Dívidas, Produtos e Pagamentos (Android APK + SQLite Offline)

Aplicativo móvel Android desenvolvido com **Angular 17**, **Angular Material**, **Capacitor** e banco de dados **SQLite 100% nativo no dispositivo** (`@capacitor-community/sqlite`), além de contar com uma API REST opcional em **Node.js + Express + SQLite** para execução web/desktop.

Projetado para registrar, agrupar e quitar compras do dia a dia (doces, lanches, encomendas e despesas recorrentes) com controle de pagamentos parciais por valor ou quantidade, leitura de QR Code PIX, anexo de comprovantes e relatórios analíticos.

---

## ✨ Funcionalidades Principais

### 1. 📋 Gestão de Dívidas e Lançamentos
- **Agrupamento Inteligente:** Os pedidos são agrupados automaticamente por **Produto + Pessoa/Vendedor**, exibindo total pendente, total pago, quantidade acumulada e status (`Pendente`, `Parcial` ou `Pago`).
- **Ação Rápida `+1 Hoje`:** Adicione mais uma unidade de um item recorrente na data de hoje com apenas 1 toque direto no card do grupo.
- **Lançamento do Catálogo ou Avulso:** Selecione produtos cadastrados através de uma modal interativa com busca rápida ou realize lançamentos avulsos personalizados.
- **Edição Completa de Pedidos:** Altere descrição, vendedor, chave PIX, quantidade, valor unitário, data, observação e comprovante de qualquer lançamento.
- **Filtro Mensal e de Status:** Navegue pelos lançamentos por mês/ano (`MM/AAAA`) ou filtre entre *Todos*, *Pendentes* e *Pagos*.

### 2. 💰 Pagamentos Parciais, Amortizações e Quitação em Lote
- **Pagamento por Valor (`R$`) ou por Quantidade (`Unidades`):**
  - Permite abater qualquer valor em reais (ex: *"Pagou R$ 25,00 de R$ 50,00 — Resta R$ 25,00"*) ou pagar uma quantidade específica de itens.
- **Histórico de Amortizações (Sub-extrato):** Cada pagamento parcial registra data, valor amortizado, observação e comprovante individual no sub-extrato do pedido.
- **Quitação em Lote por Pessoa:** Card dedicado no topo da listagem para quitar todas (ou apenas as selecionadas) dívidas pendentes de um mesmo vendedor de uma só vez, anexando um único comprovante para todo o lote.

### 3. 📷 PIX Inteligente com Leitor de QR Code (BR Code EMVCo)
- **Scanner de QR Code PIX Integrado:**
  - Leitura via **Câmera ao Vivo** (com alternância entre câmera frontal e traseira) ou via **Imagem/Print da Galeria** utilizando `jsQR`.
  - **Parser EMVCo TLV do Banco Central (`000201...`):** Extrai automaticamente a **Chave PIX limpa** (CPF, CNPJ, telefone, e-mail ou EVP da Tag `26` / Subtag `01`) e o **Nome do Recebedor** (Tag `59`), preenchendo automaticamente os campos do formulário.
- **Cópia Rápida de Chave PIX:** Copie a chave PIX do vendedor com 1 toque diretamente na listagem, nos cards de lote ou no catálogo.

### 4. 📎 Comprovantes de Pagamento (Imagem e PDF)
- **Anexo de Comprovantes:** Suporte para anexar fotos da câmera, imagens da galeria ou documentos **PDF** (até 10 MB) tanto no lançamento quanto nas amortizações parciais e quitações em lote.
- **Visualizador Embutido:** Modal dedicada para visualizar imagens com nitidez ou abrir/baixar comprovantes em PDF.

### 5. 📲 Compartilhamento de Extrato para WhatsApp
- **Gerador de Resumo Formatado:** Cria automaticamente uma mensagem estruturada com todos os pedidos pendentes/pagos da pessoa, datas, valores abatidos, saldo restante e chave PIX, permitindo copiar o texto ou abrir diretamente no **WhatsApp**.

### 6. 📊 Dashboard de Relatórios e Segurança de Dados
- **KPIs e Gráficos de Consumo:**
  - Visão geral do total movimentado, percentual quitado e barra de progresso financeira.
  - **Ranking por Pessoa/Vendedor:** Acompanhe quanto já foi pago e quanto falta pagar para cada pessoa.
  - **Ranking de Produtos:** Identifique os itens mais consumidos por quantidade e valor total.
  - **Histórico Mensal:** Comparativo mês a mês com navegação direta para o período selecionado.
- **Backup e Restauração (`.json`):** Exporte todo o banco de dados (produtos, dívidas, comprovantes e histórico de pagamentos) em um arquivo `.json` portátil ou restaure seus dados ao trocar de celular.

### 7. 🌙 Interface Mobile-First & Dark Mode
- **Tema Escuro (Dark Mode) Completo:** Alternância instantânea no cabeçalho com persistência local (`localStorage`), paleta em tons *Midnight Slate* de alto contraste e suporte a todas as telas e modais.

---

## 🏗️ Arquitetura do Projeto

```text
DOCE DIVIDA/
├── apk/                                  # APKs compilados (Debug e Release)
├── database/                             # Schema SQL de referência (SQLite)
│   └── schema.sql
├── backend/                              # API REST Node.js + Express (Modo Web/Local)
│   ├── src/
│   │   ├── config/db.js
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── server.js
│   └── package.json
└── frontend/                             # Aplicação Angular 17 + Capacitor Android
    ├── android/                          # Projeto Nativo Android (Gradle)
    ├── src/
    │   ├── app/
    │   │   ├── components/
    │   │   │   ├── dividas-list/         # Listagem agrupada, filtros e quitação em lote
    │   │   │   ├── divida-form/          # Novo lançamento + Anexo + Scanner QR PIX
    │   │   │   ├── produtos-list/        # Catálogo de produtos + Vendedor + PIX
    │   │   │   └── relatorios-dashboard/ # KPIs, Rankings e Backup
    │   │   ├── shared/components/        # Modais (Pagamento Parcial, Lote, QR Scanner, WhatsApp, Backup, etc.)
    │   │   ├── services/api.service.ts   # Camada híbrida (SQLite Nativo Capacitor / Fallback LocalStorage)
    │   │   └── models/                   # Interfaces TypeScript (Produto, Divida, HistoricoPagamento)
    │   └── styles.css                    # Estilos globais e Dark Mode
    ├── capacitor.config.json
    └── package.json
```

---

## 🗄️ Estrutura do Banco de Dados SQLite

O aplicativo gerencia automaticamente 3 tabelas relacionais no dispositivo Android:

1. **`produtos`**: Catálogo de produtos com `id`, `nome`, `vendedor_pessoa`, `chave_pix`, `preco_padrao` e `criado_em`.
2. **`dividas`**: Lançamentos financeiros com `id`, `produto_id`, `descricao`, `vendedor_pessoa`, `chave_pix`, `quantidade`, `quantidade_paga`, `valor_unitario`, `valor`, `valor_pago`, `data_lancamento`, `pago`, `data_pagamento`, `observacao` e anexo (`comprovante_base64`, `comprovante_nome`, `comprovante_tipo`).
3. **`historico_pagamentos`**: Registro individual de amortizações parciais ou quitações vinculado a `divida_id`, contendo `valor`, `data_pagamento`, `observacao` e comprovante próprio.

---

## 🚀 Como Executar e Compilar o Projeto

### Pré-requisitos
- **Node.js** 18+ e **NPM**
- **JDK 21** (para compilação Android / Gradle)
- **Android SDK** configurado

### 1. Executar no Navegador (Desenvolvimento)
```bash
cd frontend
npm install
npm start
```
Acesse `http://localhost:4200` no navegador.

### 2. Gerar Build e Sincronizar com o Android (Capacitor)
```bash
cd frontend
npm run build
npx cap sync android
```

### 3. Compilar o APK Android (Debug ou Release)
No PowerShell:
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd frontend/android

# Para gerar o APK de Debug:
.\gradlew.bat assembleDebug

# Para gerar o APK de Release assinado:
.\gradlew.bat assembleRelease
```

- **Saída Debug:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- **Saída Release:** `frontend/android/app/build/outputs/apk/release/app-release.apk`

---

## 📄 Licença

Projeto de uso pessoal e comercial para controle financeiro de pequenas compras, doces e despesas compartilhadas.
