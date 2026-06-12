/**
 * Konverterer WAV til samme format som print av fax.wav:
 * PCM 16-bit, mono, 44100 Hz
 */
const fs = require('fs');
const path = require('path');

const TARGET_RATE = 44100;
const TARGET_CHANNELS = 1;
const TARGET_BITS = 16;

const IMA_INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
const IMA_STEP_TABLE = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253,
    279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166,
    1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428,
    4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289,
    16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
];

function parseWav(buffer) {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Ikke en gyldig WAV-fil');
    }

    let offset = 12;
    let fmt = null;
    let data = null;

    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;
        if (id === 'fmt ') {
            fmt = {
                audioFormat: buffer.readUInt16LE(chunkStart),
                channels: buffer.readUInt16LE(chunkStart + 2),
                sampleRate: buffer.readUInt32LE(chunkStart + 4),
                bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
                blockAlign: buffer.readUInt16LE(chunkStart + 12),
                extraSize: size > 16 ? buffer.readUInt16LE(chunkStart + 16) : 0
            };
        } else if (id === 'data') {
            data = buffer.subarray(chunkStart, chunkStart + size);
        }
        offset = chunkStart + size + (size % 2);
    }

    if (!fmt || !data) throw new Error('Mangler fmt eller data chunk');
    return { fmt, data };
}

function decodeImaAdpcmMono(data, blockAlign) {
    const samples = [];
    let offset = 0;

    while (offset + blockAlign <= data.length) {
        let predictor = data.readInt16LE(offset);
        let index = data[offset + 2];
        index = Math.max(0, Math.min(88, index));
        samples.push(predictor);

        let blockOffset = offset + 4;
        const blockEnd = offset + blockAlign;

        while (blockOffset < blockEnd) {
            let byte = data[blockOffset++];
            for (let nibbleIdx = 0; nibbleIdx < 2; nibbleIdx++) {
                const nibble = nibbleIdx === 0 ? (byte & 0x0f) : ((byte >> 4) & 0x0f);
                const step = IMA_STEP_TABLE[index];
                let diff = step >> 3;
                if (nibble & 1) diff += step >> 2;
                if (nibble & 2) diff += step >> 1;
                if (nibble & 4) diff += step;
                if (nibble & 8) diff = -diff;
                predictor += diff;
                predictor = Math.max(-32768, Math.min(32767, predictor));
                index += IMA_INDEX_TABLE[nibble];
                index = Math.max(0, Math.min(88, index));
                samples.push(predictor);
            }
        }
        offset += blockAlign;
    }

    return samples;
}

function decodePcm16LE(data, channels) {
    const frameCount = Math.floor(data.length / (2 * channels));
    const mono = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for (let ch = 0; ch < channels; ch++) {
            sum += data.readInt16LE((i * channels + ch) * 2);
        }
        mono[i] = Math.round(sum / channels);
    }
    return mono;
}

function decodePcm24LE(data, channels) {
    const frameCount = Math.floor(data.length / (3 * channels));
    const mono = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for (let ch = 0; ch < channels; ch++) {
            const base = (i * channels + ch) * 3;
            let sample = data[base] | (data[base + 1] << 8) | (data[base + 2] << 16);
            if (sample & 0x800000) sample |= ~0xffffff;
            sum += sample >> 8;
        }
        mono[i] = Math.round(sum / channels);
    }
    return mono;
}

function decodeToMonoPcm(fmt, data) {
    if (fmt.audioFormat === 1 && fmt.bitsPerSample === 16) {
        return { samples: decodePcm16LE(data, fmt.channels), sampleRate: fmt.sampleRate };
    }
    if (fmt.audioFormat === 1 && fmt.bitsPerSample === 24) {
        return { samples: decodePcm24LE(data, fmt.channels), sampleRate: fmt.sampleRate };
    }
    if (fmt.audioFormat === 17 && fmt.channels === 1) {
        return {
            samples: decodeImaAdpcmMono(data, fmt.blockAlign),
            sampleRate: fmt.sampleRate
        };
    }
    throw new Error(`Støtter ikke format ${fmt.audioFormat}/${fmt.bitsPerSample}-bit/${fmt.channels}ch`);
}

function resample(samples, fromRate, toRate) {
    if (fromRate === toRate) return samples;
    const outLength = Math.max(1, Math.round(samples.length * toRate / fromRate));
    const out = new Array(outLength);
    for (let i = 0; i < outLength; i++) {
        const srcPos = (i * fromRate) / toRate;
        const idx = Math.floor(srcPos);
        const frac = srcPos - idx;
        const a = samples[idx] ?? 0;
        const b = samples[Math.min(idx + 1, samples.length - 1)] ?? a;
        out[i] = Math.round(a + (b - a) * frac);
    }
    return out;
}

function writePcmWav(samples, sampleRate) {
    const dataSize = samples.length * 2;
    const out = Buffer.alloc(44 + dataSize);
    out.write('RIFF', 0);
    out.writeUInt32LE(36 + dataSize, 4);
    out.write('WAVE', 8);
    out.write('fmt ', 12);
    out.writeUInt32LE(16, 16);
    out.writeUInt16LE(1, 20);
    out.writeUInt16LE(TARGET_CHANNELS, 22);
    out.writeUInt32LE(sampleRate, 24);
    out.writeUInt32LE(sampleRate * TARGET_CHANNELS * (TARGET_BITS / 8), 28);
    out.writeUInt16LE(TARGET_CHANNELS * (TARGET_BITS / 8), 32);
    out.writeUInt16LE(TARGET_BITS, 34);
    out.write('data', 36);
    out.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-32768, Math.min(32767, samples[i] | 0));
        out.writeInt16LE(s, 44 + i * 2);
    }
    return out;
}

function convertFile(inputPath) {
    const input = fs.readFileSync(inputPath);
    const { fmt, data } = parseWav(input);
    const { samples, sampleRate } = decodeToMonoPcm(fmt, data);
    const resampled = resample(samples, sampleRate, TARGET_RATE);
    const output = writePcmWav(resampled, TARGET_RATE);
    fs.writeFileSync(inputPath, output);
    console.log(`Konvertert: ${path.basename(inputPath)} (${fmt.sampleRate}Hz ${fmt.bitsPerSample}-bit -> ${TARGET_RATE}Hz 16-bit mono PCM)`);
}

const root = path.join(__dirname, '..', 'lyder');
const targetFile = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, 'sending fax.wav');

convertFile(targetFile);
