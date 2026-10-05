import { encodeWav } from "codeboard-studio";
/** Original deterministic Foley synthesis, CC0. No recordings, speech or music. */
export function makeSound() {
  const rate = 48000,
    data = new Float32Array(15 * rate);
  let state = 741;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
  function scratch(start: number, duration: number, gain = 0.085) {
    let previous = 0;
    for (let i = 0; i < duration * rate; i++) {
      const t = i / rate,
        n = noise(),
        env = Math.min(1, t / 0.015, (duration - t) / 0.02);
      data[Math.floor(start * rate) + i]! +=
        gain * env * (n - previous * 0.75) * (0.65 + 0.35 * Math.sin(t * 91) ** 2);
      previous = n;
    }
  }
  for (const [start, duration] of [
    [0.1, 0.34],
    [0.38, 0.48],
    [0.85, 0.5],
    [1.45, 0.25],
    [1.84, 0.28],
    [2.52, 0.26],
    [2.84, 0.24],
    [3.15, 0.23],
    [3.46, 0.23],
    [3.77, 0.23],
    [4.12, 0.48],
  ])
    scratch(start!, duration!);
  function tap(start: number, gain: number) {
    for (let i = 0; i < rate * 0.18; i++) {
      const t = i / rate;
      data[Math.floor(start * rate) + i]! +=
        gain *
        (Math.sin(2 * Math.PI * 155 * t) * Math.exp(-t * 42) + noise() * 0.55 * Math.exp(-t * 115));
    }
  }
  tap(2.19, 0.12);
  tap(134 / 24, 0.6);
  scratch(5.12, 0.2, 0.045);
  scratch(6.12, 0.12, 0.035);
  scratch(10.25, 0.48, 0.1);
  scratch(11, 0.16, 0.13);
  scratch(11.23, 0.18, 0.13);
  scratch(12.68, 0.25, 0.075);
  let room = 0;
  for (let i = 0; i < data.length; i++) {
    room = room * 0.992 + noise() * 0.008;
    const t = i / rate;
    data[i]! += room * (t >= 7.5 && t < 12.5 ? 0.015 : 0.004) * Math.min(1, (15 - t) * 2);
  }
  return encodeWav([data], rate);
}
