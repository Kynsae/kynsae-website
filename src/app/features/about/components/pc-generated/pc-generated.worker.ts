/// <reference lib="webworker" />

type WorkerRequest =
  | {
      id: number;
      task: 'generateSphere';
      pointCount: number;
      radius: number;
      seed?: number;
    }
  | {
      id: number;
      task: 'loadAndSamplePly';
      url: string;
      pointCount: number;
      sphereTargetRadius: number;
    };

type WorkerResponse =
  | { id: number; type: 'progress'; progress: number }
  | { id: number; type: 'result'; result: Float32Array }
  | { id: number; type: 'error'; error: string };

function postProgress(id: number, progress: number) {
  const msg: WorkerResponse = { id, type: 'progress', progress };
  postMessage(msg);
}

function postResult(id: number, result: Float32Array) {
  const msg: WorkerResponse = { id, type: 'result', result };
  postMessage(msg, [result.buffer]);
}

function postError(id: number, error: unknown) {
  const msg: WorkerResponse = {
    id,
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
  };
  postMessage(msg);
}

function sortBySpherical(phi: Float32Array, theta: Float32Array, dist: Float32Array): Uint32Array {
  const n = phi.length;
  const indices = new Uint32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  indices.sort((a, b) => {
    const dp = phi[a] - phi[b];
    if (Math.abs(dp) > 0.001) return dp;
    const dt = theta[a] - theta[b];
    if (Math.abs(dt) > 0.001) return dt;
    return dist[a] - dist[b];
  });

  return indices;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function clampNegPos1(x: number) {
  return Math.max(-1, Math.min(1, x));
}

function randFactory(seedInit: number) {
  let seed = (seedInit >>> 0) || 1;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed ^ (seed >>> 15);
    t = Math.imul(t, (seed | 1) >>> 0);
    t ^= t + Math.imul(t ^ (t >>> 7), (t | 61) >>> 0);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSphereSorted(pointCount: number, radius: number, seed = 1): Float32Array {
  const rand = randFactory(seed);

  const positions = new Float32Array(pointCount * 3);
  const phi = new Float32Array(pointCount);
  const theta = new Float32Array(pointCount);
  const dist = new Float32Array(pointCount);

  let i3 = 0;
  let produced = 0;

  while (produced < pointCount) {
    const u = rand() * 2 - 1;
    const v = rand() * 2 - 1;
    const s = u * u + v * v;
    if (s <= 1 && s >= 1e-12) {
      const factor = 2 * Math.sqrt(1 - s);
      const x = u * factor * radius;
      const y = v * factor * radius;
      const z = (1 - 2 * s) * radius;

      positions[i3++] = x;
      positions[i3++] = y;
      positions[i3++] = z;

      const d = radius;
      dist[produced] = d;
      theta[produced] = Math.atan2(y, x);
      phi[produced] = Math.acos(clampNegPos1(z / (d || 1)));

      produced++;
    }
  }

  const indices = sortBySpherical(phi, theta, dist);
  const remapped = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const srcIdx = indices[i] * 3;
    const dstIdx = i * 3;
    remapped[dstIdx] = positions[srcIdx];
    remapped[dstIdx + 1] = positions[srcIdx + 1];
    remapped[dstIdx + 2] = positions[srcIdx + 2];
  }

  return remapped;
}

function parsePlyHeader(buffer: ArrayBuffer): { vertexCount: number; dataOffset: number } {
  // Header is ASCII and small; decode a prefix and find end_header.
  const bytes = new Uint8Array(buffer);
  const maxHeaderBytes = Math.min(bytes.length, 64 * 1024);
  const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, maxHeaderBytes));

  const endHeaderIdx = headerText.indexOf('end_header');
  if (endHeaderIdx === -1) throw new Error('Invalid PLY: missing end_header');

  const lineEndIdx = headerText.indexOf('\n', endHeaderIdx);
  if (lineEndIdx === -1) throw new Error('Invalid PLY: malformed end_header line');

  const vertexMatch = headerText.match(/element\s+vertex\s+(\d+)/);
  if (!vertexMatch) throw new Error('Invalid PLY: missing element vertex count');
  const vertexCount = Number(vertexMatch[1]);
  if (!Number.isFinite(vertexCount) || vertexCount <= 0) throw new Error('Invalid PLY: bad vertex count');

  // ASCII header => byte offset equals char offset.
  const dataOffset = lineEndIdx + 1;
  return { vertexCount, dataOffset };
}

