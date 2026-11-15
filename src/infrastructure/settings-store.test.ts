import { describe, expect, it } from 'vitest';
import {
  createSettingsStore,
  type StorageAreaLike,
  type StorageChangedLike,
} from './settings-store';

type Listener = Parameters<StorageChangedLike['addListener']>[0];

const fakeStorage = (initial: Record<string, unknown> = {}) => {
  const data = new Map(Object.entries(initial));
  const listeners = new Set<Listener>();
  const area: StorageAreaLike = {
    get: (key) => Promise.resolve(data.has(key) ? { [key]: data.get(key) } : {}),
    set: (items) => {
      Object.entries(items).forEach(([key, value]) => data.set(key, value));
      return Promise.resolve();
    },
  };
  const onChanged: StorageChangedLike = {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
  };
  const emit = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    listeners.forEach((listener) => {
      listener(changes, areaName);
    });
  };
  return { area, onChanged, emit, data, listeners };
};

describe('settings store', () => {
  it('loads the stored value, or undefined when nothing is stored', async () => {
    const empty = fakeStorage();
    await expect(createSettingsStore(empty.area, empty.onChanged).load()).resolves.toBeUndefined();

    const stored = fakeStorage({ settings: { watchIntervalMinutes: 7 } });
    await expect(createSettingsStore(stored.area, stored.onChanged).load()).resolves.toEqual({
      watchIntervalMinutes: 7,
    });
  });

  it('saves under the settings key', async () => {
    const storage = fakeStorage();
    await createSettingsStore(storage.area, storage.onChanged).save({ watchIntervalMinutes: 3 });
    expect(storage.data.get('settings')).toEqual({ watchIntervalMinutes: 3 });
  });

  it('notifies subscribers of changes to the settings key in its own area only', () => {
    const storage = fakeStorage();
    const seen: unknown[] = [];
    const unsubscribe = createSettingsStore(storage.area, storage.onChanged).subscribe((value) =>
      seen.push(value),
    );

    storage.emit({ settings: { newValue: { watchIntervalMinutes: 4 } } }, 'local');
    storage.emit({ settings: { newValue: { watchIntervalMinutes: 5 } } }, 'sync');
    storage.emit({ other: { newValue: 1 } }, 'local');
    expect(seen).toEqual([{ watchIntervalMinutes: 4 }]);

    unsubscribe();
    expect(storage.listeners.size).toBe(0);
  });
});
