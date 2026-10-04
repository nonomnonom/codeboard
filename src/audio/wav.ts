export interface ToneOptions {
  frequency?: number;
  durationSeconds?: number;
  sampleRate?: number;
  volume?: number;
  attackSeconds?: number;
  releaseSeconds?: number;
}

export function encodeWav(channels: Float32Array[], sampleRate=48000):Buffer {
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||channels.length<1||channels.length>2)throw new Error("WAV requires 1-2 channels and 8-192 kHz sample rate");
  const count=channels[0]!.length;
  if(count>sampleRate*3600||channels.some(c=>c.length!==count))throw new Error("WAV channel lengths differ or exceed one hour");
  const bytes=count*channels.length*2,b=Buffer.alloc(44+bytes);
  b.write("RIFF");b.writeUInt32LE(36+bytes,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels.length,22);
  b.writeUInt32LE(sampleRate,24);b.writeUInt32LE(sampleRate*channels.length*2,28);b.writeUInt16LE(channels.length*2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(bytes,40);
  for(let i=0;i<count;i++)for(let c=0;c<channels.length;c++){
    const v=channels[c]![i]!;if(!Number.isFinite(v))throw new Error(`Invalid audio sample ${i}`);
    b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+(i*channels.length+c)*2);
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
    const sample = Math.sin(index / sampleRate * Math.PI * 2 * frequency) * volume * Math.max(0, envelope);
    output.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return output;
}
