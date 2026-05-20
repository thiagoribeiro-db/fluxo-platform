/**
 * Exportador: ProjectState do Fluxo Platform → BlipFlow (JSON Blip).
 *
 * **Pipeline** (por frame):
 *  1. Coleta os "main nodes" dentro do frame, ordenados por Y.
 *  2. Funde nodes auxiliares no main anterior:
 *     - bubble-user → muda input.bypass do bot anterior pra false + adiciona _input tracking
 *     - btn-short[] após um bubble-bot → vira select-immediate no state do bot
 *     - mídia/link após um bubble-bot → vira SendMessage extra no mesmo state
 *  3. Mapeia cada main "non-fused" pra um BlipState:
 *     - bubble-bot → state com text/plain
 *     - menu → state com SendRawMessage + 4 scripts
 *     - direcionamento → state Redirect
 *     - condicional → state com ExecuteScript placeholder + 2 conditionOutputs
 *     - atendimento-humano → state Redirect pra "transbordo"
 *  4. Conecta states via $conditionOutputs / $defaultOutput, usando as edges.
 *  5. Adiciona onboarding/fallback/error padrão.
 *  6. Se isMainFrame, injeta Requirements + Redirect-To-Services e ajusta as
 *     conexões pra ele virar o entry point do bot.
 */

import type { Edge } from '@xyflow/react';
import type { FluxoNode, FluxoNodeType } from '@/lib/types';
import { extractTrackingName } from '@/lib/components/nodes/helpers';
import type {
  BlipContentAction,
  BlipConditionOutput,
  BlipCustomAction,
  BlipFlow,
  BlipState,
} from './blip-types';
import {
  chatStateAction,
  createConnIdGenerator,
  createGlobalActions,
  createState,
  equalsOutput,
  existsOutput,
  executeScriptAction,
  inputAction,
  matchesAllOutput,
  mediaMessageAction,
  optionMatchesLabel,
  redirectAction,
  redirectTag,
  selectImmediateAction,
  sendRawMessageAction,
  textMessageAction,
  toBlipAddress,
  toBlipPosition,
  trackEventAction,
  uuid,
  webLinkMessageAction,
} from './blip-helpers';
import {
  createRedirectToServicesState,
  createRequirementsState,
  createSkeletonStates,
  HARDCODED_WELCOME_CHATSTATE_ID,
  HARDCODED_WELCOME_TEXT_ID,
  HOLIDAY_SCRIPT_SOURCE,
  HORARIO_ATENDIMENTO_SCRIPT_SOURCE,
  inputOptionJsSource,
  OBJ_MENU_SOURCE,
  processUserContextSource,
  VALID_INPUT_JS_SOURCE,
} from './blip-templates';

// =============================================================================
// PUBLIC API
// =============================================================================

export interface ExportFrameOptions {
  isMainFrame: boolean;
  /** Address do frame principal (originBot var no Requirements). Usado só se isMainFrame. */
  mainFrameAddress?: string;
}

export interface ExportFrameResult {
  filename: string;
  flow: BlipFlow;
  warnings: string[];
}

export function exportFrameToBlip(
  frame: FluxoNode,
  allNodes: FluxoNode[],
  allEdges: Edge[],
  opts: ExportFrameOptions
): ExportFrameResult {
  const warnings: string[] = [];
  const frameAddress = toBlipAddress(
    (frame.data?.frameId as string | undefined) ??
      (frame.data?.title as string | undefined) ??
      'frame'
  );
  const filename = `fluxoplatform${frameAddress.toLowerCase()}.json`;
  const ctx = new BuildContext(frame, allNodes, allEdges, warnings);
  const states = ctx.build(opts);
  return {
    filename,
    flow: { flow: states, globalActions: createGlobalActions() },
    warnings,
  };
}

// =============================================================================
// BUILD CONTEXT — mantém estado durante a construção de um frame
// =============================================================================

class BuildContext {
  states: Record<string, BlipState> = {};
  connId: () => string;
  /** Mapeamento Fluxo node id → Blip state id. Resolve referências cruzadas. */
  blipIdByNodeId: Map<string, string> = new Map();
  frameOrigin: { x: number; y: number };
  /** bubble-bot ids absorvidos por menu — não viram state próprio. */
  private absorbedByMenu = new Set<string>();
  /** Override de texto pro `SendMessage text/plain` do menu (vem do bubble-bot absorvido). */
  private menuTextOverride = new Map<string, string>();

  constructor(
    public frame: FluxoNode,
    public allNodes: FluxoNode[],
    public allEdges: Edge[],
    public warnings: string[]
  ) {
    this.connId = createConnIdGenerator();
    this.frameOrigin = { x: frame.position.x, y: frame.position.y };
  }

  pushWarning(msg: string) {
    this.warnings.push(msg);
  }

