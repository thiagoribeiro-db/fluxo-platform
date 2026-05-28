import AIPromptSection from '../AIPromptSection';

/**
 * Sub-rota /dashboard/settings/parser-ia — visualização do system prompt
 * enviado ao Claude durante o parse de escopos.
 *
 * Acessível por todos os perfis. Read-only (visualização).
 */
export default function ParserIaPage() {
  return <AIPromptSection />;
}
