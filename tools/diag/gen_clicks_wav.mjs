// Synthesize a mono 44.1k 16-bit WAV with N sharp, unmistakable transients:
// short decaying-sine "clicks" at fixed times. Anything with working transient
// detection MUST find these, so it isolates "does REAPER detect transients at
// all" from "does this project's audio/sensitivity yield transients".
//
//   node tools/diag/gen_clicks_wav.mjs <out.wav>
//
// Clicks land at 0.5, 1.0, 1.5, 2.0, 2.5 s in a 3 s file.
import { writeFileSync } from 'node:fs'

const SR = 44100
const DUR = 3.0
const N = Math.round(SR * DUR)
const clickTimes = [0.5, 1.0, 1.5, 2.0, 2.5]
const clickLen = Math.round(SR * 0.012) // 12 ms

const samples = new Float64Array(N)
for (const t of clickTimes) {
  const start = Math.round(t * SR)
  for (let i = 0; i < clickLen; i++) {
    const env = Math.exp(-i / (SR * 0.002)) // ~2 ms decay -> sharp attack
    samples[start + i] += Math.sin((2 * Math.PI * 1800 * i) / SR) * env
  }
}

const dataBytes = N * 2
const buf = Buffer.alloc(44 + dataBytes)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8)
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28)
buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, samples[i])) * 0.9
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
}

const out = process.argv[2]
if (!out) { console.error('usage: node gen_clicks_wav.mjs <out.wav>'); process.exit(2) }
writeFileSync(out, buf)
console.log(`wrote ${out}: ${DUR}s, clicks at ${clickTimes.join(', ')}s`)
