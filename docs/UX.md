# Salt Crown — Interface System

> Written after the camp screen was rebuilt twice and still didn't feel like a
> game. The problem was never any individual screen: there was no system, so
> every fix was improvised and the result read as accumulation. This is the
> system. Follow it instead of inventing per-screen.

## The four questions

A player should be able to answer all four **at a glance**, on any screen:

1. **What is interactive?**
2. **What is urgent?**
3. **What changed?**
4. **What do I do next?**

This is the audit. Open any screen and ask them. Today's camp screen fails at
least three: buy buttons read as price labels, nothing marks urgency, nothing
marks change, and March competes visually with five other controls.

Every rule below exists to answer one of those four.

---

## 1. One primary action per screen

Each screen has exactly **one** thing the player is there to do. It gets the
accent colour, the largest hit area, and the bottom-right / end-of-flow
position. Everything else is secondary or tertiary.

| Screen | Primary | Secondary |
|---|---|---|
| Start | Begin | seed, colour |
| Commander | Confirm | pick, back |
| Camp | **March** | recruit, growth, leaders, ordering |
| Battle | speed / pause | — |
| Report | Break camp | reading the tally |

**Three levels of button, and only three:**

- **Primary** — accent fill, dark text. One per screen. `.btn-primary`
- **Secondary** — surface fill, ink text. Ordinary actions. `.btn`
- **Tertiary** — transparent, dim text. Reversible/minor. `.btn-quiet`

If a screen has two primary buttons, one of them is wrong.

## 2. Progressive disclosure

> Only show what is needed now; hide the rest until asked.

- **Always visible:** resources, phase, the primary action.
- **One interaction away:** full stat lines, capacity detail, breakdowns.
- **Two away:** anything diagnostic (the Details panel).

Concretely: a row shows identity + the one stat that matters *for that screen's
decision*. Everything else lives in the hover card. The battle-line list is
about **pace**; the recruit list is about **price and capacity**. Do not show
all five stats in both.

## 3. Urgency and change must be marked

Nothing in the UI currently says "this needs you." Two markers, used sparingly:

- **`.needs-you`** — a left accent bar in gold. For a Prospect ready to mutate,
  an unassigned leader, an unspent surplus. If more than three things carry it
  at once, the threshold is wrong.
- **`.just-changed`** — a brief highlight after a value moves. Salvage falling
  when you buy, a body count dropping after a battle.

The rule: **urgency is earned, not decorative.** A permanently-highlighted
element teaches the player to ignore the highlight.

## 4. Scales — stop inventing values

**Spacing.** Four values. Nothing else.

```
--s1: 4px    inside a control
--s2: 8px    between related items
--s3: 16px   between groups
--s4: 32px   between sections
```

**Type.** Five steps. Nothing else.

| Token | Size | Weight | Use |
|---|---|---|---|
| `--t-display` | 30px | 650 | screen title, run outcome |
| `--t-title` | 20px | 650 | encounter name, card heading |
| `--t-body` | 15px | 400 | everything ordinary |
| `--t-meta` | 12px | 400 | stats, secondary detail |
| `--t-label` | 11px | 650 | uppercase section headings, units |

Numbers are always `tabular-nums`. A number that shifts width as it counts is
a number the eye can't track.

## 5. Colour is language, not decoration

Each colour means exactly one thing, everywhere:

| Token | Means | Never used for |
|---|---|---|
| `--a` (faction) | *you*, and the primary action | decoration |
| `--enemy` | them | warnings |
| `--gold` | salvage, capacity, things you spend or covet | success |
| `--danger` | loss, death, permanence | mere emphasis |
| `--good` | survival, gain | buttons |
| `--dim` / `--faint` | recessive text | disabled state |

**Rarity should read as colour.** Capacity already started this by accident
(deeper capacity glows brighter). Formalise it: one ramp, used for capacity,
mutation level, and anything else with tiers. A player should learn the ramp
once.

## 6. Surfaces are for pressing

A background fill means **you can press this**. Content groups by whitespace
and type weight.

This is the "no frames" rule, stated as a principle rather than a preference:
frames nested in frames destroy hierarchy, because if everything is boxed then
the boxing carries no information.

Exception: one accent-edged card may mark the screen's primary object (the
march card, a growth offer). One. Not five.

## 7. Touch and input

- Minimum target **40px**; 34px only for tight secondary clusters.
- Every drag interaction needs a keyboard and a tap equivalent. HTML5 drag
  does not fire on touch — use pointer events.
- Focus rings are never removed, only styled.
- `prefers-reduced-motion` disables transitions.

---

## Applying this

The order that fixes the most per unit of work:

1. **Tokens** — add the spacing and type scales, replace ad-hoc values.
2. **Button levels** — three classes, one primary per screen.
3. **Camp triage** — March becomes unmistakably primary; recruit/growth/roster
   drop a level.
4. **Per-screen stat pruning** — battle line shows pace, recruit shows price
   and capacity, hover shows the rest.
5. **`.needs-you`** on growth-ready Prospects and idle leaders.

---

## Sources

- [Game UI/UX Design: Complete Player Experience Guide](https://generalistprogrammer.com/tutorials/game-ui-ux-design-complete-player-experience-guide-2025) — information hierarchy, progressive disclosure, the "at a glance" framing
- [Game UI and UX Guide: Menus, HUDs, and Feedback](https://respawn.outlookindia.com/gaming/gaming-guides/ui-and-ux-in-games-building-menus-huds-and-feedback-systems) — HUD disclosure, contextual prompts
- [Game UI Design Guide: Principles, Examples & Best Practices](https://pixune.com/blog/game-ui-design/)
- [Game UX Design: A Complete Guide](https://www.uxpin.com/studio/blog/game-ux/)
