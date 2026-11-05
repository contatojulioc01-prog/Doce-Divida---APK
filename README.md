# 🍫 Doce Dívida - Sistema Móvel de Controle de Dívidas e Produtos (SQLite 100% Nativo no Celular)

Aplicativo Android (APK) desenvolvido em **Angular** com **Capacitor** e banco de dados **SQLite nativo embutido no próprio celular**. Funciona de forma 100% offline, sem necessidade de servidores, APIs externas ou conexão com a internet.

---

## 📱 1. APK Compilado Pronto para Instalação

O APK compilado com o banco SQLite embutido já está disponível em:
- Arquivo: [`apk/doce-divida-debug.apk`](./apk/doce-divida-debug.apk) (ou [`frontend/android/app/build/outputs/apk/debug/app-debug.apk`](./frontend/android/app/build/outputs/apk/debug/app-debug.apk))

### Como instalar no celular:
1. Copie o arquivo `doce-divida-debug.apk` para o seu celular Android (via USB, WhatsApp, Google Drive, etc.).
2. No celular, toque no arquivo APK para instalar (habilite "Permitir desta fonte" caso solicitado pelo Android).
3. Abra o app: as tabelas SQLite e dados iniciais serão criados diretamente no armazenamento interno do aparelho!

---

## 🗄️ 2. Como Funciona o Banco de Dados SQLite no Celular

- **Sem Servidor Externo:** O próprio aplicativo gerencia o banco de dados nativo SQLite através do plugin `@capacitor-community/sqlite`.
- **Persistência Segura:** Todos os dados de produtos e lançamentos de dívidas ficam salvos no banco local do dispositivo.
- **Suporte Completo a SQL:** Criação de tabelas, índices, consultas com filtros e somas agregadas (`SUM(valor)` para total pendente e pago).

---

## 🛠️ 3. Como Recompilar o APK (Opcional)

Caso faça alterações no código do frontend Angular:
```bash
cd frontend
npm run build
npx cap sync android
cd android
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
./gradlew.bat assembleDebug
```
O novo APK será gerado em `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
