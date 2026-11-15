// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeTimers } from '../test/fake-timers';
import { createYouTubePlayer, MAX_TICK_SECONDS, type PlaybackListener } from './youtube-player';

/** jsdom has no media playback, so a video's state is simulated on the element. */
const addVideo = (className = 'html5-main-video') => {
  const video = document.createElement('video');
  video.className = className;
  let paused = true;
  Object.defineProperty(video, 'paused', { get: () => paused });
  Object.defineProperty(video, 'readyState', { value: 4 });
  video.pause = vi.fn(() => {
    paused = true;
  });
  video.play = vi.fn(() => {
    paused = false;
    video.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  document.body.append(video);
  return video;
};

const setup = () => {
  const clock = fakeTimers(1_000_000);
  const ticks: number[] = [];
  const plays: string[] = [];
  const listener: PlaybackListener = {
    onTick: (seconds) => ticks.push(seconds),
    onPlay: () => plays.push('play'),
  };
  const player = createYouTubePlayer(document, clock.timers, listener);
  return { clock, ticks, plays, player };
};

describe('YouTube player adapter', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('reports a second of playback per tick while a video plays', async () => {
    const video = addVideo();
    const { clock, ticks, player } = setup();

    clock.advance(2_000);
    expect(ticks).toEqual([]);

    await video.play();
    clock.advance(3_000);
    expect(ticks).toEqual([1, 1, 1]);

    video.pause();
    clock.advance(2_000);
    expect(ticks).toEqual([1, 1, 1]);
    player.stop();
  });

  it('caps a long gap between ticks so a sleeping computer does not count', async () => {
    const video = addVideo();
    const { clock, ticks, player } = setup();
    await video.play();
    clock.jump(10 * 60_000);
    clock.advance(1_000);
    expect(ticks).toEqual([MAX_TICK_SECONDS]);
    player.stop();
  });

  it('keeps counting when YouTube swaps the video element', async () => {
    const first = addVideo();
    const { clock, ticks, player } = setup();
    await first.play();
    clock.advance(1_000);

    first.remove();
    const second = addVideo();
    await second.play();
    clock.advance(1_000);

    expect(ticks).toEqual([1, 1]);
    player.stop();
  });

  it('reports a play event from any video at once', async () => {
    const { plays, player } = setup();
    await addVideo().play();
    document.body.dispatchEvent(new Event('play'));
    expect(plays).toEqual(['play']);
    player.stop();
  });

  it('pauses every playing video and resumes exactly those', async () => {
    const main = addVideo();
    const other = addVideo('preview');
    const idle = addVideo('idle');
    const { player } = setup();
    await main.play();
    await other.play();

    player.pause();
    expect(main.pause).toHaveBeenCalledOnce();
    expect(other.pause).toHaveBeenCalledOnce();
    expect(idle.pause).not.toHaveBeenCalled();

    player.resume();
    expect(main.play).toHaveBeenCalledTimes(2);
    expect(other.play).toHaveBeenCalledTimes(2);
    expect(idle.play).not.toHaveBeenCalled();
    player.stop();
  });

  it('keeps the remembered videos when pausing again finds nothing playing', async () => {
    const main = addVideo();
    const { player } = setup();
    await main.play();
    player.pause();
    player.pause();
    player.resume();
    expect(main.play).toHaveBeenCalledTimes(2);
    player.stop();
  });

  it('resumes the main video when the paused one is gone', async () => {
    const old = addVideo('old');
    const { player } = setup();
    await old.play();
    player.pause();
    old.remove();
    const replacement = addVideo();

    player.resume();
    expect(replacement.play).toHaveBeenCalledOnce();
    player.stop();
  });

  it('falls back to any video, and does nothing without one', () => {
    const { player } = setup();
    expect(() => {
      player.resume();
    }).not.toThrow();

    const short = addVideo('shorts');
    player.resume();
    expect(short.play).toHaveBeenCalledOnce();
    player.stop();
  });

  it('ignores a rejected play() when the browser blocks autoplay', async () => {
    const video = addVideo();
    video.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    const { player } = setup();
    player.resume();
    await Promise.resolve();
    expect(video.play).toHaveBeenCalledOnce();
    player.stop();
  });

  it('stops ticking and listening after stop()', async () => {
    const video = addVideo();
    const { clock, ticks, plays, player } = setup();
    player.stop();
    await video.play();
    clock.advance(3_000);
    expect(ticks).toEqual([]);
    expect(plays).toEqual([]);
    expect(clock.activeIntervals()).toBe(0);
  });
});
