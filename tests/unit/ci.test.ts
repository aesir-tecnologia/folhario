import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CI configuration (INFRA-12)', () => {
  const ciPath = path.resolve(process.cwd(), '.github/workflows/ci.yml');
  
  it('ci.yml should exist', () => {
    expect(fs.existsSync(ciPath)).toBe(true);
  });

  it('should use postgres:17-alpine service container', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    expect(ciContent).toContain('image: postgres:17-alpine');
  });

  it('should include required steps: lint, typecheck, unit, integration, build', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    
    // Check for the step commands directly in the file
    expect(ciContent).toContain('run: pnpm lint');
    expect(ciContent).toContain('run: pnpm typecheck');
    expect(ciContent).toMatch(/run: pnpm test:unit|run: pnpm test/);
    expect(ciContent).toContain('run: pnpm test:integration');
    expect(ciContent).toContain('run: pnpm build');
    expect(ciContent).toContain('run: pnpm test:e2e');
  });

  it('Phase 1 ONLY - should not contain deploy workflows (vercel/preview)', () => {
    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    expect(ciContent.toLowerCase()).not.toContain('vercel');
    expect(ciContent.toLowerCase()).not.toContain('preview');
  });
});
