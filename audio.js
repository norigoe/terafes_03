/* ============================================================
   audio.js（中山）
   音 Sound：BGM（ドラム・ベース）、薄いメロディ、撃退したときの音（仕様書 7章）。
   ・すべて Web Audio API で作る（音声ファイルは使わない）。
   ・Web Audio の時計（ctx.currentTime）が、ゲーム全体の時計になる（判定・ウイルスの位置も。仕様書 5.3、9章）。
   ・音は「いつ鳴らすか」を先に予約できる。sched は毎フレーム呼ばれて、0.3秒先までの音をまとめて予約する。
   ・音色・音量は【遊びながら調整する】（数字は見本からの出発点。音量は VOL にまとめた）。
   ============================================================ */

const Sound = (() => {                                        // ★ game.js と同じ「すぐ実行する関数」。ctx などは外から見えない

  let ctx = null;                                             // ★ AudioContext（音を作る道具箱）。最初の start のときに作る
  let noise = null;                                           // ★ ザーッという雑音のデータ（ハイハット・クラップに使う）
  const BASS = [130.8, 110, 87.3, 98];                        // ★ ベースの音の高さ（Hz）。ド→ラ→ファ→ソ（C→Am→F→G のコード進行）。3曲ともハ長調なので共通
  const VOL = { melody: 0.07, hit: 0.3, bass: 0.22 };         // ★ 音量（0〜1）。薄いメロディは小さく、撃退した音は大きく（仕様書 7章）

  // 【ポンと鳴って消える音】f＝高さ(Hz)、at＝鳴らす時刻、d＝長さ(秒)、type＝音色、v＝音量
  function tone(f, at, d, type, v) {
    const o = ctx.createOscillator();                         // ★ 発振器（決まった高さの音を出す部品）
    const g = ctx.createGain();                               // ★ 音量を変える部品
    o.type = type;                                            // ★ 音色：'sine'（やわらかい）、'triangle'（少しはっきり）
    o.frequency.value = f;                                    // ★ 音の高さ
    g.gain.setValueAtTime(v, at);                             // ★ at の時刻に、音量 v で鳴り始める
    g.gain.exponentialRampToValueAtTime(0.001, at + d);       // ★ d 秒かけて、ほぼ 0 まで小さくする（ポーンと消える）
    o.connect(g).connect(ctx.destination);                    // ★ 発振器 → 音量 → スピーカー の順につなぐ
    o.start(at);                                              // ★ at の時刻に鳴らし始める（予約）
    o.stop(at + d);                                           // ★ d 秒後に止める（予約）
  }

  // 【キック（ドン）】高い音から低い音へすばやく下げると「ドン」に聞こえる
  function kick(at) {
    const o = ctx.createOscillator();                         // ★ 発振器
    const g = ctx.createGain();                               // ★ 音量
    o.frequency.setValueAtTime(150, at);                      // ★ はじめは 150Hz
    o.frequency.exponentialRampToValueAtTime(40, at + 0.15);  // ★ 0.15秒で 40Hz まで下げる
    g.gain.setValueAtTime(0.5, at);                           // ★ 音量 0.5 から
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.2);     // ★ 0.2秒で消す
    o.connect(g).connect(ctx.destination);                    // ★ 発振器 → 音量 → スピーカー
    o.start(at);                                              // ★ 鳴らし始める
    o.stop(at + 0.2);                                         // ★ 止める
  }

  // 【ハイハット・クラップ（チッ、パン）】雑音から低い音を取りのぞくと、シャカシャカした音になる
  function hiss(at, d, v, hp) {
    const s = ctx.createBufferSource();                       // ★ 音のデータ（雑音）を鳴らす部品
    const f = ctx.createBiquadFilter();                       // ★ フィルター（音の一部を取りのぞく部品）
    const g = ctx.createGain();                               // ★ 音量
    s.buffer = noise;                                         // ★ 鳴らすのは雑音のデータ
    f.type = 'highpass';                                      // ★ ハイパス＝高い音だけ通す
    f.frequency.value = hp;                                   // ★ hp(Hz) より低い音を取りのぞく（7000＝チッ、1500＝パン）
    g.gain.setValueAtTime(v, at);                             // ★ 音量 v から
    g.gain.exponentialRampToValueAtTime(0.001, at + d);       // ★ d 秒で消す
    s.connect(f).connect(g).connect(ctx.destination);         // ★ 雑音 → フィルター → 音量 → スピーカー
    s.start(at);                                              // ★ 鳴らし始める
    s.stop(at + d);                                           // ★ 止める
  }

  return {                                                    // ★ ここから下が、外から使える Sound の中身

    // 【音の準備】最初の曲の開始操作のときに呼ぶ（ブラウザの決まりで、キーやクリックの後でないと音が出ない。仕様書 7章）
    init() {
      if (!ctx) {                                             // ★ まだ作っていなければ（2回目からは作らない）
        ctx = new AudioContext();                             // ★ 音の道具箱を作る
        noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);   // ★ 0.3秒ぶんの、空の音データ（1チャンネル）
        const d = noise.getChannelData(0);                    // ★ 中の数字の並び（-1〜1 が音の波）
        for (let i = 0; i < d.length; i++) {                  // ★ 全部の場所に
          d[i] = Math.random() * 2 - 1;                       // ★ -1〜1 のでたらめな数を入れる → ザーッという雑音になる
        }
      }
      ctx.resume();                                           // ★ 止まっていたら動かす
    },

    // 【いまの時刻（秒）】ゲームの時計。判定・ウイルスの位置はこれで計算する（仕様書 5.3）
    now() {
      return ctx.currentTime;                                 // ★ ctx を作ってからの秒数
    },

    // 【BGMと薄いメロディの予約】毎フレーム呼ぶ。S はゲームの状態（game.js）
    //   使うもの：S.song.bpm、S.t0（曲の開始時刻）、S.step（次のドラムの番号）、S.mel（次のメロディの番号）、S.notes
    sched(S) {
      const spb = 60 / S.song.bpm;                            // ★ 1拍の長さ（秒）
      const sp = spb / 4;                                     // ★ 16分音符の長さ（1拍を4つに分ける）
      const ahead = ctx.currentTime + 0.3;                    // ★ いまから0.3秒先まで予約する

      while (S.t0 + S.step * sp < ahead) {                    // ★ 【ドラム・ベース】次の16分音符が0.3秒先より前なら、予約する
        const i = S.step;                                     // ★ 何個目の16分音符か
        const at = S.t0 + i * sp;                             // ★ 鳴らす時刻
        const s = i % 16;                                     // ★ 1小節（16個）の中の何番目か（0〜15）
        const bar = Math.floor(i / 16) % 4;                   // ★ 何小節目か（0〜3 をくり返す）→ ベースのコードを選ぶ
        if (s % 4 === 0) kick(at);                            // ★ 1拍ごと（0,4,8,12番目）にキック「ドン」
        if (s % 4 === 2) hiss(at, 0.05, 0.12, 7000);          // ★ 拍の裏（2,6,10,14番目）にハイハット「チッ」
        if (s === 4 || s === 12) hiss(at, 0.12, 0.18, 1500);  // ★ 2拍目と4拍目にクラップ「パン」
        if ([0, 6, 8, 14].includes(s)) tone(BASS[bar], at, 0.25, 'triangle', VOL.bass);   // ★ ベース「ボン」（はねたリズム）
        S.step++;                                             // ★ 次の16分音符へ
      }

      while (S.mel < S.notes.length && S.t0 + S.notes[S.mel].t < ahead) {   // ★ 【薄いメロディ】次のノーツが0.3秒先より前なら、予約する
        const n = S.notes[S.mel];                             // ★ 次のノーツ
        if (n.mel) {                                          // ★ メロディの音だけ（+ の2つ目からは鳴らさない）
          tone(n.f, S.t0 + n.t, Math.min(0.6, n.d * spb), 'sine', VOL.melody);   // ★ 到達時刻に、小さい音で鳴らす（長さは最大0.6秒）
        }
        S.mel++;                                              // ★ 次のノーツへ
      }
    },

    // 【撃退した音】f＝そのノーツの高さ、sec＝長さ(秒)。薄いメロディより大きく、いますぐ鳴らす（仕様書 7章）
    hit(f, sec) {
      tone(f, ctx.currentTime, Math.min(0.6, sec), 'triangle', VOL.hit);   // ★ 長さは最大0.6秒
    },
  };
})();
