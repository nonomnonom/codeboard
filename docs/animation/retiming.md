# Change a shot duration

Stretch or shorten a shot timeline with an explicit rounding and audio policy. Review its editorial uses before reducing the source duration.

<!-- study:retiming:start -->
**Give the movement more time.** What changes when a shot lasts twice as long?

[![Compare both versions at frame 12, then compare the slower version at frame 24.](../../website/public/art/guides/retiming.png)](../../website/public/art/guides/retiming.png)

Compare both versions at frame 12, then compare the slower version at frame 24. Retiming moves keys to a new time scale; it does not redraw the movement.

<!-- study:retiming:end -->

## Retime an independent shot

`retimeShotAnimation(animation, options)` returns a detached `{ animation, report }` for
inspection before editing. Apply the same options through `timing.retime` in an ordinary
shot edit or version-pinned `animation.edit` plan:

```ts
const options = {
  durationFrames: 48,
  rounding: 'exact' as const,
  audio: 'scale-starts' as const,
};
const preview = retimeShotAnimation(animation, options);
project.editShotAnimation(animation.id, [{ op: 'timing.retime', ...options }]);
```

Every local frame position scales by new duration / old duration. A 12-to-24-frame change
maps frame 11 to 22 and the exclusive end 12 to 24; it does not pin the last key to frame 23.
This includes camera/layer keys, exposures, drawing substitutions, stroke reveal intervals,
controller keys/ranges, mesh/curve/envelope keys and compositing curves. Signed preroll and
postroll positions scale too, without trimming. Pen sample timestamps and bind geometry stay
unchanged. Optional `frameRate` sets the target rational rate; otherwise the old rate remains.

The default `exact` policy rejects fractional frames. Explicit `nearest`, `floor` or `ceil`
permits quantization, but distinct keys mapping to one frame and collapsed intervals still
reject. The source snapshot remains untouched on failure. The report counts mapped positions,
moved positions and quantized positions, plus audio clips and changed cue starts.

Audio policy is required: `preserve-seconds` retains cue times; `scale-starts` multiplies starts
by the new physical duration / old physical duration, accounting for both frame rates with
exact rational arithmetic. Neither policy stretches source samples or fades. Cues can extend
beyond the new duration; playback conform clips them to the shot window.

Editorial cuts are not conformed automatically. Shortening a referenced shot can invalidate a
cut's source range; revise its use before applying the shorter shot. Within a batch, the shot
must already be valid when `timing.retime` runs. Board retiming remains independent.
