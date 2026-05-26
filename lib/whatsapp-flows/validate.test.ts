import { describe, it, expect } from 'vitest';
import { validateFlow } from './validate';
import { createComponent } from './components';
import type { WhatsAppFlowScreen } from '@/lib/types';

describe('validateFlow', () => {
  it('reporta no-entry-screen quando nenhuma entry', () => {
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [] },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'no-entry-screen', severity: 'error' })
    );
  });

  it('reporta multiple-entry-screens quando >1 entry', () => {
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [], isEntry: true },
      { id: 's2', title: 'B', components: [], isEntry: true },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'multiple-entry-screens' })
    );
  });

  it('reporta navigate-target-missing quando aponta pra screen inexistente', () => {
    const footer = createComponent('Footer');
    if (footer.type !== 'Footer') throw new Error('wrong');
    footer.onClickAction = { name: 'navigate', next: { name: 'inexistente' } };
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({
        code: 'navigate-target-missing',
        severity: 'error',
      })
    );
  });

  it('reporta screen-no-footer warning quando screen sem CTA de saída', () => {
    const heading = createComponent('TextHeading');
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [heading], isEntry: true },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({
        code: 'screen-no-footer',
        severity: 'warning',
      })
    );
  });

  it('NÃO reporta screen-no-footer quando tem Footer', () => {
    const footer = createComponent('Footer');
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true, isTerminal: true },
    ];
    const probs = validateFlow({ screens });
    expect(probs.filter((p) => p.code === 'screen-no-footer')).toHaveLength(0);
  });

  it('reporta orphan-screen pra screen não alcançável', () => {
    const footer = createComponent('Footer'); // s1 vai pra complete
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true, isTerminal: true },
      { id: 's2', title: 'Órfã', components: [createComponent('Footer')] },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'orphan-screen', screenId: 's2' })
    );
  });

  it('reporta no-terminal-reachable quando nenhum caminho leva a complete', () => {
    // s1 navega pra s2, s2 navega pra s1 — sem nenhum complete
    const navS2 = createComponent('Footer');
    if (navS2.type !== 'Footer') throw new Error('wrong');
    navS2.onClickAction = { name: 'navigate', next: { name: 's2' } };
    const navS1 = createComponent('Footer');
    if (navS1.type !== 'Footer') throw new Error('wrong');
    navS1.onClickAction = { name: 'navigate', next: { name: 's1' } };

    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [navS2], isEntry: true },
      { id: 's2', title: 'B', components: [navS1] },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'no-terminal-reachable' })
    );
  });

  it('reporta duplicate-input-name quando 2 inputs têm o mesmo name', () => {
    const t1 = createComponent('TextInput');
    if (t1.type !== 'TextInput') throw new Error('wrong');
    t1.name = 'email';
    const t2 = createComponent('TextInput');
    if (t2.type !== 'TextInput') throw new Error('wrong');
    t2.name = 'email';
    const footer = createComponent('Footer');
    const screens: WhatsAppFlowScreen[] = [
      {
        id: 's1',
        title: 'A',
        components: [t1, t2, footer],
        isEntry: true,
        isTerminal: true,
      },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'duplicate-input-name' })
    );
  });

  it('reporta image-no-src quando Image sem URL', () => {
    const img = createComponent('Image');
    const footer = createComponent('Footer');
    const screens: WhatsAppFlowScreen[] = [
      {
        id: 's1',
        title: 'A',
        components: [img, footer],
        isEntry: true,
        isTerminal: true,
      },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({ code: 'image-no-src' })
    );
  });

  it('reporta data-exchange-no-endpoint quando data_exchange sem dataChannelUri', () => {
    const footer = createComponent('Footer');
    if (footer.type !== 'Footer') throw new Error('wrong');
    footer.onClickAction = { name: 'data_exchange' };
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true, isTerminal: true },
    ];
    const probs = validateFlow({ screens });
    expect(probs).toContainEqual(
      expect.objectContaining({
        code: 'data-exchange-no-endpoint',
        severity: 'error',
      })
    );
  });

  it('NÃO reporta data-exchange-no-endpoint quando dataChannelUri configurado', () => {
    const footer = createComponent('Footer');
    if (footer.type !== 'Footer') throw new Error('wrong');
    footer.onClickAction = { name: 'data_exchange' };
    const screens: WhatsAppFlowScreen[] = [
      { id: 's1', title: 'A', components: [footer], isEntry: true, isTerminal: true },
    ];
    const probs = validateFlow({
      screens,
      dataChannelUri: 'https://api.empresa.com/flow',
    });
    expect(
      probs.filter((p) => p.code === 'data-exchange-no-endpoint')
    ).toHaveLength(0);
  });

  it('flow válido (entry + Footer complete) não reporta errors', () => {
    const footer = createComponent('Footer');
    const screens: WhatsAppFlowScreen[] = [
      {
        id: 's1',
        title: 'OK',
        components: [footer],
        isEntry: true,
        isTerminal: true,
      },
    ];
    const probs = validateFlow({ screens });
    const errors = probs.filter((p) => p.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
