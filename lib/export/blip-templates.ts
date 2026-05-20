/**
 * Templates de scripts e states canônicos da Blip — copiados LITERALMENTE
 * dos exemplos em `tmp/json/*.json` que o cliente exportou.
 *
 * São intocados conforme a estrutura observada — qualquer mudança aqui
 * potencialmente quebra a importação na Blip.
 *
 * Convenção: cada função retorna `{ source: string }` ou um state pronto.
 */

import {
  chatStateAction,
  createState,
  executeScriptAction,
  FIXED_POSITIONS,
  inputAction,
  matchesAllOutput,
  redirectAction,
  setVariableAction,
  textMessageAction,
  trackEventAction,
  uuid,
  createConnIdGenerator,
} from './blip-helpers';
import type { BlipState } from './blip-types';

// =============================================================================
// SCRIPT: inputOptionJs (gera o JSON do menu lista WhatsApp)
// =============================================================================

/**
 * Gera o source do script `inputOptionJs` com options dinâmicas.
 * Replica o padrão exato do `saudacao.json` S003.
 */
export function inputOptionJsSource(opts: {
  text: string;
  options: string[];
  footer?: string;
}): string {
  const optionsJs = JSON.stringify(opts.options);
  const itemsJs = opts.options
    .map((o) => `      { name: ['${o.replace(/'/g, "\\'")}'], addNumbering: true },`)
    .join('\n');
  const footer = opts.footer ?? 'Clique no botão "Opções" e selecione uma das alternativas.';
  return `function run() {

  let properties = {
    'header': "",
    'text': \`${opts.text.replace(/`/g, '\\`')}\`,
    'options': ${optionsJs},
    'values': ${optionsJs},
    'footer': \`${footer.replace(/`/g, '\\`')}\`,
    'description': [],
    'button': "Opções",
    'titleOptions': [{ title: "Opções", quantityOfItems: 0 }],
    'items': [
${itemsJs}
    ],
    menuScope: {
      "whatsappButton": false,
      "whatsappList": true,
      "blipchatQuickReply": false,
      "blipchatMenu": true,
      "defaultText": false
    }
  }

  properties.items = addItems(properties.items);

    if (properties.titleOptions.length === 1) properties.titleOptions = [{ title: "Opções", quantityOfItems: properties.items.length }]


  return JSON.stringify(properties);
}

function addItems(items) {
  let newItens = [];
  let newNames;
  let name;
  let match;
  for (let i = 0; i < items.length; i++) {
    name = items[i].name;
    newNames = []
    for (let y = 0; y < items[i].name.length; y++) {
      match = name[y];
      newNames.push(match);
      newNames.push(match.normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""))
      newNames.push(match.toLowerCase());
      newNames.push(match.toUpperCase());
      newItens[i] = { name: newNames };
    }

    if (items[i].addNumbering) {
      newNames.push(\`\${i + 1}\`); // Acrescenta numeração automática
    }
  }
  return newItens;
} `;
}

// =============================================================================
// SCRIPT: objMenu (formata pro canal — WhatsApp/Messenger/Instagram)
// =============================================================================

/** Canônico — não varia entre frames. Copiado literal. */
export const OBJ_MENU_SOURCE = `{{resource.FunctionGetMenu}}

const run = (platform, menu) => {
  menu = JSON.parse(menu);
  platform = platform.toLowerCase();

  if (platform == 'instagram' || platform == 'messenger') {
    const objectType = {
      'type': \`text/plain\`
    }
    return objectType
  };

  let validTextWithHeader = menu.header != "" ? \`\${menu.header}\\n\\n\${menu.text}\` : menu.text
  let text = platform == 'whatsapp' ? menu.text : validTextWithHeader
  let options = platform == 'whatsapp' ? menu.options : getOptionsWithDescription(menu.options, menu.description)

  let default_msg = {
    "text": text,
    "header": menu.header,
    "body": text,
    "footer": menu.footer,
    "button": menu.button,
    "titleOptions": menu.titleOptions,
    "namespaceTemplate": '',
    "nameTemplate": '',
    "options": options,
    "values": menu.values,
    "submenu": [],
    "description": menu.description,
    "menuScope": {
      ...menu.menuScope,
      "platform": platform
    },
  };

  var newMenu = getMenuForPlatform(default_msg);

  return newMenu;
};

function getOptionsWithDescription(options, description) {
  if (description.length > 0) {
    for (let i = 0; i < options.length; i++) {
      for (let y = 0; y < description.length; y++) {
        if (i == y && description[y] != "") {
          options[i] = \`\${options[i]}\\n\${description[y]}\`
        }
      }
    }
  }

  return options
}`;

