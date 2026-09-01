# Orbe — arquitetura da primeira versão

O Orbe segue uma arquitetura local-first: a experiência continua útil sem internet e a sincronização é uma opção do usuário.

- Interface: React 19 + TypeScript, responsiva e instalável como PWA.
- Dados locais: rascunhos e preferências ficam no dispositivo. A próxima etapa é mover páginas e binários para IndexedDB/OPFS.
- Nuvem privada: API Fastify com PostgreSQL, autenticação JWT curta, senhas Argon2id, validação Zod, limites de requisição, cabeçalhos de segurança e consultas parametrizadas.
- Arquivos: bytes ficam fora do banco, em volume privado; PostgreSQL guarda metadados, propriedade e relações.
- Empacotamento: Docker Compose sobe API e PostgreSQL. Para desktop, a interface está pronta para Tauri; para lojas mobile, está pronta para Capacitor.
- Importadores: arquivos desconhecidos são preservados sem conversão. Adaptadores específicos (PDF, Markdown, Office e Samsung Notes) devem produzir uma representação editável sem apagar o original.

## Princípio de segurança

O servidor não confia em identificadores enviados pelo cliente: toda consulta é limitada ao proprietário autenticado. Segredos ficam fora do repositório, uploads recebem nomes aleatórios e o processo do container não roda como administrador.
