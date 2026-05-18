import LoginForm from './LoginForm';

interface LoginPageProps {
  searchParams: { next?: string; error?: string; sent?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blip-purple to-blip-purple-dark p-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blip-purple">🚀 Fluxo Platform</h1>
          <p className="text-gray-600 mt-2">Entre com seu e-mail para receber o link de acesso</p>
        </div>

        {searchParams.sent === '1' && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm mb-4">
            ✅ Link enviado! Verifique seu e-mail e clique para entrar.
          </div>
        )}

        {searchParams.error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm mb-4">
            ❌ {decodeURIComponent(searchParams.error)}
          </div>
        )}

        <LoginForm next={searchParams.next} />
      </div>
    </main>
  );
}
