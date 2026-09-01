# Refatoração Arquitetural: Orbe Local-First, Bun/Elysia e Desktop

Este documento detalha o plano para transformar o Orbe em uma aplicação "Local-First" robusta, suportando simultaneamente Web e Desktop, com sincronização bidirecional, e migrando o backend para o ecossistema do Bun + Elysia.js.

## ⚠️ User Review Required

> [!WARNING]
> Esta é uma mudança estrutural gigantesca. Nós vamos alterar o núcleo de como o Orbe armazena e lê dados, além de trocar o servidor (Fastify -> Elysia) e o runtime (Node -> Bun). Por favor, revise a arquitetura proposta abaixo antes de prosseguirmos.

## ❓ Open Questions

> [!IMPORTANT]
> Preciso que você decida alguns pontos de design antes de iniciarmos:
> 1. **Framework Desktop:** Recomendo fortemente o **Tauri** em vez do Electron. O Tauri é mais seguro, gera executáveis minúsculos e se integra perfeitamente com Vite/React. O backend do Tauri usa Rust (apenas para acesso ao disco/OS local). Você concorda em usar Tauri?
> 2. **Armazenamento Local (Desktop):** O Obsidian funciona lendo arquivos `.md` diretamente da pasta. Você quer que o Orbe Desktop funcione **exatamente** assim (lendo os `.md` puros e estruturando o banco em cima deles), ou prefere usar um banco SQLite local no Desktop e os arquivos físicos ficam apenas como exportação/backup?
> 3. **Monorepo:** Para organizar tudo de forma limpa, precisamos transformar o projeto em um monorepo real. Concorda em movermos as coisas para pastas como `apps/web`, `apps/api` e `apps/desktop`?

---

## 🛠️ Proposed Changes (Plano de Ação)

A implementação será dividida em 4 fases lógicas para garantir estabilidade.

### Fase 1: Padronização do Monorepo e Migração para Bun + Elysia
Vamos modernizar a base do código para usar os melhores padrões de mercado.

- **Migração do Gerenciador de Pacotes:** Substituir `npm` por `bun`.
- **Estrutura de Monorepo (Bun Workspaces):**
  - `apps/web`: O frontend atual em vinext/React.
  - `apps/api`: O novo backend.
  - `apps/desktop`: O wrapper do app Desktop.
  - `packages/shared`: Tipagens Zod, utilitários, e esquemas do Drizzle compartilhados entre todos.
- **Substituição do Fastify pelo Elysia.js:**
  - Reescrever as rotas de `server/src/index.ts` usando Elysia.
  - Manter o Postgres e Drizzle ORM para a versão Web/API.

### Fase 2: O Importador do Obsidian
Criar um conversor robusto que entenda a estrutura de um cofre (Vault) do Obsidian.

- **Conversão de Arquivos:** Ler recursivamente diretórios locais, mantendo a árvore de pastas.
- **Tratamento de Links:** Converter *Wikilinks* (`[[Nota]]`) para links padrão Markdown ou links internos do Orbe.
- **Tags e Frontmatter:** Fazer o parse de metadados YAML (frontmatter) para o banco do Orbe (seja local ou web).
- **Extração de Mídia:** Copiar e referenciar imagens/anexos do Obsidian para o armazenamento do Orbe.

### Fase 3: Estrutura do App Desktop (Local-First)
- Configurar o **Tauri** (ou Electron, dependendo da sua resposta).
- O App Desktop apontará para o frontend React.
- **Comunicação com o SO:** O Desktop não chamará a API web para ler dados! Ele lerá do disco local (File System) ou de um SQLite local usando os bindings nativos do desktop.

### Fase 4: Motor de Sincronização (Sync Engine)
Criar a lógica híbrida que você solicitou:

- **Se estiver no Desktop:**
  1. Modifica/Cria/Deleta o arquivo **localmente** no disco da máquina (Latência Zero).
  2. Adiciona a operação a uma fila local (Sync Queue).
  3. Em background, envia as mudanças para a API do Orbe na Web.
- **Se estiver na Web:**
  1. Modifica no banco de dados na Nuvem (Postgres).
  2. Um WebSocket ou mecanismo de Polling notifica os clientes Desktop de que houve alteração.
  3. O Desktop baixa a alteração da nuvem e atualiza o arquivo local da máquina.

---

## ✅ Verification Plan

### Testes Manuais e Automatizados
- **Testes de Regressão da API:** Garantir que o Elysia.js responde aos mesmos endpoints do Fastify.
- **Conversão do Obsidian:** Criar uma pasta "mock" do Obsidian com arquivos `.md` complexos, pastas aninhadas e wikilinks, e rodar o importador para verificar se a estrutura do Orbe é criada corretamente.
- **Sincronização:** Simular a criação de uma nota local offline, ativar a rede e confirmar se ela foi inserida no banco de dados Postgres da nuvem.
