'use client';
import type { UnitDamageEntry } from '@/lib/actualData/types';

interface Props {
  entries: UnitDamageEntry[];
  onChange: (entries: UnitDamageEntry[]) => void;
}

export default function DamageChartInput({ entries, onChange }: Props) {
  function addRow() {
    onChange([...entries, { championId: '', damage: 0 }]);
  }
  function updateRow(i: number, patch: Partial<UnitDamageEntry>) {
    onChange(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  }
  function removeRow(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }

  return (
    <div className="border rounded p-2 space-y-1">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold">데미지 차트</h4>
        <button onClick={addRow} className="text-xs px-2 py-0.5 border rounded">+ 추가</button>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-500">유닛별 데미지 입력 (선택)</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr><th className="text-left">유닛 ID</th><th>데미지</th><th /></tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td><input value={e.championId} onChange={ev => updateRow(i, { championId: ev.target.value })}
                  className="border p-0.5 w-full text-xs" /></td>
                <td><input type="number" value={e.damage} onChange={ev => updateRow(i, { damage: Number(ev.target.value) })}
                  className="border p-0.5 w-full text-xs text-right" /></td>
                <td><button onClick={() => removeRow(i)} className="text-red-600">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
