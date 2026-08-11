"use client";

import {
  Archive, BookOpen, Check, ChevronDown, ChevronRight, Cloud, Command, File,
  FileSpreadsheet, Grid2X2, HardDrive, Inbox, Link2, List, LogOut, Menu,
  MessageSquareText, MoreHorizontal, Network, PanelLeftClose, PenLine, Plus,
  Search, Settings, Share2, Sparkles, Star, Tag, Upload, UserRound, X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { api } from "./lib/api";
import type { CloudPage, EditorKind, OrbeDocument, SessionUser } from "./lib/types";

type PageItem = { id: string; title: string; icon: string; group: "favorites" | "private" | "shared"; preview: string; updated: string };

const initialPages: PageItem[] = [
  { id: "home", title: "Meu segundo cérebro", icon: "✦", group: "favorites", preview: "Sua central de ideias, arquivos e projetos.", updated: "agora" },
  { id: "projects", title: "Projetos em andamento", icon: "◫", group: "favorites", preview: "3 projetos ativos e 8 próximas ações", updated: "12 min" },
  { id: "journal", title: "Diário de bordo", icon: "☀", group: "private", preview: "Uma nota por dia, sem pressão.", updated: "hoje" },
  { id: "research", title: "Pesquisa & referências", icon: "◎", group: "private", preview: "Leituras, destaques e conexões", updated: "ontem" },
  { id: "finances", title: "Planejamento financeiro", icon: "↗", group: "private", preview: "Planilhas e decisões em um só lugar", updated: "2 dias" },
  { id: "team", title: "Espaço da equipe", icon: "♧", group: "shared", preview: "Compartilhado com 4 pessoas", updated: "5 min" },
];

const seedDocuments: OrbeDocument[] = [
  { id: "markdown-welcome", name: "Manifesto do Orbe.md", kind: "markdown", mimeType: "text/markdown", size: "4 KB", accent: "lilac", content: "# Bem-vindo ao Orbe\n\nSeu espaço deve se adaptar ao seu pensamento — e não o contrário.\n\n## Hoje\n\n- [ ] Capture uma ideia\n- [ ] Conecte uma referência\n- [ ] Faça um desenho livre\n\n> Tudo continua seu, inclusive quando a internet acaba." },
  { id: "sheet-demo", name: "Planejamento 2026.xlsx", kind: "spreadsheet", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: "1,7 MB", accent: "green", sheet: [["Projeto", "Responsável", "Status", "Progresso"], ["Orbe Mobile", "Matheus", "Em andamento", "65%"], ["Importadores", "Equipe", "Planejado", "20%"], ["Sincronização", "Backend", "Em andamento", "48%"]] },
  { id: "pdf-demo", name: "Pesquisa de mercado.pdf", kind: "pdf", mimeType: "application/pdf", size: "8,1 MB", accent: "coral" },
  { id: "samsung-demo", name: "Notas importadas.sdocx", kind: "samsung", mimeType: "application/octet-stream", size: "36 notas", accent: "blue", content: "Ideias recuperadas do Samsung Notes\n\n• Levar o modo local-first até o mobile\n• Criar ligações visuais entre páginas\n• Preservar sempre o arquivo original" },
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0) + " " + units[index];
}
function detectKind(file: File): EditorKind {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt") return "markdown";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "spreadsheet";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (ext === "sdoc" || ext === "sdocx") return "samsung";
  return "file";
}
function accentFor(kind: EditorKind) { return { markdown: "lilac", spreadsheet: "green", pdf: "coral", samsung: "blue", drawing: "lilac", file: "sand" }[kind]; }

function SideGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="side-group"><button className="group-title" onClick={() => setOpen(!open)}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span>{title}</span></button>{open && <div className="group-items">{children}</div>}</section>;
}

