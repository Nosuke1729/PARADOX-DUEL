# 影分身ファイターズ

4秒前の自分を分身として呼び出し、一緒に戦う2D横視点の対戦アクションゲームです。リポジトリ名と公開URLは従来の `PARADOX-DUEL` のままです。

[GitHub Pages でプレイ](https://nosuke1729.github.io/PARADOX-DUEL/)

## プレイ

```bash
npm ci
cp .env.example .env.local
npm run dev
```

ブラウザで表示されたローカル URL を開いてください。`STORY` と `PRACTICE` はネットワーク設定なしで遊べます。オンラインの部屋作成・参加には `.env.local` の `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を実際の Supabase プロジェクトへ合わせます。**secret / service-role key をブラウザに設定しないでください。** `.env.local` は Git の対象外です。

| キー | 操作 |
| --- | --- |
| A / D | 左右移動 |
| Space / W | ジャンプ |
| S | 足場を降りる |
| J | 選んだ武器で攻撃 |
| K | ダッシュ |
| L | 直前4秒を再生する Echo |
| I | 選んだ Skill を発動 |

オンライン対戦は `ONLINE → PRIVATE ROOM → CREATE ROOM` で6文字のコードを発行し、相手が `JOIN` で入力します。PCキーボード向けです。ラウンドは75秒、2本先取。タイムアップでは最大HPに対する残りHPの割合が多い側が勝ち、同率は引き分けでラウンドをやり直します。試合前に `FIGHTER` で Character・Weapon・Attack・Skill を選択します。ロビーで互いの構成を同期し、試合中は固定です。`PRACTICE` の相手は HEAVY / SPEAR / SHIELD です。
対戦中は画面右上の「対戦をやめる」からいつでもメニューに戻れます。

移動とジャンプは速いテンポに調整しています。床から中央の台までは150pxで、ジャンプの最高到達点は STANDARD 約223px、LIGHT 約277px、HEAVY 約192pxです。

## ロードアウト

新規プレイヤーは STANDARD / SWORD / BASIC SLASH / BLINK で開始します。ロック中の選択肢と解放条件は `FIGHTER` に表示されます。Story は1勝でChapterクリア、PracticeとPrivate Roomは従来の2本先取です。

| 解放 | 条件 |
| --- | --- |
| SPEAR | Player Lv.3 |
| LIGHT | Chapter 2 のLIGHT Bossを撃破 |
| SHIELD | Player Lv.7 |
| HEAVY SLASH | Player Lv.10 または STANDARD Mastery Lv.3 |
| BLASTER | Player Lv.12 |
| HEAVY | Chapter 4 のHEAVY Bossを撃破、またはPlayer Lv.15 |
| SHOCKWAVE | Player Lv.18 |
| ECHO SWAP | Chapter 5 クリア |
| ARC CYAN | STANDARD Mastery Lv.2 |
| UPPER SLASH | STANDARD Mastery Lv.4 |
| DAGGER / HAMMER | ステージ6 / 7クリア、または装備カプセル |
| FAN | ステージ9クリア、または装備カプセル |
| SPRING | ステージ10クリア、または装備カプセル |
| FAN GUST | ステージ11クリア、または装備カプセル（FAN所持後） |
| YO-YO / WHIP | ステージ12 / 13クリア、または装備カプセル |
| YO-YO HIGH / WHIP SWEEP | ステージ13 / 14クリア、または装備カプセル（対応武器の所持後） |

ストーリーは14ステージです。第12〜14ステージではヨーヨー、ムチ、ムチと分身を組み合わせるボスを相手にします。AI難易度はおまかせ・やさしい・ふつう・むずかしいから選べます。初回クリアはステージごとのXPとコインを獲得し、再クリアでも少額を獲得します。レベル1→2には100 XP、以後必要XPはレベルごとに50ずつ増えます。

ショップではコインで色を直接購入でき、色のカプセルは90コイン、装備カプセルは220コインです。装備カプセルからは未解放の武器・攻撃・スキルが1つ出ます。対応する武器を持っていない攻撃は候補に入らず、重複もありません。候補はすべて同じ確率で、現在の候補と確率をショップに表示します。装備はストーリーやレベルでも解放でき、現金による購入はありません。Rankedではレベルや所持コインによる能力補正はなく、各装備には射程・威力・隙などの得意不得意があります。

未ログイン時の進行状況はこのブラウザーの `localStorage` に保存します（キー `paradox-duel:progress:v1`）。メールアドレスとパスワードでACCOUNTを作成し、確認メールの認証後にログインすると、既存のローカル進行を初回だけCloudへ移します。以後はCloudを優先し、同じブラウザーにもバックアップを保存します。別端末で同じアカウントにログインするとCloudの進行を復元します。Cloud保存が失敗した場合は画面に警告を出し、ローカルバックアップを保持します。複数端末で同時に進行を更新した場合はリビジョン競合として保存を止め、XPやCoinsを二重加算しません。

`ONLINE → RANKED` はログインと一意のUsernameが必要です。近いRatingの相手を探し、待機時間に応じて範囲を広げます。対戦結果は両プレイヤーの申告が一致した場合、または切断タイムアウト時にDBトランザクションで一度だけ確定します。対戦途中の退出は敗北扱いです。Rankedは基礎ステータスにPlayer Level・Coins・Masteryの永続補正を掛けません。現段階では対戦ホストが戦闘を進行し、専用サーバーによる命中検証はありません。Rankedの厳密な不正対策は今後の課題です。

解放条件は [`src/progression/catalog.ts`](src/progression/catalog.ts)、Chapter/報酬/Bossは [`src/story/chapters.ts`](src/story/chapters.ts)、AI難易度は [`src/story/StoryAI.ts`](src/story/StoryAI.ts) で変更できます。進行状態は [`src/progression/progress.ts`](src/progression/progress.ts) の単一モデルで、Cloud保存にそのまま使用します。Rating、Tier、Matchmaking幅は [`src/ranked/config.ts`](src/ranked/config.ts) とDBの `ranked_settings` で設定します。

| Character | 性能 | 説明 |
| --- | --- | --- |
| STANDARD | HP 100 / 標準速度 / 標準攻撃力 | 速度・耐久・攻撃力のバランスがよい。どの構成にも合わせやすい。 |
| LIGHT | HP 78 / 高速 / 低攻撃力 | 移動・ジャンプ・ダッシュが速く、Echoとの位置調整に強い。ノックバックを受けやすい。 |
| HEAVY | HP 130 / 低速 / 高攻撃力 | 高耐久・高威力。吹き飛ばされにくい。 |

| Weapon | 攻撃 | 説明 |
| --- | --- | --- |
| SWORD | 近距離・速い斬撃 | 射程は短いが扱いやすい。 |
| SPEAR | 中距離・遅い突き | 長いリーチで間合いを取れる。 |
| BLASTER | 遠距離・弾 | 威力が低く発生も遅いが、離れた相手へ届く。Echoも弾を発射する。 |
| DAGGER | 近距離・速攻 | 攻撃間隔が短い代わりに、威力と射程が低い。 |
| HAMMER | 近距離・一撃 | 威力と吹き飛ばしに優れるが、発生と硬直が長い。 |
| FAN | 対空・広め | 上方向に広く当たるが、威力と正面の射程は控えめ。 |
| YO-YO | 中距離・持続 | 中距離に攻撃判定を置きやすいが、威力は控えめ。 |
| WHIP | 長射程・大きな隙 | 遠くまで届き吹き飛ばせるが、振り始めと硬直が長い。 |

| Skill | 再使用 | 説明 |
| --- | --- | --- |
| BLINK | 8 秒 | 向いている方向へ短距離瞬間移動する。 |
| SHIELD | 10 秒 | 約0.8秒間、ダメージとノックバックを防ぐ。 |
| SHOCKWAVE | 12 秒 | 近くの敵を吹き飛ばす。ダメージは小さい。 |
| ECHO SWAP | 10 秒 | 出現中の自分のEchoと位置を入れ替える。Echoがいないと使用できない。 |
| SPRING | 10 秒 | 空中でも上へ大きく跳べる。無敵ではない。 |

## Supabase の準備

1. プロジェクトの Auth で **Anonymous Sign-Ins** を有効にします。恒久アカウントは不要ですが、各ブラウザを一意に識別するために使います。
2. [`supabase/migrations/20260928082725_duel_rooms.sql`](supabase/migrations/20260928082725_duel_rooms.sql) を適用します。このリポジトリが接続する既存の `PARADOX DUEL` プロジェクトには適用済みです。
3. Account / Cloud / Ranked 用の残りの `supabase/migrations` をファイル名順に適用します。既存の `PARADOX DUEL` プロジェクトには適用済みです。AuthのEmail認証を有効にし、確認メールのSite URL / Redirect URLへ公開先URLを設定します。
4. `.env.local` にそのプロジェクトの URL と **publishable key** を設定します。GitHub Pagesでは同名のRepository Variablesを使用します。
5. Realtime の private channel と room membership RLS が使われます。部屋を作れない場合は Auth と `Realtime → Policies`、ブラウザのエラー表示を確認してください。

Room code は招待用です。Private Room対戦中は部屋を作成した端末が移動・命中・HP・結果を確定し、参加端末へスナップショットを送ります。Rankedも現在の戦闘同期方式を利用しますが、Rating更新はDB側で一試合一度だけ処理します。`profiles` と `player_progress`、`ranked_stats`、`ranked_queue`、`ranked_matches` にRLSを設定し、Ranking RPCはUsername・Rating・Winsと順位だけを返します。

## 開発

```bash
npm test
npm run build
```

設計の判断、MVP の条件、テスト方針は [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) にあります。
