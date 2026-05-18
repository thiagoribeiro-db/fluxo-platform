# Figma Extract Schema

> Contrato de dados pra trazer componentes do Design System pro Fluxo Platform.
>
> Use esse template (ou faça seu plugin Figma gerar esse JSON direto) e me envie.
> Cada componente extraído vira um custom node do React Flow.

---

## Formato

Você pode me passar **um JSON por componente** ou **um array com vários**.

### Schema (JSON)

```jsonc
{
  // ===== IDENTIFICAÇÃO =====
  "figmaNodeId": "14d21f2d796fe63fac3763f664e9966a6a924160",
  "figmaComponentName": "Integração com API",        // nome exato no Figma
  "fluxoType": "integracao-api",                      // slug que vou usar no código (kebab-case)
  "category": "integrations",                         // "integrations" | "ia" | "midia" | "outros"
  "paletteLabel": "Integração API",                   // texto que aparece na paleta
  "paletteIcon": "🔌",                                // emoji ou char p/ paleta
  "paletteDescription": "Chamada HTTP a sistema externo",

  // ===== DIMENSÕES =====
  "width": 280,
  "height": 80,
  "minWidth": 200,
  "minHeight": 60,

  // ===== APARÊNCIA =====
  "background": {
    "type": "solid",                  // "solid" | "linear-gradient"
    "color": "#FFFFFF"                // ou array de cores se gradient
  },
  "border": {
    "color": "#7857FF",
    "width": 1,
    "style": "solid",                 // "solid" | "dashed" | "dotted"
    "radius": 12                      // px
  },
  "shadow": "0 1px 2px rgba(0,0,0,0.08)",   // CSS box-shadow ou null
  "padding": { "top": 12, "right": 16, "bottom": 12, "left": 16 },

  // ===== CONTEÚDO (de cima pra baixo) =====
  "elements": [
    {
      "kind": "icon",                 // "icon" | "text" | "badge" | "divider" | "image"
      "value": "🔌",                  // emoji, SVG path, URL de imagem, etc.
      "size": 24,
      "color": "#7857FF",
      "align": "left"
    },
    {
      "kind": "text",
      "value": "Integração com API",  // texto fixo do componente
      "fontSize": 14,
      "fontWeight": 600,
      "color": "#1F2937",
      "align": "left"
    },
    {
      "kind": "text",
      "value": "POST /api/...",       // ou null se for editável pelo usuário
      "fontSize": 11,
      "fontWeight": 400,
      "color": "#6B7280",
      "editable": true                // se true, vira input no painel direito
    }
  ],

  // ===== CAMPOS EDITÁVEIS NO PAINEL DIREITO =====
  "editableFields": [
    {
      "key": "endpoint",              // chave em FluxoNodeData
      "label": "Endpoint URL",
      "type": "text",                 // "text" | "textarea" | "number" | "select" | "checkbox" | "list"
      "placeholder": "https://api.exemplo.com/v1/...",
      "default": ""
    },
    {
      "key": "method",
      "label": "Método HTTP",
      "type": "select",
      "options": ["GET", "POST", "PUT", "DELETE", "PATCH"],
      "default": "POST"
    }
  ],

  // ===== HANDLES (pontos de conexão) =====
  "handles": {
    "top": true,                      // entrada
    "bottom": true,                   // saída
    "left": false,
    "right": false
  },

  // ===== COMPORTAMENTO =====
  "hasCode": true,                    // se ganha badge de ID (B001, S001, etc.)
  "autoConnect": true,                // se entra na lógica de auto-conexão sequencial

  // ===== VARIANTES (opcional — para "bot/user" das mídias) =====
  "variants": {
    "key": "sender",                  // chave em FluxoNodeData
    "options": [
      { "value": "bot", "label": "Bot envia", "background": "#FFFFFF" },
      { "value": "user", "label": "Usuário envia", "background": "#DCF8C6" }
    ]
  }
}
```

---

## Componentes esperados (11)

Para cada um, preciso do JSON acima. Pode mandar todos juntos como array.

