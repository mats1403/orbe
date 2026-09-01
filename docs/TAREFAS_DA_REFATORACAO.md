- `[/]` Fase 1: Padronização do Monorepo e Bun
  - `[x]` Iniciar repositório como Bun Workspace
  - `[x]` Criar diretórios `apps/web`, `apps/api`, `apps/desktop` e `packages/shared`
  - `[x]` Mover o Frontend (Vite/React) para `apps/web`
  - `[x]` Mover o Backend para `apps/api`
  - `[ ]` Atualizar dependências e migrar o backend (Fastify -> Elysia.js)
  - `[ ]` Garantir que o ambiente de desenvolvimento rode corretamente

- `[/]` Fase 2: Estruturação Desktop (Tauri)
  - `[x]` Inicializar o Tauri em `apps/desktop`
  - `[x]` Configurar Tauri para buildar junto com o frontend `apps/web`
  - `[ ]` Configurar permissões de leitura/escrita no File System local (Rust)

- `[/]` Fase 3: Motor Local-First (Bancos de Dados Híbridos)
  - `[x]` Configurar SQLite local via Rust/Tauri para indexação de metadados no Desktop
  - `[x]` Definir a estrutura do "Cofre" (Vault) onde os arquivos brutos (MD, PDF, XLSX) ficarão armazenados
  - `[x]` Adaptar editores do frontend para ler e escrever no File System quando estiver no Desktop
  
- `[/]` Fase 4: O Importador Universal (Obsidian, Notion, etc)
  - `[x]` Criar lógica para escanear diretórios importados (Obsidian)
  - `[x]` Traduzir Wikilinks e Frontmatter para o modelo do Orbe
  - `[x]` Copiar e organizar mídias e anexos
  
- `[/]` Fase 5: Motor de Sincronização (Sync Engine)
  - `[x]` Filas de sincronização (Local -> Web) e Webhooks/Polling (Web -> Local)
  - `[x]` Resolução básica de conflitos (Timestamps)
