'use client';

interface Props {
  value: number | undefined;        // 초 단위
  onChange: (seconds: number | undefined) => void;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;              // videoEndTime 처럼 비어있을 수 있는 경우
}

/**
 * mm:ss 포맷으로 영상 시각을 입력받는 컴포넌트 (uncontrolled).
 *
 * 입력 허용 형태:
 *   - "4:23"   → 263초
 *   - "04:23"  → 263초
 *   - "1:03:20" → 3800초 (hh:mm:ss)
 *   - "263"    → 263초 (순수 숫자도 초로 해석)
 *   - ""       → allowEmpty이면 undefined
 *
 * onChange는 blur 또는 Enter 시에만 커밋되어 편집 중 "4:" 같은 불완전 입력을 허용.
 * prop value가 외부에서 바뀌면 key로 리마운트되어 defaultValue가 갱신됨.
 * React Compiler 규칙 준수를 위해 내부 state를 두지 않음.
 */
export default function VideoTimeInput({
  value,
  onChange,
  placeholder = 'mm:ss',
  className = '',
  allowEmpty = false,
}: Props) {
  const initialText = secondsToMMSS(value);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (allowEmpty) onChange(undefined);
      return;
    }
    const seconds = parseMMSS(trimmed);
    if (seconds !== null && seconds >= 0) onChange(seconds);
  }

  return (
    <input
      key={initialText}
      type="text"
      inputMode="numeric"
      defaultValue={initialText}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      placeholder={placeholder}
      className={`border border-gray-700 bg-gray-900 text-gray-100 p-1 rounded ${className}`}
    />
  );
}

export function secondsToMMSS(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function parseMMSS(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some(p => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (parts.length === 2) {
    const [m, s] = nums;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = nums;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}
