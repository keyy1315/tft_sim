import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest 설정.
 *
 * - `@/*` path alias를 tsconfig와 맞춰 src/로 매핑
 * - tests/ 디렉토리 하위의 *.test.ts 만 대상
 * - node 환경 (시뮬레이터는 React 의존 없음)
 *
 * Golden test 안내: tests/golden/README.md
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Golden snapshot 업데이트: `pnpm test:golden -u`
  },
});
