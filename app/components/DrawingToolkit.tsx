"use client";

import { Brush, ChevronDown, ChevronUp, Eye, EyeOff, Eraser, Highlighter, Layers3, Lock, PenLine, Pencil, Plus, Redo2, Trash2, Undo2, Unlock } from "lucide-react";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { DrawingLayer, DrawTool, Stroke } from "../lib/types";

export type ActiveDrawTool = DrawTool | "eraser";
export type DrawSettings = { tool: ActiveDrawTool; color: string; width: number; opacity: number };

export const DEFAULT_LAYER: DrawingLayer = { id: "base", name: "Camada 1", visible: true, locked: false, opacity: 1 };

export function useStrokeHistory(initial: Stroke[], onChange: (strokes: Stroke[]) => void) {
  const [strokes, setStrokes] = useState(initial);
  const [past, setPast] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);
  const commit = useCallback((next: Stroke[]) => {
    setStrokes((current) => { setPast((items) => [...items.slice(-79), current]); return next; });
    setFuture([]); onChange(next);
  }, [onChange]);
  const undo = useCallback(() => setPast((items) => {
    const previous = items.at(-1); if (!previous) return items;
    setStrokes((current) => { setFuture((next) => [current, ...next].slice(0, 80)); return previous; }); onChange(previous); return items.slice(0, -1);
  }), [onChange]);
  const redo = useCallback(() => setFuture((items) => {
    const next = items[0]; if (!next) return items;
    setStrokes((current) => { setPast((previous) => [...previous, current].slice(-80)); return next; }); onChange(next); return items.slice(1);
  }), [onChange]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault(); if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [redo, undo]);
  return { strokes, commit, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

export function DrawingToolbar({ settings, onSettings, undo, redo, canUndo, canRedo, onClear, compact = false }: {
  settings: DrawSettings; onSettings: (settings: DrawSettings) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean; onClear: () => void; compact?: boolean;
}) {
  const tools: Array<[ActiveDrawTool, React.ReactNode, string]> = [
    ["pencil", <Pencil key="pencil" size={16} />, "Lápis"], ["pen", <PenLine key="pen" size={16} />, "Caneta"], ["marker", <Brush key="marker" size={16} />, "Marcador"], ["highlighter", <Highlighter key="highlighter" size={16} />, "Marca-texto"], ["eraser", <Eraser key="eraser" size={16} />, "Borracha"],
  ];
  const choose = (tool: ActiveDrawTool) => {
    const defaults = tool === "pencil" ? { width: 2, opacity: .72 } : tool === "pen" ? { width: 3, opacity: .95 } : tool === "marker" ? { width: 7, opacity: .82 } : tool === "highlighter" ? { width: 18, opacity: .3 } : { width: settings.width, opacity: settings.opacity };
    onSettings({ ...settings, tool, ...defaults });
  };
  return <div className={"drawing-toolbar " + (compact ? "compact" : "")} onPointerDown={(event) => event.stopPropagation()}>
    <div className="drawing-tool-group">{tools.map(([tool, icon, label]) => <button key={tool} className={settings.tool === tool ? "active" : ""} title={label} aria-label={label} onClick={() => choose(tool)}>{icon}<small>{compact ? "" : label}</small></button>)}</div>
    <span className="ribbon-divider" />
    <div className="drawing-colors">{["#282721", "#7164ad", "#d15f48", "#2c8869", "#e4bd35", "#2673c9"].map((color) => <button key={color} title={color} className={settings.color === color ? "selected" : ""} style={{ background: color }} onClick={() => onSettings({ ...settings, color })} />)}</div>
    {!compact && <label className="stroke-size">Traço <input type="range" min="1" max="24" value={settings.width} onChange={(event) => onSettings({ ...settings, width: Number(event.target.value) })} /><span>{settings.width}</span></label>}
    <span className="ribbon-divider" />
    <button title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button><button title="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button><button title="Limpar camada" onClick={onClear}><Trash2 size={16} /></button>
  </div>;
}

export function StrokeCanvas({ strokes, settings, onCommit, page, layer, layers = [DEFAULT_LAYER], enabled = true, className = "" }: {
  strokes: Stroke[]; settings: DrawSettings; onCommit: (strokes: Stroke[]) => void; page?: number; layer?: DrawingLayer; layers?: DrawingLayer[]; enabled?: boolean; className?: string;
}) {
  const [active, setActive] = useState<Stroke | null>(null);
  const erased = useRef<Set<string>>(new Set());
  const point = (event: PointerEvent<HTMLDivElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }; };
  const scoped = (stroke: Stroke) => (page == null || stroke.page === page) && layers.find((item) => item.id === (stroke.layerId ?? "base"))?.visible !== false;
  function eraseAt(p: { x: number; y: number }) {
    const hits = strokes.filter((stroke) => scoped(stroke) && stroke.points.some((item) => Math.hypot(item.x - p.x, item.y - p.y) < Math.max(1.25, stroke.width / 8)));
    if (!hits.length) return;
    hits.forEach((stroke) => erased.current.add(stroke.id ?? strokes.indexOf(stroke).toString()));
    onCommit(strokes.filter((stroke, index) => !erased.current.has(stroke.id ?? index.toString())));
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || layer?.locked) return; event.currentTarget.setPointerCapture(event.pointerId); const p = point(event);
    if (settings.tool === "eraser") { erased.current = new Set(); eraseAt(p); return; }
    setActive({ id: crypto.randomUUID(), color: settings.color, width: settings.width, opacity: settings.opacity, tool: settings.tool, page, layerId: layer?.id ?? "base", points: [p] });
  }
  function move(event: PointerEvent<HTMLDivElement>) { if (!enabled) return; const p = point(event); if (settings.tool === "eraser") { if (event.buttons) eraseAt(p); return; } setActive((stroke) => stroke ? { ...stroke, points: [...stroke.points, p] } : null); }
  function end() { if (active) onCommit([...strokes, active]); setActive(null); erased.current.clear(); }
  const shown = [...strokes.filter(scoped), ...(active ? [active] : [])];
  return <div className={"stroke-canvas " + className + (enabled ? " enabled" : "")} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">{shown.map((stroke, index) => { const layerOpacity = layers.find((item) => item.id === (stroke.layerId ?? "base"))?.opacity ?? 1; return <polyline key={stroke.id ?? index} points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width / 10} strokeLinecap="round" strokeLinejoin="round" opacity={(stroke.opacity ?? .92) * layerOpacity} />; })}</svg>
  </div>;
}

