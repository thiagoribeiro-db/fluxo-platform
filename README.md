# Fluxo Platform

> Plataforma de design de fluxos conversacionais para chatbots (padrão Blip/Digitalbot).

## 🎯 O que faz

- **Editor visual** de fluxos conversacionais com drag/drop (React Flow)
- **Componentes nativos** do WhatsApp: BOT bubble, USER bubble, menu modal, botões, trackings, exceções, direcionamentos
- **Colaboração em tempo real**: presença, cursores, comentários ancorados em blocos
- **Multi-tenant**: organizações com roles (admin/editor/viewer)
- **Compartilhamento**: links públicos ou internos via URL
- **Exportação**: HTML, PDF, PNG por frame

## 🏗 Stack

| Camada | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript |
| Estilo | Tailwind CSS |
| Editor canvas | @xyflow/react (React Flow) |
| State | Zustand |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) |
| Hosting | Vercel (front) + Supabase (back) |
| Export PDF | jsPDF + html2canvas (client) |

## 📁 Estrutura do projeto

```
fluxo-platform/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, signup
│   ├── (dashboard)/            # Dashboard logado
│   │   ├── projects/           # Lista de projetos
│   │   └── editor/[id]/        # Editor de fluxo
│   ├── share/[token]/          # View pública via share token
│   ├── api/                    # API routes (Server Actions ou route handlers)
│   └── layout.tsx
├── components/
│   ├── editor/                 # Editor canvas + toolbars
│   ├── palette/                # Sidebar com componentes drag-source
│   ├── panels/                 # Property panel, layers panel
│   └── comments/               # Comment threads + mentions
├── lib/
│   ├── components/nodes/       # Custom React Flow nodes (BotBubble, UserBubble, etc.)
│   ├── db/                     # Database helpers
│   └── supabase/               # Supabase client + helpers
├── public/                     # Static assets
├── supabase/
│   └── migrations/             # SQL migrations
└── docs/                       # Documentação técnica
```

## 🚀 Setup local

### Pré-requisitos
- Node.js 20+
- Conta Supabase (free tier)
- Conta Vercel (free tier)

### Passos

1. **Clone e instale dependências:**
   ```bash
   git clone <repo>
   cd fluxo-platform
   npm install
   ```

2. **Configure Supabase** (passo a passo detalhado):

   **a) Crie o projeto**
   - Acesse [supabase.com](https://supabase.com) → New project
   - Anote a senha do banco (pode precisar depois)
   - Espere ~1 minuto até o projeto ficar pronto

   **b) Pegue as chaves**
   - Settings (⚙️) → API
   - Copie:
     - `Project URL` → vira `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` (key) → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` (key) → vira `SUPABASE_SERVICE_ROLE_KEY` (mantém em segredo)

   **c) Rode a migration**
   - SQL Editor (no menu lateral) → New query
   - Cole o conteúdo de `supabase/migrations/001_initial_schema.sql` → Run
   - Você deve ver: "Success. No rows returned"

   **d) Configure o magic link**
   - Authentication → Providers → Email (já vem habilitado)
   - Authentication → URL Configuration:
     - `Site URL`: `http://localhost:3000`
     - `Redirect URLs` (adicione cada uma):
       - `http://localhost:3000/auth/callback`
       - (em produção, depois) `https://seu-dominio.vercel.app/auth/callback`

   **e) (Opcional) Desligue confirmação de e-mail em dev**
   - Authentication → Providers → Email → "Confirm email" → OFF
   - Em dev, com isso o magic link funciona direto sem precisar confirmar conta

3. **Configure variáveis de ambiente:**
   ```bash
   cp .env.example .env.local
   ```
   Edite `.env.local` com suas chaves do Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
   SUPABASE_SERVICE_ROLE_KEY=ey...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Rodar dev:**
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000

5. **Primeiro login:**
   - Clique em "Entrar →"
   - Digite seu e-mail → "Enviar link de acesso"
   - Verifique seu e-mail (pode cair no spam) → clique no link
   - Você será levado para o dashboard
   - Crie seu primeiro projeto pelo botão "+ Novo projeto"

### Deploy no Vercel

1. Push pro GitHub
2. Importa no Vercel
3. Cole as env vars
4. Deploy automático

## 🎨 Componentes customizados (custom React Flow nodes)

| Node type | Componente | O que renderiza |
|---|---|---|
| `bubble-bot` | BotBubbleNode | Balão BOT (WhatsApp recebido) |
| `bubble-user` | UserBubbleNode | Balão USER (WhatsApp enviado) |
| `menu` | MenuNode | Menu modal com opções + ENVIAR |
| `btn-short` | BtnShortNode | Botão curto (em linha) |
| `btn-long` | BtnLongNode | Botão longo (em linha vertical) |
| `tracking` | TrackingNode | Tag de tracking |
| `excecao` | ExcecaoNode | Badge de exceção |
| `direcionamento` | DirecionamentoNode | Direcionamento verde (clicável) |
| `frame` | FrameNode | Container agrupador (header roxo + body) |

## 🗺 Roadmap

- [x] Fase 0: Setup do projeto + schema
- [x] Fase 1: Editor canvas + 9 custom nodes
- [x] Fase 2: Auth (magic link) + criar/listar projetos + autosave
- [ ] Fase 3: Painel de propriedades + paleta de inserção
- [ ] Fase 4: Sharing (URL público + permissões)
- [ ] Fase 5: Comments + threads + mentions
- [ ] Fase 6: Realtime (presença + cursores)
- [ ] Fase 7: Export (HTML, PDF, PNG)
- [ ] Fase 8: Templates + versioning
- [ ] Fase 9: SSO (Google/Microsoft) + audit log
