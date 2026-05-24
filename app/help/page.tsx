/**
 * Página de Ajuda — documentação visível pros usuários da plataforma.
 *
 * ⚠️⚠️⚠️ MANUTENÇÃO OBRIGATÓRIA ⚠️⚠️⚠️
 *
 * SEMPRE que implementar uma feature nova no editor ou dashboard,
 * ATUALIZE também esta página. Critério: se aparece em botão/menu/
 * atalho/painel visível, tem que estar aqui.
 *
 * Veja CLAUDE.md na raiz pra regras de manutenção.
 */
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/actions/auth';

export const metadata = {
  title: 'Ajuda — Fluxo Platform',
  description: 'Documentação completa das funcionalidades do editor.',
};

export default async function HelpPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Topbar — mesma do dashboard layout mas standalone (sem tabs) */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xl font-bold text-blip-purple hover:text-blip-purple-dark">
            <ArrowLeft size={18} /> 🚀 Fluxo Platform
          </Link>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-600">{user.email}</span>}
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-blip-purple"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Ajuda</h1>
          <p className="text-gray-600 mt-2">
            Documentação completa das funcionalidades do Fluxo Platform. Use o índice abaixo pra navegar.
          </p>
        </div>

        {/* Índice (sticky) */}
        <nav className="bg-white rounded-lg border border-gray-200 p-5 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Índice
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-sm">
            <a href="#comecando" className="text-blip-purple hover:underline">🚀 Começando</a>
            <a href="#atalhos" className="text-blip-purple hover:underline">⌨️ Atalhos do teclado</a>
            <a href="#toolbar" className="text-blip-purple hover:underline">🎛️ Toolbar do editor</a>
            <a href="#paineis" className="text-blip-purple hover:underline">🪟 Painéis laterais</a>
            <a href="#skills" className="text-blip-purple hover:underline">🧩 Skills (sub-fluxos)</a>
            <a href="#voice-tone" className="text-blip-purple hover:underline">✨ Voice &amp; Tone IA</a>
            <a href="#tabela-conteudo" className="text-blip-purple hover:underline">📊 Tabela de conteúdo</a>
            <a href="#mock-api" className="text-blip-purple hover:underline">🔌 Mock API</a>
            <a href="#versoes-diff" className="text-blip-purple hover:underline">🕰️ Versões + Diff</a>
            <a href="#colaboracao" className="text-blip-purple hover:underline">👥 Colaboração (Realtime)</a>
            <a href="#configuracoes" className="text-blip-purple hover:underline">⚙️ Configurações globais</a>
            <a href="#tour" className="text-blip-purple hover:underline">🎓 Tour de boas-vindas</a>
          </div>
        </nav>

        {/* ────────── 1. COMEÇANDO ────────── */}
        <Section id="comecando" emoji="🚀" title="Começando">
          <p>
            O Fluxo Platform é um editor visual de fluxos conversacionais (chatbots) para WhatsApp/Blip. Você desenha o fluxo arrastando componentes pra um canvas e ele gera o JSON pronto pra importar na plataforma Blip/Digitalbot.
          </p>

          <Subsection title="Conceito-chave: Frames + Prefixos">
            <p>
              Cada <strong>Frame</strong> é um container que agrupa blocos relacionados (ex: Saudação, Ofertas, SAC). Frames têm:
            </p>
            <ul>
              <li><strong>Título</strong> — visível no canvas (ex: &quot;Saudação&quot;)</li>
              <li><strong>FrameId</strong> — slug usado em direcionamentos (ex: <code>saudacao</code>)</li>
              <li><strong>Prefixo</strong> — letra(s) usadas nos IDs dos blocos contidos (ex: <code>S</code>)</li>
            </ul>
            <p>
              Blocos DENTRO do frame ganham IDs automáticos: <code>S001</code>, <code>S002</code>, <code>S003</code>… O sistema renumera automaticamente quando você reorganiza.
            </p>
          </Subsection>

          <Subsection title="Autosave">
            <p>
              Tudo é salvo automaticamente. O status (&quot;Salvo&quot; / &quot;Salvando…&quot;) aparece no topo da sidebar esquerda do editor.
            </p>
          </Subsection>

          <Subsection title="Páginas (dev / hmg / prd)">
            <p>
              Cada projeto pode ter várias <strong>páginas</strong> — pense em ambientes (dev, hmg, prd) ou variações do fluxo. Cada página tem seu próprio histórico de versões. Trocar de página salva automaticamente a anterior.
            </p>
          </Subsection>
        </Section>

        {/* ────────── 2. ATALHOS ────────── */}
        <Section id="atalhos" emoji="⌨️" title="Atalhos do teclado">
          <p>
            Aperte <Kbd>?</Kbd> dentro do editor pra ver o cheatsheet completo a qualquer momento.
          </p>

          <Subsection title="Globais">
            <ShortcutsTable
              rows={[
                ['⌘K / Ctrl+K', 'Abrir Command Palette (acesso a tudo)'],
                ['?', 'Mostrar cheatsheet completo'],
                ['⌘F ou ⌘H', 'Buscar e substituir em massa'],
                ['Esc', 'Fechar diálogo / limpar seleção'],
              ]}
            />
          </Subsection>

          <Subsection title="Edição de blocos">
            <ShortcutsTable
              rows={[
                ['⌘Z', 'Desfazer última ação'],
                ['⌘C', 'Copiar texto do(s) bloco(s) selecionado(s)'],
                ['⌘D', 'Duplicar bloco selecionado'],
                ['Del / Backspace', 'Apagar bloco(s) selecionado(s)'],
                ['Shift + click', 'Selecionar múltiplos blocos'],
              ]}
            />
          </Subsection>

          <Subsection title="Canvas">
            <ShortcutsTable
              rows={[
                ['H', 'Modo Mover (drag = pan no canvas)'],
                ['V', 'Modo Selecionar (drag = retângulo de seleção)'],
                ['Scroll', 'Zoom in/out'],
                ['Duplo clique na paleta', 'Adiciona bloco abaixo do selecionado'],
              ]}
            />
          </Subsection>
        </Section>

        {/* ────────── 3. TOOLBAR ────────── */}
        <Section id="toolbar" emoji="🎛️" title="Toolbar do editor">
          <p>
            Barra superior central do editor. Da esquerda pra direita:
          </p>

          <FeatureGrid>
            <FeatureCard emoji="🟣" title="Compartilhar" desc="Gera link público do projeto em 3 modos: somente leitura, comentários, ou edição completa." />
            <FeatureCard emoji="✨" title="IA" desc="Abre o Chat IA contextual — pergunte sobre seu fluxo, peça explicações de frames ou sugestões de blocos." />
            <FeatureCard emoji="✏️" title="Editar ▾" desc="Inserir Skill · Voice & Tone · Buscar e substituir · Organizar layout · Reordenar IDs · Resetar página" />
            <FeatureCard emoji="👁️" title="Visualizar ▾" desc="Outline · Tabela de conteúdo · Comentários · Problemas (linter) · Testar fluxo · Versões" />
            <FeatureCard emoji="📤" title="Exportar ▾" desc="Exportar Blip (.zip de JSONs) · Imagem (PNG/PDF/HTML) · Carregar template" />
            <FeatureCard emoji="📊" title="Tracking auto" desc="Toggle: cria automaticamente trackings nos bots/menus ao adicionar (recomendado ON)." />
            <FeatureCard emoji="⌨️" title="Atalhos" desc="Ícone teclado — abre o cheatsheet (mesmo que apertar ?)" />
          </FeatureGrid>
        </Section>

        {/* ────────── 4. PAINÉIS LATERAIS ────────── */}
        <Section id="paineis" emoji="🪟" title="Painéis laterais">
          <FeatureGrid>
            <FeatureCard emoji="🎨" title="Paleta (esquerda)" desc="Lista de componentes arrastáveis: Frame, Bubble Bot/User, Menu, Botões, Direcionamento, Condicional, etc." />
            <FeatureCard emoji="📄" title="Páginas (esquerda)" desc="Lista das páginas do projeto (dev, hmg, prd). Clica pra trocar, + Nova pra criar, ⎘ pra duplicar." />
            <FeatureCard emoji="⚙️" title="Propriedades (direita)" desc="Quando seleciona um bloco, mostra campos editáveis. Sem seleção, lista todos os frames com link de navegação." />
            <FeatureCard emoji="✋" title="Modos H / V (inferior)" desc="Toggle Mover (H — pan no drag) vs Selecionar (V — retângulo de seleção)." />
          </FeatureGrid>
        </Section>

        {/* ────────── 5. SKILLS ────────── */}
        <Section id="skills" emoji="🧩" title="Skills (sub-fluxos reutilizáveis)">
          <p>
            Skills são <strong>pacotes prontos</strong> de frame + blocos + conexões que você insere com 1 clique. Cobrem padrões clássicos de chatbot.
          </p>
          <p>
            <strong>Como usar:</strong> Toolbar Editar ▾ → <em>Inserir Skill</em>. Ou <Kbd>⌘K</Kbd> → digite &quot;skill&quot;.
          </p>
          <p>
            Antes de inserir, o canvas é organizado automaticamente — a skill cai à direita do conteúdo existente, sem sobrepor.
          </p>

          <Subsection title="Skills disponíveis">
            <FeatureGrid>
              <FeatureCard emoji="🧑‍💼" title="Falar com atendente" desc="Cascata de 4 condicionais (feriado, fim de semana, horário, disponibilidade) antes do transbordo humano." />
              <FeatureCard emoji="👋" title="Encerramento" desc="Agradecimento + avaliação NPS 4 níveis + feedback livre opcional." />
              <FeatureCard emoji="🔁" title="Algo Mais" desc="3 direcionamentos (voltar ao menu / falar com atendente / finalizar) após a pergunta de continuação." />
              <FeatureCard emoji="🪪" title="Validar CPF" desc="Pede CPF + condicional valida formato + branch de reentrada se inválido." />
              <FeatureCard emoji="📧" title="Validar Email" desc="Pede email + condicional valida formato + branch de reentrada." />
              <FeatureCard emoji="🔒" title="Opt-in LGPD" desc="Apresenta política, registra consentimento, branch de recusa." />
            </FeatureGrid>
          </Subsection>
        </Section>

        {/* ────────── 6. VOICE & TONE ────────── */}
        <Section id="voice-tone" emoji="✨" title="Voice & Tone IA">
          <p>
            Define o <strong>tom desejado</strong> do bot e a IA analisa todas as mensagens do fluxo, identificando as que destoam e sugerindo reescritas curtas preservando significado.
          </p>
          <p>
            <strong>Como usar:</strong> Toolbar Editar ▾ → <em>Voice &amp; Tone (IA)</em>. Tab 1 (Perfil) escolhe preset ou customiza. Tab 2 (Análise) roda a IA e mostra sugestões com Accept/Reject.
          </p>

          <Subsection title="Presets disponíveis">
            <ul>
              <li>🎩 <strong>Formal técnico</strong> — Bancos, seguros, jurídico, B2B enterprise</li>
              <li>😊 <strong>Casual próximo</strong> — Varejo, atendimento direto, marca jovem</li>
              <li>🌿 <strong>Amigável leve</strong> — Saúde, bem-estar, ONG, educação</li>
              <li>🏢 <strong>Corporativo sério</strong> — B2B, governo, indústria pesada</li>
              <li>🎉 <strong>Jovem descontraído</strong> — Gaming, streaming, Gen-Z</li>
            </ul>
          </Subsection>

          <p>
            <strong>Padrão global:</strong> você pode setar um perfil padrão em <Link href="/dashboard/settings" className="text-blip-purple hover:underline">Dashboard → Configurações</Link> que vale pra projetos novos sem profile próprio.
          </p>
        </Section>

        {/* ────────── 7. TABELA DE CONTEÚDO ────────── */}
        <Section id="tabela-conteudo" emoji="📊" title="Tabela de conteúdo">
          <p>
            Vista <strong>tipo planilha</strong> com TODOS os textos do fluxo numa só tela. Cada linha é um campo editável (menu = header + footer + N opções; condicional = condição + true label + false label).
          </p>
          <p>
            <strong>Como usar:</strong> Toolbar Visualizar ▾ → <em>Tabela de conteúdo</em>. Edite o texto inline (salva no blur). Filtros por tipo (bot/user/menu/etc.) e por frame. Botão CSV exporta tudo pra abrir em Excel/Sheets.
          </p>
          <p>
            Click no ↗ ao final da linha pra navegar até o bloco no canvas.
          </p>
        </Section>

        {/* ────────── 8. MOCK API ────────── */}
        <Section id="mock-api" emoji="🔌" title="Mock API embedded">
          <p>
            Editor inline de request/response pro nó <strong>Integração API</strong>. Configure o request real (método, URL, headers, body) E o response mockado que o Playback usa pra simular a chamada.
          </p>
          <p>
            <strong>Como usar:</strong> Selecione um nó Integração API → no PropertiesPanel aparece a seção Mock API com Request e Response Mock (colapsáveis).
          </p>

          <Subsection title="Recursos">
            <ul>
              <li><strong>Method colorido</strong>: GET 🟢 · POST 🔵 · PUT 🟡 · PATCH 🟠 · DELETE 🔴</li>
              <li><strong>URL com placeholders</strong>: use <code>{`{var}`}</code> pra valores dinâmicos (ex: <code>{`/api/clientes/{cpf}`}</code>)</li>
              <li><strong>Headers</strong>: lista key/value editável (Authorization, Content-Type, etc.)</li>
              <li><strong>Body JSON</strong>: validação visual (border vermelha + aviso se inválido)</li>
              <li><strong>Botão &quot;Testar request real&quot;</strong>: envia o request configurado e popula o mock com a resposta. Funciona com APIs públicas (ViaCEP, BrasilAPI, etc.) que tenham CORS aberto.</li>
              <li><strong>Status HTTP do mock</strong>: simula 200/400/500 conforme necessário</li>
            </ul>
          </Subsection>

          <Subsection title="No Playback">
            <p>
              Quando rodar o Test Playground, o nó de integração mostra:
              <code className="block bg-gray-100 p-2 rounded my-2 text-xs">GET viacep.com.br/ws/01310-100/json/<br/>200 MOCK RESPONSE → {`{ ... }`}</code>
              Status 2xx fica verde, 4xx vermelho, 3xx amarelo.
            </p>
          </Subsection>
        </Section>

        {/* ────────── 9. VERSÕES + DIFF ────────── */}
        <Section id="versoes-diff" emoji="🕰️" title="Versões + Diff">
          <p>
            Cada página tem um <strong>histórico de snapshots</strong> (máx 50 por página). Snapshots são criados automaticamente antes de operações destrutivas (template, IA) e podem ser criados manualmente.
          </p>
          <p>
            <strong>Como usar:</strong> Toolbar Visualizar ▾ → <em>Versões</em>. Cada versão tem 3 botões ao clicar pra expandir:
          </p>
          <ul>
            <li>🔍 <strong>Comparar</strong> — abre dialog mostrando o que mudou entre essa versão e o estado atual (adicionados/removidos/modificados com diff humano)</li>
            <li>↺ <strong>Restaurar</strong> — substitui o canvas atual pelo conteúdo da versão (cria snapshot antes pra dar undo)</li>
            <li>🗑 <strong>Apagar</strong> — remove a versão do histórico</li>
          </ul>
          <p>
            <strong>Botão &quot;+ Novo&quot;</strong> no topo do painel cria um snapshot manual com label customizável.
          </p>
        </Section>

        {/* ────────── 10. COLABORAÇÃO REALTIME ────────── */}
        <Section id="colaboracao" emoji="👥" title="Colaboração (Realtime)">
          <p>
            Quando você compartilha um projeto em modo edição com outros usuários da sua organização, o editor mostra:
          </p>
          <ul>
            <li><strong>Avatares</strong> no canto superior direito — quem está online editando o mesmo projeto</li>
            <li><strong>Cursores coloridos</strong> dos outros usuários se movendo no canvas em tempo real</li>
          </ul>
          <p>
            Mudanças salvas pelo autosave aparecem pros outros após o save (~1s). Não é colaboração simultânea de edição (tipo Google Docs) — é mais como Figma com auto-refresh.
          </p>
        </Section>

        {/* ────────── 11. CONFIGURAÇÕES ────────── */}
        <Section id="configuracoes" emoji="⚙️" title="Configurações globais">
          <p>
            Acesse via <Link href="/dashboard/settings" className="text-blip-purple hover:underline">Dashboard → Configurações</Link>. Preferências aplicadas a todos seus projetos novos.
          </p>
          <ul>
            <li><strong>Voice &amp; Tone padrão</strong> — define o tom default que projetos novos usam (override individual no editor de cada projeto)</li>
            <li>(em breve) idioma default, tema preferido, etc.</li>
          </ul>
        </Section>

        {/* ────────── 12. TOUR ────────── */}
        <Section id="tour" emoji="🎓" title="Tour de boas-vindas">
          <p>
            Tour interativo guiado de 12 passos que apresenta toda a interface — feito pra quem está abrindo o editor pela primeira vez.
          </p>
          <p>
            <strong>Rodar de novo:</strong> abra <Kbd>⌘K</Kbd> e digite &quot;tour&quot;, depois selecione <em>Rever tour de boas-vindas</em>.
          </p>
        </Section>

        {/* ────────── SUPORTE ────────── */}
        <section className="mt-12 bg-blip-purple/5 rounded-lg p-6 border border-blip-purple/20">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Não achou o que procura?</h2>
          <p className="text-sm text-gray-700 mb-3">
            Use o Chat IA dentro do editor (botão ✨ IA na toolbar) — ele tem contexto do seu fluxo e responde perguntas específicas sobre o projeto.
          </p>
          <p className="text-sm text-gray-700">
            Pra reportar bugs ou sugerir features:{' '}
            <a
              href="https://github.com/thiagoribeiro-db/fluxo-platform/issues"
              target="_blank"
              rel="noreferrer"
              className="text-blip-purple hover:underline inline-flex items-center gap-1"
            >
              GitHub Issues <ExternalLink size={12} />
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

// =============================================================================
// SUB-COMPONENTES
// =============================================================================

function Section({
  id,
  emoji,
  title,
  children,
}: {
  id: string;
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      <div className="prose prose-sm max-w-none text-gray-700 space-y-3 [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:my-0 [&_strong]:text-gray-900">
        {children}
      </div>
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FeatureGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 not-prose">
      {children}
    </div>
  );
}

function FeatureCard({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <div className="flex items-start gap-2">
        <span className="text-xl shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{title}</div>
          <div className="text-[12px] text-gray-600 mt-0.5 leading-snug">
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutsTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="w-full text-sm border-collapse mt-2 not-prose">
      <tbody>
        {rows.map(([keys, desc], i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0">
            <td className="py-1.5 pr-4 w-44">
              <Kbd>{keys}</Kbd>
            </td>
            <td className="py-1.5 text-gray-700">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono font-medium text-gray-700 bg-gray-100 rounded border border-gray-300 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  );
}
