# PARADOX DUEL — 設計レビューと実装計画

対象: Game Design & Technical Specification v0.3（2026-09-28 確認）  
状態: **設計レビュー後、2026-09-28 にユーザーが MVP 実装を承認。実装状況は README とソースを参照。**

追記（2026-09-28）: ユーザーは Phase 6 のキャラクター3種・武器3種・Skill4種も実装対象に追加した。以下の「STANDARD / Sword / Blink のみ」「Phase 6 まで作らない」は当初の段階計画を記録したもので、現在の完成範囲は README のロードアウト一覧を参照する。

## 0. 現在地と判断

- 現在のリポジトリには `README.md`、`index.html`、`package.json`、`tsconfig.json` のみがあり、`src/`、Phaser 依存、テスト、lockfile はない。README の「Current prototype」は実装済み機能の証拠にならないため、着手時に現状へ合わせて直す。
- コンセプトは成立しうる。移動と攻撃の履歴を「次の味方」として準備し、現在の本体で相手の逃げ道を変える判断が、少ない操作に深みを作る。ただし、Echo が予測しにくい、攻撃が見えない、同期で命中が食い違うと面白さは消える。Phase 1–2 でこの仮説を実機で検証する。
- 最初の完成対象は仕様 §57 の 24 条件を満たす **友人同士のブラウザ 1 対 1 対戦**。Ranked、進行要素、アイテム、追加ロードアウトは対象外。

## 1. 論点別レビュー

| 論点 | 判断・理由 | 最初の検証 |
| --- | --- | --- |
| 面白さ | 過去の攻撃を仕込み、本体で相手をその攻撃へ誘導できれば独自性がある。Echo が自動で追尾したり、現在の操作を複製したりすると読み合いが弱まる。 | 対面プレイで Echo を使った挟み撃ち・フェイント・追撃が、偶然でなく再現できるか観察。 |
| 4 秒の履歴 | 初期値として妥当な仮説。初心者には計画しにくく、短いラウンドには長すぎる可能性がある。履歴長と再生長は同じ 4 秒にする。 | まず 4 秒固定で試し、2 秒・3 秒・4 秒を同じステージと攻撃で比較。勝率だけでなく「狙った行動を出せた割合」を記録。 |
| Echo の強さ | 1 体、4 秒、再生中は本体が自由。最初は本体と同じ攻撃判定・威力で動作確認し、その後のみ威力・起動予告・クールダウンを調整する。 | Echo の命中頻度、連続被弾時の反撃余地、同じパターンの連打を確認。 |
| Cooldown | 10 秒を初期値とし、**L を押して生成した時点**から計測。再生 4 秒との重複を許すので、消滅後の待ち時間は約 6 秒。履歴不足中とラウンド外では起動不可。 | Echo のない時間が退屈か、毎回同じ 4 秒のループが最適解になるか検証。 |
| Hitbox | 見た目から独立した Hurtbox と、Startup / Active / Recovery を持つ攻撃 Hitbox を使う。Echo の攻撃にも同じ攻撃定義を適用。 | 可視デバッグ矩形で、正面・背面・上下足場・ダッシュ中の境界事例を確認。 |
| Character | MVP は STANDARD のみ。速度・HP・ジャンプ・ダッシュ・被ノックバック係数を設定値へ分離し、操作と当たり判定の基本形は共通。 | 後の LIGHT / HEAVY が設定追加で済み、Echo 記録形式を変えないことを設計レビュー。 |
| Weapon | MVP は Sword のみ。射程、発生、持続、硬直、威力、ノックバックをデータ定義。Spear / Blaster は異なる形状・Projectile のため Phase 6。 | Sword だけで接近と間合い取りが成立するか確認。 |
| Skill | MVP は Blink を 1 種。I の単押しで短距離移動し、床・壁・相手との重なりを安全に解決する。Echo Swap は独自性が高いが、Echo 不在時の扱いと重なり解決を要するので追加は Phase 6。 | Blink が逃げ専用の強すぎる行動にならないか、発動先が常に有効か確認。 |
| Physics | Phaser Arcade Physics を 2D の重力・床・足場・移動体に使用。攻撃判定は Arcade の overlap を入口とし、CombatSystem が一意の命中を確定する。決定論的なネットワーク再計算には依存しない。 | 固定 60 Hz ステップで足場通過、着地、吹き飛び、端への衝突を確認。 |
| Phaser 構成 | Scene は Boot / Menu / Lobby / Battle に限定。Loadout は当面 Menu 内の明示的な状態にする。ゲーム規則を Scene に埋めず、戦闘・Echo・ラウンドを別モジュールにする。 | BattleScene をローカル対戦・オンライン対戦で同じ規則により動かせること。 |
| Supabase | Presence は在室・接続状態だけ、Broadcast は短命な入力・状態・イベントだけ。DB は部屋コードと 2 枠の原子的な確保に限る。 | 2 ブラウザ、同時入室、切断、再接続、無料枠のスループットで確認。 |
| Network latency | 送信側の即時反応と、受信側の補間、結果の訂正を分ける。Echo や攻撃の見た目は予告できるが、HP 確定は authority の結果を待つ。 | 80 / 150 / 250 ms RTT、jitter、パケット欠落を模擬し、入力感と命中差異を記録。 |
| Echo 同期 | 起動時に直前 4 秒の定量化した軌跡と攻撃イベントを 1 回送る。毎フレームの Echo 位置送信と、両端での物理再シミュレーションはしない。 | 軌跡のサイズ、再生ずれ、途中参加・欠落時の回復を測定。 |
| Hit validation | ルーム作成者を **match authority** とする。参加者は「相手 HP=0」を送れない。authority が攻撃判定・HP・ラウンド結果を確定し、双方がそのイベントを表示する。ホスト自身の不正は防げない。 | 同一 attack ID の重複、遅着、改変、同時命中を含む 2 クライアント検証。 |
| Ranked | P2P 的なクライアント authority は競技順位に不適。将来は入力をサーバーへ送り、サーバーが戦闘・HP・勝敗を確定する別構成へ移す。 | Game rules と transport の境界を保ち、サーバー移植が可能な形かレビュー。 |

