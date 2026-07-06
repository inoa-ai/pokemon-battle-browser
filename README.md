# アークライト・クラッシュ

ブラウザで遊ぶ、ポケモンの「戦闘部分だけ」に集中したローカル向けプロトタイプです。

商用利用・公開配布をしない前提で、公式ポケモン名とPokeAPI sprites由来の公式アート表示を使っています。公開・配布・商用化する場合は、公式素材を使わない版へ差し替える想定です。

## Features

- 24体の公式ポケモンと公式アート表示
- ピカチュウとイーブイの進化後を選択可能
- 3体チーム選択
- 編成画面で各ポケモンの技を候補から4つ選択
- ミュウツー1体を撃破するボス戦モード
- プレイヤー vs CPU のターン制バトル
- タイプ相性、物理/特殊/補助技、PP、HP、状態異常、能力変化、交代
- 技タイプに応じたアクションエフェクト、ヒット演出、HPバーアニメーション
- Web Audio APIによるオリジナルBGMと効果音
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

ブラウザの自動再生制限により、BGM/効果音は最初のクリックまたは右上の音量ボタン操作後に鳴ります。

## Project Structure

- `src/data/creatures.ts`: 24体のポケモン、ステータス、技候補、タイプ、公式アートURL
- `src/game/battle.ts`: 戦闘エンジン、技ロードアウト、ボス戦モード
- `src/game/typeChart.ts`: タイプ相性
- `src/components/BattleScreen.tsx`: 戦闘UI
- `src/components/CreatureCard.tsx`: ロスター/キャラ表示
- `src/styles.css`: レイアウトとアクションエフェクト
## Notes

This is a local/private prototype. Do not use official Pokemon names, logos, music, or artwork in public/commercial builds without permission.
