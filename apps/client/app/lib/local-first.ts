import type { CloudPage, SessionUser } from "./types";
import { readDir, readTextFile, writeTextFile, exists, mkdir, remove, rename, stat } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { join, dirname, basename } from "@tauri-apps/api/path";

export const isDesktop = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Remove .md extension
function stripExt(name: string) {
  return name.replace(/\.md$/i, "");
}

// Escapar e normalizar o path para usar como ID
function normalizeId(pathStr: string) {
  return pathStr.replace(/\\/g, "/");
}

export const localApi = {
  getVaults: (): string[] => {
    try { return JSON.parse(localStorage.getItem("orbe-vaults") || "[]"); } catch { return []; }
  },

  setActiveVault: (path: string) => {
    localStorage.setItem("orbe-active-vault", path);
    const vaults = localApi.getVaults();
    if (!vaults.includes(path)) {
      vaults.push(path);
      localStorage.setItem("orbe-vaults", JSON.stringify(vaults));
    }
  },

  setupVault: async () => {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: "Selecione a pasta do seu Cofre (Vault) Orbe"
    });
    
    if (selectedPath) {
      localApi.setActiveVault(selectedPath as string);
      
      try {
        const { remoteApi } = await import("./api");
        await remoteApi.patchMe(selectedPath as string, undefined);
      } catch (e) {
        console.warn("Could not sync vault path to backend", e);
      }

      return selectedPath;
    }
    return null;
  },

  getVaultPath: () => {
    return localStorage.getItem("orbe-active-vault");
  },



  pages: async (): Promise<CloudPage[]> => {
    const vault = localApi.getVaultPath();
    if (!vault) return [];

    const pages: CloudPage[] = [];
    
    async function scanDir(currentPath: string, parentId: string | null = null) {
      if (!(await exists(currentPath))) return;
      
      const entries = await readDir(currentPath);
      for (const entry of entries) {
        if (!entry.name || entry.name.startsWith("orbe-") || entry.name.startsWith(".")) continue;
        
        const fullPath = await join(currentPath, entry.name);
        const relId = normalizeId(fullPath.substring(vault!.length + 1));
        const fileStat = await stat(fullPath);

        if (entry.isDirectory) {
          pages.push({
            id: relId,
            parent_id: parentId,
            title: entry.name,
            icon: "📁",
            content: [],
            is_favorite: false,
            updated_at: fileStat.mtime ? new Date(fileStat.mtime).toISOString() : new Date().toISOString()
          });
          await scanDir(fullPath, relId);
        } else if (entry.name.endsWith(".md")) {
          let content: any = "";
          try {
            const raw = await readTextFile(fullPath);
            try {
              content = JSON.parse(raw);
            } catch {
              content = raw;
            }
          } catch {
            // fallback
          }

          pages.push({
            id: relId,
            parent_id: parentId,
            title: stripExt(entry.name),
            icon: "○",
            content: content,
            is_favorite: false,
            updated_at: fileStat.mtime ? new Date(fileStat.mtime).toISOString() : new Date().toISOString()
          });
        }
      }
    }

    try {
      await scanDir(vault);
    } catch (e) {
      console.error("Erro ao ler diretório do vault:", e);
    }

    return pages;
  },

  createPage: async (input: { title: string; icon?: string; content?: CloudPage["content"]; parentId?: string | null }): Promise<CloudPage> => {
    const vault = localApi.getVaultPath();
    if (!vault) throw new Error("Cofre não configurado");

    const safeTitle = (input.title || "Sem título").replace(/[\\/:*?"<>|]/g, "");
    const parentPath = input.parentId ? await join(vault, input.parentId) : vault;
    const isFolder = input.icon === "📁";
    
    let fullPath = "";
    let relId = "";

    if (isFolder) {
      fullPath = await join(parentPath, safeTitle);
      let counter = 1;
      while (await exists(fullPath)) {
        fullPath = await join(parentPath, `${safeTitle} (${counter})`);
        counter++;
      }
      await mkdir(fullPath, { recursive: true });
      relId = normalizeId(fullPath.substring(vault.length + 1));
    } else {
      fullPath = await join(parentPath, `${safeTitle}.md`);
      let counter = 1;
      while (await exists(fullPath)) {
        fullPath = await join(parentPath, `${safeTitle} (${counter}).md`);
        counter++;
      }
      const actualContent = input.content || "";
      const textToWrite = typeof actualContent === "string" ? actualContent : JSON.stringify(actualContent);
      await writeTextFile(fullPath, textToWrite);
      relId = normalizeId(fullPath.substring(vault.length + 1));
    }

    const newPage: CloudPage = {
      id: relId,
      parent_id: input.parentId || null,
      title: await basename(fullPath).then(stripExt),
      icon: isFolder ? "📁" : "○",
      content: input.content || [],
      is_favorite: false,
      updated_at: new Date().toISOString()
    };

    const { SyncEngine } = await import("./sync-engine");
    SyncEngine.enqueue("CREATE_PAGE", newPage);

    return newPage;
  },

  updatePage: async (id: string, input: { title?: string; content?: CloudPage["content"]; parentId?: string | null; icon?: string }): Promise<CloudPage> => {
    const vault = localApi.getVaultPath();
    if (!vault) throw new Error("Cofre não configurado");

    const oldPath = await join(vault, id);
    if (!(await exists(oldPath))) throw new Error("Página não encontrada localmente: " + oldPath);
    
    const isFolder = (await stat(oldPath)).isDirectory;
    let newPath = oldPath;
    let newId = id;
    
    // Resolve novo parentId
    let newParentId = input.parentId;
    if (newParentId === undefined) {
      const p = await dirname(oldPath);
      newParentId = normalizeId(p.substring(vault.length + 1) || "null");
    }
    if (newParentId === "null" || newParentId === "") newParentId = null;

    // Renomear ou Mover
    if (input.title !== undefined || input.parentId !== undefined) {
      const currentTitle = await basename(oldPath).then(stripExt);
      const safeTitle = (input.title !== undefined ? input.title : currentTitle).replace(/[\\/:*?"<>|]/g, "");
      const destParentPath = input.parentId !== undefined 
          ? (input.parentId ? await join(vault, input.parentId) : vault)
          : await dirname(oldPath);
      
      newPath = await join(destParentPath, isFolder ? safeTitle : `${safeTitle}.md`);
      
      if (newPath !== oldPath) {
        if (await exists(newPath)) throw new Error("Já existe um arquivo ou pasta com este nome no destino.");
        await rename(oldPath, newPath);
        newId = normalizeId(newPath.substring(vault.length + 1));
      }
    }

    // Salvar conteúdo se for arquivo
    if (!isFolder && input.content !== undefined) {
      const textToWrite = typeof input.content === "string" ? input.content : JSON.stringify(input.content);
      await writeTextFile(newPath, textToWrite);
    }

    const updatedPage: CloudPage = {
      id: newId,
      parent_id: newParentId,
      title: await basename(newPath).then(stripExt),
      icon: input.icon !== undefined ? input.icon : (isFolder ? "📁" : "○"),
      content: input.content || [],
      is_favorite: false,
      updated_at: new Date().toISOString()
    };

    const { SyncEngine } = await import("./sync-engine");
    SyncEngine.enqueue("UPDATE_PAGE", { id: newId, data: input });

    return updatedPage;
  },

  deletePage: async (id: string): Promise<void> => {
    const vault = localApi.getVaultPath();
    if (!vault) throw new Error("Cofre não configurado");

    const targetPath = await join(vault, id);
    if (!(await exists(targetPath))) return; 

    const isFolder = (await stat(targetPath)).isDirectory;
    await remove(targetPath, { recursive: isFolder });

    const { SyncEngine } = await import("./sync-engine");
    SyncEngine.enqueue("DELETE_PAGE", { id });
  },

  files: async () => [],
  fileUrl: (id: string) => `asset://localhost/${id}`,
  upload: async (file: File) => { throw new Error("Não implementado no modo desktop."); }
};