export function LayersPanel({ layers, activeId, onActive, onChange }: { layers: DrawingLayer[]; activeId: string; onActive: (id: string) => void; onChange: (layers: DrawingLayer[]) => void }) {
  const update = (id: string, patch: Partial<DrawingLayer>) => onChange(layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  const move = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= layers.length) return; const next = [...layers]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); };
  return <aside className="layers-panel"><header><span><Layers3 size={16} /> Camadas</span><button title="Nova camada" onClick={() => { const layer = { ...DEFAULT_LAYER, id: crypto.randomUUID(), name: `Camada ${layers.length + 1}` }; onChange([...layers, layer]); onActive(layer.id); }}><Plus size={16} /></button></header>
    <div className="layers-list">{[...layers].reverse().map((layer) => { const index = layers.findIndex((item) => item.id === layer.id); return <div key={layer.id} role="button" tabIndex={0} className={activeId === layer.id ? "active" : ""} onClick={() => onActive(layer.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onActive(layer.id); }}><button title={layer.visible ? "Ocultar" : "Mostrar"} onClick={(event) => { event.stopPropagation(); update(layer.id, { visible: !layer.visible }); }}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><input value={layer.name} onClick={(event) => event.stopPropagation()} onChange={(event) => update(layer.id, { name: event.target.value })} /><button title={layer.locked ? "Desbloquear" : "Bloquear"} onClick={(event) => { event.stopPropagation(); update(layer.id, { locked: !layer.locked }); }}>{layer.locked ? <Lock size={13} /> : <Unlock size={13} />}</button><button onClick={(event) => { event.stopPropagation(); move(index, 1); }}><ChevronUp size={13} /></button><button onClick={(event) => { event.stopPropagation(); move(index, -1); }}><ChevronDown size={13} /></button>{layers.length > 1 && <button title="Excluir camada" onClick={(event) => { event.stopPropagation(); onChange(layers.filter((item) => item.id !== layer.id)); if (activeId === layer.id) onActive(layers.find((item) => item.id !== layer.id)!.id); }}><Trash2 size={13} /></button>}</div>; })}</div>
  </aside>;
}
