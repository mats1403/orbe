"use client";

import {
  Archive, BookOpen, Calendar, Check, ChevronDown, ChevronRight, Cloud, Command, File as FileIcon,
  FileSpreadsheet, Grid2X2, HardDrive, Inbox, Link2, List, Lock, LogOut, Menu,
  MessageSquareText, MoreHorizontal, Network, PanelLeftClose, PenLine, Plus,
  Search, Settings, Share2, ShieldCheck, Sparkles, Star, Tag, Upload, UserRound, X,
  Eye, EyeOff, Folder, FileText, CloudOff
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { MarkdownVisualEditor } from "./components/MarkdownVisualEditor";
import { SecureSetupModal } from "./components/SecureSetupModal";
import { api } from "./lib/api";
import { open } from "@tauri-apps/plugin-dialog";
import type { CloudPage, EditorKind, OrbeDocument, SecurityConfig, SessionUser } from "./lib/types";

type PageItem = CloudPage & { group: "favorites" | "private" | "shared"; preview: string; updated: string; isOpen?: boolean };



function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0) + " " + units[index];
}
function detectKind(file: File): EditorKind {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "sec" || ext === "vault") return "secure";
  if (ext === "md" || ext === "markdown" || ext === "txt") return "markdown";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "spreadsheet";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (ext === "sdoc" || ext === "sdocx") return "samsung";
  return "file";
}
function accentFor(kind: EditorKind) {
  return {
    markdown: "lilac",
    spreadsheet: "green",
    pdf: "coral",
    samsung: "blue",
    drawing: "lilac",
    file: "sand",
    secure: "gold",
  }[kind];
}

function SideGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="side-group"><button className="group-title" onClick={() => setOpen(!open)}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span>{title}</span></button>{open && <div className="group-items">{children}</div>}</section>;
}

