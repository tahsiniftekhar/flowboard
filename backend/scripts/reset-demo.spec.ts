import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts', 'reset-demo.sh');
const demoUrl =
  'postgresql://flowboard:pw@postgres:5432/flowboard?schema=public';

// Runs only the guard (`--check`), so no database is needed or touched.
function check(env: Record<string, string>) {
  return spawnSync('sh', [script, '--check'], {
    env: { PATH: process.env.PATH, DIRECT_URL: '', ...env },
    encoding: 'utf8',
  });
}

describe('reset-demo.sh guard', () => {
  it('refuses without DEMO_RESET_ALLOWED=true', () => {
    for (const allowed of [undefined, '', 'false', '1', 'TRUE']) {
      const env: Record<string, string> = { DATABASE_URL: demoUrl };
      if (allowed !== undefined) env.DEMO_RESET_ALLOWED = allowed;
      const result = check(env);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('DEMO_RESET_ALLOWED');
    }
  });

  it('refuses a database outside the allowlist', () => {
    for (const url of [
      'postgresql://other_app:pw@postgres:5432/other_app?schema=public',
      'postgresql://flowboard:pw@postgres:5432/flowboard_prod',
      'postgresql://flowboard:pw@postgres:5432/',
      'not a url',
    ]) {
      const result = check({ DEMO_RESET_ALLOWED: 'true', DATABASE_URL: url });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Refusing demo reset');
    }
  });

  it('refuses when DIRECT_URL points elsewhere', () => {
    const result = check({
      DEMO_RESET_ALLOWED: 'true',
      DATABASE_URL: demoUrl,
      DIRECT_URL: 'postgresql://other_app:pw@postgres:5432/other_app',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('DIRECT_URL');
  });

  it('allows the demo database', () => {
    const result = check({ DEMO_RESET_ALLOWED: 'true', DATABASE_URL: demoUrl });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('check only');
  });
});
