/* ============================================================
   game.js（中山）
   ゲーム本体 Game（仕様書 5章、10.1、10.2）。
   ・外から呼べるのは Game.start(k) / Game.stop() / Game.key(code) と、終わったときに呼ぶ Game.onFinish だけ。
   ・ゲームの状態 S は、外から見えないように Game の中に閉じこめる。
   ・いまできていること：譜面の作成（5.2）、プレイ画面の準備、キーとレーンの対応（4章）。
     音（audio.js）と、ウイルスが落ちる動き・判定は、このあと足す。
   ============================================================ */

const Game = (() => {                                         // ★ ( ) => { … } を作ってすぐ ( ) で実行する形。中で作った変数は外から見えない
                                                              // ★   最後に return した { start, stop, key … } だけが Game として外に出る

  // 【音名の番号】ド＝0 から半音ずつ数えた番号（シャープ # は ＋1）
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };  // ★ ド レ ミ ファ ソ ラ シ。ミ→ファ、シ→ド は半音なので 1 しか増えない

  let S = null;                                               // ★ いまのプレイの状態（スコア・HP・ノーツなど）。start で作る

  // 【音名 → 音の番号（MIDI番号）】例：C4（真ん中のド）→ 60、A4（ラ）→ 69
  function midi(p) {
    const name = NOTE[p[0]];                                  // ★ 1文字目（C や G）から、ドレミの番号
    const sharp = p[1] === '#' ? 1 : 0;                       // ★ 2文字目が # なら半音上げる
    const octave = Number(p[p.length - 1]);                   // ★ 最後の文字がオクターブの数字（C4 の 4）
    return name + sharp + 12 * (octave + 1);                  // ★ 1オクターブ＝12。C4 は 0 + 0 + 12×5 ＝ 60
  }

  // 【譜面の文字列 → 音と長さの一覧】例：'C4 G4:2 R' → [{ms:[60], d:1}, {ms:[67], d:2}, {ms:null, d:1}]
  function parse(str) {
    const list = [];                                          // ★ 結果を入れる配列
    str.trim().split(/\s+/).forEach(tk => {                   // ★ 前後の空白を取り、空白（1つ以上）で区切って、1つずつ見る
      const parts = tk.split(':');                            // ★ 'G4:2' → ['G4', '2']、'C4' → ['C4']
      const d = parts.length > 1 ? Number(parts[1]) : 1;      // ★ 長さ（拍）。: がなければ 1拍
      let ms = null;                                          // ★ 音の番号の配列。休み（R）のときは null のまま
      if (parts[0] !== 'R') {                                 // ★ 休みでなければ
        ms = parts[0].split('+').map(midi);                   // ★ + で分けて、それぞれ番号に（'G5+C5' → [79, 72]）。map は全部に midi を使って新しい配列を作る
      }
      list.push({ ms: ms, d: d });                            // ★ 一覧に足す
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
            f: 440 * Math.pow(2, (m - 69) / 12),              // ★ 音の高さ（Hz）。ラ(69)＝440Hz、12 上がると2倍（5.2 の 7）
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

  return {                                                    // ★ ここから下が、外から使える Game の中身（仕様書 10.1）

    onFinish: null,                                           // ★ ゲームが終わったときに呼ぶ関数。screens.js（松井さん）が中身を入れる

    // 【k番目の曲でプレイを始める】screens.js から呼ばれる
    start(k) {
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
        run: false,                                           // ★ ゲームが動いているか（音と動きを足したら true にする）
      };
      View.build(song);                                       // ★ レーン・リング・キー札を作る（view.js）
      View.setHud(S);                                         // ★ スコア 0・HP 10 を表示
      View.setTime(S.dur, 0);                                 // ★ のこり時間＝曲の長さ、進行バー 0%
      View.ready('じゅんびしてね…');                          // ★ 開始表示（仕様書 3.4）
      if (typeof Screens !== 'undefined') {                   // ★ screens.js に Screens ができていれば（松井さんの実装がまだの間は、ここを飛ばす）
        Screens.show('play');                                 // ★ プレイ画面に切り替える（仕様書 10.1）
      }
      console.log('譜面：', S.notes.length + '個', S.notes);  // ★【確認用・あとで消す】作った譜面をコンソールに出す
    },

    // 【プレイを中断する】結果は出さない（仕様書 10.1）
    stop() {
      if (S) S.run = false;                                   // ★ 動いていたら止める
      View.clear();                                           // ★ ウイルスを消す
    },

    // 【キー入力】screens.js から、プレイ中に押されたキーの名前（KeyF など）が渡される
    key(code) {
      if (!S) return;                                         // ★ まだ start していなければ何もしない
      const l = laneOf(code, S.song.lanes);                   // ★ どのレーンのキーか
      if (l >= 0) View.flash(l);                              // ★ レーンのキーなら、そのリングを光らせる（判定はこのあと足す）
    },
  };
})();                                                         // ★ ← この ( ) で、上の関数をすぐ実行している
