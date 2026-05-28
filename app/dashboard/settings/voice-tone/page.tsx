import VoiceToneSettings from '../VoiceToneSettings';

/**
 * Sub-rota /dashboard/settings/voice-tone — perfil de voz padrão global.
 * Acessível por todos os perfis (incluindo Editor).
 */
export default function VoiceTonePage() {
  return <VoiceToneSettings />;
}
