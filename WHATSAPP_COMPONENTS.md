# WhatsApp Components — Auditoria

Referência única dos componentes WhatsApp Business Platform e o status de cada um no Fluxo Platform.

**Atualizar este doc** sempre que implementar/ajustar um componente — é o contrato com o time.

Última revisão: 2026-05-25.

---

## Legenda

- ✅ **Suportado** — componente implementado, exportável pro Blip Flow, parser detecta
- ⚠️ **Parcial** — existe mas falta ajuste (limites, sub-campos, validações)
- ❌ **Faltante** — não implementado
- 🔒 **Interno** — não é componente Meta, é orquestração interna do Fluxo (condicional, direcionamento, etc.)

---

## 1. Mensagens simples (single message)

### 1.1 Texto

| Componente | Status | Tipo no Fluxo | Limite oficial |
|---|---|---|---|
| Mensagem bot | ✅ | `bubble-bot` | body 4096 chars |
| Input do usuário | ✅ | `bubble-user` | (UI no editor; coleta texto) |
| Reply quoted (citar mensagem) | ❌ | — | `context.message_id` |
| Mention (@user) | ❌ | — | Grupos only — não business |
| Reaction (emoji) | ❌ | — | 1 emoji unicode |

### 1.2 Mídia

| Componente | Status | Tipo no Fluxo | Mime | Tamanho |
|---|---|---|---|---|
| Imagem | ✅ | `midia-imagem-bot/user` | jpeg, png | **5MB** |
| Vídeo | ✅ | `midia-video-bot/user` | mp4, 3gpp | **16MB** |
| Documento | ✅ | `midia-documento-bot/user` | pdf, doc, docx, xls, xlsx, ppt, pptx, txt | **100MB** |
| Áudio | ✅ | `midia-audio-bot/user` | ogg opus, mp3, aac, mp4 audio, amr | **16MB** |
| Sticker | ❌ | — | webp (estático/animado) | **100KB estático / 500KB animado** |

**Caption**: até 1024 chars (image/video/document — áudio/sticker não suportam).

### 1.3 Geo & contato

| Componente | Status | Tipo no Fluxo | Fields |
|---|---|---|---|
| Location bot envia | ❌ | — | latitude, longitude, name, address |
| Location request (bot pede) | ❌ | — | interactive `location_request_message` |
| Contact card | ❌ | — | array de contatos (vCard 3.0) |

### 1.4 Outros

| Componente | Status | Tipo no Fluxo | Notas |
|---|---|---|---|
| Link com preview de URL | ⚠️ | `link` | falta flag explícita `preview_url` |
| Forward | 🔒 | — | leitura apenas (não envio) |
| View once | ❌ | — | flag em mídia |

---

## 2. Interactive messages

### 2.1 Botões (quick-reply)

No WhatsApp Cloud API só existe **um tipo** de botão de resposta: `interactive.button` (quick-reply). No Fluxo Platform isso é representado por **dois nodes visuais** com a mesma função:

- **`btn-short`** — renderiza compacto em row horizontal (usar quando há 2-3 opções)
- **`btn-long`** — renderiza ocupando largura inteira (usar quando há 1 única opção)

⚠️ Ambos mapeiam pro mesmo `interactive.button`. Os limites Meta valem pra somatório:

| Componente | Status | Tipo no Fluxo | Limite |
|---|---|---|---|
| Quick-reply curto | ✅ | `btn-short` | label **20 chars** (validado) |
| Quick-reply largo | ✅ | `btn-long` | label **20 chars** (validado) |
| **Total quick-replies por mensagem** | ✅ | `btn-short` + `btn-long` somados | **3 max** (validado) |
| Body acima dos botões | ✅ | `bubble-bot` antes do(s) botão(ões) | 1024 chars |

### 2.2 CTA URL Button

| Componente | Status | Tipo no Fluxo | Fields |
|---|---|---|---|
| CTA URL Button | ❌ | — | `display_text` (até 20 chars), `url`. Única CTA por mensagem; NÃO combina com quick-reply na mesma mensagem |

⚠️ Para abrir URL externa no navegador é necessário um componente novo — `btn-long` NÃO faz isso (é só quick-reply largo). Implementação na task #201.

### 2.3 List Message (menu)

| Componente | Status | Tipo no Fluxo | Limite oficial |
|---|---|---|---|
| Header text | ✅ | `menu.header` | **60 chars** |
| Body | ✅ | `menu` (via bubble anterior) | 4096 chars |
| Footer | ⚠️ | `menu.footer` | **60 chars** (atualmente sem limite) |
| Button text (CTA) | ✅ | `menu.footer` field | **20 chars** |
| **Seções** | ❌ | — | **10 seções max**, title **24 chars** |
| Item label | ✅ | `menu.options[]` | **24 chars** |
| Item description | ❌ | — | **72 chars** |
| Total items | ⚠️ | — | **10 itens TOTAIS** (atual linter checa por opção, não total) |

