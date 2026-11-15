import { describe, expect, it } from 'vitest';
import { defaultPolicy, withWatchInterval } from './break-policy';
import { defaultCatalog } from './exercise';
import type { WatchInterval } from './values';

describe('break policy', () => {
  it('defaults to 20 minutes, a 10-second minimum break and the built-in catalog', () => {
    expect(defaultPolicy).toEqual({ watchInterval: 20, minBreak: 10, catalog: defaultCatalog });
  });

  it('can change the watch interval without touching the rest', () => {
    const policy = withWatchInterval(defaultPolicy, 5 as WatchInterval);
    expect(policy).toEqual({ ...defaultPolicy, watchInterval: 5 });
    expect(defaultPolicy.watchInterval).toBe(20);
  });
});
