import { exec } from 'child_process';
import path from 'path';

export function runIngest() {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), 'scripts', 'ingest.js');
    const cmd = `node "${script}"`;
    const child = exec(cmd, { cwd: process.cwd(), env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, stdout });
      else reject(new Error(stderr || `Ingest failed with code ${code}`));
    });
  });
}