⚠️ **Próximo passo (task #213)**: menu atual é flat. Suportar `sections[].items[].{label, description}`.

### 2.4 Catalog & Products (commerce)

| Componente | Status | Tipo no Fluxo | Notas |
|---|---|---|---|
| Catalog message (CTA "Ver catálogo") | ❌ | — | `interactive.type: catalog_message` |
| Single Product Message (SPM) | ❌ | — | catalog_id + product_retailer_id |
| Multi-Product Message (MPM) | ❌ | — | até **30 produtos** em até **10 seções** |

### 2.5 Location

| Componente | Status | Tipo no Fluxo |
|---|---|---|
| Interactive `location_request_message` | ❌ | — |

### 2.6 WhatsApp Flows

| Componente | Status | Tipo no Fluxo | Notas |
|---|---|---|---|
| 🌟 Flow trigger (CTA) | ✅ | `whatsapp-flow` | bloco no canvas com nome, categoria, triggerLabel + sub-editor completo |
| 🌟 Flow JSON (telas + componentes) | ✅ | (sub-editor) | 14 componentes + routing + data_exchange + export JSON v7.1 |

---

## 3. Templates HSM (mensagens fora janela 24h)

Templates pré-aprovados pela Meta. Usados pra **utility, marketing, authentication**.

| Componente | Status | Notas |
|---|---|---|
| Template base (Header/Body/Footer/Buttons) | ❌ | crítico pra fora-da-janela-24h |
| Header text | ❌ | até **60 chars** |
| Header media (image/video/document/location) | ❌ | |
| Body com variáveis `{{1}}`, `{{2}}` | ❌ | até **1024 chars** |
| Footer | ❌ | até **60 chars** |
| Buttons quick_reply (até 3) | ❌ | mesma regra do interactive |
| Buttons URL / phone / copy_code | ❌ | |
| **Carousel** (até 10 cards) | ❌ | cada card = media + body + 2 botões |
| **LTO** (Limited Time Offer) | ❌ | template promocional com timer |
| **Coupon Code** | ❌ | botão que copia código |
| **OTP one-tap** | ❌ | autenticação 2FA com auto-fill |
| **MPM template** (catálogo com produtos) | ❌ | |

---

## 4. WhatsApp Flows (sub-projeto)

Mini-app interativo dentro do WhatsApp pra coletar dados estruturados (forms).
**Spec atual**: Flow JSON v7.1 (Meta, maio 2026).

### 4.1 Estrutura

- **Categoria** (obrigatório no Flow JSON): `SIGN_UP`, `SIGN_IN`, `APPOINTMENT_BOOKING`, `LEAD_GENERATION`, `CONTACT_US`, `CUSTOMER_SUPPORT`, `SURVEY`, `SHOPPING`, `OTHER`
- **Screens** (até **10 por Flow**): cada screen empilha componentes verticalmente
- **Routing model**: grafo de navegação entre screens
- **Data channel** (opcional): endpoint backend pra data_exchange

### 4.2 Componentes Flow

#### Layout (texto, não-interativos)

| Componente | Status | Limite |
|---|---|---|
| TextHeading | ❌ | 80 chars |
| TextSubheading | ❌ | 80 chars |
| TextBody | ❌ | 4096 chars |
| TextCaption | ❌ | 409 chars |
| Image | ❌ | base64 ou URL — 300KB max |
| EmbeddedLink | ❌ | texto + URL |

#### Input

| Componente | Status | Fields |
|---|---|---|
| TextInput | ❌ | input-type (text/number/email/password/passcode/phone), required, min/max chars, helper |
| TextArea | ❌ | required, label, helper |
| RadioButtonsGroup | ❌ | options[], required, on-select-action |
| CheckboxGroup | ❌ | options[], min/max selected, required |
| Dropdown | ❌ | options[], required |
| DatePicker | ❌ | min/max date, unavailable-dates |
| OptIn | ❌ | label + on-click-action |

#### Controle

| Componente | Status | Notas |
|---|---|---|
| Footer | ❌ | label + on-click-action (Navigate next / DataExchange / Complete) |
| If | ❌ | renderização condicional baseada em valor de input anterior |
| Switch | ❌ | múltiplas branches condicionais |

### 4.3 Roteamento e dados

| Recurso | Status |
|---|---|
| Routing model (next-screen mapping) | ✅ Footer com action `navigate` + auto-build do routing_model no export |
| Data exchange (request → endpoint, response → screen) | ✅ Action `data_exchange` + campo `dataChannelUri` no inspector + validador |
| Preview interativo (mockup WhatsApp) | ✅ Runtime simulado com inputs reais + validação de required + navegação entre screens + tela de complete |
| Export Flow JSON (Meta v7.1) | ✅ `buildFlowJson()` + `data_channel_uri` + botão "Baixar Flow JSON" |
| Validação local (lint) | ✅ `validateFlow()` — 9 checks (entry, terminal, navigate target, orphan, data-exchange-no-endpoint, etc) |
| Dry-run via Graph API | ❌ (futuro — depende de credenciais Meta da org) |

### 4.4 Estado atual (sub-projeto Flows ENCERRADO — #206→#212 ✅)

- ✅ Tipo `whatsapp-flow` no FluxoNodeType
- ✅ Node visual no canvas (card verde com nome + categoria + screens count + badge atualização)
- ✅ Sub-editor modal: lista de screens + paleta + mockup WhatsApp + inspector
- ✅ Adicionar/remover/renomear screens (limite 10)
- ✅ Marcar screen como entry (1 max) e terminal (várias)
- ✅ Categoria Meta selecionável + TriggerLabel editável
- ✅ **14 componentes Flow** disponíveis na paleta:
  - Texto: TextHeading, TextSubheading, TextBody, TextCaption
  - Visual: Image, EmbeddedLink
  - Inputs: TextInput, TextArea, RadioButtonsGroup, CheckboxGroup, Dropdown, DatePicker, OptIn
  - Controle: Footer (com action navigate/data_exchange/complete)
- ✅ Render fiel WhatsApp no mockup central; click no component abre inspector
- ✅ Inspector com props editáveis (label, name, required, helper, dataSource, etc) + reordenar/deletar
- ✅ Auto-save junto do projeto principal (mesma estrutura `node.data`)
- ✅ Validador completo + badge no header com count de erros/avisos
- ✅ Botão "Baixar Flow JSON" gera arquivo Meta v7.1 pronto pra publicação
- ✅ Campo `dataChannelUri` no inspector pra configurar endpoint de `data_exchange`
- ✅ **Preview interativo** — toggle 🟢 Play no header: substitui o mockup estático pelo runtime simulado, que aceita inputs reais, valida `required`, navega entre screens via Footer.navigate, e mostra payload final ao Footer.complete

---

## 5. Componentes internos do Fluxo Platform

Não são componentes Meta — orquestração interna que o exportador resolve.

| Componente | Status | Função |
|---|---|---|
| Frame | 🔒 | Container visual no canvas |
| Entry point | 🔒 | Marcador de início de fluxo dentro de frame |
| Tracking tag | 🔒 | Tag de evento (vira ContextSet no Blip) |
| Exceção | 🔒 | Tag de erro/saída excepcional |
| Direcionamento | 🔒 | Pulo pra outro frame (vira Redirect no Blip) |
| Condicional (if/else) | 🔒 | Decisão com 2 saídas (vira condition no state) |
| Atendimento humano | 🔒 | Transbordo bot → humano (Redirect pra transbordo) |
| IA generativa (entrada/reentrada/saída) | 🔒 | Chamada Claude pelo Blip extension |
| Integração API | 🔒 | HTTP call no Blip Action |
| Integração planilha | 🔒 | Read/write Sheets via extension |

---

## 6. Limites importantes da WhatsApp Cloud API

| Recurso | Limite |
|---|---|
| Body text geral | 4096 chars |
| Caption mídia | 1024 chars |
| Header text (list/template) | 60 chars |
| Footer (list/template) | 60 chars |
| Quick reply label | 20 chars |
| Quick reply count | 3 por mensagem |
| List section title | 24 chars |
| List item label | 24 chars |
| List item description | 72 chars |
| List sections | 10 max |
| List items totais | 10 max |
| CTA URL text | 20 chars |
| Imagem | 5MB |
| Vídeo | 16MB |
| Áudio | 16MB |
| Documento | 100MB |
| Sticker estático | 100KB |
| Sticker animado | 500KB |
| Carousel cards | 10 max |
| MPM produtos | 30 itens / 10 seções |

---

## Referências

- [WhatsApp Cloud API — Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [Interactive Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/interactive-messages)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [WhatsApp Flows — JSON Reference](https://developers.facebook.com/docs/whatsapp/flows/reference)
- [Flows Components Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/components)