// =============================================================================
// SCRIPT: validInputJs (valida input do menu)
// =============================================================================

export const VALID_INPUT_JS_SOURCE = `{{resource.FunctionProcessInput}}

function run(input, inputType, platform, menu) {

    try {
        const validacaoMenu = true;
        const erroMenuEspecial = 'ERRO DINAMICO';
        const validacoesInput = {
            nomeCompleto: false,
            telefone: false,
            cpf: false,
            cnpj: false,
            cpfCnpj: false,
            cpfCartao: false,
            email: false,
            data: false,
            nascimento: false,
            img: false,
            imgTxt: false,
            textoNumero: false,
            texto: false,
            numero: false,
            nota: false,
        };

        let processedInput = {
            'type': null,
            'input': null,
            'validation': 'none'
        }

        menu = JSON.parse(menu);
        platform = platform.toUpperCase()

        if (validacaoMenu) {
            processedInput = validaMenu(input, menu, platform)

            if ((processedInput.input == 'ERRO DINAMICO' || processedInput.input == 'ERRO NUMERICO') && erroMenuEspecial != '') {
                processedInput.input = erroMenuEspecial;
            }
            return JSON.stringify(processedInput);

        } else {
            const val = Object.entries(validacoesInput);
            processedInput = validaInput(val, input, inputType)

            if (processedInput.input == 'INPUT SEM VALIDAÇÕES') {
                return JSON.stringify({type: 'success', input: input, validation: 'none'});

            } else {
                return JSON.stringify(processedInput);
            }
        }

    } catch (e) {
        return {type: 'error', input: 'Input Inesperado', validation: 'none'}
    }
}`;

// =============================================================================
// SCRIPT: process userContext (mapeia opção do menu → destino)
// =============================================================================

/**
 * Gera o source do script `process userContext` baseado num optionMap
 * { "Ofertas": "ofertas", "Lojas": "lojas", ... }.
 */
export function processUserContextSource(
  optionMap: Record<string, string>
): string {
  const mapEntries = Object.entries(optionMap)
    .map(
      ([label, addr]) =>
        `        '${label.replace(/'/g, "\\'")}': {
            destinationBot: '${addr}',
            destinationBlock: null
        }`
    )
    .join(',\n');
  return `function run(validInputJs, originBot, originBlock) {
    const optionMap = {
${mapEntries}
    };

    validInputJs = JSON.parse(validInputJs).input
    const selectedConfig = optionMap[validInputJs];

    if (!selectedConfig) {
        return "Input inesperado";
    }

    return {
        originBot: originBot,
        originBlock: originBlock,
        destinationBot: selectedConfig.destinationBot,
        destinationBlock: selectedConfig.destinationBlock
    };
}
`;
}

// =============================================================================
// SCRIPTS: Transbordo (holiday, horário atendimento, valida atendente)
// =============================================================================

