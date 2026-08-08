// Guard: this client must not classify clinical readings.
//
// The PWA has carried this guard since the 2026-08-04 Health-tab audit. This
// app did not — and that is exactly why it still had five local classifiers
// (bpClass, glucoseClass, spo2Class, cholesterolClass, bmiClass) three months
// after the same code was deleted from the web client. The web guard even
// listed this app's strings in a comment, which is the lesson in one line:
//
//   A RULE ENFORCED IN ONE PLACE AND MERELY DESCRIBED IN ANOTHER IS A RULE
//   THAT HAS ALREADY DRIFTED.
//
// What the drift looked like here, before deletion:
//   · glucose had NO hypoglycaemia branch, so 2.5 mmol/L rendered a green
//     "Normal range" chip while the server classified it CRITICAL, set the
//     ambulance flag, and SMSed the member to call 997;
//   · BP called critical at diastolic 110 against the server's 120, and had
//     no amber band at all, so 135/85 read "Normal range" against the
//     server's stage-1 hypertension;
//   · cholesterol and BMI disagreed with the server on both boundaries.
//
// Classification happens in exactly one place: the backend's alertService.ts,
// pinned by its threshold-grid test (TORO-CLIN-BP-001). Clients render what
// the server returns.
//
// Presentation is allowed: mapping a SERVER-returned level onto colours and
// copy (services/assessmentPresentation.ts) decides pixels, not medicine.
//
// CommonJS, not ESM: this package has no "type": "module" and React Native's
// tooling assumes CJS.

const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const SRC = join(root, 'src');

// Local classifier names, both this app's historical ones and the PWA's, so
// neither codebase's deleted table can be pasted into the other.
const FORBIDDEN_IDENTIFIERS =
  /\b(bpClass|glucoseClass|spo2Class|cholesterolClass|bmiClass|classifyBP|classifyGlucose|classifyCholesterol|classifyBMI|classifySpO2|classifyStoredResult|classifyResult)\s*\(/;
const FORBIDDEN_MODULE = /healthranges/i;

// A file may TALK about the deleted classifiers — the tombstone comment in
// ScreeningScreen.tsx is load-bearing documentation. What must not come back
// is a CALL, which is why the pattern above requires an opening parenthesis.
const failures = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(name)) {
      continue;
    }
    const rel = full.slice(root.length + 1).replace(/\\/g, '/');
    if (FORBIDDEN_MODULE.test(name)) {
      failures.push(
        `${rel}: a healthRanges module exists — clinical thresholds live in the backend's alertService.ts only`,
      );
      continue;
    }
    const text = readFileSync(full, 'utf8');
    const m = text.match(FORBIDDEN_IDENTIFIERS);
    if (m) {
      failures.push(
        `${rel}: calls ${m[1]}() — clients render server assessments, they do not classify readings`,
      );
    }
  }
}

walk(SRC);

if (failures.length > 0) {
  console.error('guard-no-client-clinical-math FAILED:\n');
  for (const f of failures) {
    console.error('  ' + f);
  }
  console.error(
    "\nClassification belongs to the backend (alertService.ts, pinned by its grid test).",
  );
  process.exit(1);
}
console.log('guard-no-client-clinical-math: clean');
