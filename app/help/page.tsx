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
                ['⌘D', 'Duplicar bloco(s) selecionado(s) — multi-select clona edges internas'],
                ['⌘G', 'Agrupar bloco(s) num frame novo'],
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

        {/* ────────── Biblioteca e reuso ────────── */}
        <Section id="biblioteca" emoji="📚" title="Biblioteca e reuso">
          <p>
            3 jeitos de NÃO redigitar a mesma coisa:
          </p>

          <Subsection title="Templates por vertical 🆕">
            <p>
              Toolbar Editar ▾ → <em>Carregar template</em> → tab <strong>🌱 Usar exemplo</strong>:
            </p>
            <ul>
              <li>🛒 <strong>Varejo</strong> — chatbot completo (12 frames)</li>
              <li>🩺 <strong>Saúde / Clínica</strong> — agendamento + confirmação + convênios (8 frames)</li>
              <li>🚧 <strong>Educação</strong> e <strong>Financeiro</strong> em breve</li>
            </ul>
            <p>
              Substituem o conteúdo da página atual. Auto-organize roda em seguida pra deixar limpo.
            </p>
          </Subsection>

          <Subsection title="Skills customizadas (sua biblioteca) 🆕">
            <p>
              Salve <strong>seleções do canvas</strong> como skill reusável — toolbar Editar ▾ → <em>Inserir Skill</em> → botão <strong>+ Salvar seleção</strong>. Próxima vez que precisar daquele sub-fluxo (validação de CPF customizada, padrão de coleta de dados, etc.), aparece na seção <strong>🧩 Minha biblioteca</strong> ao lado dos builtins. Click insere com IDs novos, edges internas preservadas.
            </p>
            <p className="text-[11px] text-gray-500">
              Persistência: localStorage do navegador (por usuário). Sync por org chega em fase futura.
            </p>
          </Subsection>

          <Subsection title="Snippets de texto 🆕">
            <p>
              No <strong>RichTextEditor</strong> (campos de texto rich do PropertiesPanel), botão <strong>📋</strong> abre popover com seus snippets salvos. Use <strong>+ Salvar</strong> pra guardar o texto atual com um nome (ex: &quot;Saudação genérica&quot;, &quot;Erro padrão&quot;). Click insere no cursor preservando formatação. Persistência por usuário (localStorage).
            </p>
          </Subsection>
        </Section>

        {/* ────────── Governança ────────── */}
        <Section id="governanca" emoji="📊" title="Governança e observabilidade">
          <p>
            Recursos pra acompanhar o ciclo de vida e o custo de cada projeto.
          </p>

          <Subsection title="Status do projeto 🆕">
            <p>
              No card do dashboard e na sidebar do editor, um pill colorido indica o status:
            </p>
            <ul>
              <li>✏️ <strong>Rascunho</strong> — em construção</li>
              <li>👀 <strong>Em revisão</strong> — enviado pro cliente revisar</li>
              <li>✓ <strong>Aprovado</strong> — pronto pra deploy</li>
              <li>📦 <strong>Arquivado</strong> — concluído ou parado</li>
            </ul>
            <p>
              Click no pill troca o status (com optimistic update). No dashboard, pills no topo filtram por status com contadores.
            </p>
          </Subsection>

          <Subsection title="Tempo estimado 🆕">
            <p>
              Em cada card do dashboard, um campo <code>⏱ Xh</code> registra as horas orçadas pro projeto. Click pra editar inline (Enter salva, Esc cancela). Útil pra base de cobrança e relatórios futuros de orçado vs realizado.
            </p>
          </Subsection>

          <Subsection title="Histórico de ações (audit log) 🆕">
            <p>
              Link <code>📜 Histórico</code> no card abre a página de auditoria do projeto. Registra ações de governança:
            </p>
            <ul>
              <li>Template aplicado / página criada / renomeada</li>
              <li>Status alterado</li>
              <li>Link compartilhável criado ou revogado</li>
              <li>Versão restaurada</li>
            </ul>
            <p>
              Cada evento mostra quem fez, quando, e detalhes em JSON expandido.
            </p>
          </Subsection>

          <Subsection title="Uso da IA (tokens + custo) 🆕">
            <p>
              Link <code>🤖 Uso IA</code> abre painel com heatmap de custo diário e ranking por feature (importação de escopo, Voice &amp; Tone, Chat IA). Mostra tokens entrada/saída, número de chamadas e custo total em USD por janela (7d/30d/90d).
            </p>
            <p className="text-[11px] text-gray-500">
              Tabela de preços hardcoded em <code>lib/actions/ia-usage.ts</code> — atualizar se Anthropic mudar valores.
            </p>
          </Subsection>
        </Section>

        {/* ────────── Problems Panel (linter) ────────── */}
        <Section id="problems" emoji="🩹" title="Problems Panel (linter)">
          <p>
            Painel lateral que escaneia o fluxo continuamente e aponta problemas estruturais. Toolbar mostra um badge com a contagem; clica pra abrir.
          </p>
          <Subsection title="Checks ativos">
            <ul>
              <li><strong>Texto vazio</strong> — bubble-bot/user sem conteúdo</li>
              <li><strong>Menu sem opções / sem header</strong> — bloqueia export</li>
              <li><strong>Botão / direcionamento sem destino</strong> — fluxo quebrado</li>
              <li><strong>Códigos duplicados</strong> — IDs colidindo (rode &quot;Reordenar IDs&quot;)</li>
              <li><strong>Frame vazio / sem &quot;Início&quot;</strong> — sem ponto de entrada</li>
              <li><strong>Nó inalcançável</strong> — fluxo morto sem caminho de chegada</li>
              <li>🆕 <strong>Variável quebrada</strong> — <code>{'{{x}}'}</code> usada mas não declarada em tracking/IAG/bubble-user</li>
              <li>🆕 <strong>Limites Blip</strong> — btn-short &gt; 20 chars, btn-long &gt; 72, header menu &gt; 60, opção &gt; 24</li>
              <li>🆕 <strong>Loop infinito</strong> — ciclo de bots sem bubble-user (pausa do usuário) pra quebrar</li>
            </ul>
          </Subsection>
          <p>
            <strong>Como usar:</strong> Toolbar Visualizar ▾ → <em>Problemas</em>. Ou <kbd>⌘K</kbd> → digite &quot;problem&quot;. Clica num item pra pular pro nó no canvas.
          </p>
        </Section>

        {/* ────────── Produtividade no canvas (multi-select) ────────── */}
        <Section id="produtividade-canvas" emoji="⚡" title="Produtividade no canvas">
          <p>
            Atalhos e ações que economizam tempo no dia-a-dia, principalmente quando você seleciona vários blocos com <kbd>Shift+click</kbd>.
          </p>
          <Subsection title="Atalhos rápidos">
            <ShortcutsTable
              rows={[
                ['⌘D', 'Duplicar — multi-select clona com edges internas preservadas'],
                ['⌘G', 'Agrupar selecionados num frame novo (com padding automático)'],
                ['Botão direito', 'Menu contextual com Duplicar, Agrupar, Alinhar, Editar em massa, Apagar'],
              ]}
            />
          </Subsection>

          <Subsection title="Alinhar e distribuir">
            <p>
              Selecione 2+ blocos → menu contextual ou <kbd>⌘K</kbd> → busca <em>alinhar</em>. Opções: à esquerda, direita, topo, base, centralizar horizontal/vertical. Com 3+ selecionados, também aparece <strong>Distribuir horizontal/vertical</strong> (espaça uniformemente entre os extremos).
            </p>
          </Subsection>

          <Subsection title="Editar em massa">
            <p>
              Com 2+ blocos selecionados, abra <strong>Editar em massa…</strong> (menu contextual). Modal lista todos os campos de texto editáveis, com ações em massa: aplicar prefixo a todos, travar/destravar de uma vez. Salva tudo em 1 operação (Undo reverte junto).
            </p>
          </Subsection>

          <Subsection title="Inserir variáveis ({{...}})">
            <p>
              Nos campos de texto rich (bubble-bot, header de menu, opções), a toolbar agora tem o botão <code>{'{{ }}'}</code>. Clica e vê todas as variáveis declaradas no fluxo (trackings, IAG saídas, bubble-users) com busca. Click insere <code>{'{{nome}}'}</code> na posição do cursor.
            </p>
          </Subsection>
        </Section>

        {/* ────────── 7. TABELA DE CONTEÚDO ────────── */}
        <Section id="tabela-conteudo" emoji="📊" title="Tabela de conteúdo">
          <p>
            Vista <strong>tipo planilha</strong> com TODOS os textos do fluxo numa só tela. Cada linha é um campo editável (menu = header + footer + N opções; condicional = condição + true label + false label).
          </p>
          <p>
            <strong>Como usar:</strong> Toolbar Visualizar ▾ → <em>Tabela de conteúdo</em>. Edite o texto inline (salva no blur). Filtros por tipo (bot/user/menu/etc.) e por frame.
          </p>
          <Subsection title="Round-trip com cliente (CSV/Excel)">
            <ul>
              <li><strong>CSV</strong>: UTF-8 BOM + separador <code>;</code>, Excel BR abre direto com acentos OK</li>
              <li>🆕 <strong>Excel (.xlsx)</strong>: colunas formatadas, larguras automáticas, header congelado</li>
              <li>🆕 <strong>Importar</strong>: aceita .xlsx ou .csv com colunas <code>nodeId</code>, <code>fieldPath</code>, <code>valor</code>. Match exato por chave, conta diffs e pede confirmação antes de aplicar. Tudo num único Undo.</li>
            </ul>
            <p>
              <strong>Workflow:</strong> exporta Excel → manda pro cliente revisar → cliente devolve a planilha com edições → importa de volta no editor. <em>Não cria/apaga blocos, só atualiza textos existentes.</em>
            </p>
          </Subsection>
          <p>
            Click no ↗ ao final da linha pra navegar até o bloco no canvas.
          </p>
        </Section>

        {/* ────────── Compartilhamento + Comentário externo ────────── */}
        <Section id="compartilhamento" emoji="🤝" title="Compartilhar com cliente">
          <p>
            Toolbar &quot;Compartilhar&quot; (canto superior direito do editor) abre o modal de links públicos. <strong>3 níveis de permissão</strong>:
          </p>
          <FeatureGrid>
            <FeatureCard emoji="👁" title="Visualizar" desc="Só leitura — cliente abre o link, navega o fluxo, não interage." />
            <FeatureCard emoji="💬" title="Comentar 🆕" desc="Cliente vê e COMENTA em blocos. Digita o nome (salva no navegador), comments aparecem no painel interno com sufixo (externo)." />
            <FeatureCard emoji="✏️" title="Editar" desc="Cliente pode mover, editar textos, deletar nodes. Use com cuidado, revogue quando não precisar mais." />
          </FeatureGrid>
          <p>
            Links são <strong>tokens únicos</strong> em <code>/share/[token]</code>. Cliente acessa sem login. Revogue a qualquer momento — o link para de funcionar instantaneamente.
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