  build(opts: ExportFrameOptions): Record<string, BlipState> {
    // 1. Coleta + ordena mains do frame
    const mains = this.collectFrameMains();

    if (mains.length === 0) {
      this.pushWarning(`Frame "${this.frame.data?.title}" não tem nenhum main node — gerando esqueleto vazio.`);
      // Mesmo vazio, retorna esqueleto mínimo (onboarding → fallback)
      const skel = createSkeletonStates('fallback', this.connId);
      return { onboarding: skel.onboarding, fallback: skel.fallback, error: skel.error };
    }

    // 1.5. Detecta pares (bubble-bot → menu) consecutivos pra ABSORVER o bot
    //      no menu (texto do bot vira o SendMessage de "Escolha uma opção…").
    //      Sem isso, a frase apareceria 2x no preview Blip.
    this.detectBotMenuFusion(mains);

    // 2. Agrupa: identifica "lider" e "fundidos"
    const groups = this.groupMains(mains);

    // 3. Pré-aloca blip state ids pra cada grupo (precisamos pra refs cruzadas)
    groups.forEach((g, idx) => {
      const blipId = idx === 0 ? 'welcome' : uuid();
      this.blipIdByNodeId.set(g.lead.id, blipId);
      // Fundidos pegam o mesmo blipId do lead (referências apontam pro mesmo state)
      g.fused.forEach((n) => this.blipIdByNodeId.set(n.id, blipId));
    });

    // 4. Constroi state pra cada grupo
    groups.forEach((g, idx) => {
      const blipId = this.blipIdByNodeId.get(g.lead.id)!;
      const nextLead = groups[idx + 1]?.lead;
      const nextBlipId = nextLead ? this.blipIdByNodeId.get(nextLead.id) : undefined;
      const state = this.buildStateForGroup(g, blipId, nextBlipId);
      this.states[blipId] = state;
    });

    // 5. Onboarding / fallback / error
    const firstBlipId = this.blipIdByNodeId.get(groups[0].lead.id)!;
    const skel = createSkeletonStates(firstBlipId, this.connId);
    this.states['onboarding'] = skel.onboarding;
    this.states['fallback'] = skel.fallback;
    this.states['error'] = skel.error;

    // 6. Main frame extras
    if (opts.isMainFrame) {
      this.injectMainFrameSetup(opts.mainFrameAddress ?? 'saudacao', firstBlipId);
    }

    return this.states;
  }

  // ---------------------------------------------------------------------------
  // FRAME MAINS COLLECTION
  // ---------------------------------------------------------------------------

  /** Mains do frame: nodes que entram no fluxo principal, ordenados por Y. */
  private collectFrameMains(): FluxoNode[] {
    const FRAME_MAIN_TYPES = new Set<FluxoNodeType>([
      'bubble-bot',
      'bubble-user',
      'menu',
      'midia-imagem-bot',
      'midia-imagem-user',
      'midia-documento-bot',
      'midia-documento-user',
      'midia-video-bot',
      'midia-video-user',
      'link',
      'btn-short',
      'btn-long',
      'direcionamento',
      'condicional',
      'atendimento-humano',
      'integracao-api',
      'integracao-planilha',
      'iag-entrada',
      'iag-reentrada',
      'iag-saida',
    ]);
    const fbox = this.frameBox();
    const raw = this.allNodes
      .filter((n) => {
        if (!n.type || !FRAME_MAIN_TYPES.has(n.type as FluxoNodeType)) return false;
        if (n.parentId) return false; // tracking/excecao são children
        const cx = n.position.x + 100;
        const cy = n.position.y + 30;
        return (
          cx >= fbox.x &&
          cx <= fbox.x + fbox.w &&
          cy >= fbox.y &&
          cy <= fbox.y + fbox.h
        );
      })
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    // Filtra direcionamentos ABSORVIDOS por algum menu deste frame.
    // Quando um menu lista WhatsApp tem options que casam com labels de
    // direcionamentos, esses direcionamentos viram entradas no script
    // `process userContext` e o roteamento é feito pelo Redirect-To-Services
    // (que usa `{{userContext@destinationBot}}`). Gerar states de Redirect
    // independentes pra cada um seria redundante e POLUIRIA o fluxo Blip.
    const absorbed = this.identifyAbsorbedDirecionamentos(raw);
    if (absorbed.size > 0) {
      const skipped = raw.filter((n) => absorbed.has(n.id));
      this.pushWarning(
        `${skipped.length} direcionamento(s) absorvido(s) pelo menu via process userContext (não viram states Redirect próprios): ${skipped
          .map((n) => (n.data?.label as string | undefined) ?? n.id)
          .join(', ')}.`
      );
    }
    return raw.filter((n) => !absorbed.has(n.id));
  }

