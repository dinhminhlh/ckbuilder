import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, save } from './lib.mjs';

const files = readdirSync(resolve(root, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => resolve(root, 'tests', f));
const result = spawnSync(process.execPath, ['--test', ...files], { encoding: 'utf8', cwd: root });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
save('evidence/07-automated-tests.json', { capturedAt: new Date().toISOString(), nodeVersion: process.version,
  command: 'node --test tests/*.test.mjs', exitCode: result.status, passed: result.status === 0,
  stdout: result.stdout, stderr: result.stderr });
process.exitCode = result.status ?? 1;
