'use client';

import { useState, useTransition } from 'react';
import { sendMagicLink } from '@/lib/actions/auth';

interface LoginFormProps {
  next?: string;
}

export default function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await sendMagicLink(email, next);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blip-purple focus:outline-none focus:ring-2 focus:ring-blip-purple/20"
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !email}
        className="w-full bg-blip-purple text-white py-3 rounded-lg font-semibold hover:bg-blip-purple-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Enviando…' : 'Enviar link de acesso →'}
      </button>

      <p className="text-xs text-gray-500 text-center pt-2">
        Você receberá um link mágico no e-mail. Sem senha.
      </p>
    </form>
  );
}
