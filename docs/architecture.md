# Architecture

Pushup Break is a functional core inside an imperative shell. `domain/` and
`application/` are pure and decide what should happen; only
`infrastructure/` and `entrypoints/` touch the browser.

## Ubiquitous language

One bounded context, **Break Enforcement**, with one aggregate: the watch
session of a single tab.

| Term             | Meaning                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Watch time       | Seconds of actual playback since the last break. Paused or buffering time does not count.            |
| Watch interval   | How much watch time makes a break due: a whole number of minutes from 2 to 30.                       |
| Watch session    | One tab's state: watching (with its watch time) or on break.                                         |
| Exercise         | What the viewer must do: a name and an amount, either reps (5 pushups) or a hold (30-second plank).  |
| Exercise catalog | The built-in, non-empty list of exercises a break can ask for.                                       |
| Break policy     | The rule for when a break is due and when it may end: watch interval, minimum break length, catalog. |
| Break            | The period in which playback is blocked.                                                             |
| Acknowledgement  | The viewer's confirmation that the exercise is done.                                                 |
| Cycle            | One round of watching followed by one break. Completing a break starts the next cycle.               |

Use these words in code, tests, issues and pull requests.

## Invariants

The domain enforces these; each has its own test in `src/domain/`.

1. Watch time accumulates only while the session is watching.
2. A break starts as soon as watch time reaches the policy's watch interval.
3. The break's exercise comes from the catalog and differs from the previous
   one whenever the catalog has more than one entry.
4. Playback recorded during a break yields `PlaybackBlocked`, never watch time.
5. A break cannot be acknowledged before the minimum break length has passed
   (`BreakTooShort`).
6. Completing a break returns the session to watching with zero watch time,
   which starts the next cycle.
7. Value objects come from smart constructors that return a `Result`:
   `watchInterval` accepts whole minutes from 2 to 30, `reps` at least 1, and
   a catalog at least one exercise.

The current time and the random roll enter as data on the command (`at`,
`roll`). The domain never calls `Date.now()` or `Math.random()`.

## Layers

```text
 entrypoints/      composition roots (content script, popup)      ┐ imperative
 infrastructure/   adapters: <video>, overlay, storage, effects   ┘ shell
 application/      ports, effects, step(), parseSettings()        ┐ functional
 domain/           values, exercises, policy, decide/evolve       ┘ core
```

**The layer rule: imports only point down.** The entrypoints also import
`application/` directly to run the workflow. ESLint enforces it with
`no-restricted-imports` per folder:

- `domain/` imports nothing outside `domain/`.
- `application/` imports `domain/` only.
- `infrastructure/` never imports `entrypoints/`.

## The decider

State and events are immutable data. `decide` validates a command against the
current session and returns events or a rejection; `evolve` folds one event
into the next session.

```ts
decide(policy, session, command): Result<readonly DomainEvent[], Rejection>
evolve(session, event): WatchSession
```

One step of the workflow is a pure function. The content script calls it for
every playback tick and for the Done button, then hands the returned effects
to the interpreter in `infrastructure/run-effects.ts`.

```ts
const step = (policy, session, command) =>
  map(decide(policy, session, command), (events) => ({
    session: events.reduce(evolve, session),
    effects: events.flatMap(react(policy)),
  }));
```

| Domain event        | Effects                      |
| ------------------- | ---------------------------- |
| `WatchTimeRecorded` | none                         |
| `BreakStarted`      | `PauseVideo`, `ShowOverlay`  |
| `PlaybackBlocked`   | `PauseVideo`                 |
| `BreakCompleted`    | `HideOverlay`, `ResumeVideo` |

## Functional conventions

Enforced by ESLint (`eslint-plugin-functional`, `typescript-eslint`) in
`domain/` and `application/`:

- No classes, no `this`, no `let`, no loops, no mutation. Types are
  `readonly` all the way down.
- States, commands, events and effects are discriminated unions handled by
  `switch` statements. Exhaustiveness is checked twice: by the compiler (a
  missing case leaves the function without a return value) and by
  `@typescript-eslint/switch-exhaustiveness-check`.
- Errors are values. Functions return `Result<T, E>`; nothing in the core
  throws.
- Dependencies are function arguments. A port is a function type such as
  `type PauseVideo = () => void`; the entrypoint passes the adapters in.
  There is no container.
- Side effects are described as data and executed in one place,
  `run-effects.ts`.
- Time and randomness are inputs, read once by the shell and passed in on the
  command. Browser globals, `Date.now` and `Math.random` are lint errors in
  the core.

## Storage boundary

`application/settings.ts` is the anti-corruption layer. Whatever is stored is
treated as `unknown` and only becomes a `BreakPolicy` through the domain's
smart constructors; missing or invalid input falls back to the default
policy.

## Testing

| Layer          | What                                                                 | How                         |
| -------------- | -------------------------------------------------------------------- | --------------------------- |
| Domain         | Each invariant; `decide`/`evolve` as given-when-then tables; bounds  | Vitest in Node, 100 % cover |
| Domain         | Properties over random command sequences                             | fast-check                  |
| Application    | `react`, a full cycle through `step`, `parseSettings` fallbacks      | Vitest in Node, 100 % cover |
| Infrastructure | Effect interpreter with recording fakes; player and overlay in a DOM | Vitest with jsdom           |
| Entrypoints    | Only wiring                                                          | Manual smoke checklist      |

### Manual smoke checklist (per release, Chrome and Firefox)

Set the interval to 2 minutes in the popup, then check:

- [ ] A watch page pauses after 2 minutes of playback and shows the overlay.
- [ ] Done is disabled for 10 seconds, then resumes the video.
- [ ] A second break arrives 2 minutes after the first one ended, with a
      different exercise.
- [ ] Pressing play (or `k`/space) during a break pauses the video again.
- [ ] A Short pauses and resumes the same way.
- [ ] Navigating to another video without a page reload keeps counting.
- [ ] An ad playing when the break is due is paused like a video.
- [ ] In fullscreen the overlay is visible.
- [ ] Moving the slider while a video plays changes when the next break
      arrives, without reloading the tab.