## 2. Architecture / Game systems

### 実行モデル

1. **シミュレーション**: BattleScene の固定 60 Hz で入力、移動、当たり判定、攻撃フェーズ、ダメージ、Echo 記録、ラウンド状態を順に更新。画面描画は別のフレーム周期。処理落ちで失った時間を無制限に追いかけず、上限と警告を設ける。
2. **移動**: A/D と Space。W は初期 MVP ではジャンプ補助にしない（操作曖昧さを減らす）。S は足場上でのみ下へ通過し、主床ではしゃがみ表示のみ。空中左右制御を地上より弱める。K ダッシュは短距離で cooldown 付き、無敵は初期仕様に含めない。
3. **ステージ**: 主床と 1 個の一方向足場から始める。上昇時は通過、下降時は上面に着地。S を押した瞬間に該当足場との衝突を短く無効化し、再着地までの状態を管理する。カメラ・スポーン・壁を固定し、競技上の視認性を優先。
4. **CombatSystem**: 攻撃入力をフェーズへ変換。Active 中に形状を置き、Hurtbox と overlap した対象について `(roundId, attackerId, attackId, targetId)` を一度だけ適用。味方・自分には命中しない。無敵、キャンセル、方向攻撃、Projectile は MVP に入れない。被弾は HP、ヒットストップ候補、ノックバック、短い被弾表示を発生させる。多段 Echo は同じ attack ID で再命中しない。
5. **RoundManager**: `BOOT → MENU → LOADOUT → LOBBY → COUNTDOWN → PLAYING → ROUND_END → MATCH_END` を明示。1 ラウンド 75 秒を初期値、2 本先取。時間切れは残 HP の**割合**で比較し、同値は引き分けとしてそのラウンドを再試行する（両者に勝ち星を与えない）。結果確定後は入力・ダメージを止め、次ラウンドで位置、HP、履歴、Echo、cooldown を初期化。Rematch は両者の同意で新 match ID を開始。
6. **HUD**: 双方の HP、残り時間、ラウンド勝利数、Echo と Skill の ready / 秒数、接続状態を表示。Echo はチーム色・半透明・輪郭を組み合わせ、本体と相手を混同させない。攻撃の予備動作と有効範囲の読みやすさを先に確認する。

### ローカル Phase 1 の相手

ネットワーク前でも戦闘を検証できるよう、同一端末で 2 人目を**決められた入力列で動くテスト相手**として用意する。AI、アカウント、マッチメイクは不要。プレイテストでは 2 人操作または簡単な入力シナリオを使う。キー割り当ての本番仕様はプレイヤー 1 の A/D/Space/J/K/L/I を維持する。

## 3. Echo architecture

