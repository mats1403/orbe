"use client";

import { Download, FileText, LoaderCircle, PenLine, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { OrbeDocument, Stroke } from "../lib/types";
import { api } from "../lib/api";
import { DEFAULT_LAYER, DrawingToolbar, DrawSettings, StrokeCanvas, useStrokeHistory } from "./DrawingToolkit";

export function PdfAnnotator({ document, onChange }: { document: OrbeDocument; onChange: (strokes: Stroke[]) => void }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [annotating, setAnnotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState<DrawSettings>({ tool: "pen", color: "#d15f48", width: 3, opacity: .95 });
  const history = useStrokeHistory((document.annotations ?? []).map((stroke) => stroke.page ? stroke : { ...stroke, page: 1 }), onChange);

  useEffect(() => {
    let active = true; let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const sourceUrl = document.objectUrl ?? (document.cloudId ? api.fileUrl(document.cloudId) : undefined);
        const data = document.file ? await document.file.arrayBuffer() : sourceUrl ? await fetch(sourceUrl, { credentials: "include" }).then((response) => response.arrayBuffer()) : null;
        if (!data) throw new Error("Arquivo original não está disponível nesta sessão.");
        loaded = await pdfjs.getDocument({ data }).promise;
        if (active) setPdf(loaded);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível abrir o PDF."); }
    })();
    return () => { active = false; loaded?.destroy(); };
  }, [document.file, document.objectUrl]);

  async function downloadAnnotated() {
    setExporting(true);
    try {
      const sourceUrl = document.objectUrl ?? (document.cloudId ? api.fileUrl(document.cloudId) : undefined);
      const source = document.file ? await document.file.arrayBuffer() : sourceUrl ? await fetch(sourceUrl, { credentials: "include" }).then((response) => response.arrayBuffer()) : null;
      if (!source) throw new Error("Original indisponível");
      const { PDFDocument, rgb } = await import("pdf-lib");
      const copy = await PDFDocument.load(source);
      for (const stroke of history.strokes) {
        const page = copy.getPages()[(stroke.page ?? 1) - 1]; if (!page || stroke.points.length < 2) continue;
        const { width, height } = page.getSize();
        const color = hex(stroke.color);
        for (let index = 1; index < stroke.points.length; index++) {
          const previous = stroke.points[index - 1], current = stroke.points[index];
          page.drawLine({ start: { x: previous.x / 100 * width, y: (1 - previous.y / 100) * height }, end: { x: current.x / 100 * width, y: (1 - current.y / 100) * height }, thickness: Math.max(.7, stroke.width * .72), color: rgb(color.r, color.g, color.b), opacity: stroke.opacity ?? .92, lineCap: 1 });
        }
      }
      const bytes = await copy.save(); const blob = new Blob([bytes as BlobPart], { type: "application/pdf" }); const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = document.name.replace(/\.pdf$/i, "") + "-anotado.pdf"; anchor.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  return <div className="pdf-editor">
    <div className="editor-ribbon pdf-ribbon">
      <div className="format-tools"><button className={annotating ? "active" : ""} onClick={() => setAnnotating(true)}><PenLine size={16} /> Anotar</button><button className={!annotating ? "active" : ""} onClick={() => setAnnotating(false)}><FileText size={16} /> Navegar</button></div>
      <div className="pdf-zoom"><button title="Diminuir zoom" onClick={() => setZoom((value) => Math.max(.6, value - .1))}><ZoomOut size={15} /></button><span>{Math.round(zoom * 100)}%</span><button title="Aumentar zoom" onClick={() => setZoom((value) => Math.min(2, value + .1))}><ZoomIn size={15} /></button></div>
      <button className="export-button pdf-export" onClick={downloadAnnotated} disabled={!pdf || exporting}><Download size={15} /> {exporting ? "Criando cópia…" : "Baixar cópia anotada"}</button>
    </div>
    {annotating && <DrawingToolbar settings={settings} onSettings={setSettings} undo={history.undo} redo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo} onClear={() => history.commit([])} />}
    <div className="pdf-pages-scroll">
      {!pdf && !error && <div className="editor-loading"><LoaderCircle size={18} /> Preparando páginas…</div>}
      {error && <div className="pdf-empty"><strong>Não foi possível abrir este PDF</strong><small>{error}</small></div>}
      {pdf && Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} zoom={zoom} strokes={history.strokes} settings={settings} annotating={annotating} onCommit={history.commit} />)}
    </div>
  </div>;
}

function PdfPage({ pdf, pageNumber, zoom, strokes, settings, annotating, onCommit }: { pdf: PDFDocumentProxy; pageNumber: number; zoom: number; strokes: Stroke[]; settings: DrawSettings; annotating: boolean; onCommit: (strokes: Stroke[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => { let active = true; pdf.getPage(pageNumber).then((value) => { if (active) { setPage(value); const viewport = value.getViewport({ scale: 1 }); setRatio(viewport.width / viewport.height); } }); return () => { active = false; }; }, [pdf, pageNumber]);
  useEffect(() => {
    if (!page || !canvasRef.current) return; const canvas = canvasRef.current; const base = page.getViewport({ scale: 1 }); const cssWidth = Math.min(980 * zoom, window.innerWidth - 64); const scale = cssWidth / base.width; const viewport = page.getViewport({ scale: scale * Math.min(window.devicePixelRatio || 1, 2) });
    canvas.width = viewport.width; canvas.height = viewport.height; canvas.style.width = `${cssWidth}px`; canvas.style.height = `${cssWidth / ratio}px`;
    const context = canvas.getContext("2d"); if (!context) return; const task = page.render({ canvas, canvasContext: context, viewport }); return () => task.cancel();
  }, [page, ratio, zoom]);
  return <section className="pdf-page" style={{ width: `min(${980 * zoom}px, calc(100vw - 64px))`, aspectRatio: ratio }}><canvas ref={canvasRef} /><StrokeCanvas strokes={strokes} settings={settings} onCommit={onCommit} page={pageNumber} layer={DEFAULT_LAYER} enabled={annotating} /><span className="pdf-page-number">Página {pageNumber}</span></section>;
}

function hex(value: string) { const normalized = value.replace("#", ""); const full = normalized.length === 3 ? normalized.split("").map((part) => part + part).join("") : normalized; return { r: parseInt(full.slice(0, 2), 16) / 255, g: parseInt(full.slice(2, 4), 16) / 255, b: parseInt(full.slice(4, 6), 16) / 255 }; }
