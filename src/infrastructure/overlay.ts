import type { Overlay } from '../application/ports';
import { describeExercise, type Exercise } from '../domain/exercise';
import type { Instant } from '../domain/values';
import type { Timers } from './youtube-player';

export const OVERLAY_HOST_ID = 'pushup-break-overlay';
const REFRESH_MS = 250;

const styles = `
  :host { all: initial; }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: grid;
    place-items: center;
    background: rgb(4 47 46 / 0.82);
    backdrop-filter: blur(6px);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    color: #f0fdfa;
  }
  .card {
    max-width: min(32rem, calc(100vw - 2rem));
    padding: 2.5rem 2rem 2rem;
    border-radius: 1.25rem;
    background: #0f766e;
    box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.45);
    text-align: center;
    outline: none;
  }
  .label {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #99f6e4;
  }
  .exercise {
    margin: 0 0 1rem;
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    line-height: 1.2;
  }
  .status {
    margin: 0 0 1.75rem;
    font-size: 1rem;
    color: #ccfbf1;
    min-height: 1.5em;
  }
  button {
    font: inherit;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 0.75rem 2.5rem;
    border: 0;
    border-radius: 999px;
    background: #f0fdfa;
    color: #134e4a;
    cursor: pointer;
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button:focus-visible { outline: 3px solid #fbbf24; outline-offset: 3px; }
`;

type Shown = {
  readonly host: HTMLElement;
  readonly interval: number;
};

/**
 * A full-page overlay in a shadow root, so YouTube's styles cannot reach
 * it. It names the exercise, counts down to `unlockAt`, and enables the Done
 * button once the minimum break length has passed.
 */
export const createOverlay = (doc: Document, timers: Timers, onDone: () => void): Overlay => {
  let shown: Shown | null = null;

  // In fullscreen only the fullscreen element is visible, so the overlay moves into it.
  const parent = (): Element => doc.fullscreenElement ?? doc.body;
  const reparent = () => {
    if (shown && shown.host.parentElement !== parent()) parent().append(shown.host);
  };

  const hide = () => {
    if (!shown) return;
    timers.clearInterval(shown.interval);
    shown.host.remove();
    shown = null;
    doc.removeEventListener('fullscreenchange', reparent);
  };

  const show = (exercise: Exercise, unlockAt: Instant) => {
    hide();
    const host = doc.createElement('div');
    host.id = OVERLAY_HOST_ID;
    const root = host.attachShadow({ mode: 'open' });

    const style = doc.createElement('style');
    style.textContent = styles;

    const backdrop = doc.createElement('div');
    backdrop.className = 'backdrop';

    const card = doc.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'exercise');
    card.setAttribute('aria-describedby', 'status');
    card.tabIndex = -1;

    const label = doc.createElement('p');
    label.className = 'label';
    label.textContent = 'Pushup break';

    const heading = doc.createElement('h2');
    heading.className = 'exercise';
    heading.id = 'exercise';
    heading.textContent = describeExercise(exercise);

    const status = doc.createElement('p');
    status.className = 'status';
    status.id = 'status';
    status.setAttribute('aria-live', 'polite');

    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Done';
    button.disabled = true;
    button.addEventListener('click', () => {
      if (!button.disabled) onDone();
    });

    card.append(label, heading, status, button);
    backdrop.append(card);
    root.append(style, backdrop);

    // Keep keystrokes away from YouTube's shortcuts and keep focus inside the dialog.
    const trapKeys = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Tab') {
        event.preventDefault();
        (button.disabled ? card : button).focus();
      }
    };
    host.addEventListener('keydown', trapKeys);
    host.addEventListener('keyup', (event) => {
      event.stopPropagation();
    });

    const refresh = () => {
      const left = Math.ceil((unlockAt - timers.now()) / 1000);
      if (left > 0) {
        status.textContent = `Done unlocks in ${left} s`;
        return;
      }
      if (button.disabled) {
        status.textContent = 'Finished? Press Done to keep watching.';
        button.disabled = false;
        button.focus();
      }
    };

    parent().append(host);
    doc.addEventListener('fullscreenchange', reparent);
    card.focus();
    refresh();
    shown = { host, interval: timers.setInterval(refresh, REFRESH_MS) };
  };

  return { show, hide };
};
