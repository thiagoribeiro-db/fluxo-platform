/**
 * Helpers de construção de nodes/edges pras skills.
 *
 * Cada chamada gera IDs únicos via nanoid — sem state global. Isso permite
 * inserir a mesma skill múltiplas vezes no mesmo projeto sem colisão.
 *
 * Padrões respeitados (mesmos que helpers.ts + ai-builder):
 *  - Bubble bot tem 1 tracking child "_exibicao"
 *  - Menu tem 3 trackings (exibicao, selecao, inesperado)
 *  - User input tem 1 exceção child + tracking "_input" no anterior
 *  - Edges entre flow nodes são animated: true
 */
import { nanoid } from 'nanoid';
import type { Edge } from '@xyflow/react';
import type { FluxoNode } from '@/lib/types';
import { extractTrackingName } from '@/lib/components/nodes/helpers';

const TRK_X = -256; // tracking à esquerda do parent
const TRK_STEP_Y = 52; // espaçamento vertical de trackings empilhados

export class SkillBuilder {
  nodes: FluxoNode[] = [];
  edges: Edge[] = [];
  private lastFlowId: string | null = null;
  private prefix = '';
  private seq = 1;

  constructor(prefix = '') {
    this.prefix = prefix;
  }

  private uid(p: string) {
    return `${p}-${nanoid(6)}`;
  }

  private nextCode(): string | undefined {
    if (!this.prefix) return undefined;
    return `${this.prefix}${String(this.seq++).padStart(3, '0')}`;
  }

  /** Cria um frame container (opcional — algumas skills geram frame próprio). */
  frame(opts: {
    title: string;
    frameId: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }): string {
    const id = this.uid('frame');
    this.nodes.push({
      id,
      type: 'frame',
      position: { x: opts.x, y: opts.y },
      zIndex: 0,
      data: {
        title: opts.title,
        frameId: opts.frameId,
        prefix: this.prefix,
        code: this.prefix,
        width: opts.width ?? 800,
        height: opts.height ?? 700,
      },
    });
    return id;
  }

  bot(text: string, pos: { x: number; y: number }, connect = true): string {
    const id = this.uid('bot');
    this.nodes.push({
      id,
      type: 'bubble-bot',
      position: pos,
      zIndex: 1,
      data: { code: this.nextCode(), text },
    });
    // Tracking exibicao
    this.nodes.push({
      id: this.uid('trk'),
      type: 'tracking',
      parentId: id,
      position: { x: TRK_X, y: 0 },
      zIndex: 1,
      data: { label: `${extractTrackingName(text)} exibicao` },
    });
    if (connect && this.lastFlowId) {
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    this.lastFlowId = id;
    return id;
  }

  user(text: string, pos: { x: number; y: number }): string {
    const id = this.uid('user');
    this.nodes.push({
      id,
      type: 'bubble-user',
      position: pos,
      zIndex: 1,
      data: { code: this.nextCode(), text },
    });
    // Tracking _input no anterior
    if (this.lastFlowId) {
      const prev = this.nodes.find((n) => n.id === this.lastFlowId);
      if (prev && (prev.type === 'bubble-bot' || prev.type === 'menu')) {
        const prevText =
          (prev.data?.text as string | undefined) ??
          (prev.data?.header as string | undefined) ??
          '';
        const existing = this.nodes.filter(
          (n) => n.type === 'tracking' && n.parentId === prev.id
        ).length;
        this.nodes.push({
          id: this.uid('trk'),
          type: 'tracking',
          parentId: prev.id,
          position: { x: TRK_X, y: existing * TRK_STEP_Y },
          zIndex: 1,
          data: { label: `${extractTrackingName(prevText)} input` },
        });
      }
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    // Exceção como child
    this.nodes.push({
      id: this.uid('exc'),
      type: 'excecao',
      parentId: id,
      position: { x: 0, y: 140 },
      zIndex: 1,
      data: { label: 'Exceção / Fallback' },
    });
    this.lastFlowId = id;
    return id;
  }

  menu(
    header: string,
    options: string[],
    pos: { x: number; y: number },
    footer = 'Enviar'
  ): string {
    const id = this.uid('menu');
    this.nodes.push({
      id,
      type: 'menu',
      position: pos,
      zIndex: 1,
      data: { code: this.nextCode(), header, options, footer },
    });
    const name = extractTrackingName(header);
    ['exibicao', 'selecao', 'inesperado'].forEach((kind, i) => {
      this.nodes.push({
        id: this.uid('trk'),
        type: 'tracking',
        parentId: id,
        position: { x: TRK_X, y: i * TRK_STEP_Y },
        zIndex: 1,
        data: { label: `${name} ${kind}` },
      });
    });
    if (this.lastFlowId) {
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    this.lastFlowId = id;
    return id;
  }

  /** Direcionamento — pílula verde apontando pra outro frame. */
  direcionamento(
    label: string,
    targetFrameId: string,
    pos: { x: number; y: number },
    connectFromLast = true
  ): string {
    const id = this.uid('dir');
    this.nodes.push({
      id,
      type: 'direcionamento',
      position: pos,
      zIndex: 1,
      data: {
        label,
        targetFrameId,
        clickable: true,
        code: this.nextCode(),
      },
    });
    if (connectFromLast && this.lastFlowId) {
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    this.lastFlowId = id;
    return id;
  }

  condicional(
    condition: string,
    trueLabel: string,
    falseLabel: string,
    pos: { x: number; y: number },
    connectFromLast = true
  ): string {
    const id = this.uid('cond');
    this.nodes.push({
      id,
      type: 'condicional',
      position: pos,
      zIndex: 1,
      data: {
        code: this.nextCode(),
        condition,
        trueLabel,
        falseLabel,
      },
    });
    if (connectFromLast && this.lastFlowId) {
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    this.lastFlowId = id;
    return id;
  }

  /** Ponto de entrada (Início) — marca onde o fluxo do frame começa. */
  entryPoint(pos: { x: number; y: number }, label = 'Início'): string {
    const id = this.uid('entry');
    this.nodes.push({
      id,
      type: 'entry-point',
      position: pos,
      zIndex: 1,
      data: { label },
    });
    this.setLastFlowId(id);
    return id;
  }

  atendimentoHumano(label: string, pos: { x: number; y: number }, connectFromLast = true): string {
    const id = this.uid('atd');
    this.nodes.push({
      id,
      type: 'atendimento-humano',
      position: pos,
      zIndex: 1,
      data: { label },
    });
    if (connectFromLast && this.lastFlowId) {
      this.edges.push({
        id: this.uid('e'),
        source: this.lastFlowId,
        target: id,
        animated: true,
      });
    }
    this.lastFlowId = id;
    return id;
  }

  /** Setter manual do "último ID do fluxo" — usado quando o builder precisa
   * conectar de um ponto que não é necessariamente o último inserido (ex:
   * branches do condicional). */
  setLastFlowId(id: string | null) {
    this.lastFlowId = id;
  }

  getLastFlowId() {
    return this.lastFlowId;
  }

  /** Conecta source → target manualmente (pra branches que o flow normal
   * não cobre — ex: ambos os lados de um condicional). */
  connect(sourceId: string, targetId: string, opts?: { sourceHandle?: string }): void {
    this.edges.push({
      id: this.uid('e'),
      source: sourceId,
      target: targetId,
      sourceHandle: opts?.sourceHandle,
      animated: true,
    });
  }
}
