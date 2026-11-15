import type { SettingsStore } from '../application/ports';
import { SETTINGS_KEY } from '../application/settings';

/** The slice of `browser.storage.local` the store needs. */
export type StorageAreaLike = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

type ChangeListener = (
  changes: Record<string, { readonly newValue?: unknown }>,
  areaName: string,
) => void;

/** The slice of `browser.storage.onChanged` the store needs. */
export type StorageChangedLike = {
  addListener(listener: ChangeListener): void;
  removeListener(listener: ChangeListener): void;
};

/**
 * Settings in `storage.local`, which works in Chrome and Firefox without an
 * add-on ID. Values come back as `unknown`; `parseSettings` validates them.
 */
export const createSettingsStore = (
  area: StorageAreaLike,
  onChanged: StorageChangedLike,
  areaName = 'local',
): SettingsStore => ({
  load: async () => (await area.get(SETTINGS_KEY))[SETTINGS_KEY],
  save: (settings) => area.set({ [SETTINGS_KEY]: settings }),
  subscribe: (listener) => {
    const handle: ChangeListener = (changes, changedArea) => {
      const change = changes[SETTINGS_KEY];
      if (changedArea === areaName && change) listener(change.newValue);
    };
    onChanged.addListener(handle);
    return () => {
      onChanged.removeListener(handle);
    };
  },
});
