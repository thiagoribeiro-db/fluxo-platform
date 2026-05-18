'use client';

interface LoadingOverlayProps {
  /** Quando true, renderiza o overlay sobre o canvas. */
  visible: boolean;
  /** Mensagem exibida (default: "Carregando…"). */
  message?: string;
}

/**
 * Overlay semi-transparente com spinner pra indicar operações em andamento
 * (trocar página, aplicar template, parsing de PDF, etc.).
 *
 * Cobre o canvas mas mantém sidebars/topbar interativos.
 */
export default function LoadingOverlay({
  visible,
  message = 'Carregando…',
}: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
      <div className="flex flex-col items-center gap-3 bg-white px-6 py-5 rounded-xl shadow-lg border border-gray-200">
        {/* Spinner CSS */}
        <div
          className="w-8 h-8 border-3 border-blip-purple/20 border-t-blip-purple rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-gray-700">{message}</p>
      </div>
    </div>
  );
}
