/* ============================================================
   audio.js（中山）
   音 Sound：BGM（ドラム・ベース・和音）、薄いメロディ、撃退したときの音（仕様書 7章）。
   ・ベースと和音は、曲データの chords（charts.js）のコード進行で鳴らす（議題12）。
   ・すべて Web Audio API で作る（音声ファイルは使わない）。
   ・Web Audio の時計（ctx.currentTime）が、ゲーム全体の時計になる（判定・ウイルスの位置も。仕様書 5.3、9章）。
   ・音は「いつ鳴らすか」を先に予約できる。sched は毎フレーム呼ばれて、0.3秒先までの音をまとめて予約する。
   ・音色・音量は【遊びながら調整する】（数字は見本からの出発点。音量は VOL にまとめた）。
   ============================================================ */

const Sound = (() => {                                        // ★ game.js と同じ「すぐ実行する関数」。ctx などは外から見えない

  let ctx = null;                                             // ★ AudioContext（音を作る道具箱）。最初の start のときに作る
  let noise = null;                                           // ★ ザーッという雑音のデータ（ハイハット・クラップに使う）
  const VOL = { melody: 0.07, hit: 0.3, bass: 0.22, chord: 0.05 };   // ★ 音量（0〜1）。薄いメロディは小さく、撃退した音は大きく（仕様書 7章）。chord は和音の1つの音の大きさ（3〜4つ重なる）
  const ROOT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; // ★ コードの根音 → ドから数えて半音いくつ上か
  const FALLBACK = 'C:4 Am:4 F:4 G:4';                        // ★ chords が無い曲のコード（今までと同じ C→Am→F→G。16拍ごとにくり返す）
  let cs = null;                                              // ★ いまの曲のコードの一覧（曲が変わったら作り直す）
  let csSong = null;                                          // ★ cs を作ったときの曲（同じ曲なら作り直さない）

  // 【音の番号 → 高さ(Hz)】ラ(69)＝440Hz、12 上がると2倍（game.js と同じ計算）
  function hz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // 【コードの文字列 → 一覧】例：'C:4 G7:2' → [{ b:0, d:4, bass:…, fs:[…] }, { b:4, d:2, … }]（議題12）
  function parseChords(str) {
    const list = [];                                          // ★ 結果を入れる配列
    let b = 0;                                                // ★ 曲の頭から数えた拍
    str.trim().split(/\s+/).forEach(tk => {                   // ★ 空白で区切って、1つずつ見る（chart と同じ読み方）
      const parts = tk.split(':');                            // ★ 'G7:2' → ['G7', '2']
      const name = parts[0];                                  // ★ コード名
      const d = parts.length > 1 ? Number(parts[1]) : 1;      // ★ 長さ（拍）。: がなければ 1拍
      if (name === 'R') {                                     // ★ R は伴奏なし（弱起の小節など）。ベースも和音も鳴らさない
        list.push({ b: b, d: d, none: true });                // ★ 「なし」の印だけ付けて、長さの分の場所はとっておく
        b += d;                                               // ★ 拍を進める
        return;                                               // ★ この字はここで終わり（forEach の次の字へ）
      }
      const r = ROOT[name[0]] + (name[1] === '#' ? 1 : 0);    // ★ 根音（ド＝0 〜 シ＝11）。# なら半音上
      const top = 55 + (r + 5) % 12;                          // ★ 和音の根音の番号。ソ(55)〜ファ#(66) の間に置く（どのコードも同じくらいの高さになる）
      const ns = [top, top + (name.includes('m') ? 3 : 4), top + 7];   // ★ 根音・3度（短調 m は3、それ以外は4 半音上）・5度（7 半音上）＝ドミソの形
      if (name.endsWith('7')) ns.push(top + 10);              // ★ 7 のコード（G7 など）は、10 半音上の音も足す（G7 ならファ）
      list.push({
        b: b,                                                 // ★ 始まりの拍
        d: d,                                                 // ★ 長さ（拍）
        bass: hz(41 + (r + 7) % 12),                          // ★ ベースの高さ。ファ(41)〜ミ(52) の間に置く（C＝130.8Hz、Am＝110Hz など、今までと同じ高さ）
        fs: ns.map(hz),                                       // ★ 和音の音の高さ（Hz）の配列
      });
      b += d;                                                 // ★ 拍を進める
    });
    return list;                                              // ★ できた一覧を返す
  }

  // 【beat 拍目のコード】曲の chords（無ければ FALLBACK）から探す。見つからなければ null
  function chordAt(song, beat) {
    if (csSong !== song) {                                    // ★ 曲が変わったら
      cs = parseChords(song.chords || FALLBACK);              // ★ コードの一覧を作り直す（chords が無ければ C→Am→F→G）
      csSong = song;                                          // ★ どの曲の一覧かを覚える
    }
    if (!song.chords) beat = beat % 16;                       // ★ FALLBACK は16拍しかないので、くり返して使う
    let hit = null;                                           // ★ 見つかったコード
    cs.forEach(c => {                                         // ★ 一覧を1つずつ見て
      if (beat >= c.b && beat < c.b + c.d) hit = c;           // ★ beat がそのコードの間に入っていれば、それ
    });
    if (hit && hit.none) return null;                         // ★ R（伴奏なし）の間も null にする
    return hit;                                               // ★ 曲が終わった後は null（ベースも和音も鳴らさない）
  }

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
    //   使うもの：S.song.bpm、S.t0（曲の開始時刻）、S.lead（準備時間）、S.dur（曲の長さ）、S.step（次のドラムの番号）、S.mel（次のメロディの番号）、S.notes
    sched(S) {
      const spb = 60 / S.song.bpm;                            // ★ 1拍の長さ（秒）
      const sp = spb / 4;                                     // ★ 16分音符の長さ（1拍を4つに分ける）
      const ahead = ctx.currentTime + 0.3;                    // ★ いまから0.3秒先まで予約する
      const off = Math.round(S.lead / sp);                    // ★ 準備時間が16分音符いくつ分か（きらきら星は5拍＝20個、ほかの2曲は4拍＝16個）
      const end = Math.round(S.dur / sp);                     // ★ 曲の長さが16分音符いくつ分か（きらきら星は48拍＝192個）。ここから後は鳴らさない

      while (S.t0 + S.step * sp < ahead) {                    // ★ 【ドラム・ベース・和音】次の16分音符が0.3秒先より前なら、予約する
        const i = S.step;                                     // ★ 何個目の16分音符か
        const at = S.t0 + i * sp;                             // ★ 鳴らす時刻
        const k = i - off;                                    // ★ メロディの始まりから数えて何個目か（準備中はマイナス）。小節の頭をメロディの頭にそろえるため（議題11）
        const s = (k % 16 + 16) % 16;                         // ★ 1小節（16個）の中の何番目か（0〜15）。+16 して割り直すと、マイナスでも 0〜15 になる
        const c = k >= 0 && k < end ? chordAt(S.song, k / 4) : null;   // ★ いまのコード（k÷4＝メロディの始まりから何拍目か）。準備中（k がマイナス）は無し → リズムだけにして、ベースと和音はメロディと一緒に入る
        const last = c !== null && S.song.chords && c === cs[cs.length - 1];   // ★ 曲の最後のコードなら true（chords がある曲だけ）。【曲の終わり】最後のコードのあいだは、リズム（ドラム）だけにする
        if (i >= off % 16 && k < end) {                       // ★ 準備時間のうち、1小節（16個）に足りない「はんぱ」の分は鳴らさない → 1拍目の「ドン」から始まる。曲が終わったら何も鳴らさない
          if (s % 4 === 0) kick(at);                          // ★ 1拍ごと（0,4,8,12番目）にキック「ドン」
          if (s % 4 === 2) hiss(at, 0.05, 0.12, 7000);        // ★ 拍の裏（2,6,10,14番目）にハイハット「チッ」
          if (s === 4 || s === 12) hiss(at, 0.12, 0.18, 1500);   // ★ 2拍目と4拍目にクラップ「パン」
          if (c && !last && [0, 6, 8, 14].includes(s)) tone(c.bass, at, 0.25, 'triangle', VOL.bass);   // ★ ベース「ボン」（はねたリズム）。高さはコードの根音。最後のコードでは鳴らさない
          if (c && !last && (s === 4 || s === 12)) {          // ★ 2拍目と4拍目（クラップと同じ所）に、和音「ジャッ」。最後のコードでは鳴らさない
            c.fs.forEach(f => tone(f, at, spb * 0.8, 'triangle', VOL.chord));   // ★ コードの音を全部、同時に鳴らす（長さは1拍より少し短く）
          }
        }
        S.step++;                                             // ★ 次の16分音符へ
      }

      while (S.mel < S.notes.length && S.t0 + S.notes[S.mel].t < ahead) {   // ★ 【薄いメロディ】次のノーツが0.3秒先より前なら、予約する
        const n = S.notes[S.mel];                             // ★ 次のノーツ
        if (n.mel) {                                          // ★ メロディの音だけ（+ の2つ目からは鳴らさない）
          tone(n.fs[n.fs.length - 1], S.t0 + n.t, Math.min(0.6, n.d * spb), 'sine', VOL.melody);   // ★ 到達時刻に、小さい音で鳴らす（長さは最大0.6秒）。和音なら最後に書いた音（いちばん上のメロディ）だけ
        }
        S.mel++;                                              // ★ 次のノーツへ
      }
    },

    // 【撃退した音】fs＝そのノーツの高さ(Hz)の配列、sec＝長さ(秒)。薄いメロディより大きく、いますぐ鳴らす（仕様書 7章）
    hit(fs, sec) {
      const v = VOL.hit / Math.sqrt(fs.length);               // ★ 和音は1つずつの音量を少し下げる（2つなら約0.7倍、4つなら半分）。重なっても大きくなりすぎない
      fs.forEach(f => tone(f, ctx.currentTime, Math.min(0.6, sec), 'triangle', v));   // ★ 全部の音を同時に鳴らす。長さは最大0.6秒
    },
  };
})();
