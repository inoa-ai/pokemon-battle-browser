# アークライト・クラッシュ

ブラウザで遊ぶ、ポケモンの「戦闘部分だけ」に集中したローカル向けプロトタイプです。

商用利用・公開配布をしない前提で、公式ポケモン名とPokeAPI sprites由来の公式アート表示を使っています。公開・配布・商用化する場合は、公式素材を使わない版へ差し替える想定です。

## Features

- 10体の公式ポケモンと公式アート表示
- 3体チーム選択
- プレイヤー vs CPU のターン制バトル
- タイプ相性、物理/特殊/補助技、PP、HP、状態異常、能力変化、交代
- 技タイプに応じたアクションエフェクト、ヒット演出、HPバーアニメーション
- PC/スマホ対応のレスポンシブUI

## Commands

```bash
npm install
npm run dev -- --port 5174 --strictPort
npm run build
npm run test
```

Open:

```text
http://127.0.0.1:5174/
```

Published URL:

```text
https://inoa-ai.github.io/pokemon-battle-browser/
```

ランキングや外部DBはありません。ゲーム本体だけをGitHub Pagesで静的公開します。

## Project Structure

- `src/data/creatures.ts`: 10体のポケモン、ステータス、技、タイプ、公式アートURL
- `src/game/battle.ts`: 戦闘エンジン
- `src/game/typeChart.ts`: タイプ相性
- `src/components/BattleScreen.tsx`: 戦闘UI
- `src/components/CreatureCard.tsx`: ロスター/キャラ表示
- `src/styles.css`: レイアウトとアクションエフェクト
## Notes

This is a local/private prototype. Do not use official Pokemon names, logos, music, or artwork in public/commercial builds without permission.