async function fetchArrayBufferWithProgress(url: string, id: number): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PLY: ${res.status} ${res.statusText}`);

  const total = Number(res.headers.get('Content-Length') || 0);
  const body = res.body;
  if (!body) {
    // Fallback: no streaming body
    const buf = await res.arrayBuffer();
    postProgress(id, 100);
    return buf;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) postProgress(id, Math.round((received / total) * 60)); // 0-60% reserved for download
    }
  }

  let size = 0;
  for (const c of chunks) size += c.byteLength;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }

  postProgress(id, 60);
  return out.buffer;
}

function sampleModelFromBinaryPly(buffer: ArrayBuffer, pointCount: number, sphereTargetRadius: number): Float32Array {
  const { vertexCount, dataOffset } = parsePlyHeader(buffer);

  let floats: Float32Array;
  if (dataOffset % 4 === 0) {
    floats = new Float32Array(buffer, dataOffset, vertexCount * 3);
  } else {
    const sliced = buffer.slice(dataOffset);
    floats = new Float32Array(sliced, 0, vertexCount * 3);
  }

  // AABB (fast + stable)
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    const x = floats[idx];
    const y = floats[idx + 1];
    const z = floats[idx + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  let maxR2 = 0;
  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    const dx = floats[idx] - cx;
    const dy = floats[idx + 1] - cy;
    const dz = floats[idx + 2] - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > maxR2) maxR2 = r2;
  }
  const sphereRadius = Math.sqrt(maxR2) || 1;
  const scale = (sphereTargetRadius * 0.8) / sphereRadius;

  const modelPositions = new Float32Array(pointCount * 3);
  const phi = new Float32Array(pointCount);
  const theta = new Float32Array(pointCount);
  const dist = new Float32Array(pointCount);
  const stride = vertexCount >= pointCount ? vertexCount / pointCount : 1;

  for (let i = 0; i < pointCount; i++) {
    const src = Math.floor((vertexCount >= pointCount ? i * stride : i % vertexCount)) * 3;
    // center + scale
    const x0 = (floats[src] - cx) * scale;
    const y0 = (floats[src + 1] - cy) * scale;
    const z0 = (floats[src + 2] - cz) * scale;
    // rotate -90° around X: (x, y, z) -> (x, z, -y)
    const x = x0;
    const y = z0;
    const z = -y0;

    const dst = i * 3;
    modelPositions[dst] = x;
    modelPositions[dst + 1] = y;
    modelPositions[dst + 2] = z;

    const d = Math.sqrt(x * x + y * y + z * z) || 1;
    dist[i] = d;
    theta[i] = Math.atan2(y, x);
    phi[i] = Math.acos(Math.max(-1, Math.min(1, z / d)));
  }

  const indices = sortBySpherical(phi, theta, dist);
  const remapped = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const srcIdx = indices[i] * 3;
    const dstIdx = i * 3;
    remapped[dstIdx] = modelPositions[srcIdx];
    remapped[dstIdx + 1] = modelPositions[srcIdx + 1];
    remapped[dstIdx + 2] = modelPositions[srcIdx + 2];
  }

  return remapped;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  const { id } = data;

  try {
    if (data.task === 'generateSphere') {
      const result = generateSphereSorted(data.pointCount, data.radius, data.seed ?? 1);
      postResult(id, result);
      return;
    }

    if (data.task === 'loadAndSamplePly') {
      postProgress(id, 0);
      const buffer = await fetchArrayBufferWithProgress(data.url, id);
      postProgress(id, 70);
      const result = sampleModelFromBinaryPly(buffer, data.pointCount, data.sphereTargetRadius);
      postProgress(id, 100);
      postResult(id, result);
      return;
    }
  } catch (e) {
    postError(id, e);
  }
};