### Integrações (2)
1. **Integração com API** — `figmaNodeId: 14d21f2d796fe63fac3763f664e9966a6a924160`
2. **Integração com planilha** — `figmaNodeId: 13d49cd6267fff08093e7a872465c3f546ab6b76`

### Fluxo IA (3)
3. **Ponto de saída de fluxo de IA** — `333abf6acf33d41dd0491c56fe94bc2919eebae8`
4. **Ponto de reentrada de fluxo de IA** — `12ddbb554dd6dda257c394c45c0a5fbe93a46022`
5. **Ponto de entrada de fluxo de IA** — `11be0dc7bb613e4a6fe2a5611db9e19d4fd3511d`

### Mídias (6)
> Sugestão: agrupar como **1 componente único "Mídia"** com variantes (imagem/documento/vídeo × bot/user).
> Mas se ficar melhor 6 separados, também serve.

6. **Imagem enviada pelo bot** — `1a565f15e852b23a27f91568c6210a64eaeae5b3`
7. **Imagem enviada pelo usuário** — `f0bfe175ca4dded18c7afe8ecc02b7f6900d2299`
8. **Documento enviado pelo bot** — `3748fb9521280f797b0a4df1212de46efecef9ed`
9. **Documento enviado pelo usuário** — `db8392d428e243409b341cfa1766ee6bbfb4f661`
10. **Vídeo enviado pelo bot** — `c19aa42703945c026991d209d719ae21b8787505`
11. **Vídeo enviado pelo usuário** — `50bb5e46f1d9b3e5648b58b4ff3af44d7b8ae01a`

---

## Se for mais fácil, alternativa simplificada

Se preencher esse schema todo for chato, você pode me mandar **só o essencial**:

```jsonc
{
  "figmaNodeId": "...",
  "figmaComponentName": "...",
  "paletteLabel": "...",
  "paletteIcon": "...",
  "background": "#FFFFFF",
  "border": "#7857FF",
  "icon": "🔌",
  "label": "Integração com API",
  "subtitle": "POST /api/...",
  "editableFields": ["endpoint", "method"],
  "hasCode": true
}
```

Mais o **SVG/PNG do componente** como anexo. Com isso já consigo reproduzir 80% do estilo.

---

## O que eu faço quando recebo

1. Gero o React component (`lib/components/nodes/IntegracaoApiNode.tsx`)
2. Registro no `nodeTypes` registry (`lib/components/nodes/index.ts`)
3. Adiciono entrada na paleta (`lib/components/nodes/defaults.ts → PALETTE_ITEMS`)
4. Adiciono os campos editáveis no `PropertiesPanel.tsx`
5. Adiciono estilo CSS no `globals.css`

Tudo isso pra cada componente, em ~5min por componente uma vez que tenho o JSON.

---

## Como gerar o extract no plugin Figma

Se você está fazendo um plugin custom no Figma, aqui está o código JS de exemplo que extrai um node selecionado e gera esse JSON:

```js
// figma-plugin/code.js
const node = figma.currentPage.selection[0];
if (!node) {
  figma.notify('Selecione um componente');
  return;
}

const extract = {
  figmaNodeId: node.id,
  figmaComponentName: node.name,
  width: node.width,
  height: node.height,
  background: extractFills(node.fills),
  border: extractStroke(node),
  shadow: extractEffects(node.effects),
  padding: extractPadding(node),
  elements: [],     // walk children e extrai text/icon/etc
  handles: { top: true, bottom: true },
};

// Walk dos filhos
function walk(n) {
  if (n.type === 'TEXT') {
    extract.elements.push({
      kind: 'text',
      value: n.characters,
      fontSize: n.fontSize,
      fontWeight: n.fontName?.style?.includes('Bold') ? 700 : 400,
      color: rgbToHex(n.fills[0]?.color),
    });
  }
  // ... etc
}

figma.ui.postMessage({ type: 'extract', data: extract });
```

Se você não tem plugin custom, pode usar plugins prontos tipo:
- **"JSON Exporter"** (pega só estrutura básica)
- **"Anima"** ou **"Figma to Code"** (gera HTML/CSS direto)
- **"Design Tokens"** (extrai apenas cores, tipografia, espaçamento)
