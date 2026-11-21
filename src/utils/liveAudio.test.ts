import assert from 'node:assert/strict';
import test from 'node:test';
import {
  base64ToBytes,
  buildLiveWsUrl,
  bytesToBase64,
  float32ToPcm16Bytes,
  pcm16BytesToFloat32,
} from './liveAudio';

test('float32ToPcm16Bytes and pcm16BytesToFloat32 round-trip and clamp values', () => {
  const input = new Float32Array([-1.5, -0.5, 0, 0.5, 1.5]);
  const bytes = float32ToPcm16Bytes(input);
  assert.equal(bytes.byteLength, 10);

  const decoded = pcm16BytesToFloat32(bytes);
  assert.equal(decoded.length, 5);
  assert.ok(decoded[0] <= -0.99);
  assert.ok(Math.abs(decoded[1] + 0.5) < 0.001);
  assert.equal(decoded[2], 0);
  assert.ok(Math.abs(decoded[3] - 0.5) < 0.001);
  assert.ok(decoded[4] >= 0.99);
});

test('bytesToBase64 and base64ToBytes round-trip arbitrary binary chunks', () => {
  const original = new Uint8Array([0, 1, 127, 128, 255, 42, 99]);
  const encoded = bytesToBase64(original);
  const decoded = base64ToBytes(encoded);
  assert.deepEqual(Array.from(decoded), Array.from(original));
});

test('buildLiveWsUrl derives ws/wss protocol from page location', () => {
  assert.equal(
    buildLiveWsUrl({ protocol: 'https:', host: 'example.run.app' }, 'real'),
    'wss://example.run.app/api/live?scope=real'
  );
  assert.equal(
    buildLiveWsUrl({ protocol: 'http:', host: 'localhost:3000' }, 'all'),
    'ws://localhost:3000/api/live?scope=all'
  );
});
