/* ============================================================
   game.js（中山）
   ゲーム本体 Game（仕様書 5章、10.1、10.2）。
   ・外から呼べるのは Game.start(k) / Game.stop() / Game.key(code) と、終わったときに呼ぶ Game.onFinish だけ。
   ・ゲームの状態 S は、外から見えないように Game の中に閉じこめる。
   ・時刻はすべて Sound.now()（Web Audio の時計）から計算する（仕様書 5.3、9章）。
   ・中身：譜面の作成（5.2）、BGMと薄いメロディ（7章）、ウイルスの出現・落下・ミス（5.4）、
     キーとレーンの対応（4章）、判定・スコア・コンボ・HP（5.3、5.5）、ゲームの終わり（5.6）、防衛率とランク（5.7）。
   ============================================================ */

const Game = (() => {                                         // ★ ( ) => { … } を作ってすぐ ( ) で実行する形。中で作った変数は外から見えない
                                                              // ★   最後に return した { start, stop, key … } だけが Game として外に出る

  // 【音名の番号】ド＝0 から半音ずつ数えた番号（シャープ # は ＋1）
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };  // ★ ド レ ミ ファ ソ ラ シ。ミ→ファ、シ→ド は半音なので 1 しか増えない

  // 【判定の種類】タイミングのずれが小さい順に、文字・色・基本点（仕様書 5.3）
  const JUDGE = [
    { tx: '大優勝！', c: '#ff4fa3', pt: 300 },                // ★ 0：ずれ 0.06秒未満（ピンク）
    { tx: '神！', c: '#3bb8ff', pt: 200 },                    // ★ 1：ずれ 0.12秒未満（水色）
    { tx: '超かわよ！', c: '#9a6bff', pt: 100 },              // ★ 2：ずれ 0.2秒以内（紫）
  ];

  let S = null;                                               // ★ いまのプレイの状態（スコア・HP・ノーツなど）。start で作る
  let raf = 0;                                                // ★ 次に呼ばれる loop の予約番号（requestAnimationFrame が返す）。前のループを止めるのに使う

  // 【音名 → 音の番号（MIDI番号）】例：C4（真ん中のド）→ 60、A4（ラ）→ 69
  function midi(p) {
    const name = NOTE[p[0]];                                  // ★ 1文字目（C や G）から、ドレミの番号
    const sharp = p[1] === '#' ? 1 : 0;                       // ★ 2文字目が # なら半音上げる
    const octave = Number(p[p.length - 1]);                   // ★ 最後の文字がオクターブの数字（C4 の 4）
    return name + sharp + 12 * (octave + 1);                  // ★ 1オクターブ＝12。C4 は 0 + 0 + 12×5 ＝ 60
  }

  // 【譜面の文字列 → 音と長さの一覧】例：'C4 G4:2 R' → [{ms:[60], snd:[[60]], d:1}, {ms:[67], snd:[[67]], d:2}, {ms:null, d:1}]
  //   ms＝位置の音（レーンを決める）、snd＝それぞれのノーツで鳴る音。'C5=C6' のように ＝ があれば、左が位置・右が鳴る音
  function parse(str) {
    const list = [];                                          // ★ 結果を入れる配列
    str.trim().split(/\s+/).forEach(tk => {                   // ★ 前後の空白を取り、空白（1つ以上）で区切って、1つずつ見る
      const parts = tk.split(':');                            // ★ 'G4:2' → ['G4', '2']、'C4' → ['C4']
      const d = parts.length > 1 ? Number(parts[1]) : 1;      // ★ 長さ（拍）。: がなければ 1拍
      let ms = null;                                          // ★ 位置の音の番号の配列。休み（R）のときは null のまま
      let snd = null;                                         // ★ 鳴る音の番号の配列の配列（ノーツ1匹ごとに、鳴る音の配列）
      if (parts[0] !== 'R') {                                 // ★ 休みでなければ
        const eq = parts[0].split('=');                       // ★ 'F#5=A#3+F#4' → ['F#5', 'A#3+F#4']、'C4' → ['C4']
        if (eq.length > 1) {                                  // ★ ＝ があれば：左＝位置（1匹）、右＝鳴る音（+ でいくつでも）
          ms = [midi(eq[0])];                                 // ★ 位置の音は1つ（'F#5' → [78]）
          snd = [eq[1].split('+').map(midi)];                 // ★ その1匹で鳴る音（'A#3+F#4' → [[58, 66]]）
        } else {                                              // ★ ＝ がなければ今まで通り（位置＝鳴る音）
          ms = parts[0].split('+').map(midi);                 // ★ + で分けて、それぞれ番号に（'G5+C5' → [79, 72]）。map は全部に midi を使って新しい配列を作る
          snd = ms.map(m => [m]);                             // ★ 1匹ごとに、自分の音を1つ鳴らす（[79, 72] → [[79], [72]]）
        }
      }
      list.push({ ms: ms, snd: snd, d: d });                  // ★ 一覧に足す
    });
    return list;                                              // ★ できた一覧を返す
  }

  // 【譜面の作成】曲データから、ノーツ（落ちてくるウイルス）の一覧を作る（仕様書 5.2）
  function chart(song) {
    const spb = 60 / song.bpm;                                // ★ 1拍の長さ（秒）。BPM100 なら 0.6秒（5.2 の 1）
    const lead = Math.ceil((song.fall + 0.3) / spb) * spb;    // ★ 準備時間：（落下時間＋0.3秒）を1拍単位で切り上げ（5.2 の 2）。きらきら星は 2.5秒→5拍→3.0秒
    const seq = parse(song.chart);                            // ★ 譜面の文字列を一覧にする

    const ps = [];                                            // ★ 曲に出てくる音の番号（同じ音は1回だけ）
    seq.forEach(x => {                                        // ★ 一覧を1つずつ見る
      if (x.ms) {                                             // ★ 休みでなければ
        x.ms.forEach(m => {                                   // ★ 同時の音も1つずつ
          if (!ps.includes(m)) ps.push(m);                    // ★ まだ入っていない音だけ足す
        });
      }
    });
    ps.sort((a, b) => a - b);                                 // ★ 低い順に並べる（5.2 の 4）。きらきら星は ド レ ミ ファ ソ ラ の6つ

    const notes = [];                                         // ★ ノーツの一覧
    let b = 0;                                                // ★ 曲の頭から数えた拍
    seq.forEach(x => {                                        // ★ 一覧を先頭から1つずつ
      if (x.ms) {                                             // ★ 休みでなければノーツにする（休みは時間だけ進める。5.2 の 3）
        const used = [];                                      // ★ この拍で使ったレーン（同時ノーツが重ならないように）
        x.ms.forEach((m, i) => {                              // ★ 同時の音を1つずつ（i＝何番目か。0 が先に書いた音＝メロディ）
          let l = Math.floor(ps.indexOf(m) * song.lanes / ps.length);   // ★ レーン＝切り捨て（低い方から何番目 × レーン数 ÷ 音の種類数）（5.2 の 4）
          if (used.includes(l)) {                             // ★ 同じ拍で、もうそのレーンを使っていたら（5.2 の 6）
            l = l + 1 < song.lanes ? l + 1 : l - 1;           // ★ 右へずらす。右がなければ左へ
          }
          used.push(l);                                       // ★ 使ったレーンを覚える
          notes.push({                                        // ★ ノーツを1つ足す
            t: lead + b * spb,                                // ★ 到達時刻（秒）＝ 準備時間 ＋ それまでの拍 × 1拍の長さ（5.2 の 3）
            l: l,                                             // ★ レーン（0 が左）
            ty: l % 3,                                        // ★ キャラの種類＝レーン番号を3で割った余り（5.2 の 5）
            fs: x.snd[i].map(s => 440 * Math.pow(2, (s - 69) / 12)),   // ★ 鳴る音の高さ（Hz）の配列。ラ(69)＝440Hz、12 上がると2倍（5.2 の 7）。＝ の和音なら2つ以上
            d: x.d,                                           // ★ 長さ（拍）。叩いたときの音の長さに使う
            mel: i === 0,                                     // ★ 先に書いた音（メロディ）なら true。薄いメロディで鳴らすのはこれだけ
            h: 0,                                             // ★ 結果：0＝まだ、1＝撃退、-1＝ミス
            el: null,                                         // ★ 画面のウイルスの要素（出てきたときに入れる）
          });
        });
      }
      b += x.d;                                               // ★ 拍を進める（休みでも進める）
    });
    return { notes: notes, lead: lead, dur: b * spb };        // ★ ノーツの一覧、準備時間、曲の長さ（秒）を返す
  }

  // 【キー → レーン】code はキーの名前（KeyF など）。対応するレーンがなければ -1（仕様書 4章）
  function laneOf(code, n) {
    const nums = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };   // ★ 上の段の数字キー 1〜4（テンキーは入れない）
    if (nums[code] !== undefined) {                           // ★ 数字キーなら
      return nums[code] < n ? nums[code] : -1;                // ★ レーン数より大きい番号は無効（2レーンのときの 3・4）
    }
    const keys = n === 2 ? { KeyF: 0, KeyJ: 1 } : { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };   // ★ 2レーンは F J、4レーンは D F J K
    return keys[code] !== undefined ? keys[code] : -1;        // ★ あればそのレーン、なければ -1
  }

  // 【毎フレームの処理】1秒に約60回、ブラウザが呼ぶ（requestAnimationFrame）。出現 → 移動・ミス → 時間 → 終わりの判定
  function loop() {
    if (!S || !S.run) return;                                 // ★ 止まっていたら何もしない（次も呼ばない＝ループが終わる）
    const t = Sound.now() - S.t0;                             // ★ 曲の開始からの経過時間（秒）。Web Audio の時計で測る（仕様書 5.3）
    const song = S.song;                                      // ★ 曲データ（何度も使うので短い名前に）

    Sound.sched(S);                                           // ★ 0.3秒先までの BGM と薄いメロディを予約する（audio.js）

    while (S.nxt < S.notes.length && S.notes[S.nxt].t - t < song.fall * 1.15) {   // ★ 【出現】次のノーツの到達まで「落下時間×1.15」を切ったら（仕様書 5.4）
      const n = S.notes[S.nxt];                               // ★ 次のノーツ
      n.el = View.mkVirus(n.ty, song.santa);                  // ★ ウイルスを作る（ジングルベルならフィッシングがサンタ）
      S.live.push(n);                                         // ★ 画面にいるウイルスの一覧に足す
      S.nxt++;                                                // ★ その次のノーツへ
    }

    S.live = S.live.filter(n => {                             // ★ 【移動・ミス】画面にいるウイルスを1つずつ見る。true を返したものだけ残る
      if (n.h === 1) {                                        // ★ 撃退ずみなら（判定は⑥で足す）
        n.el.remove();                                        // ★ 画面から消す
        return false;                                         // ★ 一覧からも外す
      }
      if (t - n.t > 0.2) {                                    // ★ 到達から0.2秒過ぎても叩かれていなければ、ミス（仕様書 5.3）
        n.h = -1;                                             // ★ 結果＝ミス
        n.el.remove();                                        // ★ 画面から消す（仕様書 5.4）
        miss();                                               // ★ HPを減らす
        return false;                                         // ★ 一覧から外す
      }
      const y = View.HY - (n.t - t) / song.fall * (View.HY + 30);   // ★ 縦の位置＝500 −（到達時刻 − いま）÷ 落下時間 × 530（仕様書 5.4）
      View.move(n.el, View.lx(song.lanes, n.l), y);           // ★ レーンの真ん中の x と、計算した y へ動かす
      return true;                                            // ★ まだ画面に残す
    });

    View.shake(S.sk - t);                                     // ★ 【揺れ】ミスしてから0.25秒の間は画面を揺らす（のこり時間を渡す。0以下なら元の位置）
    View.setTime(Math.min(S.dur, S.lead + S.dur - t), (t - S.lead) / S.dur);   // ★ のこり時間（準備中は曲の長さのまま）と、進行バー
    if (t > S.lead - 0.5) View.ready('');                     // ★ 最初のノーツの0.5秒前に「じゅんびしてね…」を消す（仕様書 3.4）

    if (S.hp <= 0 || t > S.end) {                             // ★ 【終わり】HPが0、または終了時刻を過ぎた（仕様書 5.6）
      finish();                                               // ★ 結果を計算して、screens.js に渡す
      return;                                                 // ★ 次のフレームは呼ばない
    }
    raf = requestAnimationFrame(loop);                        // ★ 次の画面の書きかえのときに、もう一度 loop を呼んでもらう（予約番号を覚える）
  }

  // 【ミス】HPを1減らし、コンボを0に戻して、「ざんねん…」を出し、画面を揺らす（仕様書 5.3、5.5）。効果音はない（7章）
  function miss() {
    S.hp--;                                                   // ★ HP −1
    S.sk = Sound.now() - S.t0 + 0.25;                         // ★ 揺れが終わる時刻＝いま＋0.25秒（揺らすのは loop の View.shake）
    S.combo = 0;                                              // ★ コンボは0に戻る
    View.setHud(S);                                           // ★ ハートの表示を書きかえる
    View.say('ざんねん…', '#8a7bb0');                         // ★ 判定表示（灰紫）
  }

  // 【叩いたとき】l＝叩いたレーン。いちばん近いウイルスを探して、判定・得点・音・演出（仕様書 5.3、5.5）
  function press(l) {
    const t = Sound.now() - S.t0;                             // ★ 叩いた時刻（曲の開始からの秒数）
    View.flash(l);                                            // ★ リングを光らせる（空打ちでも光る）
    let best = null;                                          // ★ いちばん近いノーツ（まだ見つかっていない）
    let bestD = 0;                                            // ★ そのノーツとのずれ（秒）
    S.live.forEach(n => {                                     // ★ 画面にいるウイルスを1つずつ見る
      if (n.h === 0 && n.l === l) {                           // ★ まだ叩かれていなくて、同じレーンのもの
        const d = Math.abs(n.t - t);                          // ★ 到達時刻とのずれ（絶対値＝プラスにした差）
        if (d <= 0.2 && (best === null || d < bestD)) {       // ★ 0.2秒以内で、いままでの候補より近ければ
          best = n;                                           // ★ 候補にする
          bestD = d;                                          // ★ ずれも覚える
        }
      }
    });
    if (best === null) return;                                // ★ 0.2秒以内にいなければ、何も起きない（空打ちにペナルティなし）

    best.h = 1;                                               // ★ 結果＝撃退（次の loop で画面から消える）
    S.hit++;                                                  // ★ 撃退した数 +1
    S.combo++;                                                // ★ コンボ +1
    S.max = Math.max(S.max, S.combo);                         // ★ 最大コンボを更新
    let j = 2;                                                // ★ 判定：まず「超かわよ！」として
    if (bestD < 0.12) j = 1;                                  // ★ 0.12秒未満なら「神！」
    if (bestD < 0.06) j = 0;                                  // ★ 0.06秒未満なら「大優勝！」
    S.score += JUDGE[j].pt + Math.min(S.combo, 50) * 2;      // ★ スコア＝基本点 ＋ min(コンボ, 50) × 2（仕様書 5.5）
    View.setHud(S);                                           // ★ スコア・コンボの表示を書きかえる
    View.say(JUDGE[j].tx, JUDGE[j].c);                        // ★ 判定の文字を出す
    Sound.hit(best.fs, best.d * 60 / S.song.bpm);             // ★ そのノーツの音（和音なら全部）を大きく鳴らす（長さ＝拍 × 1拍の秒数。仕様書 7章）
    View.burst(View.lx(S.song.lanes, l));                     // ★ リングの位置で粒を飛ばす（ヒット演出）
  }

  // 【ゲームの終わり】防衛率とランクを計算して、Game.onFinish に結果を渡す（仕様書 5.7、10.2）
  function finish() {
    S.run = false;                                            // ★ 止める
    View.clear();                                             // ★ 残っているウイルスを消す
    const total = S.notes.length;                             // ★ 全ノーツ数（HP0で途中で終わっても、分母は全部の数。5.7）
    const rate = total > 0 ? Math.round(S.hit / total * 100) : 0;   // ★ 防衛率（%）＝ 撃退した数 ÷ 全ノーツ数 × 100 を四捨五入
    let rank = 'C';                                           // ★ まず C として
    let comment = 'まだまだかわいい';                         // ★ C のコメント
    if (rate >= 70) { rank = 'B'; comment = '神！'; }         // ★ 70%以上なら B
    if (rate >= 85) { rank = 'A'; comment = '大優勝！'; }     // ★ 85%以上なら A
    if (rate >= 95) { rank = 'S'; comment = '超大優勝★'; }   // ★ 95%以上なら S
    const result = {                                          // ★ screens.js に渡す結果（仕様書 10.2 の9項目）
      k: S.k,                                                 // ★ 曲の番号
      score: S.score,                                         // ★ スコア
      hit: S.hit,                                             // ★ 撃退した数
      total: total,                                           // ★ 全ノーツ数
      max: S.max,                                             // ★ 最大コンボ
      dead: S.hp <= 0,                                        // ★ HPが0で終わったか（true / false）
      rate: rate,                                             // ★ 防衛率（%）
      rank: rank,                                             // ★ ランク S / A / B / C
      comment: comment,                                       // ★ ランクのコメント
    };
    if (Game.onFinish) Game.onFinish(result);                 // ★ screens.js が関数を入れていれば呼ぶ（リザルト画面へ）
  }

  return {                                                    // ★ ここから下が、外から使える Game の中身（仕様書 10.1）

    onFinish: null,                                           // ★ ゲームが終わったときに呼ぶ関数。screens.js（松井さん）が中身を入れる

    // 【k番目の曲でプレイを始める】screens.js から呼ばれる
    start(k) {
      cancelAnimationFrame(raf);                              // ★ 前のプレイのループが残っていたら、予約を取り消す（ループが2つ動かないように）
      Sound.init();                                           // ★ 音の準備（最初の1回だけ道具箱を作る。仕様書 7章）
      const song = SONGS[k];                                  // ★ k番目の曲データ（charts.js）
      const ch = chart(song);                                 // ★ 譜面を作る
      S = {                                                   // ★ このプレイの状態を、新しく作る
        k: k,                                                 // ★ 曲の番号
        song: song,                                           // ★ 曲データ
        notes: ch.notes,                                      // ★ ノーツの一覧
        lead: ch.lead,                                        // ★ 準備時間（秒）
        dur: ch.dur,                                          // ★ 曲の長さ（秒）
        end: ch.lead + ch.dur + 1,                            // ★ 終了時刻＝準備時間＋曲の長さ＋1秒（仕様書 5.6）
        hp: 10,                                               // ★ サーバーHP（はじめは10。仕様書 5.5）
        score: 0,                                             // ★ スコア
        combo: 0,                                             // ★ いまのコンボ
        max: 0,                                               // ★ 最大コンボ
        hit: 0,                                               // ★ 撃退した数
        sk: -1,                                               // ★ 画面の揺れが終わる時刻（秒）。ミスしたときに miss が決める
                                                              // ★   時間は開始の0.3秒前（−0.3秒）から数えるので、0 にすると始めに少し揺れてしまう。だから −1
        t0: 0,                                                // ★ 曲の開始時刻。Space を押したときに決める（key を見る）
        wait: true,                                           // ★ Space を待っている間は true（自分のタイミングでスタート）
        step: 0,                                              // ★ 次に予約するドラムの番号（audio.js の sched が進める）
        mel: 0,                                               // ★ 次に予約する薄いメロディの番号（audio.js の sched が進める）
        nxt: 0,                                               // ★ 次に出現させるノーツの番号
        live: [],                                             // ★ いま画面にいるウイルス（ノーツ）の一覧
        run: true,                                            // ★ ゲームが動いているか
      };
      View.build(song);                                       // ★ レーン・リング・キー札を作る（view.js）
      View.setHud(S);                                         // ★ スコア 0・HP 10 を表示
      View.setTime(S.dur, 0);                                 // ★ のこり時間＝曲の長さ、進行バー 0%
      View.ready('スペースキーでスタート！');                  // ★ 開始表示。Space を押すまで待つ（ループはまだ始めない）
      if (typeof Screens !== 'undefined') {                   // ★ screens.js に Screens ができていれば（松井さんの実装がまだの間は、ここを飛ばす）
        Screens.show('play');                                 // ★ プレイ画面に切り替える（仕様書 10.1）
      }
    },

    // 【プレイを中断する】結果は出さない（仕様書 10.1）
    stop() {
      cancelAnimationFrame(raf);                              // ★ 次の loop の予約を取り消す（すぐ止まる）
      if (S) S.run = false;                                   // ★ 動いていたら止める
      View.clear();                                           // ★ ウイルスを消す
    },

    // 【キー入力】screens.js から、プレイ中に押されたキーの名前（KeyF など）が渡される
    key(code) {
      if (!S || !S.run) return;                               // ★ プレイ中でなければ何もしない
      if (S.wait) {                                           // ★ 【開始前】Space を待っているとき
        if (code === 'Space') {                               // ★ Space が押されたら
          S.wait = false;                                     // ★ もう待たない
          S.t0 = Sound.now() + 0.3;                           // ★ 曲の開始時刻（いまから0.3秒後。音の予約が間に合うように）
          View.ready('じゅんびしてね…');                      // ★ 開始表示を切りかえる（仕様書 3.4）
          raf = requestAnimationFrame(loop);                  // ★ 毎フレームの処理を始める（予約番号を覚える）
        }
        return;                                               // ★ 開始前は、レーンのキー（D F J K・数字）を押しても何も起きない
      }
      const l = laneOf(code, S.song.lanes);                   // ★ どのレーンのキーか
      if (l >= 0) press(l);                                   // ★ レーンのキーなら、叩いたときの処理へ
    },
  };
})();                                                         // ★ ← この ( ) で、上の関数をすぐ実行している