  /**
   * Detecta pares (bubble-bot → menu) consecutivos. O bubble-bot é absorvido
   * pelo menu: seu texto vira o "header bubble" do state do menu, e o bot
   * em si não vira state próprio (senão a frase aparece 2x no preview Blip).
   *
   * Trackings do bot absorvido são DESCARTADOS — o menu já tem o seu próprio
   * `_exibicao`. Adiciona warning pra cada par detectado.
   */
  private detectBotMenuFusion(mains: FluxoNode[]): void {
    for (let i = 1; i < mains.length; i++) {
      const cur = mains[i];
      const prev = mains[i - 1];
      if (cur.type !== 'menu') continue;
      if (prev.type !== 'bubble-bot') continue;
      // bot e menu consecutivos em mains (sem nada entre eles em Y) → fundir
      const botText = (prev.data?.text as string | undefined) ?? '';
      if (!botText.trim()) continue; // bot sem texto, não vale fundir
      this.absorbedByMenu.add(prev.id);
      this.menuTextOverride.set(cur.id, botText);
      const botCode = (prev.data?.code as string | undefined) ?? prev.id;
      const menuCode = (cur.data?.code as string | undefined) ?? cur.id;
      this.pushWarning(
        `bubble-bot ${botCode} ("${botText.slice(0, 40)}${botText.length > 40 ? '…' : ''}") absorvido pelo menu ${menuCode} — texto vira o header do menu state.`
      );
    }
  }

  /** Identifica direcionamentos que serão "absorvidos" pelo script process
   * userContext de algum menu — esses NÃO viram states próprios. */
  private identifyAbsorbedDirecionamentos(mains: FluxoNode[]): Set<string> {
    const absorbed = new Set<string>();
    const menus = mains.filter((n) => n.type === 'menu');
    if (menus.length === 0) return absorbed;
    const direcs = mains.filter(
      (n) => n.type === 'direcionamento' && !n.parentId
    );
    for (const menu of menus) {
      const opts = ((menu.data?.options as string[] | undefined) ?? []).filter(
        Boolean
      );
      for (const opt of opts) {
        const dir = direcs.find((d) =>
          optionMatchesLabel(opt, (d.data?.label as string | undefined) ?? '')
        );
        if (dir) absorbed.add(dir.id);
      }
    }
    return absorbed;
  }

  private frameBox(): { x: number; y: number; w: number; h: number } {
    const w = (this.frame.data?.width as number | undefined) ?? 656;
    const h = (this.frame.data?.height as number | undefined) ?? 800;
    return { x: this.frame.position.x, y: this.frame.position.y, w, h };
  }

  // ---------------------------------------------------------------------------
  // GROUPING (lead + fused)
  // ---------------------------------------------------------------------------

  private groupMains(mains: FluxoNode[]): MainGroup[] {
    const groups: MainGroup[] = [];
    let i = 0;
    while (i < mains.length) {
      const lead = mains[i];
      // bubble-user só faz sentido fundido em um bubble-bot/menu ANTERIOR.
      // Se aparece como "lead" (= não foi fundido em nada), é um placeholder
      // visual órfão (ex: "Resposta do usuário" desconectado) — ignoramos.
      if (lead.type === 'bubble-user') {
        this.pushWarning(
          `bubble-user "${lead.id}" sem bubble-bot/menu anterior pra fundir — ignorado (placeholder visual).`
        );
        i++;
        continue;
      }
      // bubble-bot absorvido por menu (detectBotMenuFusion) — pula
      if (this.absorbedByMenu.has(lead.id)) {
        i++;
        continue;
      }
      const group: MainGroup = { lead, fused: [], btnShorts: [] };
      i++;
      // Tipos auxiliares fundidos no lead atual:
      while (i < mains.length) {
        const n = mains[i];
        if (this.shouldFuse(lead, n)) {
          if (n.type === 'btn-short') {
            group.btnShorts.push(n);
          } else {
            group.fused.push(n);
          }
          i++;
        } else {
          break;
        }
      }
      groups.push(group);
    }
    return groups;
  }