export default function Home() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [activePage, setActivePage] = useState("home");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [contextMenuPage, setContextMenuPage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<OrbeDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<OrbeDocument | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [lastOpenedState, setLastOpenedState] = useState<{ activePage?: string; activeDocumentId?: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [createSecureOpen, setCreateSecureOpen] = useState(false);
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaults, setVaults] = useState<string[]>([]);
  const [vaultSwitcherOpen, setVaultSwitcherOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "offline" | "error">("saved");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [title, setTitle] = useState("Meu segundo cérebro");
  const [note, setNote] = useState("Tudo começa aqui. Capture uma ideia, conecte uma referência ou simplesmente escreva o que está na sua cabeça.");
  const fileInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const vs = api.getVaults ? api.getVaults() : [];
    setVaults(vs);
    const active = api.getVaultPath ? api.getVaultPath() : null;
    if (active) setVaultPath(active);
    api.me().then(async ({ user }) => { 
      setSession(user); 
      
      if (user.vault_path && user.vault_path !== active) {
         try {
           const { exists } = await import("@tauri-apps/plugin-fs");
           const vaultExists = await exists(user.vault_path);
           if (vaultExists) {
               api.setActiveVault(user.vault_path);
               setVaultPath(user.vault_path);
               if (!vs.includes(user.vault_path)) setVaults([...vs, user.vault_path]);
           } else {
               alert(`Aviso: O cofre sincronizado com a sua conta (${user.vault_path}) não foi encontrado neste dispositivo. Por favor, crie ou abra um cofre existente.`);
           }
         } catch (e) {
            console.error("Erro ao verificar vault remoto:", e);
         }
      }
      
      if (user.last_opened_files) {
        try {
          setLastOpenedState(JSON.parse(user.last_opened_files));
        } catch {}
      }
    }).catch(() => setSession(null));
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setUploadOpen(false); setAuthOpen(false); setCreateSecureOpen(false); setVaultSwitcherOpen(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  async function pickVault() {
    try {
      const selected = await api.setupVault();
      if (selected) {
        setVaults(api.getVaults());
        setVaultPath(selected);
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!vaultPath) return;
    
    async function loadVault() {
      setPages([]);
      setDocuments([]);
      setActivePage("home");
      try {
        const pathApi = await import("@tauri-apps/api/path");
        const fs = await import("@tauri-apps/plugin-fs");
        
        const notePath = await pathApi.join(vaultPath as string, "orbe-note.md");
        const docsPath = await pathApi.join(vaultPath as string, "orbe-documents.json");
        
        if (await fs.exists(notePath)) {
          const content = await fs.readTextFile(notePath);
          setNote(content);
        }
        
        if (await fs.exists(docsPath)) {
          const docsStr = await fs.readTextFile(docsPath);
          setDocuments(JSON.parse(docsStr));
        }
        
        const loadedPages = await api.pages();
        setPages(loadedPages.map(p => ({ 
          ...p, 
          group: "private", 
          preview: "...", 
          updated: new Date(p.updated_at).toLocaleDateString(),
          isOpen: false 
        } as PageItem)));
        
        if (lastOpenedState) {
          if (lastOpenedState.activePage) setActivePage(lastOpenedState.activePage);
          if (lastOpenedState.activeDocumentId) {
             const docs = await fs.exists(docsPath) ? JSON.parse(await fs.readTextFile(docsPath)) : [];
             const doc = docs.find((d: any) => d.id === lastOpenedState.activeDocumentId);
             if (doc) setActiveDocument(doc);
          }
        }
      } catch (e) {
        console.error("Failed to load vault:", e);
      }
    }
    
    loadVault();
  }, [vaultPath]);

  useEffect(() => {
    if (!vaultPath || isLoadingNote) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = window.setTimeout(async () => {
      try {
        const pathApi = await import("@tauri-apps/api/path");
        const fs = await import("@tauri-apps/plugin-fs");
        
        const notePath = await pathApi.join(vaultPath as string, "orbe-note.md");
        const docsPath = await pathApi.join(vaultPath as string, "orbe-documents.json");
        
        await fs.writeTextFile(notePath, note);
        
        const docsToSave = documents.map(({ file: _file, objectUrl: _url, ...item }) => {
          if (item.security?.isLocked) {
            return { ...item, content: undefined };
          }
          return item;
        });
        
        await fs.writeTextFile(docsPath, JSON.stringify(docsToSave, null, 2));
        
        // Se for uma página real, atualiza
        if (activePage !== "home" && activePage !== "today" && activePage !== "connections" && activePage !== "all_files") {
          const currentPage = pages.find(p => p.id === activePage);
          if (currentPage && (currentPage.title !== title || currentPage.content !== note)) {
             let parsedContent = [];
             try { parsedContent = JSON.parse(note); } catch { parsedContent = note as any; }
             const updated = await api.updatePage(activePage, { title, content: parsedContent });
             setPages(current => current.map(p => p.id === activePage ? { ...p, ...updated, updated: "agora" } : p));
             if (updated.id !== activePage) {
               setActivePage(updated.id);
             }
          }
        }
        setSyncStatus("saved");
      } catch (e) {
        console.error("Failed to save vault:", e);
        setSyncStatus("error");
      }
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [title, note, documents, vaultPath]);

  const filteredPages = useMemo(() => pages.filter((page) => (page.title + " " + page.preview).toLowerCase().includes(search.toLowerCase())), [pages, search]);

  const storageUsedBytes = useMemo(() => documents.reduce((acc, doc) => acc + (doc.sizeBytes || 0), 0), [documents]);

  useEffect(() => {
    if (!session || session.id === "local-user" || !vaultPath) return;
    
    const handler = setTimeout(() => {
       const state = { activePage, activeDocumentId: activeDocument?.id };
       api.patchMe(undefined, JSON.stringify(state)).catch(() => {});
    }, 2000);
    
    return () => clearTimeout(handler);
  }, [activePage, activeDocument, session, vaultPath]);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString();
    return pages.filter(p => p.updated === today).length + documents.filter(d => d.updatedAt && new Date(d.updatedAt).toLocaleDateString() === today).length;
  }, [pages, documents]);

  function togglePage(id: string) { setPages(current => current.map(p => p.id === id ? { ...p, isOpen: !p.isOpen } : p)); }

  async function openPage(page: PageItem) { 
    setActivePage(page.id); 
    setTitle(page.title); 
    setNote(""); 
    setMobileOpen(false); 
    
    setIsLoadingNote(true);
    try {
      const rawContent = await api.getPageContent(page.id);
      let parsedContent = rawContent;
      try { parsedContent = JSON.parse(rawContent); } catch {}
      
      const newNote = Array.isArray(parsedContent) ? JSON.stringify(parsedContent, null, 2) : (parsedContent || "");
      setNote(newNote);
      setPages(current => current.map(p => p.id === page.id ? { ...p, content: parsedContent } : p));
    } catch (e) {
      setNote("");
    } finally {
      setIsLoadingNote(false);
    }
  }
  async function addPage(parentId: string | null = null) {
    try {
      const newPage = await api.createPage({ title: "Nova página", content: "", parentId });
      const item = { ...newPage, group: "private" as const, preview: "...", updated: "agora", isOpen: true };
      setPages(current => [...current, item]);
      if (parentId) {
        setPages(current => current.map(p => p.id === parentId ? { ...p, isOpen: true } : p));
      }
      openPage(item);
    } catch(e) { console.error(e); }
  }

  async function deletePage(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta pasta/nota e tudo que há dentro dela?")) return;
    try {
      await api.deletePage(id);
      setPages(current => current.filter(p => p.id !== id && !p.id.startsWith(id + "/")));
      if (activePage === id) setActivePage("home");
    } catch(e) { console.error(e); }
  }

  function newDocument(kind: EditorKind) {
    const names = {
      markdown: "Nova nota.md",
      spreadsheet: "Nova planilha.xlsx",
      pdf: "Novo PDF",
      samsung: "Samsung Notes",
      drawing: "Novo quadro",
      file: "Novo arquivo",
      secure: "Nota Segura.sec",
    };
    const document: OrbeDocument = {
      id: crypto.randomUUID(),
      name: names[kind],
      kind,
      mimeType: kind === "markdown" || kind === "secure" ? "text/markdown" : "application/octet-stream",
      size: "Local",
      accent: accentFor(kind),
      content: kind === "markdown" ? "# Nova nota\n\nComece a escrever…" : undefined
    };
    setDocuments((current) => [document, ...current]);
    setActiveDocument(document);
  }

  function handleCreateSecureNote(config: SecurityConfig | null) {
    if (!config) return;
    const document: OrbeDocument = {
      id: crypto.randomUUID(),
      name: "Nota Segura.sec",
      kind: "secure",
      mimeType: "text/markdown",
      size: "Local",
      accent: "gold",
      content: "# 🔒 Nova Nota Segura\n\nEste conteúdo está protegido e criptografado com sua senha/PIN.",
      security: config,
    };
    setDocuments((current) => [document, ...current]);
    setActiveDocument(document);
    setCreateSecureOpen(false);
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    const added = await Promise.all(chosen.map(async (file) => {
      const kind = detectKind(file);
      const document: OrbeDocument = { id: crypto.randomUUID(), name: file.name, kind, mimeType: file.type || "application/octet-stream", size: formatBytes(file.size), accent: accentFor(kind), file, objectUrl: kind === "pdf" ? URL.createObjectURL(file) : undefined };
      if (kind === "markdown") document.content = await file.text();
      return document;
    }));
    setDocuments((current) => [...added, ...current]);
    setUploadOpen(false);
    if (added[0]) setActiveDocument(added[0]);
    event.target.value = "";
  }

  function saveDocument(document: OrbeDocument) {
    setDocuments((current) => current.map((item) => item.id === document.id ? document : item));
    setActiveDocument(document);
  }

  async function connected(user: SessionUser) {
    setSession(user); setAuthOpen(false); setSyncStatus("saved");
  }

  async function logout() { await api.logout().catch(() => undefined); setSession(null); }

  if (activeDocument) return <EditorWorkspace document={activeDocument} onClose={() => setActiveDocument(null)} onSave={saveDocument} />;

  if (!vaultPath) {
    return (
      <main className="app-shell" style={{ alignItems: "center", justifyContent: "center", background: "var(--background-secondary)" }}>
        <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🌌</div>
          <h2>Bem-vindo ao Orbe</h2>
          <p style={{ color: "var(--foreground-muted)", marginBottom: 30 }}>Escolha ou crie um cofre local para começar.</p>
          
          {vaults.length > 0 && (
            <div style={{marginBottom: 20, textAlign: 'left', background: 'var(--background)', padding: 12, borderRadius: 12, border: '1px solid var(--border-color)'}}>
              <span className="eyebrow" style={{display: 'block', marginBottom: 8}}>SEUS COFRES</span>
              {vaults.map(v => (
                 <button key={v} onClick={() => { api.setActiveVault(v); setVaultPath(v); }} className="nav-row" style={{width: '100%', justifyContent: 'flex-start', marginBottom: 4}}>
                   <HardDrive size={15}/> <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1}}>{v}</span>
                 </button>
              ))}
            </div>
          )}

          <button onClick={pickVault} className="sync-pill" style={{ margin: "0 auto", padding: "10px 20px" }}>
            <HardDrive size={18} style={{ marginRight: 8 }} /> {vaults.length > 0 ? "Adicionar outro Cofre" : "Abrir ou Criar Cofre"}
          </button>
        </div>
      </main>
    );
  }

  if (session === undefined) return <main className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}><div style={{ color: "var(--foreground-muted)" }}>Carregando sessão...</div></main>;
  if (session === null) return <main className="app-shell" style={{ alignItems: "center", justifyContent: "center", background: "var(--background-secondary)" }}><AuthPanel onClose={() => {}} onConnected={connected} /></main>;

    function openSpecial(id: string, newTitle: string) {
    setActivePage(id);
    setTitle(newTitle);
    setNote("");
  }

  return <main className="app-shell">
    <header className="top-nav">
      <div className="brand" style={{ color: '#fff', padding: '0 16px 0 12px' }}>
        <span className="brand-mark" style={{ background: 'transparent', boxShadow: 'none', color: 'var(--violet)' }}>🌌</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Orbe</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 99, gap: 4 }}>
        <button className={"nav-pill-btn " + (activePage === "home" ? "active" : "")} onClick={() => openSpecial("home", "Início")}>
          <Inbox size={15} /> Início
        </button>
        <button className={"nav-pill-btn " + (activePage === "today" ? "active" : "")} onClick={() => openSpecial("today", "Hoje")}>
          <Calendar size={15} /> Hoje
        </button>
        <button className={"nav-pill-btn " + (activePage === "all_files" ? "active" : "")} onClick={() => openSpecial("all_files", "Todos os arquivos")}>
          <Archive size={15} /> Arquivos
        </button>
        <button className={"nav-pill-btn " + (activePage === "connections" ? "active" : "")} onClick={() => openSpecial("connections", "Conexões")}>
          <Network size={15} /> Conexões
        </button>
      </div>

      <div style={{ position: 'relative', marginLeft: 16, marginRight: 4 }}>
        <button className="nav-pill-btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setVaultSwitcherOpen(!vaultSwitcherOpen)}>
          <HardDrive size={15} /> <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vaultPath?.split(/[\\/]/).pop() || vaultPath}</span>
        </button>
        {vaultSwitcherOpen && (
          <div className="vault-dropdown" style={{position: 'absolute', top: '100%', right: 0, marginTop: 12, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 8, zIndex: 100, minWidth: 220, boxShadow: '0 10px 40px rgba(0,0,0,0.15)'}}>
            <span className="eyebrow" style={{display: 'block', marginBottom: 8, color: 'var(--muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', paddingLeft: 8}}>SEUS COFRES</span>
            {vaults.map(v => (
              <button key={v} onClick={() => { api.setActiveVault(v); setVaultPath(v); setVaultSwitcherOpen(false); }} className="nav-row" style={{width: '100%', justifyContent: 'flex-start', background: v === vaultPath ? 'var(--paper)' : 'transparent', marginBottom: 2, color: 'var(--ink)'}}>
                 <HardDrive size={15} color="var(--violet)"/> <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl'}}>{v}</span>
              </button>
            ))}
            <hr style={{borderColor: 'var(--line)', margin: '8px 0'}}/>
            <button onClick={() => { pickVault(); setVaultSwitcherOpen(false); }} className="nav-row" style={{width: '100%', justifyContent: 'flex-start', color: 'var(--ink)'}}><Plus size={15}/> Adicionar Cofre</button>
          </div>
        )}
      </div>
    </header>

    <aside className={"sidebar " + (!sidebarOpen ? "collapsed " : "") + (mobileOpen ? "mobile-open" : "")}>
      <div style={{ padding: '24px 16px 16px' }}>
         <h3 style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>Seu Cofre</h3>
         <button className="search-button" onClick={() => setSearchOpen(true)} style={{ width: '100%', margin: '0 0 12px', background: 'var(--paper)', border: 'none', height: 40, borderRadius: 12 }}><Search size={14}/><span>Buscar no cofre...</span></button>
      </div>
      <div className="page-tree">{(["favorites", "private", "shared"] as const).map((group) => <SideGroup key={group} title={{ favorites: "FAVORITOS", private: "PRIVADO", shared: "COMPARTILHADO" }[group]}>
        {function renderTree(parentId: string | null = null, depth = 0) {
          const nodes = pages.filter(p => ((p as any).parent_id || null) === parentId && p.group === group);
          return nodes.map(page => {
            const hasChildren = pages.some(p => (p as any).parent_id === page.id && p.group === group);
            return (
              <div key={page.id}>
                <div 
                  style={{ display: "flex", alignItems: "center", paddingLeft: depth * 12, position: 'relative' }}
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); setDraggedId(page.id); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={async (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (!draggedId || draggedId === page.id) return;
                    try {
                      const updated = await api.updatePage(draggedId, { parentId: page.id });
                      setPages(current => {
                         const next = current.map(p => p.id === draggedId ? { ...p, ...updated, isOpen: true } : p);
                         return next.map(p => p.id === page.id ? { ...p, isOpen: true } : p);
                      });
                      if (activePage === draggedId) setActivePage(updated.id);
                    } catch(e) { alert(String(e)); }
                    setDraggedId(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuPage(contextMenuPage === page.id ? null : page.id);
                  }}
                >
                  {hasChildren ? (
                    <button className="icon-button" style={{ padding: 2, marginRight: 4, width: 20, height: 20 }} onClick={(e) => { e.stopPropagation(); togglePage(page.id); }}>
                      {page.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ) : (
                    <span style={{ width: 24 }} />
                  )}
                  <button style={{ flex: 1 }} className={"page-row " + (activePage === page.id ? "selected" : "") + (draggedId === page.id ? " dragging" : "")} onClick={() => {
                      if (page.icon === 'folder') {
                        togglePage(page.id);
                      } else {
                        openPage(page);
                      }
                  }}>
                    <span className="page-emoji" style={{ display: 'flex', alignItems: 'center', opacity: 0.7, marginRight: 6 }}>
                      {page.icon === 'folder' ? <Folder size={15}/> : page.icon === 'file' ? <FileText size={15}/> : (hasChildren ? <Folder size={15}/> : <FileText size={15}/>)}
                    </span>
                    <span>{page.title}</span>{group === "shared" && <span className="avatar-mini">M</span>}
                  </button>
                  
                  {contextMenuPage === page.id && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 50, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: 4, minWidth: 150 }}>
                      <button onClick={(e) => { e.stopPropagation(); addPage(page.id); setContextMenuPage(null); }} className="nav-row" style={{ width: '100%', justifyContent: 'flex-start' }}><Plus size={14}/> Nova sub-página</button>
                      <button onClick={(e) => { e.stopPropagation(); deletePage(page.id); setContextMenuPage(null); }} className="nav-row" style={{ width: '100%', justifyContent: 'flex-start', color: '#ff4b4b' }}><X size={14}/> Excluir</button>
                    </div>
                  )}
                </div>
                {page.isOpen && hasChildren && renderTree(page.id, depth + 1)}
              </div>
            );
          });
        }()}
        {group === "private" && <button className="page-row muted-row" onClick={() => addPage(null)} style={{ marginLeft: 24 }}><Plus size={15} /><span>Nova página na raiz</span></button>}
      </SideGroup>)}</div>
      
      <div className="sidebar-footer" style={{ borderTop: 'none', padding: '16px' }}>
         <button className="profile-button" onClick={() => setAuthOpen(true)} style={{ background: 'var(--paper)', borderRadius: 12 }}>
           <span className="avatar" style={{ background: 'var(--violet)' }}><UserRound size={14} /></span>
           <span><strong style={{ color: 'var(--ink)' }}>Conectar Nuvem</strong><small>Entrar ou criar conta</small></span>
         </button>
      </div>
    </aside>

    {!sidebarOpen && <button className="sidebar-reopen desktop-only" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>}
    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} />}
    
    <section className="workspace">
      <div className="content-scroll">
        <article className="page-content" style={{ maxWidth: 1080, padding: '20px 40px 100px' }}>
          {activePage !== "home" && activePage !== "today" && activePage !== "all_files" && activePage !== "connections" ? (
            <>
              <div className="page-toolbar">
                <span className={"save-state " + (syncStatus === "saved" ? "done" : "")}>
                  {syncStatus === "saving" ? <><span className="pulse-dot" /> Salvando local...</> : syncStatus === "saved" ? <><Check size={12} /> Salvo localmente</> : <><CloudOff size={12} /> Erro ao salvar</>}
                </span>
                <button onClick={() => openSpecial("home", "Início")}><X size={14} /> Fechar</button>
              </div>
              <input className="page-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da página" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, background: 'transparent', border: 'none', outline: 'none', width: '100%', color: 'inherit' }} />
              <div className="seamless-editor-container" style={{ marginTop: 16 }}>
                <style>{`
                  .seamless-editor-container .visual-markdown-editor { min-height: 400px; }
                  .seamless-editor-container .editor-ribbon { background: transparent; border-bottom: 1px solid rgba(0,0,0,0.05); margin-bottom: 16px; border-radius: 12px; }
                  .seamless-editor-container .visual-markdown-scroll { overflow-y: visible !important; background: transparent !important; }
                  .seamless-editor-container .visual-markdown-scroll .tiptap { padding: 0 !important; width: 100% !important; min-height: auto !important; }
                `}</style>
                {isLoadingNote ? (
                  <div style={{ color: 'var(--muted)' }}>Carregando...</div>
                ) : (
                  <MarkdownVisualEditor 
                    value={note} 
                    onChange={setNote} 
                  />
                )}
              </div>
            </>
          ) : null}

          {activePage === "home" && (
            <>
              <div style={{ marginBottom: 30, marginTop: 10 }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Início</h1>
                <p style={{ color: 'var(--muted)', margin: '4px 0 0' }}>Sua central de trabalho unificada.</p>
              </div>

              <div className="quick-actions" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 0 }}>
                <button className="finnova-card" onClick={() => setCreateSecureOpen(true)} style={{ padding: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <span className="action-icon gold" style={{ width: 48, height: 48, borderRadius: 12 }}><ShieldCheck size={24} /></span>
                  <span><strong style={{ fontSize: 14 }}>Nota Segura</strong><small style={{ whiteSpace: 'normal', display: 'block' }}>Criptografia por senha</small></span>
                </button>
                <button className="finnova-card" onClick={() => fileInput.current?.click()} style={{ padding: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <span className="action-icon mint" style={{ width: 48, height: 48, borderRadius: 12 }}><Upload size={24} /></span>
                  <span><strong style={{ fontSize: 14 }}>Importar</strong><small style={{ whiteSpace: 'normal', display: 'block' }}>Qualquer arquivo local</small></span>
                </button>
                <button className="finnova-card" onClick={() => newDocument("drawing")} style={{ padding: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <span className="action-icon violet" style={{ width: 48, height: 48, borderRadius: 12 }}><PenLine size={24} /></span>
                  <span><strong style={{ fontSize: 14 }}>Quadro Livre</strong><small style={{ whiteSpace: 'normal', display: 'block' }}>Desenhe livremente</small></span>
                </button>
                <button className="finnova-card" onClick={() => addPage(null)} style={{ padding: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  <span className="action-icon amber" style={{ width: 48, height: 48, borderRadius: 12 }}><Plus size={24} /></span>
                  <span><strong style={{ fontSize: 14 }}>Nova Página</strong><small style={{ whiteSpace: 'normal', display: 'block' }}>Markdown na raiz</small></span>
                </button>
              </div>

              <div className="finnova-dark-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                   <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Acessados Recentemente</h2>
                   <button style={{ background: 'var(--violet)', color: '#fff', padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }} onClick={() => openSpecial("all_files", "Todos os arquivos")}>Ver todos</button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {documents.slice(0, 3).map((item) => (
                    <button key={item.id} className="finnova-card" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: 'none' }} onClick={() => setActiveDocument(item)}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <span className={"action-icon " + item.accent} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', width: 40, height: 40 }}>
                            {item.kind === "spreadsheet" ? <FileSpreadsheet size={19} /> : item.kind === "drawing" ? <PenLine size={19} /> : item.kind === "secure" ? <Lock size={19} /> : <FileIcon size={19} />}
                          </span>
                          <strong style={{ fontSize: 15, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{item.name}</strong>
                       </div>
                       <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'left' }}>
                          {item.size} • {item.kind}
                       </div>
                    </button>
                  ))}
                  {documents.length === 0 && (
                     <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.5)' }}>
                        Nenhum documento encontrado. Importe ou crie um novo para começar.
                     </div>
                  )}
                </div>
              </div>
            </>
          )}

          {(activePage === "all_files" || activePage === "today") && (
            <section className="section-block">
              <div className="section-heading" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{activePage === "today" ? "Modificados Hoje" : "Todos os Arquivos"}</h2>
                </div>
                <button className="sync-pill" onClick={() => setUploadOpen(true)} style={{ background: 'var(--violet)', color: '#fff', border: 'none', borderRadius: 99, padding: '0 20px', fontWeight: 500, height: 40 }}><Upload size={15} /> Importar</button>
              </div>
              
              <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                {documents.filter(d => activePage === "today" ? (d.updatedAt && new Date(d.updatedAt).toLocaleDateString() === new Date().toLocaleDateString()) : true)
                .map((item) => (
                  <button className="file-row" key={item.id} onClick={() => setActiveDocument(item)} style={{ width: '100%', padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'transparent', transition: 'background 0.2s', height: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span className={"file-icon action-icon " + item.accent} style={{ width: 40, height: 40, borderRadius: 12 }}>
                      {item.kind === "spreadsheet" ? <FileSpreadsheet size={20} /> : item.kind === "drawing" ? <PenLine size={20} /> : item.kind === "secure" ? <Lock size={20} /> : <FileIcon size={20} />}
                    </span>
                    <span className="file-name" style={{ textAlign: 'left', flex: 1 }}>
                       <strong style={{ fontSize: 15, marginBottom: 4, display: 'block' }}>{item.name}</strong>
                       <small style={{ color: 'var(--muted)' }}>{item.kind} • {item.size}</small>
                    </span>
                    <MoreHorizontal size={17} style={{ color: 'var(--muted)' }} />
                  </button>
                ))}
              </div>
            </section>
          )}
          
          {activePage === "connections" && (
            <section className="section-block">
              <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 24px', letterSpacing: '-0.02em' }}>Conexões</h1>
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--line)' }}>
                <Network size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhuma conexão visualizada no momento.</p>
              </div>
            </section>
          )}
        </article>
      </div>
      <button className="capture-button" style={{ background: 'var(--violet-dark)', bottom: 30, right: 30, borderRadius: 99, padding: '12px 24px' }} onClick={() => setUploadOpen(true)}><Sparkles size={17} /><span>Captura rápida</span><kbd style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}>N</kbd></button>
    </section>
    <input ref={fileInput} className="hidden-input" type="file" multiple onChange={importFiles} />

    {searchOpen && <div className="modal-layer" onMouseDown={() => setSearchOpen(false)}><section className="command-panel" onMouseDown={(event) => event.stopPropagation()}><div className="command-search"><Search size={20} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque notas, arquivos, textos…" /><kbd>ESC</kbd></div><div className="command-body"><span className="command-label">PÁGINAS E DOCUMENTOS</span>{filteredPages.map((page) => <button key={page.id} onClick={() => { openPage(page); setSearchOpen(false); }}><span className="result-icon">{page.icon}</span><span><strong>{page.title}</strong><small>{page.preview}</small></span><span className="result-time">{page.updated}</span></button>)}</div><footer><span><Command size={13} /> + K para abrir</span><span>↑↓ navegar · ↵ abrir</span></footer></section></div>}
    {uploadOpen && <div className="modal-layer" onMouseDown={() => setUploadOpen(false)}><section className="upload-panel" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setUploadOpen(false)}><X size={19} /></button><span className="modal-kicker">CAPTURA UNIVERSAL</span><h2>Traga qualquer coisa para o Orbe</h2><p>Arquivos reconhecidos abrem no editor adequado; os demais são preservados integralmente.</p><button className="drop-zone" onClick={() => fileInput.current?.click()}><span><Upload size={25} /></span><strong>Escolha arquivos do dispositivo</strong><small>.md, .xlsx, .pdf, .sdocx e muito mais</small></button></section></div>}
    {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onConnected={connected} />}
    {createSecureOpen && (
      <SecureSetupModal
        currentContent="# 🔒 Nova Nota Segura\n\nEscreva aqui suas senhas, chaves privadas ou notas confidenciais..."
        onSave={handleCreateSecureNote}
        onClose={() => setCreateSecureOpen(false)}
      />
    )}
  </main>;
}

function AuthPanel({ onClose, onConnected }: { onClose: () => void; onConnected: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginStr, setLoginStr] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { 
      const result = mode === "login" 
        ? await api.login(loginStr, password) 
        : await api.register(loginStr, username, password); 
      onConnected(result.user); 
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-layer auth-layer" onMouseDown={onClose}>
      <form className="auth-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}><X size={19} /></button>
        <span className="brand-mark">O</span>
        <span className="modal-kicker">NUVEM PRIVADA ORBE</span>
        <h2>{mode === "login" ? "Continue de qualquer dispositivo" : "Crie seu espaço sincronizado"}</h2>
        <p>Seus dados continuam locais e ganham uma cópia protegida no PostgreSQL.</p>
        
        <label>
          {mode === "login" ? "E-mail ou Username" : "E-mail"}
          <input 
            type={mode === "login" ? "text" : "email"} 
            value={loginStr} 
            onChange={(event) => setLoginStr(event.target.value)} 
            required 
            autoComplete={mode === "login" ? "username" : "email"} 
          />
        </label>

        {mode === "register" && (
          <label>
            Nome de Usuário (Username)
            <input 
              type="text" 
              value={username} 
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
              required 
              minLength={3}
              maxLength={64}
              placeholder="ex: mats123"
            />
          </label>
        )}

        <label>
          Senha
          <div className="input-with-icon" style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password} 
              onChange={(event) => setPassword(event.target.value)} 
              required 
              minLength={12} 
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{ width: "100%", paddingRight: "32px" }}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "var(--foreground-muted)", display: "flex", alignItems: "center" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <small>Mínimo de 12 caracteres</small>
        </label>

        {error && <div className="auth-error">{error}</div>}
        
        <button className="auth-submit" disabled={busy}>
          {busy ? "Conectando…" : mode === "login" ? "Entrar e sincronizar" : "Criar conta segura"}
        </button>
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setPassword(""); }}>
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </form>
    </div>
  );
}