export const HOLIDAY_SCRIPT_SOURCE = `function run() {
    // Ajuste para horário de Brasília (UTC-3)
    var agora = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
    var dia = agora.getUTCDay();        // 0 = domingo, 6 = sábado
    var d = agora.getUTCDate();
    var m = agora.getUTCMonth() + 1;
    var y = agora.getUTCFullYear();

    // Fim de semana
    if (dia === 0 || dia === 6) return true;

    // Feriados fixos nacionais (DD/MM)
    var fixos = [
        "01/01", "21/04", "01/05", "07/09",
        "12/10", "02/11", "15/11", "20/11", "25/12"
    ];
    var hoje = (d < 10 ? "0" + d : d) + "/" + (m < 10 ? "0" + m : m);
    if (fixos.indexOf(hoje) !== -1) return true;

    return false;
}`;

export const HORARIO_ATENDIMENTO_SCRIPT_SOURCE = `function run() {
    var horaInicio = 8;
    var horaFim    = 18;

    var agora = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
    var hora = agora.getUTCHours();
    var minuto = agora.getUTCMinutes();

    var minutosAtual = hora * 60 + minuto;
    return minutosAtual >= horaInicio * 60 && minutosAtual < horaFim * 60;
}`;

// =============================================================================
// SCRIPT: platform / channelTags (Requirements state — frame principal)
// =============================================================================

export const PLATFORM_SCRIPT_SOURCE = `function run(contactIdentity) {
    return getUserChannel(contactIdentity);
}

function getUserChannel(contactIdentity) {
    const CHANNEL_INDEX = 1;
    const CHANNEL_IDENTIFIERS = {
        'wa.gw.msging.net': 'WhatsApp',
        '0mn.io': 'BlipChat',
        'take.io': 'TakeSMS',
        'messenger.gw.msging.net': 'Messenger',
        'instagram.gw.msging.net': 'Instagram',
        'abs.gw.msging.net': 'Teams',
        'businessmessages.gw.msging.net': 'gbm',
        'skype.gw.msging.net': 'Skype',
        'telegram.gw.msging.net': 'Telegram',
        'workplace.gw.msging.net': 'Workplace',
        'mailgun.gw.msging.net': 'Email',
        'pagseguro.gw.msging.net': 'PageSeguro'
    };

    let contactChannelId = contactIdentity.split('@')[CHANNEL_INDEX];
    return CHANNEL_IDENTIFIERS[contactChannelId] || 'default';
}`;

export const CHANNEL_TAGS_SCRIPT_SOURCE = `{{resource.FunctionGetMenu}}
function run(platform) {
  return channelTags(platform);
}`;

// =============================================================================
// STATES PADRÃO (onboarding, fallback, error)
// =============================================================================

/**
 * Cria os 3 states obrigatórios + connection ids.
 * Onboarding: input bypass=false, condition matches `.*` → primeiro state real.
 * Fallback: input bypass=true, condition matches `.*` → error.
 * Error: composing + "Desculpe…" + input bypass=true.
 */
export function createSkeletonStates(
  firstRealStateId: string,
  getConnId: () => string,
  /** Quando true, onboarding usa input bypass=false (= sempre primeiro hit captura input). Default false (frame interno). */
  isOnboardingRoot?: boolean
): { onboarding: BlipState; fallback: BlipState; error: BlipState } {
  // ---- ONBOARDING
  const onboarding = createState({
    id: 'onboarding',
    title: 'Início',
    position: FIXED_POSITIONS.onboarding,
    root: true,
    defaultOutputStateId: 'fallback',
  });
  onboarding.$contentActions = [inputAction(false)];
  onboarding.$conditionOutputs = [
    matchesAllOutput(firstRealStateId, getConnId()),
  ];
  // ---- FALLBACK
  const fallback = createState({
    id: 'fallback',
    title: 'Exceções',
    position: FIXED_POSITIONS.fallback,
    defaultOutputStateId: 'onboarding',
  });
  fallback.$contentActions = [inputAction(true)];
  fallback.$conditionOutputs = [matchesAllOutput('error', getConnId())];
  // ---- ERROR
  const error = createState({
    id: 'error',
    title: 'Erro padrão',
    position: FIXED_POSITIONS.error,
    defaultOutputStateId: 'onboarding',
  });
  error.$contentActions = [
    chatStateAction('00000000-0000-0000-0000-000000000002'),
    textMessageAction(
      'Desculpe, não consegui entender!',
      '00000000-0000-0000-0000-000000000003'
    ),
    inputAction(true),
  ];

  void isOnboardingRoot; // reservado pra cenários futuros
  return { onboarding, fallback, error };
}