export default function Home() {
  const [pages, setPages] = useState(initialPages);
  const [activePage, setActivePage] = useState("home");
  const [documents, setDocuments] = useState(seedDocuments);
  const [activeDocument, setActiveDocument] = useState<OrbeDocument | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [syncMode, setSyncMode] = useState<"local" | "cloud">("local");
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "offline" | "error">("saved");
  const [cloudPageId, setCloudPageId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [title, setTitle] = useState("Meu segundo cérebro");
  const [note, setNote] = useState("Tudo começa aqui. Capture uma ideia, conecte uma referência ou simplesmente escreva o que está na sua cabeça.");
  const fileInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const storedNote = window.localStorage.getItem("orbe-note");
    const storedDocuments = window.localStorage.getItem("orbe-documents");
    if (storedNote) setNote(storedNote);
    if (storedDocuments) {
      try { setDocuments(JSON.parse(storedDocuments)); } catch { /* preserve defaults */ }
    }
    api.me().then(({ user }) => { setSession(user); setSyncMode("cloud"); }).catch(() => undefined);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setUploadOpen(false); setAuthOpen(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = window.setTimeout(async () => {
      window.localStorage.setItem("orbe-note", note);
      window.localStorage.setItem("orbe-documents", JSON.stringify(documents.map(({ file: _file, objectUrl: _url, ...item }) => item)));
      if (syncMode === "cloud" && session) {
        try {
          const content: CloudPage["content"] = [{ type: "markdown", data: { markdown: note } }, { type: "documents", data: { items: documents.map(({ file: _file, objectUrl: _url, ...item }) => item) } }];
          if (cloudPageId) await api.updatePage(cloudPageId, { title, content });
          else { const created = await api.createPage({ title, icon: "✦", content }); setCloudPageId(created.id); }
          setSyncStatus("saved");
        } catch { setSyncStatus("error"); }
      } else {
        setSyncStatus("saved");
      }
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [title, note, documents, syncMode, session, cloudPageId]);

  const filteredPages = useMemo(() => pages.filter((page) => (page.title + " " + page.preview).toLowerCase().includes(search.toLowerCase())), [pages, search]);

  function openPage(page: PageItem) { setActivePage(page.id); setTitle(page.title); setMobileOpen(false); }
  function addPage() {
    const item: PageItem = { id: crypto.randomUUID(), title: "Página sem título", icon: "○", group: "private", preview: "Comece a escrever…", updated: "agora" };
    setPages((current) => [...current, item]); openPage(item); setNote(""); setCloudPageId(null);
  }
  function newDocument(kind: EditorKind) {
    const names = { markdown: "Nova nota.md", spreadsheet: "Nova planilha.xlsx", pdf: "Novo PDF", samsung: "Samsung Notes", drawing: "Novo quadro", file: "Novo arquivo" };
    const document: OrbeDocument = { id: crypto.randomUUID(), name: names[kind], kind, mimeType: kind === "markdown" ? "text/markdown" : "application/octet-stream", size: "Local", accent: accentFor(kind), content: kind === "markdown" ? "# Nova nota\n\nComece a escrever…" : undefined };
    setDocuments((current) => [document, ...current]); setActiveDocument(document);
  }
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    const added = await Promise.all(chosen.map(async (file) => {
      const kind = detectKind(file);
      const document: OrbeDocument = { id: crypto.randomUUID(), name: file.name, kind, mimeType: file.type || "application/octet-stream", size: formatBytes(file.size), accent: accentFor(kind), file, objectUrl: kind === "pdf" ? URL.createObjectURL(file) : undefined };
      if (kind === "markdown") document.content = await file.text();
      if (session && syncMode === "cloud") {
        try { const cloud = await api.upload(file); document.cloudId = cloud.id; } catch { setSyncStatus("error"); }
      }
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
    setSession(user); setSyncMode("cloud"); setAuthOpen(false); setSyncStatus("saving");
    try {
      const cloudPages = await api.pages();
      if (cloudPages[0]) {
        setCloudPageId(cloudPages[0].id);
        setTitle(cloudPages[0].title);
        const markdown = cloudPages[0].content.find((block) => block.type === "markdown")?.data.markdown;
        if (typeof markdown === "string") setNote(markdown);
      }
      setSyncStatus("saved");
    } catch { setSyncStatus("error"); }
  }
  async function logout() { await api.logout().catch(() => undefined); setSession(null); setSyncMode("local"); setCloudPageId(null); }

  if (activeDocument) return <EditorWorkspace document={activeDocument} onClose={() => setActiveDocument(null)} onSave={saveDocument} />;

  return <main className="app-shell">
    <aside className={"sidebar " + (!sidebarOpen ? "collapsed " : "") + (mobileOpen ? "mobile-open" : "")}>
      <div className="workspace-head"><button className="brand" onClick={() => openPage(initialPages[0])}><span className="brand-mark">O</span><span className="brand-copy"><strong>Orbe</strong><small>{session ? session.email : "Espaço pessoal"}</small></span></button><button className="icon-button desktop-only" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={18} /></button><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
      <button className="search-button" onClick={() => setSearchOpen(true)}><Search size={16} /><span>Buscar em tudo</span><kbd>⌘ K</kbd></button>
      <nav className="primary-nav"><button className="nav-row active"><Inbox size={17} /><span>Início</span></button><button className="nav-row"><BookOpen size={17} /><span>Hoje</span><small>4</small></button><button className="nav-row"><Network size={17} /><span>Conexões</span></button><button className="nav-row"><Archive size={17} /><span>Todos os arquivos</span><small>{documents.length}</small></button></nav>
      <div className="page-tree">{(["favorites", "private", "shared"] as const).map((group) => <SideGroup key={group} title={{ favorites: "FAVORITOS", private: "PRIVADO", shared: "COMPARTILHADO" }[group]}>{pages.filter((page) => page.group === group).map((page) => <button className={"page-row " + (activePage === page.id ? "selected" : "")} key={page.id} onClick={() => openPage(page)}><span className="page-emoji">{page.icon}</span><span>{page.title}</span>{group === "shared" && <span className="avatar-mini">M</span>}</button>)}{group === "private" && <button className="page-row muted-row" onClick={addPage}><Plus size={15} /><span>Nova página</span></button>}</SideGroup>)}</div>
      <div className="storage-card"><div className="storage-top"><span><HardDrive size={15} /> Armazenamento</span><strong>{syncMode === "cloud" ? "Nuvem ativa" : "2,8 GB"}</strong></div><div className="storage-track"><span /></div><small>{syncMode === "cloud" ? "cópia local + PostgreSQL" : "de 10 GB usados neste dispositivo"}</small></div>
      <div className="sidebar-footer"><button className="nav-row"><Settings size={17} /><span>Configurações</span></button>{session ? <button className="profile-button" onClick={logout}><span className="avatar">{session.email.slice(0, 2).toUpperCase()}</span><span><strong>{session.email}</strong><small>Sincronização ativa</small></span><LogOut size={17} /></button> : <button className="profile-button" onClick={() => setAuthOpen(true)}><span className="avatar"><UserRound size={14} /></span><span><strong>Conectar à nuvem</strong><small>Entrar ou criar conta</small></span><ChevronRight size={17} /></button>}</div>
    </aside>

    {!sidebarOpen && <button className="sidebar-reopen desktop-only" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>}
    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} />}
    <section className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><button>Espaço pessoal</button><ChevronRight size={14} /><span>{title}</span></div><div className="topbar-actions">
        <span className={"save-state " + (syncStatus === "saved" ? "done" : syncStatus === "error" ? "error" : "")}>{syncStatus === "saved" ? <Check size={13} /> : <span className="pulse-dot" />}{syncStatus === "saved" ? "Salvo" : syncStatus === "error" ? "Falha ao sincronizar" : "Salvando"}</span>
        <button className="sync-pill" onClick={() => session ? setSyncMode(syncMode === "local" ? "cloud" : "local") : setAuthOpen(true)}>{syncMode === "cloud" ? <Cloud size={15} /> : <HardDrive size={15} />}<span>{syncMode === "cloud" ? "Sincronizado" : "Somente local"}</span><ChevronDown size={13} /></button>
        <button className="icon-button hide-small"><MessageSquareText size={18} /></button><button className="share-button"><Share2 size={16} /><span>Compartilhar</span></button><button className="icon-button hide-small"><MoreHorizontal size={19} /></button>
      </div></header>

      <div className="content-scroll"><article className="page-content">
        <div className="page-toolbar"><button><Star size={15} /> Favoritar</button><button><Link2 size={15} /> Copiar link</button><button><MoreHorizontal size={16} /></button></div>
        <div className="page-icon">✦</div><input className="page-title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea className="page-intro" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        <div className="editor-launcher"><div><span className="eyebrow">EDITORES UNIVERSAIS</span><h2>Abra, transforme e continue criando</h2><p>O original é preservado. Suas mudanças vivem em camadas editáveis e sincronizáveis.</p></div><div className="editor-launch-buttons"><button onClick={() => newDocument("markdown")}><span className="action-icon lilac"><File size={18} /></span>Markdown</button><button onClick={() => newDocument("spreadsheet")}><span className="action-icon green"><FileSpreadsheet size={18} /></span>Planilha</button><button onClick={() => newDocument("drawing")}><span className="action-icon coral"><PenLine size={18} /></span>Quadro livre</button></div></div>
        <div className="quick-actions"><button onClick={() => fileInput.current?.click()}><span className="action-icon mint"><Upload size={19} /></span><span><strong>Importar qualquer arquivo</strong><small>PDF, Office, Markdown ou Samsung Notes</small></span></button><button onClick={() => newDocument("drawing")}><span className="action-icon violet"><PenLine size={19} /></span><span><strong>Desenhar livremente</strong><small>Caneta, toque ou mouse</small></span></button><button onClick={addPage}><span className="action-icon amber"><Plus size={20} /></span><span><strong>Criar uma página</strong><small>Texto, lista ou banco de dados</small></span></button></div>

        <section className="section-block"><div className="section-heading"><div><h2>Seus documentos</h2><p>Clique para abrir no editor adequado</p></div><div className="view-controls"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Grid2X2 size={16} /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={17} /></button></div></div>
          <div className={"recent-grid document-grid " + (view === "list" ? "list-view" : "")}>{documents.slice(0, 6).map((document, index) => <button className="recent-card" key={document.id} onClick={() => setActiveDocument(document)}><div className={"card-art art-" + ((index % 3) + 1)}><span>{document.kind === "spreadsheet" ? <FileSpreadsheet size={17} /> : document.kind === "drawing" ? <PenLine size={17} /> : <File size={17} />}</span><div className="art-lines"><i /><i /><i /></div></div><div className="card-copy"><strong>{document.name}</strong><p>{document.kind === "pdf" ? "Anotar sem alterar o original" : document.kind === "spreadsheet" ? "Células editáveis e exportação .xlsx" : document.kind === "samsung" ? "Conteúdo recuperado e editável" : "Conteúdo livre e conectado"}</p><small>{document.cloudId ? "Na nuvem" : "Neste dispositivo"} · {document.size}</small></div><MoreHorizontal className="card-more" size={17} /></button>)}</div>
        </section>

        <section className="section-block"><div className="section-heading"><div><h2>Biblioteca</h2><p>Tudo cabe aqui, sem se prender ao formato</p></div><button className="text-button" onClick={() => setUploadOpen(true)}>Importar <ChevronRight size={15} /></button></div><div className="file-list">{documents.slice(0, 5).map((item) => <button className="file-row" key={item.id} onClick={() => setActiveDocument(item)}><span className={"file-icon " + item.accent}>{item.kind === "spreadsheet" ? <FileSpreadsheet size={19} /> : item.kind === "drawing" ? <PenLine size={19} /> : <File size={19} />}</span><span className="file-name"><strong>{item.name}</strong><small>{item.kind} · {item.size}</small></span><span className="file-tag"><Tag size={12} /> {item.cloudId ? "Sincronizado" : "Local"}</span><MoreHorizontal size={17} /></button>)}</div></section>
      </article></div>
      <button className="capture-button" onClick={() => setUploadOpen(true)}><Sparkles size={17} /><span>Captura rápida</span><kbd>N</kbd></button>
    </section>

    <input ref={fileInput} className="hidden-input" type="file" multiple onChange={importFiles} />

    {searchOpen && <div className="modal-layer" onMouseDown={() => setSearchOpen(false)}><section className="command-panel" onMouseDown={(event) => event.stopPropagation()}><div className="command-search"><Search size={20} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque notas, arquivos, textos…" /><kbd>ESC</kbd></div><div className="command-body"><span className="command-label">PÁGINAS</span>{filteredPages.map((page) => <button key={page.id} onClick={() => { openPage(page); setSearchOpen(false); }}><span className="result-icon">{page.icon}</span><span><strong>{page.title}</strong><small>{page.preview}</small></span><span className="result-time">{page.updated}</span></button>)}</div><footer><span><Command size={13} /> + K para abrir</span><span>↑↓ navegar · ↵ abrir</span></footer></section></div>}
    {uploadOpen && <div className="modal-layer" onMouseDown={() => setUploadOpen(false)}><section className="upload-panel" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setUploadOpen(false)}><X size={19} /></button><span className="modal-kicker">CAPTURA UNIVERSAL</span><h2>Traga qualquer coisa para o Orbe</h2><p>Arquivos reconhecidos abrem no editor adequado; os demais são preservados integralmente.</p><button className="drop-zone" onClick={() => fileInput.current?.click()}><span><Upload size={25} /></span><strong>Escolha arquivos do dispositivo</strong><small>.md, .xlsx, .pdf, .sdocx e muito mais</small></button></section></div>}
    {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onConnected={connected} />}
  </main>;
}

function AuthPanel({ onClose, onConnected }: { onClose: () => void; onConnected: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = mode === "login" ? await api.login(email, password) : await api.register(email, password); onConnected(result.user); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar."); }
    finally { setBusy(false); }
  }
  return <div className="modal-layer auth-layer" onMouseDown={onClose}><form className="auth-panel" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}><X size={19} /></button><span className="brand-mark">O</span><span className="modal-kicker">NUVEM PRIVADA ORBE</span><h2>{mode === "login" ? "Continue de qualquer dispositivo" : "Crie seu espaço sincronizado"}</h2><p>Seus dados continuam locais e ganham uma cópia protegida no PostgreSQL.</p><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} /><small>Mínimo de 12 caracteres</small></label>{error && <div className="auth-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Conectando…" : mode === "login" ? "Entrar e sincronizar" : "Criar conta segura"}</button><button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button><div className="privacy-note"><HardDrive size={15} /> O modo local continua disponível mesmo sem entrar.</div></form></div>;
}
