"use client";

import {
  Archive, BookOpen, Check, ChevronDown, ChevronRight, Cloud, Command, Download,
  File, FileSpreadsheet, Grid2X2, HardDrive, Inbox, Link2, List, Menu,
  MessageSquareText, MoreHorizontal, Network, PanelLeftClose, PenLine, Plus,
  Search, Settings, Share2, Sparkles, Star, Tag, Trash2, Upload, X,
} from "lucide-react";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type PageItem = { id: string; title: string; icon: string; group: "favorites" | "private" | "shared"; preview: string; updated: string };
type ImportedFile = { id: string; name: string; type: string; size: string; accent: string };

const initialPages: PageItem[] = [
  { id: "home", title: "Meu segundo cérebro", icon: "✦", group: "favorites", preview: "Sua central de ideias, arquivos e projetos.", updated: "agora" },
  { id: "projects", title: "Projetos em andamento", icon: "◫", group: "favorites", preview: "3 projetos ativos e 8 próximas ações", updated: "12 min" },
  { id: "journal", title: "Diário de bordo", icon: "☀", group: "private", preview: "Uma nota por dia, sem pressão.", updated: "hoje" },
  { id: "research", title: "Pesquisa & referências", icon: "◎", group: "private", preview: "Leituras, destaques e conexões", updated: "ontem" },
  { id: "finances", title: "Planejamento financeiro", icon: "↗", group: "private", preview: "Planilhas e decisões em um só lugar", updated: "2 dias" },
  { id: "team", title: "Espaço da equipe", icon: "♧", group: "shared", preview: "Compartilhado com 4 pessoas", updated: "5 min" },
];

const seedFiles: ImportedFile[] = [
  { id: "f1", name: "Mapa mental — Produto", type: "Canvas", size: "2,4 MB", accent: "lilac" },
  { id: "f2", name: "Pesquisa de mercado.pdf", type: "PDF", size: "8,1 MB", accent: "coral" },
  { id: "f3", name: "Projeções 2026.xlsx", type: "Planilha", size: "1,7 MB", accent: "green" },
  { id: "f4", name: "Notas importadas", type: "Samsung Notes", size: "36 notas", accent: "blue" },
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0) + " " + units[index];
}

function SideGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="side-group">
    <button className="group-title" onClick={() => setOpen(!open)} aria-expanded={open}>
      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span>{title}</span>
    </button>
    {open && <div className="group-items">{children}</div>}
  </section>;
}

