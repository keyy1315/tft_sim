/** TFT 게임 데이터의 HTML/플레이스홀더 태그를 제거하여 순수 텍스트로 변환 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/@[^@]+@/g, '').replace(/%i:\w+%/g, '');
}

/**
 * 설명 템플릿의 @변수@ 플레이스홀더를 실제 수치로 치환.
 *
 * 패턴:
 *   @VarName@          → variables에서 VarName 값
 *   @VarName*100@      → variables에서 VarName 값 × 100
 *   @TFTUnitProperty...@ → 제거
 *   %i:scaleXX%        → 제거
 *   <expandRow>/<row>  → 제거
 *   <br>               → 줄바꿈
 *   기타 HTML 태그     → 태그만 제거, 내용 유지
 */
export function resolveDescription(
  template: string | undefined | null,
  variables: Record<string, number | null> | { name: string; value: number[] }[],
  starLevel?: number,
): string {
  if (!template) return '';

  // variables ��규화
  const vars: Record<string, number> = {};
  if (!variables) return template;
  if (Array.isArray(variables)) {
    for (const v of variables) {
      if (!v.value) continue;
      const idx = starLevel ?? 1;
      const val = v.value[idx] ?? v.value[0] ?? 0;
      vars[v.name] = val;
    }
  } else {
    for (const [k, v] of Object.entries(variables)) {
      if (v != null) vars[k] = v;
    }
  }

  let result = template;

  // {{TFT_Keyword_*}} 등 mustache 스타일 placeholder 제거.
  // 원본 데이터에서 키워드 강조용 마커 (예: '{{TFT_Keyword_Precision}}' = '정밀')
  // 가 변환 없이 노출되는 케이스 방지. 매핑 정보가 없으므로 일단 제거.
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  // expandRow / row 태그 제거
  result = result.replace(/<expandRow>[\s\S]*?<\/expandRow>/g, '');
  result = result.replace(/<row>[\s\S]*?<\/row>/g, '');

  // <br> → 줄바꿈
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // @TFTUnitProperty...@ 제거 (일반 변수보다 먼저 처리)
  result = result.replace(/@TFTUnitProperty[^@]*@/g, '');

  // @VarName*100@ 패턴 — 곱셈
  result = result.replace(/@([^@*]+)\*(\d+)@/g, (_match, name: string, mult: string) => {
    const val = findVar(vars, name.trim());
    if (val == null) return '';
    return String(Math.round(val * parseInt(mult)));
  });

  // @VarName@ 패턴 — 단순 치환 (`.`, `:` 포함 가능한 잔여 패턴도 처리)
  result = result.replace(/@([^@]+)@/g, (_match, name: string) => {
    const val = findVar(vars, name.trim());
    if (val == null) return '';
    return formatNum(val);
  });

  // %i:scaleXX% → 한국어 스케일링 표시
  result = result.replace(/%i:(\w+)%/g, (_match, key: string) => {
    return SCALE_LABELS[key] ?? '';
  });

  // 빈 괄호 정리: () 또는 ( ) 제거
  result = result.replace(/\(\s*\)/g, '');

  // HTML 태그 제거 (내용 유지)
  result = result.replace(/<[^>]+>/g, '');

  // 연속 줄바꿈 정리
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

const SCALE_LABELS: Record<string, string> = {
  scaleAP: '주문력',
  scaleAD: '공격력',
  scaleHealth: '체력',
  scaleArmor: '방어력',
  scaleMR: '마법저항력',
  scaleAS: '공격속도',
  scaleCrit: '치명타',
  scaleCritMult: '치명타 피해',
  scaleDR: '피해감소',
  scaleSV: '흡혈',
  scaleLevel: '레벨',
};

/** 변수명 변형을 고려한 조회 */
function findVar(vars: Record<string, number>, name: string): number | undefined {
  if (name in vars) return vars[name];

  // Modified/Total/AP 접두사 제거 후 매칭
  const prefixes = ['Modified', 'Total', 'AP'];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      const stripped = name.slice(prefix.length);
      if (stripped in vars) return vars[stripped];
    }
  }

  // 접두사 제거 후에도 못 찾으면 suffix 매칭 시도
  // ex: ModifiedJarvanDamage → JarvanDamage, ModifiedShield → LuxShield (Shield suffix)
  const coreName = name.replace(/^(Modified|Total|AP)/, '');
  if (coreName) {
    for (const [k, v] of Object.entries(vars)) {
      if (k.endsWith(coreName)) return v;
    }
  }

  return undefined;
}

function formatNum(val: number): string {
  if (Number.isInteger(val)) return String(val);
  if (Math.abs(val) < 0.01) return '0';
  return val.toFixed(1).replace(/\.0$/, '');
}
