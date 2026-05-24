/**
 * Presets de Voice/Tone — perfis prontos pra escolha rápida.
 *
 * Cada preset tem descrição + exemplos. A descrição vai pro system prompt
 * do Claude e influencia diretamente as sugestões.
 */
import type { VoicePresetId, VoiceProfile } from './types';

export interface VoicePreset extends VoiceProfile {
  id: VoicePresetId;
  /** Nome curto exibido no UI. */
  title: string;
  /** Emoji representativo. */
  emoji: string;
  /** Subtítulo / quando usar. */
  subtitle: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'formal-tecnico',
    title: 'Formal técnico',
    emoji: '🎩',
    subtitle: 'Bancos, seguros, jurídico, B2B enterprise',
    preset: 'formal-tecnico',
    description: `Tom formal, profissional e técnico. Use linguagem precisa, evite gírias,
emojis, abreviações e contrações. Tratamento na 3ª pessoa ("o cliente") ou
"você" formal. Frases completas, parágrafos bem estruturados.

EVITAR: "tá", "pra", "tipo", "rola", emojis em excesso, exclamações múltiplas.
PREFERIR: "está", "para", "como por exemplo", "ocorre", linguagem objetiva.`,
    examples: [
      'Olá. Sou o assistente virtual do Banco Exemplo. Como posso auxiliá-lo?',
      'Sua solicitação foi recebida com sucesso. O protocolo é 1234.',
    ],
  },
  {
    id: 'casual-proximo',
    title: 'Casual próximo',
    emoji: '😊',
    subtitle: 'Varejo, atendimento direto, marca jovem',
    preset: 'casual-proximo',
    description: `Tom casual e amistoso, como se fosse uma conversa com um amigo prestativo.
Use "você" (ou "tu" se a marca usa regionalismo), contrações são bem-vindas
("tá", "pra"). 1-2 emojis no início ou fim de mensagens-chave. Frases curtas
e diretas. Empatia natural ("entendi", "claro!").

EVITAR: linguagem rebuscada, frases longas, terceira pessoa, "prezado(a)".
PREFERIR: simplicidade, calor humano, pequena dose de emoji.`,
    examples: [
      'Oi! 👋 Tudo bem? Sou o assistente da Loja Exemplo, em que posso te ajudar?',
      'Pronto! Anotei seu pedido aqui ✓',
    ],
  },
  {
    id: 'amigavel-leve',
    title: 'Amigável leve',
    emoji: '🌿',
    subtitle: 'Saúde, bem-estar, ONG, educação',
    preset: 'amigavel-leve',
    description: `Tom acolhedor, gentil e respeitoso, sem ser frio. Cuidado emocional
nas palavras, evitar pressa. Usa "você", trata com calma. Emojis sutis
quando apropriado. Mensagens não-comerciais (sem call-to-actions agressivos).

EVITAR: tom de venda, urgência, vocativos genéricos como "querido(a)".
PREFERIR: empatia ("compreendo"), paciência, ritmo calmo.`,
    examples: [
      'Olá, é um prazer te receber por aqui. Como posso ajudar hoje?',
      'Sem problemas, vamos com calma. O que aconteceu?',
    ],
  },
  {
    id: 'corporativo-serio',
    title: 'Corporativo sério',
    emoji: '🏢',
    subtitle: 'B2B, governo, indústria pesada',
    preset: 'corporativo-serio',
    description: `Tom institucional e objetivo. Sem emojis. Linguagem formal sem ser
arcaica. Foco em clareza, precisão e respeito ao tempo do interlocutor.
Trata por "você" formal (nunca "senhor(a)" exagerado).

EVITAR: emojis, gírias, exclamações, tom amistoso excessivo.
PREFERIR: objetividade, fatos, frases nominais quando possível.`,
    examples: [
      'Atendimento ao cliente — Indústria Exemplo. Selecione uma das opções:',
      'Solicitação registrada. Aguardamos retorno em até 2 dias úteis.',
    ],
  },
  {
    id: 'jovem-descontraido',
    title: 'Jovem descontraído',
    emoji: '🎉',
    subtitle: 'Gaming, streaming, redes sociais, Gen-Z',
    preset: 'jovem-descontraido',
    description: `Tom super casual, com gírias atuais e linguagem da internet. Pode usar
emojis livremente, abreviações ("vc", "tbm"), expressões de Twitter/TikTok.
Direto, animado, sem firulas. Frases bem curtas.

EVITAR: formalidade, "prezado", construções rebuscadas.
PREFERIR: leveza, humor leve, ritmo de mensagem instantânea.`,
    examples: [
      'eai! 🔥 manda ver, no que eu posso te ajudar?',
      'show, anotado ✨ qualquer coisa só chamar',
    ],
  },
];

export function getPresetById(id: VoicePresetId): VoicePreset | undefined {
  return VOICE_PRESETS.find((p) => p.id === id);
}

/** Profile default — usado em projetos novos. */
export const DEFAULT_PROFILE: VoiceProfile = {
  preset: 'casual-proximo',
  description: VOICE_PRESETS[1].description,
  examples: VOICE_PRESETS[1].examples,
};