export default function Home() {
  const [pages, setPages] = useState(initialPages);
  const [activePage, setActivePage] = useState("home");
  const [files, setFiles] = useState(seedFiles);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<"local" | "cloud">("local");
  const [saved, setSaved] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [title, setTitle] = useState("Meu segundo cérebro");
  const [note, setNote] = useState("Tudo começa aqui. Capture uma ideia, conecte uma referência ou simplesmente escreva o que está na sua cabeça.");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("orbe-note");
    if (stored) setNote(stored);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSearchOpen(false); setUploadOpen(false); setCanvasOpen(false); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const filteredPages = useMemo(() => pages.filter((page) => (page.title + " " + page.preview).toLowerCase().includes(search.toLowerCase())), [pages, search]);

  function saveNote(value: string) {
    setNote(value); setSaved(false);
    window.setTimeout(() => { window.localStorage.setItem("orbe-note", value); setSaved(true); }, 450);
  }

  function openPage(page: PageItem) { setActivePage(page.id); setTitle(page.title); setMobileOpen(false); }
  function addPage() {
    const item: PageItem = { id: crypto.randomUUID(), title: "Página sem título", icon: "○", group: "private", preview: "Comece a escrever…", updated: "agora" };
    setPages((current) => [...current, item]); openPage(item);
  }
  function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setFiles((current) => [...chosen.map((item) => ({ id: crypto.randomUUID(), name: item.name, type: item.type.split("/").pop()?.toUpperCase() || "Arquivo", size: formatBytes(item.size), accent: "sand" })), ...current]);
    setUploadOpen(false);
  }

  return <main className="app-shell">
    <aside className={"sidebar " + (!sidebarOpen ? "collapsed " : "") + (mobileOpen ? "mobile-open" : "")}>
      <div className="workspace-head">
        <button className="brand" onClick={() => openPage(initialPages[0])}><span className="brand-mark">O</span><span className="brand-copy"><strong>Orbe</strong><small>Espaço pessoal</small></span></button>
        <button className="icon-button desktop-only" onClick={() => setSidebarOpen(false)} aria-label="Recolher menu"><PanelLeftClose size={18} /></button>
        <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={19} /></button>
      </div>
      <button className="search-button" onClick={() => setSearchOpen(true)}><Search size={16} /><span>Buscar em tudo</span><kbd>⌘ K</kbd></button>
      <nav className="primary-nav">
        <button className="nav-row active"><Inbox size={17} /><span>Início</span></button>
        <button className="nav-row"><BookOpen size={17} /><span>Hoje</span><small>4</small></button>
        <button className="nav-row"><Network size={17} /><span>Conexões</span></button>
        <button className="nav-row"><Archive size={17} /><span>Todos os arquivos</span><small>{files.length}</small></button>
      </nav>
      <div className="page-tree">
        {(["favorites", "private", "shared"] as const).map((group) => <SideGroup key={group} title={{ favorites: "FAVORITOS", private: "PRIVADO", shared: "COMPARTILHADO" }[group]}>
          {pages.filter((page) => page.group === group).map((page) => <button className={"page-row " + (activePage === page.id ? "selected" : "")} key={page.id} onClick={() => openPage(page)}>
            <span className="page-emoji">{page.icon}</span><span>{page.title}</span>{group === "shared" && <span className="avatar-mini">M</span>}
          </button>)}
          {group === "private" && <button className="page-row muted-row" onClick={addPage}><Plus size={15} /><span>Nova página</span></button>}
        </SideGroup>)}
      </div>
      <div className="storage-card"><div className="storage-top"><span><HardDrive size={15} /> Armazenamento</span><strong>2,8 GB</strong></div><div className="storage-track"><span /></div><small>de 10 GB usados neste dispositivo</small></div>
      <div className="sidebar-footer"><button className="nav-row"><Settings size={17} /><span>Configurações</span></button><button className="profile-button"><span className="avatar">MF</span><span><strong>Matheus</strong><small>Plano pessoal</small></span><MoreHorizontal size={17} /></button></div>
    </aside>

    {!sidebarOpen && <button className="sidebar-reopen desktop-only" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>}
    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}

    <section className="workspace">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><button>Espaço pessoal</button><ChevronRight size={14} /><span>{title}</span></div>
        <div className="topbar-actions">
          <span className={"save-state " + (saved ? "done" : "")}>{saved ? <Check size={13} /> : <span className="pulse-dot" />}{saved ? "Salvo" : "Salvando"}</span>
          <button className="sync-pill" onClick={() => setSyncMode(syncMode === "local" ? "cloud" : "local")}>{syncMode === "local" ? <HardDrive size={15} /> : <Cloud size={15} />}<span>{syncMode === "local" ? "Somente local" : "Sincronizado"}</span><ChevronDown size={13} /></button>
          <button className="icon-button hide-small"><MessageSquareText size={18} /></button><button className="share-button"><Share2 size={16} /><span>Compartilhar</span></button><button className="icon-button hide-small"><MoreHorizontal size={19} /></button>
        </div>
      </header>

      <div className="content-scroll"><article className="page-content">
        <div className="page-toolbar"><button><Star size={15} /> Favoritar</button><button><Link2 size={15} /> Copiar link</button><button><MoreHorizontal size={16} /></button></div>
        <div className="page-icon">✦</div>
        <input className="page-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Título da página" />
        <textarea className="page-intro" value={note} onChange={(event) => saveNote(event.target.value)} rows={2} aria-label="Texto da página" />

        <div className="quick-actions">
          <button onClick={() => fileInput.current?.click()}><span className="action-icon mint"><Upload size={19} /></span><span><strong>Importar algo</strong><small>Qualquer arquivo ou pasta</small></span></button>
          <button onClick={() => setCanvasOpen(true)}><span className="action-icon violet"><PenLine size={19} /></span><span><strong>Desenhar livremente</strong><small>Caneta, toque ou mouse</small></span></button>
          <button onClick={addPage}><span className="action-icon amber"><Plus size={20} /></span><span><strong>Criar uma página</strong><small>Texto, lista ou banco de dados</small></span></button>
        </div>

        <section className="section-block">
          <div className="section-heading"><div><h2>Continue de onde parou</h2><p>Seus espaços mais recentes</p></div><div className="view-controls"><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><Grid2X2 size={16} /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={17} /></button></div></div>
          <div className={"recent-grid " + (view === "list" ? "list-view" : "")}>{pages.slice(1, 4).map((page, index) => <button className="recent-card" key={page.id} onClick={() => openPage(page)}>
            <div className={"card-art art-" + (index + 1)}><span>{page.icon}</span><div className="art-lines"><i /><i /><i /></div></div>
            <div className="card-copy"><strong>{page.title}</strong><p>{page.preview}</p><small>Editado {page.updated}</small></div><MoreHorizontal className="card-more" size={17} />
          </button>)}</div>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><h2>Biblioteca</h2><p>Tudo cabe aqui, sem se prender ao formato</p></div><button className="text-button" onClick={() => setUploadOpen(true)}>Ver tudo <ChevronRight size={15} /></button></div>
          <div className="file-list">{files.slice(0, 4).map((item) => <button className="file-row" key={item.id}><span className={"file-icon " + item.accent}>{item.type.includes("Planilha") ? <FileSpreadsheet size={19} /> : item.type === "Canvas" ? <PenLine size={19} /> : <File size={19} />}</span><span className="file-name"><strong>{item.name}</strong><small>{item.type} · {item.size}</small></span><span className="file-tag"><Tag size={12} /> Referência</span><MoreHorizontal size={17} /></button>)}</div>
        </section>
      </article></div>
      <button className="capture-button" onClick={() => setUploadOpen(true)}><Sparkles size={17} /><span>Captura rápida</span><kbd>N</kbd></button>
    </section>

    <input ref={fileInput} className="hidden-input" type="file" multiple onChange={importFiles} />

    {searchOpen && <div className="modal-layer" onMouseDown={() => setSearchOpen(false)}><section className="command-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="command-search"><Search size={20} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque notas, arquivos, textos…" /><kbd>ESC</kbd></div>
      <div className="command-body"><span className="command-label">RESULTADOS</span>{filteredPages.map((page) => <button key={page.id} onClick={() => { openPage(page); setSearchOpen(false); }}><span className="result-icon">{page.icon}</span><span><strong>{page.title}</strong><small>{page.preview}</small></span><span className="result-time">{page.updated}</span></button>)}{!filteredPages.length && <div className="empty-result">Nenhum resultado. Tente outra palavra.</div>}</div>
      <footer><span><Command size={13} /> + K para abrir</span><span>↑↓ navegar · ↵ abrir</span></footer>
    </section></div>}

    {uploadOpen && <div className="modal-layer" onMouseDown={() => setUploadOpen(false)}><section className="upload-panel" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setUploadOpen(false)}><X size={19} /></button><span className="modal-kicker">CAPTURA UNIVERSAL</span><h2>Traga qualquer coisa para o Orbe</h2><p>PDF, Markdown, Samsung Notes, Office, imagens, áudio, vídeo ou uma pasta inteira.</p>
      <button className="drop-zone" onClick={() => fileInput.current?.click()}><span><Upload size={25} /></span><strong>Escolha arquivos do dispositivo</strong><small>ou arraste e solte aqui</small></button>
    </section></div>}

    {canvasOpen && <DrawingCanvas onClose={() => setCanvasOpen(false)} />}
  </main>;
}

