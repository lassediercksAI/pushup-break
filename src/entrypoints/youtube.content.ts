import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { step } from '../application/break-workflow';
import type { Clock, Random } from '../application/ports';
import { parseSettings } from '../application/settings';
import type { BreakPolicy } from '../domain/break-policy';
import { getOrElse } from '../domain/result';
import { instant, roll, seconds, type Instant, type Roll, type Seconds } from '../domain/values';
import { initialSession, type Command, type WatchSession } from '../domain/watch-session';
import { createOverlay } from '../infrastructure/overlay';
import { runEffects } from '../infrastructure/run-effects';
import { createSettingsStore } from '../infrastructure/settings-store';
import { createYouTubePlayer, type Timers } from '../infrastructure/youtube-player';

/**
 * Composition root for youtube.com. The shell owns the only mutable state
 * (the current policy and session); every decision is made by `step`.
 */
export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const timers: Timers = {
      now: () => Date.now(),
      setInterval: (callback, ms) => ctx.setInterval(callback, ms),
      clearInterval: (id) => {
        clearInterval(id);
      },
    };
    // Time and randomness are read here, once, and enter the core as data.
    const clock: Clock = () => getOrElse(instant(Date.now()), 0 as Instant);
    const random: Random = () => getOrElse(roll(Math.random()), 0 as Roll);

    const store = createSettingsStore(browser.storage.local, browser.storage.onChanged);
    let policy: BreakPolicy = parseSettings(await store.load());
    let session: WatchSession = initialSession;

    const overlay = createOverlay(document, timers, () => {
      dispatch({ type: 'AcknowledgeBreak', at: clock() });
    });
    const player = createYouTubePlayer(document, timers, {
      onTick: (played) => {
        recordPlayback(played);
      },
      onPlay: () => {
        recordPlayback(0);
      },
    });
    const run = runEffects({ player, overlay });

    function dispatch(command: Command): void {
      const result = step(policy, session, command);
      if (!result.ok) return;
      session = result.value.session;
      run(result.value.effects);
    }

    function recordPlayback(played: number): void {
      dispatch({
        type: 'RecordPlayback',
        seconds: getOrElse(seconds(played), 0 as Seconds),
        at: clock(),
        roll: random(),
      });
    }

    // A new interval applies to the open tab at once, without a reload.
    const unsubscribe = store.subscribe((raw) => {
      policy = parseSettings(raw);
    });

    ctx.onInvalidated(() => {
      unsubscribe();
      player.stop();
      overlay.hide();
    });
  },
});
