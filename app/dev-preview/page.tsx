'use client';

/**
 * Página DEV-ONLY pra testar o export visual sem precisar de auth/Supabase.
 *
 * Carrega o `tmp/state-snapshot.json` via `/api/dev/snapshot`, aplica o
 * pipeline padrão (repair edges + organize layout) e renderiza no
 * ReactFlow. Tem botão pra abrir o `ExportVisualDialog` igual ao editor
 * normal — útil pra eu iterar autonomamente em ajustes do PDF/PNG/HTML.
 */
import { useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  organizeLayoutByFrame,
  repairMainFlowEdges,
} from '@/lib/components/nodes/helpers';
import { nodeTypes } from '@/lib/components/nodes';
import type { FluxoNode } from '@/lib/types';
import ExportVisualDialog from '@/components/editor/ExportVisualDialog';

function DevPreviewInner() {
  const [nodes, setNodes] = useState<FluxoNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const { fitView } = useReactFlow();

  // Hook DEV: intercepta downloads e envia o blob pro server. Permite
  // o loop de auto-validação do PDF sem depender de download via browser.
  useEffect(() => {
    const w = window as unknown as {
      __DEV_INTERCEPT_DOWNLOAD__?: (url: string, filename: string) => Promise<void>;
      __DEV_LAST_SAVED?: string;
    };
    w.__DEV_INTERCEPT_DOWNLOAD__ = async (url: string, filename: string) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const fd = new FormData();
        fd.append('file', blob, filename);
        const r = await fetch('/api/dev/save-pdf', { method: 'POST', body: fd });
        const j = await r.json();
        w.__DEV_LAST_SAVED = JSON.stringify(j);
        // eslint-disable-next-line no-console
        console.log('[dev-preview] saved:', j);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[dev-preview] save failed:', e);
        w.__DEV_LAST_SAVED = JSON.stringify({ ok: false, error: String(e) });
      }
    };
    return () => {
      delete w.__DEV_INTERCEPT_DOWNLOAD__;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/snapshot');
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        const rawNodes: FluxoNode[] = data.state?.nodes ?? data.nodes ?? [];
        const rawEdges: Edge[] = data.state?.edges ?? data.edges ?? [];
        // Aplica pipeline padrão: repair + organize (sem getMeasured —
        // primeira passagem usa approx widths; reorganizamos após render).
        const cleanedEdges = repairMainFlowEdges(rawEdges, rawNodes);
        const organized = organizeLayoutByFrame(rawNodes, cleanedEdges);
        setNodes(organized);
        setEdges(cleanedEdges);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Após carregar, fit view e RE-organize com dimensões medidas reais
  useEffect(() => {
    if (loading || nodes.length === 0) return;
    const t = setTimeout(() => {
      // Re-organize com measured widths agora que o React Flow renderizou
      setNodes((prev) => organizeLayoutByFrame(prev, edges));
      fitView({ padding: 0.1, duration: 400 });
    }, 600);
    return () => clearTimeout(t);
  }, [loading, nodes.length, edges, fitView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Carregando snapshot…
      </div>
    );
  }
  if (err) {
    return (
      <div className="p-6 text-red-700">
        <h1 className="text-lg font-bold mb-2">Erro</h1>
        <pre className="bg-red-50 p-3 rounded text-xs">{err}</pre>
        <p className="text-xs text-gray-600 mt-2">
          Verifique se <code>fluxo-platform/tmp/state-snapshot.json</code>{' '}
          existe.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen">
      <div className="absolute top-2 left-2 z-50 flex gap-2 bg-white border border-gray-300 rounded shadow px-2 py-1.5 text-xs">
        <span className="font-bold text-gray-700">🧪 DEV PREVIEW</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">
          {nodes.length} nodes · {edges.length} edges
        </span>
        <span className="text-gray-400">|</span>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="text-blip-purple font-medium hover:underline"
        >
          📷 Exportar imagem
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.05}
      >
        <Background gap={20} />
      </ReactFlow>
      {exportOpen && (
        <ExportVisualDialog
          projectName="dev-preview"
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

export default function DevPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="p-6 text-gray-700">
        Esta rota é apenas para desenvolvimento.
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <DevPreviewInner />
    </ReactFlowProvider>
  );
}
