/**
 * detect-container.ts: picks podman or docker as the container runtime.
 *
 * Preference: podman first, docker fallback. A runtime counts as usable
 * only when both:
 *   1. its CLI is installed (`<cmd> --version` exits 0)
 *   2. its daemon/VM responds (`<cmd> info` exits 0 within timeout)
 *
 * Why we also check the daemon: `podman --version` returns 0 even when
 * the Podman machine is off on Windows/macOS. Without this check,
 * downstream compose calls hang on the socket forever.
 *
 * Override the autodetect with CONTAINER_CMD env var.
 *
 * Used by ensure-infra.ts (imports detectContainerRuntime) and by the
 * Justfile (calls this as a one-shot to print the runtime name).
 */

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CANDIDATES = ['podman', 'docker'] as const;
const DAEMON_CHECK_TIMEOUT_MS = 5000;

function isInstalled(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function daemonResponds(cmd: string): boolean {
  try {
    execSync(`${cmd} info`, { stdio: 'ignore', timeout: DAEMON_CHECK_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function printDaemonOffHint(cmd: string): void {
  const isWinOrMac = process.platform === 'win32' || process.platform === 'darwin';
  if (cmd === 'podman') {
    if (isWinOrMac) {
      console.error('  podman: VM apagada. Ejecutá `podman machine start`.');
    } else {
      console.error(
        '  podman: daemon no responde. Ejecutá `systemctl --user start podman.socket`.',
      );
    }
  } else if (cmd === 'docker') {
    if (isWinOrMac) {
      console.error('  docker: daemon no responde. Arrancá Docker Desktop.');
    } else {
      console.error('  docker: daemon no responde. Ejecutá `sudo systemctl start docker`.');
    }
  } else {
    console.error(`  ${cmd}: daemon no responde. Verificá que esté corriendo.`);
  }
}

export function detectContainerRuntime(): string {
  const override = process.env.CONTAINER_CMD;
  if (override) {
    if (!isInstalled(override)) {
      console.error(`CONTAINER_CMD=${override} no está instalado o no está en el PATH.`);
      process.exit(1);
    }
    if (!daemonResponds(override)) {
      console.error(`CONTAINER_CMD=${override} instalado pero el daemon no responde.`);
      printDaemonOffHint(override);
      process.exit(1);
    }
    return override;
  }

  const installedButOff: string[] = [];
  for (const candidate of CANDIDATES) {
    if (!isInstalled(candidate)) continue;
    if (daemonResponds(candidate)) return candidate;
    installedButOff.push(candidate);
  }

  if (installedButOff.length > 0) {
    console.error(
      `Runtime(s) instalado(s) pero con daemon apagado: ${installedButOff.join(', ')}.`,
    );
    for (const c of installedButOff) printDaemonOffHint(c);
    console.error('');
    console.error('  Una vez arrancado, reintentá el comando.');
    process.exit(1);
  }

  console.error('No se encontró ningún container runtime. Instalá podman o docker.');
  process.exit(1);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(detectContainerRuntime());
}
