/* ============================================================
   ranking.js（松井）
   ランキング Ranking（仕様書 8.2、8.3、10.1）：add(k, s, r) / setName(k, at, n) / top10(k) / reset()
   ・曲ごとに LocalStorage のキー yumekawa_hs_0、yumekawa_hs_1 … に、上位10件を保存する（k は SONGS の何番目か）。
   ・記録の形：{ s: スコア, r: 防衛率(%), at: 登録時刻（ミリ秒、Date.now()）, n: 名前 }
   ・LocalStorage が使えなくても止まらないように、読み書きは try { } catch { } で囲む（仕様書 8.2、9章）。
     中身はメモリ（records）にも持っておくので、保存できないときも、ページを開いている間は記録が残る。
   ============================================================ */

const Ranking = (() => {                                      // ★ game.js と同じ形。中の変数は外から見えない

  const records = {};                                         // ★ メモリの置き場。records[k] ＝ k番目の曲の記録（スコアの高い順、最大10件）
  const storageKey = k => 'yumekawa_hs_' + k;                 // ★ 保存するときの名前（キー）。0番の曲なら 'yumekawa_hs_0'
  const MAX = 10;                                             // ★ 曲ごとに残す件数（上位10件）
  const NONAME = 'ななし';                                    // ★ 名前の初期値
  let lastAt = 0;                                             // ★ 最後に使った登録時刻（同じ時刻の記録ができないようにする）
  let saveFailed = false;                                     // ★ 保存に失敗したことがあれば true。そのあとはメモリ（records）だけを使う（B-001）

  // 【LocalStorage から読む】k番目の曲の記録の配列を返す。読めなかったら null
  function read(k) {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey(k)) || '[]');   // ★ 文字列 → 配列。保存が無ければ '[]'（空の配列）
      return Array.isArray(data) ? data.filter(isValidRecord) : [];   // ★ 配列でなければ空。形のおかしい記録は取り除く
    } catch (e) {
      return null;                                            // ★ 読み込みに失敗した（LocalStorage が使えない、中身がこわれている）
    }
  }

  // 【読み込み】k番目の曲の記録を返す。LocalStorage から読むのは、はじめの1回だけ
  function list(k) {
    if (!records[k]) {                                        // ★ まだメモリに無ければ、LocalStorage から読む
      records[k] = read(k) || [];                             // ★ 読み込みに失敗したら、空として扱う（仕様書 8.2）
    }
    return records[k];
  }

  // 【読み直し】保存する前に、LocalStorage の最新の記録をメモリに入れ直す（B-001）
  //  ・ほかのウィンドウ（タブ）で保存された記録を、上書きして消さないようにするため
  //  ・読めないとき、保存に失敗したことがあるときは、メモリの記録をそのまま使う（仕様書 8.2）
  function reload(k) {
    const data = saveFailed ? null : read(k);                 // ★ 保存に失敗したことがあれば、読み直さない
    if (data) records[k] = data;                              // ★ 読めたときだけ入れ直す
    return list(k);
  }

  // 【記録の形が正しいか】s・r・at が数で、n が文字なら true
  function isValidRecord(x) {
    return x && typeof x.s === 'number' && typeof x.r === 'number' && typeof x.at === 'number' && typeof x.n === 'string';
  }

  // 【保存】k番目の曲の記録を、LocalStorage に書く
  function save(k) {
    try {
      localStorage.setItem(storageKey(k), JSON.stringify(records[k]));   // ★ 配列 → 文字列にして保存
    } catch (e) {
      saveFailed = true;                                      // ★ 保存できなかったことを覚えておく（このあとは読み直さない）
      // ★ 書き込みに失敗しても無視して、ゲームを続ける（仕様書 8.2）
    }
  }

  // 【名前を整える】前後の空白を取り、6文字まで。空なら「ななし」（仕様書 8.2）
  function cleanName(n) {
    const trimmed = String(n == null ? '' : n).trim();        // ★ 文字にしてから、前後の空白を取る
    return Array.from(trimmed).slice(0, 6).join('') || NONAME;   // ★ Array.from で1文字ずつに分けてから6文字を取る（絵文字も1文字に数えるため）
  }

  return {                                                    // ★ ここから下が、外から使える Ranking の中身（仕様書 10.1）

    // 【記録を追加】k番目の曲に、スコア s・防衛率 r・名前「ななし」で追加して保存し、追加した記録を返す
    //  ・10位より下だった場合も、記録は返す（ただし保存はされない）。10位以内かどうかは top10 の中にあるかで分かる
    add(k, s, r) {
      lastAt = Math.max(Date.now(), lastAt + 1);              // ★ 登録時刻。前の記録と同じミリ秒になったら1ミリ秒ずらす（setName で記録を見分けるため）
      const me = { s: s, r: r, at: lastAt, n: NONAME };       // ★ 今回の記録
      const all = reload(k).concat([me]);                     // ★ 最新の記録を読み直して（B-001）、今回の記録を足した配列
      all.sort((a, b) => b.s - a.s || a.at - b.at);           // ★ スコアの高い順。同じ点なら、先に出した人が上
      records[k] = all.slice(0, MAX);                         // ★ 上から10件だけ残す
      save(k);
      return me;
    },

    // 【できれば】k番目の曲の、登録時刻が at の記録の名前を n にして保存する
    setName(k, at, n) {
      const rec = reload(k).find(x => x.at === at);           // ★ 最新の記録を読み直して（B-001）、登録時刻で、どの記録かを探す
      if (rec) {                                              // ★ 見つかったときだけ（10位より下で消えていたら、何もしない）
        rec.n = cleanName(n);
        save(k);
      }
    },

    // 【上位10件】k番目の曲の記録を、スコアの高い順の配列で返す（本日のトップ3も、screens.js がここから作る。仕様書 8.3）
    top10(k) {
      return list(k).slice(0, MAX);                           // ★ slice でコピーを返す（外で並べかえても、中身が変わらないように）
    },

    // 【リセット】全曲の記録を消す（スタッフ用）
    reset() {
      SONGS.forEach((_, k) => {                               // ★ 曲の数だけくり返す
        records[k] = [];                                      // ★ メモリを空にする
        try {
          localStorage.removeItem(storageKey(k));             // ★ 保存も消す
        } catch (e) {
          // ★ 消せなくても無視する
        }
      });
    },
  };
})();
