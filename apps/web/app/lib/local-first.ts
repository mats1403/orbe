import type { CloudPage, SessionUser } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile, BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { randomUUID } from "node:crypto";

export const isDesktop = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Quando rodamos no Desktop, usamos este adaptador em vez do `api.ts` normal
export const localApi = {
  // Inicializa o cofre (Vault) local
  setupVault: async () => {
    // Pede para o usuário escolher uma pasta no computador dele
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "Selecione a pasta do seu Cofre (Vault) Orbe"
    });
    
    if (selectedPath) {
      localStorage.setItem("orbe_vault_path", selectedPath as string);
      return selectedPath;
    }
    return null;
  },

  getVaultPath: () => {
    return localStorage.getItem("orbe_vault_path");
  },

  // Mock do endpoint de /auth/me para o ambiente local
  me: async (): Promise<{ user: SessionUser }> => {
    return {
      user: {
        id: "local-user",
        email: "local@orbe.app",
        display_name: "Local User",
        role: "admin"
      }
    };
  },

  // Listar páginas (lendo o arquivo metadata.json ou buscando as notas)
  pages: async (): Promise<CloudPage[]> => {
    const vault = localStorage.getItem("orbe_vault_path");
    if (!vault) return [];

    try {
      const metadataPath = `${vault}/orbe-metadata.json`;
      if (await exists(metadataPath)) {
        const content = await readTextFile(metadataPath);
        return JSON.parse(content);
      } else {
        // Se não existir, inicializa vazio
        await writeTextFile(metadataPath, "[]");
        return [];
      }
    } catch (e) {
      console.error("Erro ao ler páginas locais:", e);
      return [];
    }
  },

  createPage: async (input: { title: string; icon?: string; content?: CloudPage["content"] }): Promise<CloudPage> => {
    const vault = localStorage.getItem("orbe_vault_path");
    if (!vault) throw new Error("Cofre não configurado");

    const newPage: CloudPage = {
      id: crypto.randomUUID(), // crypto é nativo do browser
      parentId: null,
      title: input.title || "Sem título",
      icon: input.icon || null,
      content: input.content || [],
      isFavorite: false,
      updatedAt: new Date().toISOString()
    };

    const pages = await localApi.pages();
    pages.push(newPage);
    
    // Atualiza metadados
    await writeTextFile(`${vault}/orbe-metadata.json`, JSON.stringify(pages, null, 2));
    
    // Se a página tem conteúdo textual markdown, salva como arquivo .md na pasta pages/
    const mdFolder = `${vault}/pages`;
    if (!(await exists(mdFolder))) {
      await mkdir(mdFolder, { recursive: true });
    }
    
    // Simplificação: salva o JSON bruto ou Markdown no File System
    await writeTextFile(`${mdFolder}/${newPage.id}.md`, JSON.stringify(input.content));

    // Coloca a operação na fila para ir pra nuvem em background
    const { SyncEngine } = await import("./sync-engine");
    SyncEngine.enqueue("CREATE_PAGE", newPage);

    return newPage;
  },

  updatePage: async (id: string, input: { title?: string; content?: CloudPage["content"]; isFavorite?: boolean }): Promise<CloudPage> => {
    const vault = localStorage.getItem("orbe_vault_path");
    if (!vault) throw new Error("Cofre não configurado");

    const pages = await localApi.pages();
    const index = pages.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Página não encontrada localmente");

    pages[index] = { ...pages[index], ...input, updatedAt: new Date().toISOString() };
    await writeTextFile(`${vault}/orbe-metadata.json`, JSON.stringify(pages, null, 2));

    if (input.content) {
      await writeTextFile(`${vault}/pages/${id}.md`, JSON.stringify(input.content));
    }

    // Coloca a operação na fila para ir pra nuvem em background
    const { SyncEngine } = await import("./sync-engine");
    SyncEngine.enqueue("UPDATE_PAGE", { id, data: input });

    return pages[index];
  },

  files: async () => {
    // Por enquanto, retorna array vazio para os arquivos (PDFs, Excel) no Desktop
    return [];
  },

  fileUrl: (id: string) => {
    return `asset://localhost/${id}`; // O Tauri intercepta isso
  },

  upload: async (file: File) => {
    throw new Error("Upload direto não implementado no modo desktop. Salve o arquivo na pasta Assets.");
  }
};
