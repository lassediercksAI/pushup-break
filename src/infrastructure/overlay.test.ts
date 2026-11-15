// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultCatalog } from '../domain/exercise';
import type { Instant } from '../domain/values';
import { fakeTimers } from '../test/fake-timers';
import { createOverlay, OVERLAY_HOST_ID } from './overlay';

const [pushups] = defaultCatalog;
const plank = defaultCatalog.find((e) => e.id === 'plank') ?? pushups;

const setup = () => {
  const clock = fakeTimers(0);
  const done: string[] = [];
  const overlay = createOverlay(document, clock.timers, () => done.push('done'));
  const host = () => document.getElementById(OVERLAY_HOST_ID);
  const part = (selector: string) => host()?.shadowRoot?.querySelector<HTMLElement>(selector);
  const button = () => part('button') as HTMLButtonElement;
  return { clock, done, overlay, host, part, button };
};

describe('overlay', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('names the exercise in a modal dialog inside a shadow root', () => {
    const { overlay, part, host } = setup();
    overlay.show(pushups, 10_000 as Instant);

    expect(host()?.shadowRoot).not.toBeNull();
    expect(part('.exercise')?.textContent).toBe('Do 5 pushups');
    const dialog = part('[role="alertdialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(host()?.shadowRoot?.activeElement).toBe(dialog);
  });

  it('counts down and unlocks Done after the minimum break', () => {
    const { overlay, part, button, clock, done, host } = setup();
    overlay.show(plank, 10_000 as Instant);
    expect(part('.exercise')?.textContent).toBe('Hold a 30-second plank');
    expect(part('.status')?.textContent).toBe('Done unlocks in 10 s');
    expect(button().disabled).toBe(true);

    button().click();
    expect(done).toEqual([]);

    clock.advance(3_100);
    expect(part('.status')?.textContent).toBe('Done unlocks in 7 s');

    clock.advance(7_000);
    expect(button().disabled).toBe(false);
    expect(part('.status')?.textContent).toBe('Finished? Press Done to keep watching.');
    expect(host()?.shadowRoot?.activeElement).toBe(button());

    clock.advance(1_000);
    button().click();
    expect(done).toEqual(['done']);
  });

  it('removes itself and its timer on hide, and hide is safe to repeat', () => {
    const { overlay, host, clock } = setup();
    overlay.show(pushups, 10_000 as Instant);
    overlay.hide();
    overlay.hide();
    expect(host()).toBeNull();
    expect(clock.activeIntervals()).toBe(0);
  });

  it('replaces an overlay that is already shown', () => {
    const { overlay, clock } = setup();
    overlay.show(pushups, 10_000 as Instant);
    overlay.show(plank, 10_000 as Instant);
    expect(document.querySelectorAll(`#${OVERLAY_HOST_ID}`)).toHaveLength(1);
    expect(clock.activeIntervals()).toBe(1);
  });

  it('keeps keystrokes from reaching the page and traps Tab focus', () => {
    const { overlay, host, button, clock } = setup();
    const reached: string[] = [];
    document.addEventListener('keydown', (e) => reached.push(e.key));
    document.addEventListener('keyup', (e) => reached.push(e.key));
    overlay.show(pushups, 1_000 as Instant);
    const dialog = host()?.shadowRoot?.querySelector('[role="alertdialog"]');

    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    button().dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(host()?.shadowRoot?.activeElement).toBe(dialog);

    clock.advance(1_000);
    button().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }),
    );
    expect(host()?.shadowRoot?.activeElement).toBe(button());

    button().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true, composed: true }),
    );
    button().dispatchEvent(new KeyboardEvent('keyup', { key: 'k', bubbles: true, composed: true }));
    expect(reached).toEqual([]);
  });

  it('moves into the fullscreen element and back', () => {
    const { overlay, host } = setup();
    const player = document.createElement('div');
    document.body.append(player);
    let fullscreen: Element | null = player;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreen,
    });

    overlay.show(pushups, 10_000 as Instant);
    expect(host()?.parentElement).toBe(player);

    fullscreen = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host()?.parentElement).toBe(document.body);

    document.dispatchEvent(new Event('fullscreenchange'));
    expect(host()?.parentElement).toBe(document.body);

    overlay.hide();
    Reflect.deleteProperty(document, 'fullscreenElement');
  });
});
