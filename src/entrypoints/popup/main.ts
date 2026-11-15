import { browser } from 'wxt/browser';
import { parseSettings, toStoredSettings } from '../../application/settings';
import { watchInterval } from '../../domain/values';
import { createSettingsStore } from '../../infrastructure/settings-store';

const store = createSettingsStore(browser.storage.local, browser.storage.onChanged);

const slider = document.querySelector<HTMLInputElement>('#interval');
const value = document.querySelector<HTMLOutputElement>('#interval-value');
const saved = document.querySelector<HTMLParagraphElement>('#saved');

const label = (minutes: number) => `${minutes} minutes`;

const init = async (input: HTMLInputElement, output: HTMLOutputElement, status: HTMLElement) => {
  const { watchInterval: current } = parseSettings(await store.load());
  input.value = String(current);
  output.value = label(current);

  input.addEventListener('input', () => {
    output.value = label(input.valueAsNumber);
  });

  input.addEventListener('change', () => {
    const interval = watchInterval(input.valueAsNumber);
    if (!interval.ok) return;
    void store.save(toStoredSettings(interval.value)).then(() => {
      status.textContent = 'Saved.';
    });
  });
};

if (slider && value && saved) void init(slider, value, saved);
