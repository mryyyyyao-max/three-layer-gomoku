import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binaryPath = path.join(
  __dirname,
  '..',
  'bin',
  process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
);
const TRY_CLOUDFLARE_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function releaseAsset() {
  const platforms = {
    win32: 'windows',
    linux: 'linux',
    darwin: 'darwin',
  };
  const architectures = {
    x64: 'amd64',
    arm64: 'arm64',
    arm: 'arm',
  };
  const platform = platforms[process.platform];
  const arch = architectures[process.arch];
  if (!platform || !arch) {
    throw new Error(`Unsupported cloudflared platform: ${process.platform}/${process.arch}`);
  }

  if (process.platform === 'darwin') {
    return { name: `cloudflared-${platform}-${arch}.tgz`, archive: true };
  }
  const extension = process.platform === 'win32' ? '.exe' : '';
  return { name: `cloudflared-${platform}-${arch}${extension}`, archive: false };
}

function extractBinaryFromTarGz(contents) {
  const tar = gunzipSync(contents);
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = Number.parseInt(
      header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim(),
      8,
    );
    const type = header[156];
    const dataOffset = offset + 512;
    if ((type === 0 || type === 48) && path.basename(name) === 'cloudflared') {
      return tar.subarray(dataOffset, dataOffset + size);
    }
    offset = dataOffset + Math.ceil(size / 512) * 512;
  }
  throw new Error('cloudflared binary was not found in downloaded archive');
}

async function ensureBinary() {
  if (fs.existsSync(binaryPath)) return binaryPath;

  const asset = releaseAsset();
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset.name}`;
  console.log(`  Downloading cloudflared (${asset.name})...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`cloudflared download failed: HTTP ${response.status}`);
  }

  const downloaded = Buffer.from(await response.arrayBuffer());
  const contents = asset.archive ? extractBinaryFromTarGz(downloaded) : downloaded;
  if (contents.length === 0) {
    throw new Error('cloudflared download returned an empty file');
  }

  await fs.promises.mkdir(path.dirname(binaryPath), { recursive: true });
  await fs.promises.writeFile(binaryPath, contents, { mode: 0o755 });
  if (process.platform !== 'win32') {
    await fs.promises.chmod(binaryPath, 0o755);
  }
  return binaryPath;
}

function noOpTunnel() {
  return { stop() {} };
}

/**
 * Starts Cloudflare's ephemeral quick tunnel without making local play depend on it.
 * @param {{ port: number, onUrl: (url: string) => void }} options
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startQuickTunnel({ port, onUrl }) {
  try {
    const executable = await ensureBinary();
    const child = spawn(
      executable,
      ['tunnel', '--url', `http://127.0.0.1:${port}`],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    let stopped = false;
    let published = false;
    let output = '';

    const stop = () => {
      if (!stopped && !child.killed) {
        stopped = true;
        child.kill();
      }
    };

    const readOutput = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-4096);
      if (published) return;
      const match = output.match(TRY_CLOUDFLARE_URL);
      if (!match) return;
      published = true;
      try {
        onUrl(match[0]);
      } catch (error) {
        console.error('  Cloudflare tunnel URL callback failed:', error.message);
      }
    };

    child.stdout.on('data', readOutput);
    child.stderr.on('data', readOutput);
    child.on('error', (error) => {
      if (!stopped) {
        console.error('  Cloudflare tunnel could not start:', error.message);
      }
    });
    child.on('exit', (code, signal) => {
      if (!stopped && code !== 0) {
        console.error(`  Cloudflare tunnel stopped (${signal || `exit ${code}`}).`);
      }
    });

    return { stop };
  } catch (error) {
    console.error('  Cloudflare tunnel unavailable; local play remains available:', error.message);
    return noOpTunnel();
  }
}