- **記録**: 本体の固定 tick ごとに `tick, x, y, vx, vy, facing, movementState, attackPhase` を長さ 240 tick のリングバッファへ格納し、攻撃開始には `attackId, weaponId, startTick` を記録する。ジャンプ・ダッシュ・Skill は状態と必要な開始イベントを残す。Echo の行動やネットワーク補間値は記録しない。
- **起動**: 履歴が満杯で Echo が不在かつ cooldown が 0 の時、過去 240 tick のコピーを固定する。Echo はコピーの先頭位置（約 4 秒前の本体位置）に出現して時系列で再生する。起動 tick / round ID / owner ID / echo ID を付ける。短い出現予告はプレイテストで決める。
- **再生**: 軌跡の位置・向き・姿勢を表示に反映し、保存された攻撃フェーズから Hitbox を起こす。攻撃の命中先は**記録しない**。再生時に現在の相手位置と判定するので戦術的意味がある。移動軌跡は元の足場・壁の衝突を再計算しない。Echo は Hurtbox と HP を持たず、ダメージ・ノックバックを受けず、最大 1 体。
- **取り扱い**: Echo は攻撃者として owner のチーム ID を継承する。ラウンド切替、切断、リマッチで消去。再生の最後の tick を処理してから消滅。記録不足時は HUD に残り準備時間を示す。
- **ネットワーク形式**: 権威側が軌跡を短い相対 tick と量子化座標にして一括送信する。受信者は `echoId` と `startTick` によって重複を捨て、受信時の authority tick に合わせて追いつき再生する。二重生成や旧ラウンドの遅着を拒否。実測で payload 上限と描画誤差を確認し、必要ならチャンク化と欠落時の再要求を行う。JSON で測ってから圧縮・バイナリ化を判断する（現行 `supabase-js` の機能を実装時に再確認）。

## 4. Networking strategy

### 部屋と権限

- Supabase の匿名サインインを使い、恒久アカウントなしで各ブラウザに user ID を与える。作成者／参加者の 2 枠を持つ短命な room レコードと membership を DB で管理する。6 桁程度のコードは衝突時に再生成し、参加枠はトランザクションまたは DB 関数で原子的に確保する。単なる Presence 人数の目視判定では同時参加の競合を防げない。
- Realtime は room ID に対応する private channel とし、room membership に結びつけた `realtime.messages` の read / write RLS を設計する。部屋テーブル側にも RLS を設定。ブラウザには publishable key だけを置き、secret key は置かない。部屋の期限・退出時の扱い・放置部屋の掃除を Phase 4 に含める。
- Presence には ID、slot、ready、接続状態など低頻度の情報のみ。`sync` に伴う join / leave は即座に勝敗扱いせず、一定の再接続猶予と membership 確認を挟む。再接続した当人には authority が完全な match snapshot を送る。

### 試合のメッセージ

| 種別 | 送信者 | 内容と処理 |
| --- | --- | --- |
| `input` | ゲスト → authority | 連番、対象 tick、左右 / ジャンプ / ダッシュ / 攻撃 / Echo / Skill の状態・押下縁。20 Hz のまとめ送信に加えて重要な押下は即時送信。範囲と順序を検査。 |
| `snapshot` | authority → ゲスト | match / round ID、authority tick、両者の位置・速度・向き・HP・行動フェーズ・cooldown、最後に反映した input sequence。20 Hz を起点に頻度を測定。 |
| `attack`, `skill`, `echo` | authority → ゲスト | action ID、開始 tick、種別、Echo の記録データ。イベント ID で冪等に適用。 |
| `hit`, `round_end`, `match_end` | authority → ゲスト | 検証済み命中・HP・勝者・結果。ゲスト送信の HP 値や勝者宣言は採用しない。 |
| `ready`, `rematch`, `resync` | 両者 | lobby / match ID を含む低頻度の意図と再同期要求。 |