  private shouldFuse(lead: FluxoNode, candidate: FluxoNode): boolean {
    const leadType = lead.type;
    const candType = candidate.type;
    if (!leadType || !candType) return false;
    // bubble-user: fundir no bot anterior (vira input bypass=false do bot)
    if (candType === 'bubble-user') {
      return leadType === 'bubble-bot' || leadType === 'menu';
    }
    // btn-short / btn-long: fundir no bot anterior (select-immediate)
    if (candType === 'btn-short' || candType === 'btn-long') {
      return leadType === 'bubble-bot' || leadType === 'menu';
    }
    // mídia bot: fundir no bot anterior
    if (candType.startsWith('midia-') && candType.endsWith('-bot')) {
      return leadType === 'bubble-bot';
    }
    // link: fundir no bot anterior
    if (candType === 'link') {
      return leadType === 'bubble-bot';
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // STATE BUILDER (DISPATCHER POR TIPO DE LEAD)
  // ---------------------------------------------------------------------------

  private buildStateForGroup(
    g: MainGroup,
    blipId: string,
    nextBlipId: string | undefined
  ): BlipState {
    const lead = g.lead;
    switch (lead.type) {
      case 'bubble-bot':
        return this.buildBubbleBotState(g, blipId, nextBlipId);
      case 'menu':
        return this.buildMenuState(g, blipId);
      case 'direcionamento':
        return this.buildDirecionamentoState(g, blipId);
      case 'condicional':
        return this.buildCondicionalState(g, blipId);
      case 'atendimento-humano':
        return this.buildAtendimentoHumanoState(g, blipId);
      case 'link':
        return this.buildLinkOnlyState(g, blipId, nextBlipId);
      default:
        // Fallback genérico — gera state vazio com warning
        this.pushWarning(
          `Tipo "${lead.type}" sem handler de export — state placeholder gerado pra ${lead.id}.`
        );
        return this.buildFallbackState(g, blipId, nextBlipId);
    }
  }

  // ---------- bubble-bot (+ btn-shorts fundidos → select-immediate)
  private buildBubbleBotState(
    g: MainGroup,
    blipId: string,
    nextBlipId: string | undefined
  ): BlipState {
    const lead = g.lead;
    const text = (lead.data?.text as string | undefined) ?? '';
    const isWelcomeId = blipId === 'welcome';
    const code = (lead.data?.code as string | undefined) ?? '';

    const state = createState({
      id: blipId,
      title: code || (isWelcomeId ? 'S001' : 'Bloco'),
      position: toBlipPosition(lead.position, this.frameOrigin),
    });

    // ----- Tem btn-shorts? Vira select-immediate
    if (g.btnShorts.length > 0) {
      const opts = g.btnShorts.map(
        (b) => (b.data?.label as string | undefined) ?? 'Opção'
      );
      // 1 chat-state composing + 1 select-immediate (texto + botões) + input bypass=false
      state.$contentActions = [
        chatStateAction(isWelcomeId ? HARDCODED_WELCOME_CHATSTATE_ID : undefined),
        selectImmediateAction({ text, options: opts }).action,
        inputAction(false),
      ];
      // contentId pra ligar conditions ao select
      const selectId = (
        (state.$contentActions[1] as Extract<BlipContentAction, { action: unknown }>).action
          .settings as { id: string }
      ).id;
      state.$inputSuggestions = opts;

      // Pra cada btn-short: descobre o target (próximo node via edge outgoing)
      g.btnShorts.forEach((btn) => {
        const label = (btn.data?.label as string | undefined) ?? 'Opção';
        const target = this.findEdgeTarget(btn.id);
        if (!target) {
          this.pushWarning(
            `btn-short "${label}" sem target — usando fallback como destino.`
          );
          state.$conditionOutputs.push(
            equalsOutput('fallback', this.connId(), label, selectId)
          );
          return;
        }
        // Target pode ser um main do mesmo frame OU um direcionamento
        const targetBlipId = this.resolveBlipIdForNode(target);
        state.$conditionOutputs.push(
          equalsOutput(targetBlipId, this.connId(), label, selectId)
        );
      });

      // Trackings: _exibicao no entering, _selecao no leaving
      const trackings = this.findChildTrackings(lead.id);
      state.$enteringCustomActions.push(
        ...this.trackingsToActions(trackings, ['exibicao'])
      );
      state.$leavingCustomActions.push(
        ...this.trackingsToActions(trackings, ['selecao'], true)
      );

      return state;
    }

    // ----- Sem btn-shorts: bubble-bot puro + possíveis mídias fundidas + bubble-user fundido?
    const contentActions: BlipContentAction[] = [
      chatStateAction(isWelcomeId ? HARDCODED_WELCOME_CHATSTATE_ID : undefined),
      textMessageAction(text, isWelcomeId ? HARDCODED_WELCOME_TEXT_ID : undefined),
    ];

    // Mídias fundidas (cada uma vira chat-state + SendMessage media)
    for (const fused of g.fused) {
      if (fused.type?.startsWith('midia-') && fused.type.endsWith('-bot')) {
        contentActions.push(chatStateAction());
        contentActions.push(this.mediaActionFromNode(fused));
      } else if (fused.type === 'link') {
        contentActions.push(chatStateAction());
        contentActions.push(this.webLinkActionFromNode(fused));
      }
    }

    // Há bubble-user fundido? Então input bypass=false
    const hasBubbleUser = g.fused.some((f) => f.type === 'bubble-user');
    contentActions.push(inputAction(hasBubbleUser ? false : true));
    state.$contentActions = contentActions;

    // Output: vai pro próximo via "exists"
    if (nextBlipId) {
      state.$conditionOutputs = [existsOutput(nextBlipId, this.connId())];
    }

    // Trackings: _exibicao no entering
    const trackings = this.findChildTrackings(lead.id);
    state.$enteringCustomActions.push(
      ...this.trackingsToActions(trackings, ['exibicao'])
    );

    // Se tem bubble-user fundido: _input no leaving
    if (hasBubbleUser) {
      state.$leavingCustomActions.push(
        ...this.trackingsToActions(trackings, ['input'], true)
      );
      // Exceção do bubble-user → conditionOutput extra "matches .*" pro fallback
      const bUser = g.fused.find((f) => f.type === 'bubble-user');
      if (bUser) {
        const hasExc = this.allNodes.some(
          (n) => n.type === 'excecao' && n.parentId === bUser.id
        );
        if (hasExc) {
          state.$conditionOutputs.push(matchesAllOutput('fallback', this.connId()));
        }
      }
    }

    return state;
  }

  // ---------- menu (lista WhatsApp com 4 scripts)
  private buildMenuState(g: MainGroup, blipId: string): BlipState {
    const lead = g.lead;
    const header = (lead.data?.header as string | undefined) ?? 'Selecione uma opção';
    const options = ((lead.data?.options as string[] | undefined) ?? []).filter(Boolean);
    const code = (lead.data?.code as string | undefined) ?? '';

    const state = createState({
      id: blipId,
      title: code || 'Menu',
      position: toBlipPosition(lead.position, this.frameOrigin),
    });

    // Se um bubble-bot anterior foi absorvido (detectBotMenuFusion), seu
    // texto vira o "header" do menu (substitui o "Escolha uma opção abaixo:"
    // hardcoded). Caso contrário, usa o default.
    const menuHeaderText =
      this.menuTextOverride.get(lead.id) ?? 'Escolha uma opção abaixo:';

    state.$contentActions = [
      chatStateAction(),
      textMessageAction(menuHeaderText),
      chatStateAction(),
      sendRawMessageAction(),
      inputAction(false),
    ];

    // Mapeamento opção → destinationBot (auto via direcionamentos sucessores)
    const optionMap = this.deriveMenuOptionMap(lead, options);
    if (Object.keys(optionMap).length === 0 && options.length > 0) {
      this.pushWarning(
        `Menu "${header}" sem mapeamento de opções → destino. Geramos placeholder, mas você precisa preencher no script process userContext na Blip.`
      );
    }

    // Scripts entering
    state.$enteringCustomActions = [
      executeScriptAction({
        title: 'inputOptionJs',
        source: inputOptionJsSource({ text: `Selecione a loja:`, options }),
        inputVariables: [],
        outputVariable: 'inputOptionJs',
      }),
      executeScriptAction({
        title: 'objMenu',
        source: OBJ_MENU_SOURCE,
        inputVariables: ['platform', 'inputOptionJs'],
        outputVariable: 'objMenu',
      }),
    ];

    // Tracking _exibicao entering
    const trackings = this.findChildTrackings(lead.id);
    state.$enteringCustomActions.push(
      ...this.trackingsToActions(trackings, ['exibicao'])
    );

    // Scripts leaving
    state.$leavingCustomActions = [
      executeScriptAction({
        title: 'validInputJs',
        source: VALID_INPUT_JS_SOURCE,
        inputVariables: ['input.content', 'input.type', 'platform', 'inputOptionJs'],
        outputVariable: 'validInputJs',
      }),
      executeScriptAction({
        title: "process 'userContext'",
        source: processUserContextSource(optionMap),
        inputVariables: ['validInputJs', 'originBot', 'state.id'],
        outputVariable: 'userContext',
      }),
      ...this.trackingsToActions(trackings, ['selecao', 'inesperado'], true),
    ];

    // Output: vai pro próximo (que tipicamente é Redirect-To-Services no frame principal,
    // ou um direcionamento solto em frames internos)
    // Pra menu, conectamos via "exists" pro próximo lead — quem for.
    // Se for o frame principal, o Redirect-To-Services será injetado depois e
    // ajustaremos a conexão lá.
    state.$conditionOutputs = []; // será preenchido em postprocess
    state.$defaultOutput = { stateId: 'fallback', $invalid: false };

    // Marca pra processar depois (precisa do Redirect-To-Services id se main)
    (state as BlipState & { __pendingMenuConnection?: boolean }).__pendingMenuConnection = true;

    return state;
  }

  // ---------- direcionamento (state Redirect)
  private buildDirecionamentoState(g: MainGroup, blipId: string): BlipState {
    const lead = g.lead;
    const label = (lead.data?.label as string | undefined) ?? 'Direcionamento';
    const code = (lead.data?.code as string | undefined) ?? '';
    const targetFrameId =
      (lead.data?.targetFrameId as string | undefined) ?? '';
    const address = targetFrameId
      ? toBlipAddress(targetFrameId)
      : 'fallback';
    if (!targetFrameId) {
      this.pushWarning(
        `Direcionamento "${label}" sem targetFrameId — usando "fallback" como address. Configure na Blip.`
      );
    }
    const state = createState({
      id: blipId,
      title: code ? `${code} - Redirect - ${label}` : `Redirect - ${label}`,
      position: toBlipPosition(lead.position, this.frameOrigin),
    });
    state.$contentActions = [inputAction(true)];
    state.$leavingCustomActions = [
      redirectAction({ contextValue: 'oi', address }),
    ];
    state.$tags = [redirectTag()];
    return state;
  }

  // ---------- condicional (ExecuteScript + 2 conditionOutputs)
  private buildCondicionalState(g: MainGroup, blipId: string): BlipState {
    const lead = g.lead;
    const condition = (lead.data?.condition as string | undefined) ?? 'TODO: descrever condição';
    const trueLabel = (lead.data?.trueLabel as string | undefined) ?? 'Verdadeiro';
    const falseLabel = (lead.data?.falseLabel as string | undefined) ?? 'Falso';
    const varName = `cond_${blipId.slice(0, 8)}`;

    const state = createState({
      id: blipId,
      title: `Condicional: ${condition}`,
      position: toBlipPosition(lead.position, this.frameOrigin),
    });
    state.$contentActions = [inputAction(true)];
    state.$enteringCustomActions = [
      executeScriptAction({
        title: 'Executar script',
        source: `function run() {
    // TODO: implementar regra para "${condition}"
    // Retornar true para "${trueLabel}" ou false para "${falseLabel}"
    return true;
}`,
        inputVariables: [],
        outputVariable: varName,
      }),
    ];

    // Targets V/F: pegar pelos edges com sourceHandle "true"/"false"
    const trueTarget = this.findEdgeTarget(lead.id, 'true');
    const falseTarget = this.findEdgeTarget(lead.id, 'false');

    const pushCondOutput = (
      target: FluxoNode | null,
      value: 'true' | 'false',
      fallbackLabel: string
    ) => {
      if (!target) {
        this.pushWarning(
          `Condicional "${condition}" sem destino para ${fallbackLabel} — usando fallback.`
        );
        state.$conditionOutputs.push({
          stateId: 'fallback',
          typeOfStateId: 'state',
          $connId: this.connId(),
          $id: uuid(),
          conditions: [
            { source: 'context', comparison: 'equals', variable: varName, values: [value] },
          ],
          $invalid: false,
        });
        return;
      }
      const targetId = this.resolveBlipIdForNode(target);
      state.$conditionOutputs.push({
        stateId: targetId,
        typeOfStateId: 'state',
        $connId: this.connId(),
        $id: uuid(),
        conditions: [
          { source: 'context', comparison: 'equals', variable: varName, values: [value] },
        ],
        $isBuilderDefaultOutput: true,
        $invalid: false,
      });
    };

    pushCondOutput(trueTarget, 'true', trueLabel);
    pushCondOutput(falseTarget, 'false', falseLabel);

    return state;
  }

  // ---------- atendimento-humano (Redirect pro transbordo)
  private buildAtendimentoHumanoState(g: MainGroup, blipId: string): BlipState {
    const lead = g.lead;
    const label = (lead.data?.label as string | undefined) ?? 'Atendimento humano';
    const state = createState({
      id: blipId,
      title: `Atend. humano - ${label}`,
      position: toBlipPosition(lead.position, this.frameOrigin),
    });
    state.$contentActions = [inputAction(true)];
    state.$leavingCustomActions = [
      redirectAction({ contextValue: 'oi', address: 'transbordo' }),
    ];
    state.$tags = [redirectTag()];
    return state;
  }

  // ---------- link standalone (raro — geralmente fica fundido no bot)
  private buildLinkOnlyState(
    g: MainGroup,
    blipId: string,
    nextBlipId: string | undefined
  ): BlipState {
    const state = createState({
      id: blipId,
      title: 'Link',
      position: toBlipPosition(g.lead.position, this.frameOrigin),
    });
    state.$contentActions = [
      chatStateAction(),
      this.webLinkActionFromNode(g.lead),
      inputAction(true),
    ];
    if (nextBlipId) {
      state.$conditionOutputs = [existsOutput(nextBlipId, this.connId())];
    }
    return state;
  }

  // ---------- fallback (tipo desconhecido)
  private buildFallbackState(
    g: MainGroup,
    blipId: string,
    nextBlipId: string | undefined
  ): BlipState {
    const state = createState({
      id: blipId,
      title: `TODO: ${g.lead.type}`,
      position: toBlipPosition(g.lead.position, this.frameOrigin),
    });
    state.$contentActions = [inputAction(true)];
    if (nextBlipId) {
      state.$conditionOutputs = [existsOutput(nextBlipId, this.connId())];
    }
    return state;
  }

  // ---------------------------------------------------------------------------
  // MAIN FRAME SETUP (Requirements + Redirect-To-Services)
  // ---------------------------------------------------------------------------

  private injectMainFrameSetup(mainAddress: string, firstWelcomeId: string) {
    // Caso típico: onboarding deve ter 2 conditions:
    //   1. equals "menu principal" → vai pro menu (S003 do saudacao)
    //   2. exists → vai pro Requirements (que depois leva pro welcome)
    // E adicionar Requirements + Redirect-To-Services.

    const requirements = createRequirementsState(
      mainAddress,
      firstWelcomeId,
      this.connId
    );
    const redirectToServices = createRedirectToServicesState(this.connId);

    this.states[requirements.id] = requirements;
    this.states[redirectToServices.id] = redirectToServices;

    // Pendência: se algum state tem __pendingMenuConnection (menu state),
    // conecta ele pro Redirect-To-Services
    for (const id of Object.keys(this.states)) {
      const s = this.states[id] as BlipState & { __pendingMenuConnection?: boolean };
      if (s.__pendingMenuConnection) {
        s.$conditionOutputs.push(existsOutput(redirectToServices.id, this.connId()));
        delete s.__pendingMenuConnection;
      }
    }

    // Ajustar onboarding: adicionar condition pra Requirements ANTES da matchesAll original
    const onboarding = this.states['onboarding'];
    if (onboarding) {
      // Substituir conditionOutputs: 1ª = equals "menu principal" → procurar state menu (fallback se não achar)
      const menuState = Object.values(this.states).find((s) =>
        s.$contentActions?.some(
          (ca) =>
            'action' in ca &&
            (ca as { action: { settings: { type?: string } } }).action.settings.type === 'application/vnd.lime.select+json'
        ) === false &&
        // Tem SendRawMessage = é o menu lista WhatsApp
        s.$contentActions?.some(
          (ca) => 'action' in ca && (ca as { action: { type: string } }).action.type === 'SendRawMessage'
        )
      );
      const menuStateId = menuState?.id;
      onboarding.$conditionOutputs = [];
      if (menuStateId) {
        onboarding.$conditionOutputs.push({
          stateId: menuStateId,
          typeOfStateId: 'state',
          $connId: this.connId(),
          $id: uuid(),
          conditions: [
            { source: 'input', comparison: 'equals', values: ['menu principal'] },
          ],
          $isBuilderDefaultOutput: true,
          $invalid: false,
        });
      }
      onboarding.$conditionOutputs.push({
        stateId: requirements.id,
        typeOfStateId: 'state',
        $connId: this.connId(),
        $id: uuid(),
        conditions: [{ source: 'input', comparison: 'exists', values: [] }],
        $invalid: false,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /** Acha o target de uma outgoing edge (opcional: filtrar por sourceHandle). */
  private findEdgeTarget(
    sourceNodeId: string,
    sourceHandle?: string
  ): FluxoNode | null {
    const edges = this.allEdges.filter(
      (e) =>
        e.source === sourceNodeId &&
        (sourceHandle ? e.sourceHandle === sourceHandle : true)
    );
    if (edges.length === 0) return null;
    const targetId = edges[0].target;
    return this.allNodes.find((n) => n.id === targetId) ?? null;
  }

  /** Resolve o Blip state id pra um node FP. Se for um direcionamento, pode resolver
   * pelo address; se for um main, busca no map. Fallback: 'fallback'. */
  private resolveBlipIdForNode(node: FluxoNode): string {
    const mapped = this.blipIdByNodeId.get(node.id);
    if (mapped) return mapped;
    // Direcionamento sem mapeamento? Cria um state Redirect ad-hoc
    if (node.type === 'direcionamento') {
      const adhocId = uuid();
      this.blipIdByNodeId.set(node.id, adhocId);
      this.states[adhocId] = this.buildDirecionamentoState(
        { lead: node, fused: [], btnShorts: [] },
        adhocId
      );
      return adhocId;
    }
    this.pushWarning(`Não consegui mapear "${node.id}" (${node.type}) — usando fallback como destino.`);
    return 'fallback';
  }

  /** Trackings filhos (parentId=node.id), filtrados por SUFFIX do label. */
  private findChildTrackings(parentId: string): FluxoNode[] {
    return this.allNodes.filter(
      (n) => n.type === 'tracking' && n.parentId === parentId
    );
  }

  /** Converte trackings em TrackEvent actions, filtrando por SUFFIX do label. */
  private trackingsToActions(
    trackings: FluxoNode[],
    suffixes: string[],
    isLeaving = false
  ): BlipCustomAction[] {
    const out: BlipCustomAction[] = [];
    for (const t of trackings) {
      const label = (t.data?.label as string | undefined) ?? '';
      // O label do Fluxo Platform vem em "<nome> <sufixo>" (formato novo) ou
      // "<slug>_<sufixo>" (formato legado). Aceita ambos.
      const match = suffixes.find(
        (s) => label.endsWith(` ${s}`) || label.endsWith(`_${s}`)
      );
      if (!match) continue;
      const actionStr = match === 'exibicao' ? 'exibicao' : '{{input.content}}';
      out.push(trackEventAction({ category: label, action: actionStr }));
    }
    return out;
  }

  /** Para um menu, deduz o optionMap (label → destinationBot) olhando direcionamentos
   * com label que casam com cada option. Usa heurística flexível (exato →
   * startsWith → overlap de palavras-chave) pra tolerar labels com sufixos
   * (ex: option "Cartão de crédito" casa com label "Cartão de crédito Masterboi").
   */
  private deriveMenuOptionMap(
    menuNode: FluxoNode,
    options: string[]
  ): Record<string, string> {
    void menuNode;
    const map: Record<string, string> = {};
    const candidatos = this.allNodes.filter(
      (n) => n.type === 'direcionamento' && !n.parentId
    );
    for (const opt of options) {
      const dir = candidatos.find((c) =>
        optionMatchesLabel(opt, (c.data?.label as string | undefined) ?? '')
      );
      if (dir) {
        const fid = (dir.data?.targetFrameId as string | undefined) ?? '';
        if (fid) map[opt] = toBlipAddress(fid);
      }
    }
    return map;
  }

  /** Cria action de mídia (imagem/documento/vídeo) a partir de um node FP. */
  private mediaActionFromNode(node: FluxoNode): BlipContentAction {
    const t = node.type ?? '';
    const isImage = t.includes('imagem');
    const isVideo = t.includes('video');
    const isDoc = t.includes('documento');
    const mediaType = isImage ? 'image/jpeg' : isVideo ? 'video/mp4' : 'application/pdf';
    const uri =
      (node.data?.url as string | undefined) ??
      (node.data?.uri as string | undefined) ??
      (isDoc
        ? 'https://blip-community.s3-sa-east-1.amazonaws.com/documento-padrao-blip.pdf'
        : 'http://limeprotocol.org/content-types.html#media-link');
    const caption =
      (node.data?.caption as string | undefined) ??
      (node.data?.filename as string | undefined) ??
      '';
    return mediaMessageAction({
      mediaType,
      uri,
      title: caption || 'Mídia',
      text: isImage ? '' : undefined,
      aspectRatio: isImage ? '1:1' : undefined,
    });
  }

  /** Cria action web-link a partir de um node link FP. */
  private webLinkActionFromNode(node: FluxoNode): BlipContentAction {
    const uri =
      (node.data?.url as string | undefined) ??
      (node.data?.uri as string | undefined) ??
      'http://limeprotocol.org/content-types.html#web-link';
    const title = (node.data?.linkTitle as string | undefined) ?? 'Link';
    const text = (node.data?.linkDescription as string | undefined) ?? '';
    return webLinkMessageAction({ uri, title, text });
  }
}

// =============================================================================
// TYPES INTERNOS
// =============================================================================

interface MainGroup {
  /** Node "líder" do grupo — o que vira o BlipState. */
  lead: FluxoNode;
  /** Nodes fundidos no líder (bubble-user, mídia, link). */
  fused: FluxoNode[];
  /** btn-shorts que viram opções do select-immediate do líder. */
  btnShorts: FluxoNode[];
}

// =============================================================================
// EXPORT MULTI-FRAME (orquestrador)
// =============================================================================

export interface ExportProjectOptions {
  /** Ids das pages a incluir. Vazio = todas. */
  pageIds?: string[];
  /** Marca um frame específico como principal (override). */
  mainFrameId?: string;
}

export interface PageState {
  id: string;
  title: string;
  nodes: FluxoNode[];
  edges: Edge[];
}

export interface ExportProjectResult {
  files: ExportFrameResult[];
  warnings: string[];
}

/**
 * Exporta todas as pages selecionadas. O FRAME PRINCIPAL é o primeiro
 * frame da PRIMEIRA page incluída (regra escolhida pelo usuário).
 */
export function exportProjectToBlip(
  pages: PageState[],
  opts: ExportProjectOptions = {}
): ExportProjectResult {
  const warnings: string[] = [];
  const files: ExportFrameResult[] = [];
  const selectedPages = opts.pageIds
    ? pages.filter((p) => opts.pageIds!.includes(p.id))
    : pages;

  if (selectedPages.length === 0) {
    return { files, warnings: ['Nenhuma page selecionada.'] };
  }

  // Frame principal: primeiro frame da primeira page (ou override manual)
  const firstPageFrames = selectedPages[0].nodes.filter((n) => n.type === 'frame');
  const mainFrame =
    (opts.mainFrameId
      ? findFrameById(pages, opts.mainFrameId)
      : firstPageFrames[0]) ?? null;
  const mainFrameAddress = mainFrame
    ? toBlipAddress(
        (mainFrame.data?.frameId as string | undefined) ??
          (mainFrame.data?.title as string | undefined) ??
          'saudacao'
      )
    : 'saudacao';

  for (const page of selectedPages) {
    const frames = page.nodes.filter((n) => n.type === 'frame');
    for (const frame of frames) {
      const isMain = mainFrame?.id === frame.id;
      const result = exportFrameToBlip(frame, page.nodes, page.edges, {
        isMainFrame: isMain,
        mainFrameAddress,
      });
      files.push(result);
      warnings.push(...result.warnings);
    }
  }

  return { files, warnings };
}

function findFrameById(pages: PageState[], frameId: string): FluxoNode | null {
  for (const p of pages) {
    const f = p.nodes.find((n) => n.id === frameId);
    if (f) return f;
  }
  return null;
}
