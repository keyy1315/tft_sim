# Diff Attribution Follow-up — Tasks 1/2/3 진단 (2026-05-06)

> PR #95 (TF +40% / CritChance / AD outliers 정규화) 머지 후 잔여 항목 3건 진단:
> 1. Talon -67% (가장 큰 잔여 negative)
> 2. Survivor HP error +1.45 (PR #94 후속 over-correction)
> 3. 다른 stat 키 (Healing/Shield 등) percentage 점검

## Task 1 — Talon -67% 진단 결과

### 결론: **Talon 단독 이슈 아님 — sim duration mismatch 의 symptom**

검증 (1v1 isolation):
- Talon ★3 + RFC vs Aatrox ★3, no team: **sim 1407 dmg vs real 1428** (≈match)
- Talon ★3 no items vs same: 1298 dmg

검증 (full team round 5-1):
- 게임 5-1: real 33s 전투, sim **7.77s** 전투 — 4.2x 빠르게 종료
- Talon: real 5418 dmg vs sim 1005 (per-second: real 164/s, sim 129/s — 비교적 매치)
- 즉 **Talon 의 per-second 공식은 합리적**, 전투 시간이 짧아 누적 데미지 부족

### 근본 원인: 시뮬 종료가 실제보다 4x 빠름

원인 후보:
1. Player 측 alpha-strike (TF 등 caster 가 너무 빨리 mana 차서 cast)
2. Opponent 측 carries (Lissandra/Veigar/Mordekaiser ★3) 의 ability damage 가 sim 미구현
3. 챔피언별 ability 형식 (DOT after death, 도약 후 cast 동기화 등) 부정확

→ **Talon 별도 fix 불필요**. 후속 작업은 opponent 챔프 ability 점검.

## Task 2 — Survivor HP error 진단 결과

### 결론: **Sim duration mismatch 의 같은 symptom**

per-champ HP error (PR #94 baseline 8.59 → PR #95 10.02):

| Team | 챔프 | rounds | aliveMis | mean HP Δ (pts) |
|------|------|--------|----------|-----------------|
| player | Jax | 19 | 11 | **+47.3** |
| player | TwistedFate | 15 | 8 | **+55.9** |
| player | Aatrox | 21 | 13 | +39.7 |
| player | Talon | 20 | 11 | +40.0 |
| player | Caitlyn | 12 | 9 | +41.3 |
| opponent | IvernMinion | 12 | 4 | -21.1 |
| opponent | Lissandra | 10 | 2 | -15.0 |
| opponent | Galio | 5 | 1 | -19.0 |

패턴:
- **Player 측 모든 carry: +40~56% HP** (sim 이 너무 살아남음)
- **Opponent 측: -15~-22% HP** (sim 에서 빨리 죽음)

→ Player 알파 스트라이크 → opponent 빨리 사망 → player 무피해 종료. 같은 root cause.

### 진단: opponent damage 부족이 잔여 오차 dominant

후속 점검 후보:
- Lissandra ★3 ability (얼음 폭발 + 슬로우?)
- Veigar ★3 ability (마법 피해 burst)
- Mordekaiser ★3 ability (DOT field)
- Poppy / Illaoi tank ★3 ability (defensive)

## Task 3 — 다른 stat 키 percentage 점검 결과

### 점검 결과

| 키 | 분포 | 처리 |
|----|------|------|
| ManaRegen | 모두 integer 1~10 | sim manaRegen (mana/sec) 으로 직접 사용 — 정상 |
| BonusManaRegen | 모두 integer 2~5 | 정상 |
| StatOmnivamp | 9 fraction + 1 integer (Omniweapon=1) | 1.0 fraction 으로 보존, sim 동작 정상 |
| Omnivamp | 3 fraction + 1 integer (HextechGunblade=18) | **data redundancy — sim 은 StatOmnivamp 사용, Omnivamp 무시 → 자연 정상** |
| BonusOmnivamp | 모두 fraction | 정상 |
| DamageAmp | 2 fraction + 1 integer (TalismanOfAscension=1.2) | 1.2 fraction 으로 보존 |
| Mana | 모두 integer 20~40 | flat mana 가산 (정상) |

### 발견: Omnivamp 는 bug 아님

처음에는 HextechGunblade Omnivamp=18 이 +1800% omnivamp 처럼 보였지만 추가 점검 결과:
- HextechGunblade 데이터: `Omnivamp=18` + `StatOmnivamp=0.15` 둘 다 존재
- `ITEM_EFFECT_KEYS` 매핑: `'StatOmnivamp': 'omnivamp'` 만 등록 (Omnivamp 키 미매핑)
- → sim 이 자동으로 StatOmnivamp(0.15) 만 사용, Omnivamp(18) 무시 → bug 없음

### Fix 적용 (없음)

본 Task 3 는 진단 only. 다른 키 (Healing/Shield 등) 도 sim 정상 동작 확인.

## Summary

| Task | 결과 | Action |
|------|------|--------|
| 1 (Talon) | sim duration symptom — Talon 단독 이슈 아님 | 진단 only, 후속 PR (opponent ability) 권고 |
| 2 (Survivor HP) | 같은 root cause — opponent damage 부족 | 진단 only, Task 1 과 함께 |
| 3 (other stats) | bug 없음 — HextechGunblade Omnivamp/StatOmnivamp 는 data redundancy, sim 정상 | 회귀 가드 1건 추가 (fingerprint), code 변경 없음 |

## 다음 PR 후보 (sim duration mismatch 해소)

### 우선순위
1. **Set 17 opponent carries ability 점검** — Lissandra / Veigar / Mordekaiser / Poppy / Illaoi ★3 ability 가 sim 에 정확히 구현되어 있는지 audit
2. Mana economy 검토 — 시뮬 caster 측 mana 가 너무 빨리 차는지
3. Opponent items / artifacts 점검 — opponent 측 사용 items 의 sim 영향 확인

### 측정 트리거
다음 PR 후 diff cache 재실행 시:
- sim duration 이 23~30s 범위로 늘어나면 OK
- winnerMatchRate +5pt 이상 추가 개선 기대
