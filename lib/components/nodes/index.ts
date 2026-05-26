/**
 * Registry de custom nodes do editor de fluxo.
 *
 * Cada chave é o `type` usado nos nodes do React Flow (ver lib/types.ts:FluxoNodeType).
 * Mantenha em sincronia com lib/types.ts.
 */
import BotBubbleNode from './BotBubbleNode';
import UserBubbleNode from './UserBubbleNode';
import BtnShortNode from './BtnShortNode';
import BtnLongNode from './BtnLongNode';
import MenuNode from './MenuNode';
import TrackingNode from './TrackingNode';
import ExcecaoNode from './ExcecaoNode';
import DirecionamentoNode from './DirecionamentoNode';
import FrameNode from './FrameNode';
import NotificationNode from './NotificationNode';
import MediaNode from './MediaNode';
import LinkNode from './LinkNode';
import ConditionalNode from './ConditionalNode';
import AtendimentoHumanoNode from './AtendimentoHumanoNode';
import EntryPointNode from './EntryPointNode';
import WhatsAppFlowNode from './WhatsAppFlowNode';

export const nodeTypes = {
  // Estrutura
  frame: FrameNode,
  'entry-point': EntryPointNode,
  // Mensagens
  'bubble-bot': BotBubbleNode,
  'bubble-user': UserBubbleNode,
  'btn-short': BtnShortNode,
  'btn-long': BtnLongNode,
  menu: MenuNode,
  // Eventos
  tracking: TrackingNode,
  excecao: ExcecaoNode,
  direcionamento: DirecionamentoNode,
  condicional: ConditionalNode,
  'atendimento-humano': AtendimentoHumanoNode,
  // Link externo
  link: LinkNode,
  // Integrações & IAG (reaproveitam NotificationNode)
  'integracao-api': NotificationNode,
  'integracao-planilha': NotificationNode,
  'iag-entrada': NotificationNode,
  'iag-reentrada': NotificationNode,
  'iag-saida': NotificationNode,
  // Mídias (reaproveitam MediaNode)
  'midia-imagem-bot': MediaNode,
  'midia-imagem-user': MediaNode,
  'midia-documento-bot': MediaNode,
  'midia-documento-user': MediaNode,
  'midia-video-bot': MediaNode,
  'midia-video-user': MediaNode,
  'midia-audio-bot': MediaNode,
  'midia-audio-user': MediaNode,
  // WhatsApp Flow (mini-app multi-screen)
  'whatsapp-flow': WhatsAppFlowNode,
} as const;

export {
  BotBubbleNode,
  UserBubbleNode,
  BtnShortNode,
  BtnLongNode,
  MenuNode,
  TrackingNode,
  ExcecaoNode,
  DirecionamentoNode,
  FrameNode,
  NotificationNode,
  MediaNode,
  LinkNode,
  ConditionalNode,
  AtendimentoHumanoNode,
  EntryPointNode,
  WhatsAppFlowNode,
};
