export interface ToneOptions {
  frequency?: number;
  durationSeconds?: number;
  sampleRate?: number;
  volume?: number;
  attackSeconds?: number;
  releaseSeconds?: number;
}

export interface WavEncodingOptions {
  sampleFormat?: "pcm16" | "float32";
}

export function encodeWav(
  channels: Float32Array[],
  sampleRate = 48000,
  options: WavEncodingOptions = {},
): Buffer {
  const format = options.sampleFormat ?? "pcm16";
  if (format !== "pcm16" && format !== "float32") throw new Error("Unknown WAV sample format");
  if (!Array.isArray(channels) || channels.some((channel) => !(channel instanceof Float32Array)))
    throw new Error("WAV channels must be Float32Array values");
  if (
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    channels.length < 1 ||
    channels.length > 2
  )
    throw new Error("WAV requires 1-2 channels and 8-192 kHz sample rate");
  const count = channels[0]!.length;
  if (count > sampleRate * 3600 || channels.some((c) => c.length !== count))
    throw new Error("WAV channel lengths differ or exceed one hour");
  const floating = format === "float32",
    bytesPerSample = floating ? 4 : 2;
  const headerBytes = floating ? 58 : 44;
  const bytes = count * channels.length * bytesPerSample;
  if (bytes + headerBytes - 8 > 0xffffffff)
    throw new Error("Audio exceeds the RIFF WAV size limit");
  const b = Buffer.alloc(headerBytes + bytes);
  b.write("RIFF");
  b.writeUInt32LE(headerBytes - 8 + bytes, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(floating ? 18 : 16, 16);
  b.writeUInt16LE(floating ? 3 : 1, 20);
  b.writeUInt16LE(channels.length, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * channels.length * bytesPerSample, 28);
  b.writeUInt16LE(channels.length * bytesPerSample, 32);
  b.writeUInt16LE(bytesPerSample * 8, 34);
  if (floating) {
    b.writeUInt16LE(0, 36);
    b.write("fact", 38);
    b.writeUInt32LE(4, 42);
    b.writeUInt32LE(count, 46);
  }
  b.write("data", headerBytes - 8);
  b.writeUInt32LE(bytes, headerBytes - 4);
  for (let i = 0; i < count; i++)
    for (let c = 0; c < channels.length; c++) {
      const v = channels[c]![i]!;
      if (!Number.isFinite(v)) throw new Error(`Invalid audio sample ${i}`);
      const offset = headerBytes + (i * channels.length + c) * bytesPerSample;
      if (floating) b.writeFloatLE(v, offset);
      else b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), offset);
    }
  return b;
}

export function createToneWav(options: ToneOptions = {}): Buffer {
  const frequency = options.frequency ?? 440;
  const durationSeconds = options.durationSeconds ?? 1;
  const sampleRate = options.sampleRate ?? 48_000;
  const volume = Math.max(0, Math.min(1, options.volume ?? 0.25));
  const sampleCount = Math.max(1, Math.round(durationSeconds * sampleRate));
  const dataBytes = sampleCount * 2;
  const output = Buffer.alloc(44 + dataBytes);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataBytes, 4);
  output.write("WAVEfmt ", 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataBytes, 40);
  const attack = Math.max(1, Math.round((options.attackSeconds ?? 0.015) * sampleRate));
  const release = Math.max(1, Math.round((options.releaseSeconds ?? 0.08) * sampleRate));
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.min(1, index / attack, (sampleCount - index - 1) / release);
    const sample =
      Math.sin((index / sampleRate) * Math.PI * 2 * frequency) * volume * Math.max(0, envelope);
    output.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return output;
}