function DrawingCanvas({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#26251f");
  const [width, setWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; canvas.getContext("2d")?.scale(ratio, ratio);
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function start(event: PointerEvent<HTMLCanvasElement>) { drawing.current = true; const context = canvasRef.current?.getContext("2d"); const p = point(event); context?.beginPath(); context?.moveTo(p.x, p.y); event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: PointerEvent<HTMLCanvasElement>) { if (!drawing.current) return; const context = canvasRef.current?.getContext("2d"); if (!context) return; const p = point(event); context.lineCap = "round"; context.strokeStyle = color; context.lineWidth = width * (event.pressure || .7); context.lineTo(p.x, p.y); context.stroke(); }
  function clear() { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height); }
  function download() { const link = document.createElement("a"); link.download = "desenho-orbe.png"; link.href = canvasRef.current?.toDataURL() ?? ""; link.click(); }

  return <div className="canvas-layer"><header><div><button className="icon-button" onClick={onClose}><X size={20} /></button><span className="canvas-title"><strong>Quadro livre</strong><small>Use caneta, toque ou mouse</small></span></div><div className="canvas-tools">
    {["#26251f", "#7164ad", "#d15f48", "#2c8869"].map((item) => <button key={item} className={"color-dot " + (color === item ? "selected" : "")} style={{ background: item }} onClick={() => setColor(item)} />)}
    <span className="tool-divider" />{[2, 5, 9].map((item) => <button key={item} className={"stroke-button " + (width === item ? "selected" : "")} onClick={() => setWidth(item)}><i style={{ width: item + 5, height: item }} /></button>)}
  </div><div><button className="canvas-secondary" onClick={clear}><Trash2 size={16} /> Limpar</button><button className="canvas-save" onClick={download}><Download size={16} /> Salvar desenho</button></div></header><div className="canvas-wrap"><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} /></div></div>;
}
