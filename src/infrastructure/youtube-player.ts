import type { VideoPlayer } from '../application/ports';

export type Timers = {
  readonly now: () => number;
  readonly setInterval: (callback: () => void, ms: number) => number;
  readonly clearInterval: (id: number) => void;
};

export type PlaybackListener = {
  /** Called about once per second with the seconds of playback since the last call. */
  readonly onTick: (seconds: number) => void;
  /** Called as soon as any video starts playing, so a break can re-pause it at once. */
  readonly onPlay: () => void;
};

export type YouTubePlayer = VideoPlayer & {
  /** Stops reporting playback and removes all listeners. */
  readonly stop: () => void;
};

/** Longer gaps (a sleeping laptop, a frozen tab) are capped so they cannot count as watch time. */
export const MAX_TICK_SECONDS = 60;
const TICK_MS = 1_000;

const isPlaying = (video: HTMLVideoElement): boolean =>
  !video.paused && !video.ended && video.readyState > 2;

const videos = (doc: Document): readonly HTMLVideoElement[] => [...doc.querySelectorAll('video')];

/** The main player on a watch page; on Shorts, whichever video is in view. */
const mainVideo = (doc: Document): HTMLVideoElement | null =>
  doc.querySelector<HTMLVideoElement>('video.html5-main-video') ?? doc.querySelector('video');

/**
 * Adapter for YouTube's `<video>` elements. Every tick looks the elements up
 * again, so YouTube swapping videos without a page reload (next video,
 * Shorts scrolling, ads) needs no special handling.
 */
export const createYouTubePlayer = (
  doc: Document,
  timers: Timers,
  listener: PlaybackListener,
): YouTubePlayer => {
  let lastTick = timers.now();
  let pausedByUs: readonly HTMLVideoElement[] = [];

  const tick = () => {
    const now = timers.now();
    const seconds = Math.min(Math.max(0, (now - lastTick) / 1000), MAX_TICK_SECONDS);
    lastTick = now;
    if (videos(doc).some(isPlaying)) listener.onTick(seconds);
  };

  // Media events do not bubble, but they can be captured at the document.
  const onPlay = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) listener.onPlay();
  };

  doc.addEventListener('play', onPlay, true);
  const interval = timers.setInterval(tick, TICK_MS);

  return {
    pause: () => {
      const playing = videos(doc).filter((video) => !video.paused);
      playing.forEach((video) => {
        video.pause();
      });
      if (playing.length > 0) pausedByUs = playing;
    },
    resume: () => {
      const connected = pausedByUs.filter((video) => video.isConnected);
      const main = mainVideo(doc);
      const targets = connected.length > 0 ? connected : main ? [main] : [];
      pausedByUs = [];
      lastTick = timers.now();
      targets.forEach((video) => {
        // play() rejects when the browser blocks autoplay; the viewer can press play.
        void Promise.resolve(video.play()).catch(() => undefined);
      });
    },
    stop: () => {
      timers.clearInterval(interval);
      doc.removeEventListener('play', onPlay, true);
    },
  };
};