// =============================================================================
// STATE: Requirements (frame principal — define vars iniciais)
// =============================================================================

/**
 * Cria o state Requirements completo, hardcoded igual ao `saudacao.json`.
 * `originBot` é o address (camelCase) do frame principal.
 */
export function createRequirementsState(
  originBot: string,
  welcomeStateId: string,
  getConnId: () => string
): BlipState {
  const state = createState({
    id: uuid(),
    title: 'Requirements',
    position: { top: '139px', left: '420px' },
  });
  state.$contentActions = [inputAction(true)];
  state.$conditionOutputs = [
    {
      stateId: welcomeStateId,
      typeOfStateId: 'state',
      $connId: getConnId(),
      $id: uuid(),
      conditions: [{ source: 'input', comparison: 'exists', values: [] }],
      $invalid: false,
    },
  ];
  state.$enteringCustomActions = [
    executeScriptAction({
      title: 'platform',
      source: PLATFORM_SCRIPT_SOURCE,
      inputVariables: ['contact.identity'],
      outputVariable: 'platform',
    }),
    executeScriptAction({
      title: 'channelTags',
      source: CHANNEL_TAGS_SCRIPT_SOURCE,
      inputVariables: ['platform'],
      outputVariable: 'channelTags',
    }),
    setVariableAction({
      title: 'openBold',
      variable: 'n1',
      value: '{{channelTags@bold.open}}',
      expiration: null,
    }),
    setVariableAction({
      title: 'closeBold',
      variable: 'n2',
      value: '{{channelTags@bold.close}}',
    }),
    setVariableAction({
      title: 'italicValue',
      variable: 'italicValue',
      value: '{{channelTags@italic}}',
    }),
    setVariableAction({
      title: 'Set "newAttendance"',
      variable: 'newAttendance',
      value: 'true',
      conditions: [
        { source: 'context', comparison: 'notExists', variable: 'newAttendance', values: [] },
      ],
    }),
    setVariableAction({
      title: 'Set "originBot"',
      variable: 'originBot',
      value: originBot,
    }),
  ];
  return state;
}

// =============================================================================
// STATE: Redirect-To-Services (frame principal — pós-menu)
// =============================================================================

/**
 * State Redirect-To-Services — usa `{{userContext}}` pra rotear dinamicamente
 * baseado na escolha do menu (process userContext gerou o destinationBot).
 */
export function createRedirectToServicesState(getConnId: () => string): BlipState {
  void getConnId;
  const state = createState({
    id: uuid(),
    title: 'R - Redirect To "Services"',
    position: { top: '580px', left: '641px' },
  });
  state.$contentActions = [inputAction(true)];
  state.$leavingCustomActions = [
    redirectAction({
      contextValue: '{{userContext}}',
      address: '{{userContext@destinationBot}}',
    }),
  ];
  state.$defaultOutput = {
    stateId: 'onboarding',
    $invalid: false,
    typeOfStateId: 'state',
  };
  state.$tags = [
    {
      id: `blip-tag-${uuid()}`,
      label: 'Redirect',
      background: '#1EA1FF',
      canChangeBackground: false,
    },
  ];
  return state;
}

// =============================================================================
// HARDCODED IDS DE WELCOME / ERROR (replicar exemplos)
// =============================================================================

export const HARDCODED_WELCOME_CHATSTATE_ID =
  '00000000-0000-0000-0000-000000000000';
export const HARDCODED_WELCOME_TEXT_ID = '00000000-0000-0000-0000-000000000001';

// Re-exports utilitários
export { trackEventAction, createConnIdGenerator };
