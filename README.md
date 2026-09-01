# Orbe - Seu Segundo Cérebro Digital

O **Orbe** é um sistema de organização pessoal e gestão de conhecimento pensado para funcionar como um segundo cérebro digital. Ele reúne notas visuais, Markdown, PDFs anotáveis, planilhas, desenhos em camadas e arquivos pessoais em um único ambiente.

Ele preserva os formatos originais, oferece edição especializada para cada conteúdo e combina armazenamento local com uma API segura.

## 🌟 Principais Funcionalidades

- **Editor Markdown Visual:** Edição visual ao vivo (estilo Obsidian) sem aprisionamento de formato.
- **Anotador de PDF:** Leitura e anotação em PDFs com traços vetoriais em camadas separadas, preservando o documento original.
- **Quadro de Desenho Livre:** Ferramentas de desenho vetorial (lápis, caneta, marca-texto) com suporte a camadas.
- **Planilhas:** Edição nativa de arquivos Excel no navegador.
- **Importação Universal:** Suporte para importação de Markdown, PDF, planilhas Excel, pacotes do Samsung Notes e arquivos genéricos.

## 🛠 Tecnologias Utilizadas

- **Frontend:** React 19, TypeScript, vinext, Vite, Tailwind CSS 4, Tiptap.
- **Backend:** Node.js, Fastify, TypeScript, Zod, JWT/Argon2.
- **Banco de Dados:** PostgreSQL.
- **Outros:** PDF.js, pdf-lib, read-excel-file, JSZip.

## 🚀 Como executar localmente

### Pré-requisitos
- Node.js >= 22.13
- PostgreSQL (ou Docker)

### 1. Dependências
```bash
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```bash
cp .env.example .env
```
*(Certifique-se de preencher a URL do banco de dados e as outras configurações)*

### 3. Executando os servidores
O projeto é dividido em API e Interface. Você pode rodar os dois com:

**Backend (API):**
```bash
npm run dev:back
# Disponível em http://localhost:4000
```

**Frontend (Interface):**
```bash
npm run dev:front
# Disponível em http://localhost:3000
```

Se preferir usar Docker (apenas para backend e banco):
```bash
docker compose up
```

## 🌍 Estrutura de Deploy (Vercel, Render e Neon)

A infraestrutura foi preparada para o seguinte stack de produção:

1. **Neon (Banco de Dados):** Fornece o PostgreSQL e a URL de conexão (`DATABASE_URL`).
2. **Render (Backend):** 
   - Ao configurar o Web Service, use o **Root Directory** como `server`.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
3. **Vercel (Frontend):** 
   - Use o preset padrão de Vite/Next e aponte a variável `NEXT_PUBLIC_API_URL` para o link do Render.

---
*Para informações técnicas aprofundadas sobre o produto, roadmap e a arquitetura completa, consulte o arquivo [CONTEXTO_DO_PROJETO.md](./CONTEXTO_DO_PROJETO.md).*