- ゲストは自身の移動・基本行動をローカル予測し、snapshot の確認済み input sequence から再適用して補正する。相手はスナップショットを少し遅らせて補間し、外挿は短く制限する。予測と確定の差が大きい場合は補正を明示的に扱う。命中・HP は authority の結果だけを確定表示する。
- authority はホスト端末で固定 tick を進める。自分の操作とゲストの最新入力を同じ CombatSystem に通す。ゲスト入力の到着が遅れたら短い保持期限を設け、古い入力を無期限に使わない。初期 MVP には高度な rollback / lag compensation を入れないため、ゲスト側の被弾表示や攻撃体感に遅延が残りうる。
- Broadcast は永続ログではない。連番欠落、再接続、room 切替では単発イベントに依存せず authority snapshot へ収束させる。`roundId`、`matchId`、sender slot、sequence、tick、schema version を全てのメッセージに含め、サイズと値を検証する。
- Supabase の現行資料では Free tier の上限は 100 WebSocket events/s。2 端末間で 20 Hz の `input` と 20 Hz の `snapshot` は送信と配送を数えると約 80 events/s となり、攻撃・Echo・Presence と他ルームの余裕が小さい。25 Hz ならこの 2 系統だけで約 100 events/s。**20 Hz を保証値とは見なさず**、実測で余裕がなければ頻度や送信内容を下げる。プロジェクトごとの設定・プランも確認する。[Realtime limits](https://supabase.com/docs/guides/realtime/limits), [Realtime settings](https://supabase.com/docs/guides/realtime/settings)
- 対戦の手触りが Supabase の中継遅延や無料枠で成立しない場合は、Phase 4 で対戦経路を再評価する。Ranked のためにゲーム規則を Realtime API に直結させない。

## 5. 想定ファイル構成

以下は**実装承認後**の目標構成。ファイルごとの責務を保ち、空の抽象層は先に作らない。

```text
src/
  main.ts
  game/
    scenes/BootScene.ts, MenuScene.ts, LobbyScene.ts, BattleScene.ts
    entities/Player.ts, Echo.ts
    systems/InputManager.ts, MovementSystem.ts, EchoRecorder.ts, RoundManager.ts
    combat/CombatSystem.ts, AttackDefinition.ts, Hurtbox.ts
    abilities/Skill.ts, Blink.ts
    weapons/Weapon.ts, Sword.ts
    characters/CharacterConfig.ts
  network/
    SupabaseClient.ts, RoomManager.ts, RealtimeManager.ts
    Protocol.ts, Prediction.ts, SnapshotBuffer.ts
  ui/HUD.ts, LobbyUI.ts
  types/GameState.ts
tests/
  combat/, echo/, round/, network/
```

`Projectile.ts`、Spear、Blaster、残りの Skill は Phase 6 まで作らない。Scene は入出力・描画・ライフサイクルを担い、ルールの単体検証は Phaser を起動せずに行える境界に置く。

## 6. Implementation phases と完了ゲート

| Phase | 作業 | 次へ進む条件 |
| --- | --- | --- |
| 0. 設計確定 | 本文書のレビュー、操作・ラウンド・authority の決定、実測項目を固定。ユーザーの明示承認後に着手。 | 未決事項と MVP 範囲が確定。 |
| 1. Offline Core | Phaser 導入、ステージ、STANDARD / Sword、入力、移動、足場通過、ダッシュ、攻撃、HP、ノックバック、ローカル試合相手。 | キーボードだけで一連の戦闘が可能。壁・足場・攻撃の境界不具合がない。 |
| 2. Echo | 4 秒記録、L 起動、軌跡再生、Echo 攻撃、cooldown、視覚区別。 | Echo で意図的な挟み撃ち・フェイント・追撃を再現でき、重複命中がない。面白さをプレイテスト。 |
| 3. Loadout seam | STANDARD / Sword / Blink を設定・インターフェースへ分離。見た目の選択画面は 1 選択肢でもよい。 | 追加キャラクター等が共通入力・Echo データ形式を壊さない。 |
| 4. Multiplayer | 匿名 ID、room code、原子的な 2 枠参加、private channel、Presence / Broadcast、authority、予測・補間・再同期。 | 2 ブラウザでルーム作成・参加・移動・攻撃・Echo・HP が一致。遅延試験とイベント量試験に合格。 |
| 5. Match | 75 秒、2 本先取、勝敗、リマッチ、切断と復帰、UI / 音の最低限。 | §57 の 24 条件を全て実機確認。ルームを連続して使っても前試合のイベントが混入しない。 |
| 6. Content | LIGHT / HEAVY、Spear / Blaster、追加 Skill。 | MVP の対戦バランスと基本操作を維持。 |
| 7. Polish | アート、アニメーション、音、ステージ・HUD の磨き込み。 | 視認性・入力感・読み合いの改善をプレイテストで確認。 |

## 7. Testing strategy

- **純粋なルールの検証**: 攻撃のフェーズ、1 回だけの命中、ダメージとノックバック、時間切れ、2 本先取、引き分け、ラウンドリセット。入力列から同じ権威側結果を得るテストを優先。
- **Echo の検証**: 240 tick のリングバッファ境界、履歴不足、起動後の独立操作、足場を含む軌跡、現在の相手への再判定、攻撃の重複排除、round 変更時の消去、記録 payload と受信 replay の一致。
- **ネットワークの検証**: 重複・順序逆転・欠落・旧 match ID・不正 HP イベント・同時 Join・ホスト切断・ゲスト切断・再接続・リマッチ。2 ブラウザを同時に見て authority の HP と結果が一致することを確認。
- **体感の検証**: 実ブラウザのキーボード、60 Hz / 低 FPS、異なる画面幅、音が使えない環境を確認。RTT / jitter を注入し、入力から表示までの時間、補正量、Echo 再生ずれ、送受信 events/s、payload サイズを記録する。
- **ゲーム性の検証**: 2 人以上のプレイテストで Echo の狙いを口頭説明してから再現してもらい、成功回数と「何に当たったか分かるか」を記録。4 秒・10 秒 cooldown は結果を見て変える。
- **実装時の基本ゲート**: lockfile を含む依存固定、TypeScript build、必要なルールテスト、ローカル 2 ブラウザ、実 Supabase project を使う接続確認。モックだけでオンライン完成と宣言しない。

## 8. Known risks / 最大リスク

1. **最大: ネットワーク越しの命中と体感**。ホスト authority は HP 不一致を防げるが、ゲストの攻撃結果は往復遅延に左右される。60 Hz シミュレーションと 20 Hz 前後の中継で楽しい対戦になるかが Phase 4 の中止・再設計判断点。無料枠では複数ルームが同時に動くと上限に達しやすい。
2. **Echo の可読性と強さ**。4 秒前の絶対座標から始まるため、遠くに出る・画面外に出る・突然背後から攻撃する可能性がある。出現位置の表示、予告、攻撃フェーズ、ステージ幅を合わせて調整する。
3. **クライアント authority の信頼限界**。ゲストが勝敗を偽装することは防げても、ホストの改造や切断による不正は防げない。友人対戦用と明記し、Ranked で流用しない。
4. **Room 権限と二重参加**。コードを知るだけで private channel へ入れないよう membership の RLS が必要。匿名 ID の更新・ブラウザ再読込・同時 Join を設計しないと 2 枠が壊れる。
5. **物理と Echo の差**。Echo を再シミュレーションすると端末やフレーム落ちで軌跡がずれる。保存軌跡を表示の基準とし、実際の敵への攻撃判定だけ現在状態で行う。
6. **現行 repository の不足**。README が既存 prototype を主張する一方、ソースは存在しない。初期実装時に依存・構成・README を整え、存在しない機能を完成済み扱いしない。

## 9. MVP completion criteria

仕様 §57 の 24 項目を次の 4 群で確認する。各項目はブラウザ操作で再現でき、オンライン項目は **2 つの独立したブラウザ環境**で確認する。

| 群 | 対象番号と受け入れ条件 |
| --- | --- |
| 起動・操作 | 1–9: Web 起動、2D 床と足場、A/D、Space、S 足場降下、J 攻撃、K ダッシュ、L Echo、I Blink。マウスなしで操作可能。 |
| 戦闘・Echo | 10–13: HP、ノックバック、直前 4 秒の再生、Echo が現在の相手へ攻撃できる。各攻撃は一意の命中。 |
| ルーム・同期 | 14–20: room 作成、コード発行、参加、2 人の位置・攻撃・Echo・HP が同期し、他 room や旧 round のイベントが混入しない。 |
| 試合・離脱 | 21–24: ラウンド終了、2 本先取の試合終了、両者同意の Rematch、切断表示とロビー復帰。 |

### MVP から削るもの

追加 2 Character、追加 2 Weapon、追加 3 Skill、Skill tree、Item、Casual/Ranked のモード分岐、アカウント登録、統計、マッチメイク、観戦、課金、広告、Chat、AI、複雑なステージギミック、豪華なアートを Phase 6 以降に回す。初期は `STANDARD + Sword + Blink` のみでも、操作と Echo の核を成立させる。

## 参考資料（設計時点の一次資料）

- [Phaser: Scenes](https://docs.phaser.io/phaser/concepts/scenes) / [Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade)
- [Supabase: Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) / [Presence](https://supabase.com/docs/guides/realtime/presence) / [Authorization](https://supabase.com/docs/guides/realtime/authorization) / [Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase: Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase: Realtime schema restrictions (2026-07-14)](https://supabase.com/changelog/realtime-schema-locked-down-against-modification) — private channel の RLS policy は許容されるが、`realtime` schema の独自テーブル変更は行わない。

これらの API、制限値、価格・プランは実装直前と実プロジェクト設定で再確認する。
