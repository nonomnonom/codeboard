# Split an editorial clip

Cut one clip into two editable pieces while keeping the same picture timing. Use this after [creating an edit](editing.md#edit-an-editorial-sequence).

## Split without shifting picture sampling

```ts
project.editEditorial('edit:main', [
  {op: 'split', id: 'clip:reaction', atFrame: 24, newId: 'clip:reaction-tail'},
]);
```

`atFrame` is an offset from the clip's beginning, strictly between zero and its duration. The right source-in advances by the exact conversion from editorial frames to source frames. At equal rates every interior integer boundary is representable. For 30 fps editorial and 24 fps source, offsets divisible by five are exact; offset one rejects because the current clip model cannot retain that fractional sampling phase. No rounding policy is applied implicitly.

A split preserves the total picture duration and existing outer transitions when the resulting sequence is valid. Existing overlap constraints still apply to each piece; adjust transitions in the same batch if necessary. Subsequent operations may address either piece by its ID. Source animation, drawing keys and sequence-level audio placements remain unchanged. Shot audio is re-conformed for the two resulting source windows; inspect the audio conform quantization report when frame boundaries do not map to integer output samples. Picture sampling continuity is not a guarantee of bit-identical resampled audio. General fractional-phase splits and speed/reverse clips remain unsupported.
