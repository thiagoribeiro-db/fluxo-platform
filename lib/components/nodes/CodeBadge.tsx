'use client';

interface CodeBadgeProps {
  code?: string;
}

/**
 * Badge pequeno no canto superior direito do node mostrando seu code
 * auto-gerado (ex.: "B001", "M002"). Some quando não há code.
 */
export default function CodeBadge({ code }: CodeBadgeProps) {
  if (!code) return null;
  return (
    <div
      className="absolute -top-2 -right-2 bg-blip-purple text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-sm pointer-events-none z-10"
      title={`ID do bloco: ${code}`}
    >
      {code}
    </div>
  );
}
