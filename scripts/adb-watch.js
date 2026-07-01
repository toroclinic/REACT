/**
 * Runs detached in the background while Metro is open.
 * Polls `adb devices` every 2s and re-runs `adb reverse tcp:8081 tcp:8081`
 * whenever a device appears or reconnects — so the Metro tunnel is never stale.
 *
 * Usage: called automatically by `npm start` and `npm run android`.
 * Do not run manually.
 */
const { exec, spawn } = require('child_process');

// First invocation: re-spawn ourselves detached so Metro can start immediately.
if (process.env.ADB_WATCH_CHILD !== '1') {
  const child = spawn(process.execPath, [__filename], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ADB_WATCH_CHILD: '1' },
  });
  child.unref();
  process.exit(0);
}

// ── Running as detached background child ──────────────────────────────────────

const PORT = 8081;

function reversePort() {
  exec(`adb reverse tcp:${PORT} tcp:${PORT}`);
}

let lastCount = 0;

function poll() {
  exec('adb devices', (_err, stdout) => {
    if (!stdout) return;
    const connected = stdout.split('\n').filter((l) => l.includes('\tdevice')).length;
    if (connected > 0 && connected !== lastCount) {
      // Device count changed upward — a device (re)connected
      setTimeout(reversePort, 800);
    }
    lastCount = connected;
  });
  setTimeout(poll, 2000);
}

reversePort(); // run immediately on process start
poll();
