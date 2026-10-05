# Frame rates and exact time conversion

Use these rules when converting between video frames, editorial time and audio samples. For ordinary panel timing, start with [animation](../animation/timing.md).

## Exact tick conversion

`normalizeRate(23.976)` returns `{numerator:2997, denominator:125}`. It preserves the decimal value; it does not infer `24000/1001`. Supply that fraction explicitly when required.

```ts
import { normalizeRate, rescaleTime } from 'codeboard-studio';
const fps = normalizeRate({ numerator: 24000, denominator: 1001 });
const sample = rescaleTime(24, fps, 48000, 'exact');
// sample.value is 48048; sample.exact is true.
```

`rescaleTime(position, sourceRate, targetRate, rounding)` converts integer ticks between positive rates. Rates accept positive finite numbers or safe-integer numerator/denominator objects. Intermediate arithmetic uses BigInt; returned positions must fit a safe integer. Policies are `nearest` (default, ties toward positive infinity), `floor`, `ceil`, and `exact` (rejects quantization). `error` contains reduced integer strings describing rounded minus exact destination position. Negative tick positions support studio preroll; board authoring methods retain their nonnegative frame rules.

Project `preserve-seconds` retiming reuses this mapper and retains collision/collapsed-interval rejection. Project board timelines still store a numeric rate and global frames. Board rates remain numeric; studio animations and editorial sequences persist their own rational rates.
