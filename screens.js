/* ============================================================
   screens.js（松井）　画面の切り替え、キー入力の振り分け、曲カード、本日のトップ（仕様書 2.2）
   ------------------------------------------------------------
   ・いまできていること：画面の拡大縮小、背景の演出、画面の切り替え（Screens.show）、
     画面ごとのキー入力の振り分け（仕様書 4章）、ボタン、曲カード（SONGS から作る）、本日のトップ、ランキングのリセット、
     リザルト画面（認定証・ランキング・【できれば】名前の入力・【できれば】豆知識）。
   ・学園祭の展示用に、放置するとタイトルに戻るしくみを足した（仕様書にはない。展示用の変更）。
   ・学園祭の展示用に、スタッフ画面（ランキングを1件ずつ消す・ぜんぶ消す）を足した。リセットボタンのパスワードのあとに開く。
   ・外から呼べるのは Screens.show(name) だけ（仕様書 10.1）。
   ============================================================ */

// 【画面の拡大縮小】舞台（1067×600）を、ウィンドウに収まる最大の倍率で拡大縮小する（仕様書 2.1）
const W = 1067;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / 600);
  document.getElementById('stage').style.transform = 'scale(' + s + ')';
  document.getElementById('app').style.width = W * s + 'px';
  document.getElementById('app').style.height = 600 * s + 'px';
}
addEventListener('resize', fit);
fit();

// 【背景のキラキラ】白い点を20個作る（プレイ画面などの背景）
for (let i = 0; i < 20; i++) {
  const d = document.createElement('div');
  d.className = 'spk';
  // ★ 横の位置は 0, 53, 106 … 1007px（画面の横幅 1067px 全体に散らばる。41 だと 779px までで、右の方に降りてこなかった）
  d.style.cssText = 'left:' + (i * 53 % W) + 'px;animation-duration:' + (8 + i % 5 * 3) + 's;animation-delay:-' + (i * 1.7) + 's';
  document.getElementById('stage').prepend(d);
}

// 【背景の演出】ハート・星を16個浮かべる（全画面共通。ランサムちゃんのトゲの星形は chara.css に書いてある）
(function () {
  const f = document.getElementById('fl'), C = ['#ff9ccf', '#c9a8ff', '#9fd8ff', '#fff'], G = ['♥', '♥', '★'];
  for (let i = 0; i < 16; i++) {
    const e = document.createElement('i');
    e.textContent = G[i % 3];
    e.style.cssText = 'left:' + (i * 67 % 1040) + 'px;font-size:' + (14 + i % 4 * 8) + 'px;color:' + C[i % 4] + ';animation-duration:' + (10 + i % 5 * 3) + 's;animation-delay:-' + (i * 1.3) + 's';
    f.appendChild(e);
  }
})();

// ------------------------------------------------------------
// 【画面 Screens】画面の切り替えと、キー入力の振り分け（仕様書 3.1、4章、10.1）
// ------------------------------------------------------------
const Screens = (() => {                                      // ★ game.js と同じ形。中の変数は外から見えない
  const NAMES = ['title', 'select', 'play', 'result'];        // ★ 4つの画面の id（仕様書 3.1）
  const RESET_PASS = '1026';                                  // ★ ランキングのリセットのパスワード（スタッフ用）。変えるときは、ここだけ直す
  let state = 'title';                                        // ★ いま表示している画面
  // ★ 曲を見せる順番：難易度順（星の少ない順。同じ星なら SONGS の順）。中身は曲の番号。例：[0, 1, 2]
  //   タイトルの「本日のトップ3」と、セレクト画面の曲カードの両方で、この順番を使う
  const ORDER = SONGS.map((_, k) => k).sort((a, b) => SONGS[a].star - SONGS[b].star || a - b);
  let sel = 0;                                                // ★ セレクト画面で選択中のカードの位置（左から 0, 1, 2 …。曲の番号は ORDER[sel]）
  let last = 0;                                               // ★ 最後に遊んだ曲の番号（リザルトの「もういちどあそぶ」で使う）
  let naming = null;                                          // ★ 【できれば】名前を入力中の記録。入力中でなければ null
  // ★ 【放置対策】学園祭の展示用。タイトル以外の画面で、キー・クリックが3分なければタイトルに戻る
  const IDLE_SEC = 180;                                       // ★ 何秒操作がなければ戻るか（3分＝180秒）。変えるときは、ここだけ直す
  const WARN_SEC = 10;                                        // ★ 残り何秒からカウントダウンを出すか
  let idleAt = Date.now();                                    // ★ 最後に操作した時刻（ミリ秒）
  let playing = false;                                        // ★ 曲を遊んでいる最中なら true（プレイ画面で Space を押したら true。この間は数えない）
  let fading = false;                                         // ★ 放置でタイトルに戻る切りかえ（ふわっと）の最中なら true。この間はキーを受け付けない
  // ★ 【スタッフ画面】学園祭の展示用。ランキングを1件ずつ消せる画面（パスワードのあとに開く）
  const STAFF_SEC = 180;                                      // ★ 何秒操作がなければ、スタッフ画面を自動で閉じるか（3分。閉じ忘れたとき、お客さんが記録を消せないように）
  let staff = null;                                           // ★ 開いているスタッフ画面（div）。開いていなければ null
  let staffK = ORDER[0];                                      // ★ スタッフ画面で選んでいる曲の番号（はじめは、いちばんやさしい曲）

  // 【画面を切り替える】name の画面だけに class="on" を付ける（表示する画面は常に1つ）
  function show(name) {
    NAMES.forEach(id => $(id).classList.toggle('on', id === name));   // ★ 一致した画面だけ on、ほかは外す
    state = name;                                             // ★ キー入力の振り分けに使う
    idleAt = Date.now();                                      // ★ 【放置対策】画面が変わったら、時間を数え直す
    playing = false;                                          // ★ 【放置対策】プレイ画面に来た直後は「スタート待ち」（Space を押すまで）
    if (name === 'title') renderToday();                      // ★ タイトル画面を出すたびに、本日のトップ3を読み直す（仕様書 8.3）
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();                          // ★ 押したボタンのフォーカスを外す（Enter でボタンが二重に押されるのを防ぐ）
    }
  }

  // 【本日のトップ3】曲ごとに、今日の記録の上位を「メダル・名前・点数」で並べる。記録がない行は「--」（仕様書 3.2、8.3）
  //  ・ふつうは、曲ごとに1列でトップ3まで
  //  ・曲が6曲以上のときは、いちばんやさしい2曲を1列にまとめて、それぞれトップ1だけ（列が多くなりすぎないように）
  //  ・曲名の札の色は、曲の星の数で決まる（色は style.css の .tsong.s1〜.s6）
  function renderToday() {
    const tr = document.querySelector('#today .tr');          // ★ 「★ 本日のトップ3 ★」の下の入れ物
    tr.innerHTML = '';                                        // ★ 前の表示を消す
    const today = new Date().toDateString();                  // ★ 今日の日付の文字（'Sat Oct 10 2026' のような形）
    // ★ 列の分け方。例：6曲なら [[0, 3], [1], [4], [5], [2]] のように、1列目だけ2曲（中身は曲の番号。難易度順）
    const cols = ORDER.length >= 6 ? [ORDER.slice(0, 2)].concat(ORDER.slice(2).map(k => [k])) : ORDER.map(k => [k]);
    cols.forEach(ks => {                                      // ★ 列の数だけくり返す（ks はその列の曲の番号）
      const col = document.createElement('div');              // ★ 1列分の入れ物
      col.className = 'tcol';
      const n = ks.length > 1 ? 1 : 3;                        // ★ 何位まで出すか（2曲まとめた列はトップ1だけ、ほかはトップ3）
      ks.forEach(k => {                                       // ★ その列の曲の数だけくり返す（k は曲の番号）
        const song = document.createElement('div');           // ★ 曲名の札
        song.className = 'tsong s' + SONGS[k].star;           // ★ 星の数で札の色を変える（星1なら s1）
        song.textContent = SONGS[k].name;                     // ★ textContent で入れる（HTMLとして解釈させない）
        col.appendChild(song);
        // ★ 上位10件（スコアの高い順）から今日の記録だけを取り出し、上から n 件
        const top = Ranking.top10(k).filter(e => new Date(e.at).toDateString() === today).slice(0, n);
        for (let i = 0; i < n; i++) {                         // ★ 1位〜n位の行
          const e = top[i];                                   // ★ i+1 位の記録（なければ undefined）
          const row = document.createElement('div');
          row.className = 'trow' + (e ? '' : ' none');        // ★ 記録がない行は none（CSSで薄くする）
          const md = document.createElement('span');          // ★ メダル（1＝金、2＝銀、3＝銅）
          md.className = 'md md' + (i + 1);
          md.textContent = i + 1;
          const nm = document.createElement('span');          // ★ 名前
          nm.className = 'tn';
          nm.textContent = e ? e.n : '--';
          const em = document.createElement('em');            // ★ 点数（太字）
          em.textContent = e ? e.s.toLocaleString() + '点' : '--';   // ★ 12340 → '12,340点'
          row.append(md, nm, em);
          col.appendChild(row);
        }
      });
      tr.appendChild(col);
    });
  }

  // 【リザルト画面】ゲームの結果 r を受け取って、認定証とランキングを出す（仕様書 3.5、10.2）
  //  r の中身：k（曲の番号）、score、hit、total、max（最大コンボ）、dead（HP0で終わったか）、rate（防衛率）、rank、comment
  function showResult(r) {
    last = r.k;                                               // ★ 「もういちどあそぶ」で同じ曲を始めるために覚える
    const d = new Date();                                     // ★ 今日の日付（認定証の下に出す）

    // ★ 認定証の文字。textContent で入れる（HTMLとして解釈させない）
    $('rn').textContent = SONGS[r.k].name;                                    // ★ 曲名
    $('rk').textContent = 'ランク ' + r.rank;                                 // ★ 例：ランク S
    $('rcm').textContent = r.comment;                                         // ★ 例：超大優勝★
    $('rt').textContent = '防衛率 ' + r.rate + '%';                           // ★ 例：防衛率 98%
    $('rs').textContent = 'スコア ' + r.score.toLocaleString() + ' 点';       // ★ 例：スコア 12,340 点（3けたごとにカンマ）
    $('rm').textContent = '最大コンボ ' + r.max;                              // ★ 例：最大コンボ 41
    $('rday').textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日　学園祭サイバー防衛本部';   // ★ getMonth は 0〜11 なので +1

    $('rh').textContent = r.dead ? 'サーバーダウン…！' : '防衛成功！';       // ★ HPが0で終わったら「サーバーダウン…！」

    // ★ 名前「ななし」で記録する（HP0で終わっても記録する。仕様書 8.2）
    //   ただし学園祭の展示用に、0点のときは記録しない（朝はランキングが空なので、0点でも10位以内に入ってしまうため）。
    //   記録しないときは me が null になり、ランキングは表示だけで、名前の入力は出ない
    const me = r.score > 0 ? Ranking.add(r.k, r.score, r.rate) : null;
    renderRanking(r.k, me);                                   // ★ この曲のランキングを出す
    showTip();                                                // ★ 【できれば】豆知識を1つ出す

    show('result');                                           // ★ リザルト画面に切り替える
    if (naming) $('nm').focus();                              // ★ 10位以内なら、すぐ名前を打てるように入力欄を選ぶ（show の後でないと、フォーカスが外される）
  }

  // 【豆知識】tips.js の TIPS から、ランダムに1つ選んで出す。TIPS がない・空のときは、札ごと出さない（【できれば】仕様書 3.5、8.4）
  function showTip() {
    const ok = typeof TIPS !== 'undefined' && Array.isArray(TIPS) && TIPS.length > 0;   // ★ typeof で調べると、TIPS が無くてもエラーにならない
    $('tip').style.display = ok ? '' : 'none';                // ★ 使えるときだけ札を見せる
    if (ok) {
      const i = Math.floor(Math.random() * TIPS.length);      // ★ 0 〜（個数−1）の中から、ランダムに1つ選ぶ
      $('tipt').textContent = TIPS[i];                        // ★ 文を入れる（textContent なので、HTMLとして解釈させない）
    }
  }

  // 【ランキング】k番目の曲の上位10件を、1行に「順位　名前　◯点　◯%」で並べる。今回の記録 me は強調する（仕様書 3.5、8.2）
  function renderRanking(k, me) {
    const ol = $('rl');                                       // ★ ランキングのリスト（<ol>）
    ol.innerHTML = '';                                        // ★ 前の表示を消す
    naming = null;                                            // ★ まず「入力中ではない」にしておく（10位以内なら、下で入れる）
    Ranking.top10(k).forEach((e, i) => {                      // ★ 1件ずつ（i は 0 から始まる）
      const li = document.createElement('li');                // ★ 1行
      const no = document.createElement('b');                 // ★ 順位
      const nm = document.createElement('span');              // ★ 名前
      const sc = document.createElement('span');              // ★ スコア
      const rt = document.createElement('span');              // ★ 防衛率
      no.textContent = i + 1;                                 // ★ 順位は 1 から
      nm.className = 'rnm';                                   // ★ 名前の見た目（result.css の #rl .rnm）
      if (me && e.at === me.at) {                             // ★ 今回の記録なら、名前の位置に入力欄を出す（【できれば】仕様書 3.5）
        naming = e;                                           // ★ 名前を入力中の記録として覚える
        const inp = document.createElement('input');          // ★ 入力欄
        inp.id = 'nm';                                        // ★ id="nm"（見た目は result.css の #nm）
        inp.maxLength = 6;                                    // ★ 6文字まで（仕様書 8.2）
        inp.placeholder = 'なまえ';                           // ★ 何も入っていないときに薄く出る文字
        inp.setAttribute('aria-label', 'なまえ');             // ★ 読み上げ用の名前（placeholder だけだと、入力欄の名前として読まれないことがある）
        inp.autocomplete = 'off';                             // ★ ブラウザが前に入れた名前を出さないように（展示では毎回ちがう人が遊ぶ）
        inp.addEventListener('keydown', nameKey);             // ★ 入力欄でキーを押したとき
        nm.appendChild(inp);
      } else {
        nm.textContent = e.n;                                 // ★ 名前は textContent で（HTMLとして解釈させない。仕様書 8.2）
      }
      sc.textContent = e.s.toLocaleString() + '点';           // ★ 例：12,340点
      rt.textContent = e.r + '%';                             // ★ 例：98%
      if (me && e.at === me.at) li.className = 'me';          // ★ 今回の記録なら強調（太字・濃いピンク・薄いピンクの帯）
      li.append(no, nm, sc, rt);                              // ★ 4つを行に入れる
      ol.appendChild(li);                                     // ★ 行をリストに足す
    });
    $('nmh').style.display = naming ? '' : 'none';            // ★ 名前の案内は、入力欄を出したときだけ見せる
    lockButtons(!!naming);                                    // ★ 名前を決めるまで、ボタンは押せないようにする（!! で true / false にする）
  }

  // 【ボタンを押せなくする／戻す】lock が true なら押せない（仕様書 3.5、4章）
  function lockButtons(lock) {
    ['again', 'home', 'rback'].forEach(id => { $(id).disabled = lock; });   // ★ disabled＝押せない状態
  }

  // 【名前の入力欄のキー】（仕様書 4章）
  function nameKey(e) {
    e.stopPropagation();                                      // ★ 入力中のキーは、ゲームの操作（下の keydown）に渡さない。D F J K や数字は文字として入るだけ
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {   // ★ Enter。ただし日本語入力の変換を決める Enter は除く
      e.preventDefault();
      decide(e.target.value);                                 // ★ 入れた名前で決める（空なら ranking.js が「ななし」にする）
    } else if (e.key === 'Escape') {
      e.preventDefault();
      decide('');                                             // ★ 入力をやめて「ななし」で決める
    }
  }

  // 【名前を決める】ranking.js に書き込み、入力欄を文字に戻す（仕様書 3.5、8.2）
  function decide(v) {
    Ranking.setName(last, naming.at, v);                      // ★ 名前を記録に書き込む（6文字まで・空白を取る・空なら「ななし」は ranking.js がする）
    const saved = Ranking.top10(last).find(x => x.at === naming.at);   // ★ 書き込んだ記録を読み直す
    const inp = $('nm');                                      // ★ 入力欄
    const span = inp.parentNode;                              // ★ 入力欄が入っている名前の場所
    inp.blur();                                               // ★ フォーカスを外す
    span.textContent = saved ? saved.n : '';                  // ★ 入力欄を、決めた名前の文字に置きかえる（textContent なので安全）
    naming = null;                                            // ★ 入力中ではなくなった
    $('nmh').style.display = 'none';                          // ★ 案内を消す
    lockButtons(false);                                       // ★ ボタンを押せるように戻す
  }

  // 【曲を始める】曲の番号を覚えてから、game.js に渡す。プレイ画面への切り替えは game.js がする（仕様書 10.1）
  function start(k) {
    last = k;                                                 // ★ リザルトの「もういちどあそぶ」用
    Game.start(k);                                            // ★ game.js が準備して、Screens.show('play') を呼ぶ
  }

  // 【キャラのHTML】ty＝種類（0：ランサム、1：フィッシング、2：DDoS）、santa＝true ならサンタの帽子（仕様書 6章）
  //  ・形は chara.css の先頭に書いたもの。view.js の View.chara と同じ形だが、
  //    仕様書 10.1 にない関数は他のファイルから呼ばないので、screens.js にも持つ。
  function charaHTML(ty, santa) {
    const html = [                                            // ★ 3種類のHTMLを配列に入れておき、ty 番目を取り出す
      '<div class="ch"><i class="stars"></i><div class="fc c0"><i class="lk"></i><i class="e"></i><i class="e r"></i><i class="bl"></i><i class="bl r"></i><i class="m"></i></div></div>',   // ★ 0：ランサムちゃん
      '<div class="ch"><div class="fc c1' + (santa ? ' santa' : '') + '"><i class="hk"></i><i class="cr"></i><i class="br"></i><i class="e"></i><i class="e r"></i><i class="bl"></i><i class="bl r"></i><i class="m"></i></div></div>',   // ★ 1：フィッシング（santa のときだけ class に santa を足す）
      '<div class="ch"><div class="fc c2"><i class="an"></i><i class="an r"></i><i class="xx">&gt;_&lt;</i><i class="bl"></i><i class="bl r"></i></div></div>',   // ★ 2：DDoS
    ];
    return html[ty];                                          // ★ 選んだ1つを返す
  }

  // 【曲の長さ（秒）】拍の合計 × 1拍の秒数（カードの「約◯秒」用）
  //  ・game.js の譜面の読み込みは外から呼ばないので、ここで拍だけ数える。
  function songSec(s) {
    let beats = 0;                                            // ★ 拍の合計
    s.chart.trim().split(/\s+/).forEach(tk => {                // ★ 'G4+C4:2' のような1つずつ
      beats += Number(tk.split(':')[1] || 1);                 // ★ ':' の後ろが拍の数（ないときは1拍）
    });
    return Math.round(beats * 60 / s.bpm);                    // ★ 1拍＝60÷BPM 秒
  }

  // 【曲カードを作る】SONGS の曲の数だけ、難易度順（ORDER の順）に作る（仕様書 3.3）
  function buildCards() {
    $('cards').innerHTML = ORDER.map((k, p) => {              // ★ k は曲の番号、p は左からの位置（0, 1, 2 …）。カード1枚のHTMLを作り、join('') で全部つなげる
      const s = SONGS[k];
      return '<div class="card" data-i="' + k + '">' +        // ★ data-i は曲の番号（クリックでその曲を始める）
        '<div class="scn"><b style="background:' + s.col + '">' + (p + 1) + '</b>' + s.name + '</div>' +                // ★ 番号（左からの位置＝数字キー）と曲名
        '<div class="slot">' + charaHTML(s.chara, s.santa) + '</div>' +                                                  // ★ キャラ
        '<div class="srow"><span class="sstar" style="color:' + s.col + '">' + '★'.repeat(s.star) + '☆'.repeat(Math.max(0, 6 - s.star)) + '</span>' +   // ★ 星は全部で6個（★が星の数、残りが☆）
          '<span class="slb" style="background:' + s.col + '">' + s.label + '</span></div>' +                           // ★ 星と難易度ラベル
        '<div class="sinfo">' + s.lanes + 'レーン／約' + songSec(s) + '秒</div>' +                                       // ★ レーン数と長さ
        '<div class="skey">キー：' + (s.lanes === 2 ? 'F J' : 'D F J K') + '</div>' +                                    // ★ 使うキー
      '</div>';
    }).join('');
    // ★ キー案内の数字も、曲の数に合わせる（曲を足したとき 1〜4 になる）
    document.querySelector('#select .hint').innerHTML =
      '← → で選んで Enter ／ <kbd>1</kbd>〜<kbd>' + SONGS.length + '</kbd>キーですぐスタート（Esc：タイトルへ）';
    pick(0);                                                  // ★ はじめはいちばん左（いちばんやさしい曲）を選択中にする
  }

  // 【曲カードを選ぶ】左から p 番目のカードだけ青い枠にする（仕様書 3.3）
  function pick(p) {
    sel = p;
    document.querySelectorAll('#cards .card').forEach((c, q) => c.classList.toggle('on', q === p));
  }

  // 【キー入力の振り分け】画面ごとにキーの意味を変える（仕様書 4章）
  addEventListener('keydown', e => {
    if (e.repeat) return;                                     // ★ 押しっぱなし（リピート）は無視する
    if (fading) { e.preventDefault(); return; }               // ★ 【放置対策】ふわっと切りかえている間は、キーを受け付けない（途中で曲が始まったりしないように）
    if (staff) {                                              // ★ 【スタッフ画面】開いている間は、Esc（とじる）だけ。ほかのキーは効かない
      e.preventDefault();                                     // ★ Enter で、うしろのボタンが押されたりしないように
      if (e.code === 'Escape') closeStaff();
      return;
    }
    const c = e.code;                                         // ★ キーの名前（Enter、KeyF、Digit1 など）
    const num = /^Digit([1-9])$/.exec(c);                     // ★ 上段の数字キーなら、その数字（テンキー Numpad は入れない）
    const n = SONGS.length;                                   // ★ 曲の数

    if (state === 'title') {
      if (c === 'Enter') { e.preventDefault(); show('select'); }

    } else if (state === 'select') {
      if (c === 'ArrowRight' || c === 'ArrowDown') pick((sel + 1) % n);          // ★ 次の曲（右端なら左端へ回り込む）
      else if (c === 'ArrowLeft' || c === 'ArrowUp') pick((sel + n - 1) % n);    // ★ 前の曲（左端なら右端へ）
      else if (c === 'Enter') { e.preventDefault(); start(ORDER[sel]); }         // ★ 選択中のカードの曲を開始
      else if (num && +num[1] <= n) start(ORDER[+num[1] - 1]);                   // ★ 数字キー 1〜（曲の数）で、左からその番目のカードの曲をすぐ開始
      else if (c === 'Escape') show('title');

    } else if (state === 'play') {
      if (c === 'Space') e.preventDefault();                 // ★ Space で画面がスクロールしたり、選ばれたままのボタンが押されたりしないようにする（Space はこの下で Game.key に渡す）
      if (c === 'Space') playing = true;                      // ★ 【放置対策】Space で曲が始まるので、ここから先は数えない（曲は終わるとリザルト画面に変わる）
      if (c === 'Escape') { Game.stop(); show('select'); }    // ★ 中断（結果は残らない。仕様書 3.1）
      else Game.key(c);                                       // ★ それ以外のキーは game.js に渡す（レーンのキーかどうかは game.js が決める）

    } else if (state === 'result' && naming) {
      $('nm').focus();                                        // ★ 名前の入力中に、入力欄の外を押していたら、入力欄に戻す

    } else if (state === 'result') {
      if (c === 'Enter') { e.preventDefault(); start(last); } // ★ もういちどあそぶ（同じ曲）
      else if (c === 'Escape') show('select');                // ★ きょくをえらぶ
    }
  });

  // 【ボタンとカードのクリック】
  $('go').onclick = () => show('select');                     // ★ タイトル：あそぶ
  $('sback').onclick = () => show('title');                   // ★ セレクト：← タイトルへ
  $('again').onclick = () => { if (!naming) start(last); };   // ★ リザルト：もういちどあそぶ（名前を決めるまでは押せない）
  $('home').onclick = () => { if (!naming) show('select'); }; // ★ リザルト：きょくをえらぶ（同じ）
  $('rback').onclick = () => { if (!naming) show('title'); }; // ★ リザルト：← タイトルへ（同じ。仕様書 3.5）
  $('rst').onclick = () => {                                  // ★ タイトル：ランキングをリセット（スタッフ用。仕様書 3.2）
    const p = prompt('スタッフ用のパスワードを入れてください');   // ★ 入力ダイアログ。キャンセルなら null が返る
    $('rst').blur();                                          // ★ フォーカスを外す（このあと Enter を押したとき、もう一度押されないように）
    if (p === RESET_PASS) openStaff();                        // ★ パスワードが合ったときだけ、スタッフ画面を開く（間違い・キャンセルは何もしない。学園祭の展示用）
  };

  // ★ カードは #cards にまとめて登録する（あとでカードを SONGS から作り直しても、登録しなおさなくてよい）
  $('cards').addEventListener('click', e => {
    const card = e.target.closest('.card');                   // ★ クリックした場所を含むカード
    if (card) start(+card.dataset.i);                         // ★ data-i が曲の番号
  });
  $('cards').addEventListener('mouseover', e => {
    const card = e.target.closest('.card');
    if (card) pick(ORDER.indexOf(+card.dataset.i));           // ★ マウスを乗せたカードを選択中にする（曲の番号 → 左からの位置）
  });

  // 【放置対策】学園祭の展示用。タイトル以外の画面で、キー・クリックが3分なければタイトルに戻る
  //  ・曲を遊んでいる最中は数えない（放置しても、ハートがなくなって終わり、リザルト画面に変わるため）
  //  ・残り10秒になったら、画面の右下にカウントダウンを出す
  //  ・名前の入力中に戻ったときは、その記録は捨てる（「ななし」だらけにならないように）
  //  ・戻るときは、ふちからゆめかわ色で包んで、3体と「またあそんでね♡」を出してから開く（ほかの画面の切りかえは、今のまま）
  const cd = document.createElement('div');                   // ★ カウントダウンの札（index.html・style.css は直さず、ここで作る）
  cd.style.cssText = 'position:absolute;right:14px;bottom:10px;z-index:10;display:none;pointer-events:none;' +
    'padding:4px 14px;border:2px solid #ffb3da;border-radius:999px;background:rgba(255,255,255,.9);' +
    'color:#7a3fb0;font-size:15px;font-weight:bold';          // ★ 見た目（右下に小さく。クリックのじゃまをしない）
  $('stage').appendChild(cd);

  const touch = () => { idleAt = Date.now(); };               // ★ 操作したら、時間を数え直す
  addEventListener('keydown', touch, true);                   // ★ キー（true＝名前の入力欄より先に受け取る。入力欄はキーを外に渡さないため）
  addEventListener('pointerdown', touch, true);               // ★ マウスのクリック

  // ★ タイトルに戻す。スタート待ちならゲームを止め、名前の入力中なら記録を捨てる
  function idleHome() {
    if (state === 'play') Game.stop();                        // ★ スタート待ちのまま放置されたとき
    if (naming) {                                             // ★ 名前の入力中に放置されたとき
      Ranking.remove(last, naming.at);                        // ★ 「ななし」で保存されている今回の記録を消す（ranking.js）
      naming = null;                                          // ★ 入力中ではなくなった
      $('nmh').style.display = 'none';                        // ★ 名前の案内を消す
      lockButtons(false);                                     // ★ ボタンを押せるように戻す
    }
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();                          // ★ 名前の入力欄などのフォーカスを外す（切りかえの間に打たれないように）
    }
    fadeHome();                                               // ★ ふわっと切りかえて、タイトルへ（本日のトップ3も読み直される）
  }

  // 【ふわっと切りかえ】放置でタイトルに戻るときだけ使う（全部で約2.4秒）
  //  ① ふちから、ゆめかわ色（ピンク→むらさき→水色）がじわっと閉じてくる
  //  ② 閉じきるころに、3体（ランサムちゃん・DDoS・フィッシング）がぽんぽんと出て、「またあそんでね♡」がゆっくり浮かびながら出る
  //  ③ その間に、うしろでタイトル画面に切りかえる
  //  ④ 3体は小さくなって、文字はうすくなって消えながら、まん中からふわっと開く
  function fadeHome() {
    fading = true;
    const ov = document.createElement('div');                 // ★ ゆめかわ色の幕
    ov.style.cssText = 'position:absolute;inset:0;z-index:20;background:linear-gradient(180deg,#ffb8e0,#d9c2ff 50%,#a9dcff)';   // ★ クリックも、この幕が受け止める
    const box = document.createElement('div');                // ★ 3体と文字の入れ物（幕の上に重ねる）
    box.style.cssText = 'position:absolute;inset:0;z-index:21;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px';
    const row = document.createElement('div');                // ★ 3体を横にならべる
    row.style.cssText = 'display:flex;gap:18px';
    const chs = [0, 2, 1].map(ty => {                         // ★ 左から ランサムちゃん（0）・DDoS（2）・フィッシング（1）
      const w = document.createElement('div');
      w.style.cssText = 'width:130px;height:150px;display:grid;place-items:end center;opacity:0';
      w.innerHTML = charaHTML(ty, false);                     // ★ セレクト画面のカードと同じキャラ
      row.appendChild(w);
      return w;
    });
    const tx = document.createElement('div');                 // ★ 「またあそんでね♡」
    tx.textContent = 'またあそんでね♡';
    tx.style.cssText = 'font-size:40px;font-weight:800;color:#ff4fa3;opacity:0;' +
      '-webkit-text-stroke:8px #fff;paint-order:stroke fill;text-shadow:0 0 18px rgba(255,255,255,.9)';   // ★ 白いふちどり。リザルト画面の見出しと同じ「なぞり線」（影をずらして重ねると、ふちがぎざぎざになるため）。paint-order で、線を文字のうしろに引く
    box.append(row, tx);
    $('stage').append(ov, box);

    const R = 650, SOFT = 120;                                // ★ 幕の穴の大きさ（はじめ）と、ふちのぼかしの幅（px）
    const CLOSE = 600, SHOW = 1200, OPEN = 600;               // ★ 閉じる・見せる・開く時間（ミリ秒）。文字がゆっくり出るので、見せる時間を長めに
    const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // ★ はじめと終わりをゆっくりにする（0〜1 → 0〜1）
    const pop = t => {                                        // ★ ぽんっと出る大きさ（0 → 1.15 → 1）
      t = Math.max(0, Math.min(1, t));
      return t < .7 ? 1.15 * ease(t / .7) : 1.15 - .15 * ease((t - .7) / .3);
    };
    const set = (el, s) => { el.style.transform = 'scale(' + s + ')'; el.style.opacity = s > 0 ? 1 : 0; };   // ★ 大きさを変える（0 なら見せない）
    // ★ 文字は拡大しない（拡大しながら動かすと、文字のふちがぎざぎざに見えるため）。うすい→はっきり と、下から上へ浮かぶだけ
    const float = (el, a, y) => { el.style.opacity = a; el.style.transform = 'translateY(' + y + 'px)'; };
    const t0 = performance.now();                             // ★ 始めた時刻
    let switched = false;                                     // ★ タイトルに切りかえたか

    const step = () => {
      const t = performance.now() - t0;                       // ★ 始めてから何ミリ秒たったか
      let r = 0;                                              // ★ 幕の穴の大きさ（0 なら、画面いっぱいがゆめかわ色）
      if (t < CLOSE) {                                        // ★ ① 閉じる
        r = R * (1 - ease(t / CLOSE));
      } else if (t < CLOSE + SHOW) {                          // ★ ②③ 見せる。途中でタイトルに切りかえる
        if (!switched && t > CLOSE + 300) { switched = true; show('title'); }
      } else if (t < CLOSE + SHOW + OPEN) {                   // ★ ④ 開く
        r = R * ease((t - CLOSE - SHOW) / OPEN);
      } else {                                                // ★ おしまい
        if (!switched) show('title');                         // ★ （念のため）切りかえていなければ、ここで切りかえる
        ov.remove();
        box.remove();
        fading = false;
        return;
      }
      const m = 'radial-gradient(circle at 50% 50%, transparent ' + Math.max(0, r - SOFT) + 'px, #000 ' + r + 'px)';   // ★ まん中が穴（すけている）、まわりが幕
      ov.style.webkitMaskImage = m;
      ov.style.maskImage = m;
      if (t < CLOSE + SHOW) {                                 // ★ 3体と文字が、順番にぽんっと出る（閉じきる少し前から）
        const ts = t - CLOSE + 150;
        chs.forEach((w, i) => set(w, pop((ts - i * 90) / 300)));
        const u = ease(Math.max(0, Math.min(1, (ts - 300) / 600)));   // ★ 文字：3体のあとから、0.6秒かけて出る（0〜1）
        float(tx, u, (1 - u) * 16);                           // ★ 16px 下から、ふわっと浮かぶ
      } else {                                                // ★ 開くときは、小さくなって消える
        const a = 1 - ease(Math.min(1, (t - CLOSE - SHOW) / OPEN * 1.6));
        chs.forEach(w => set(w, a));
        float(tx, a, 0);                                      // ★ 文字は、うすくなって消える
      }
      requestAnimationFrame(step);                            // ★ 次のコマへ
    };
    step();
  }

  // 【スタッフ画面】学園祭の展示用。ランキングを1件ずつ消せる（ふざけた名前が入ったとき用）
  //  ・上に曲のタブ、下にその曲のランキング10件。行の「×」で、確認してから1件消す（Ranking.remove）
  //  ・「ぜんぶ消す」で全曲の記録を消す（今までのリセットと同じ）
  //  ・「とじる」か Esc でタイトルに戻る。3分操作がなければ自動で閉じる
  const SBTN = 'font:inherit;font-weight:800;border-radius:20px;cursor:pointer;';   // ★ スタッフ画面のボタンの共通の見た目
  function openStaff() {
    if (staff) return;                                        // ★ もう開いていれば何もしない
    idleAt = Date.now();                                      // ★ 開いた時から3分を数える
    staff = document.createElement('div');                    // ★ 画面全体をおおう幕（うしろのボタンを押せないようにする）
    staff.style.cssText = 'position:absolute;inset:0;z-index:15;display:grid;place-items:center;background:rgba(70,40,110,.45)';
    staff.innerHTML =
      '<div style="width:780px;height:560px;box-sizing:border-box;padding:18px 24px;border-radius:24px;border:3px solid #ffb3da;background:#fff;display:flex;flex-direction:column;gap:10px;color:#4a2a6a">' +
        '<div style="font-size:22px;font-weight:800;color:#ff4fa3">スタッフ用：ランキングの管理</div>' +
        '<div data-tabs style="display:flex;gap:6px;justify-content:center"></div>' +
        '<div data-list style="flex:1;display:flex;flex-direction:column;gap:3px;text-align:left"></div>' +
        '<div style="display:flex;justify-content:space-between">' +
          '<button data-all style="' + SBTN + 'padding:8px 18px;color:#d0306f;border:2px solid #ff8fb8;background:#fff">ぜんぶ消す</button>' +
          '<button data-close style="' + SBTN + 'padding:8px 28px;color:#fff;border:2px solid #fff;background:linear-gradient(135deg,#ff7aa8,#c7a6ff)">とじる [Esc]</button>' +
        '</div>' +
      '</div>';
    staff.addEventListener('click', staffClick);              // ★ 中のボタンのクリックは、ここでまとめて受け取る
    $('stage').appendChild(staff);
    renderStaff();
  }

  // ★ スタッフ画面の中身（タブとランキング）を作り直す
  function renderStaff() {
    const tabs = staff.querySelector('[data-tabs]');
    tabs.innerHTML = '';
    ORDER.forEach(k => {                                      // ★ 曲のタブ（難易度順）
      const b = document.createElement('button');
      b.dataset.song = k;                                     // ★ 曲の番号
      b.textContent = SONGS[k].name;                          // ★ textContent で入れる（HTMLとして解釈させない）
      const on = k === staffK;                                // ★ 選んでいる曲なら、色をぬる
      b.style.cssText = SBTN + 'padding:6px 10px;font-size:14px;border:2px solid ' + SONGS[k].col + ';' +
        (on ? 'color:#fff;background:' + SONGS[k].col : 'color:' + SONGS[k].col + ';background:#fff');
      tabs.appendChild(b);
    });
    const list = staff.querySelector('[data-list]');
    list.innerHTML = '';
    const recs = Ranking.top10(staffK);                       // ★ 選んでいる曲の上位10件
    if (recs.length === 0) {
      list.innerHTML = '<div style="margin:auto;color:#a08cbf">きろくは ありません</div>';
      return;
    }
    recs.forEach((e, i) => {                                  // ★ 1件ずつ「順位　名前　点数　防衛率　×」の行を作る
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:56px 1fr 120px 70px 44px;align-items:center;padding:1px 10px;border-radius:10px;background:' + (i % 2 ? '#fff' : '#fff2fa');
      const no = document.createElement('b');
      no.textContent = (i + 1) + '位';
      const nm = document.createElement('span');
      nm.textContent = e.n;                                   // ★ 名前は textContent で（ふざけた名前でも、HTMLとして解釈させない）
      const sc = document.createElement('span');
      sc.textContent = e.s.toLocaleString() + '点';
      sc.style.textAlign = 'right';
      const rt = document.createElement('span');
      rt.textContent = e.r + '%';
      rt.style.textAlign = 'right';
      const x = document.createElement('button');             // ★ 「×」ボタン。押すと、この記録を消す
      x.dataset.at = e.at;                                    // ★ どの記録かは、登録時刻で見分ける
      x.textContent = '×';
      x.setAttribute('aria-label', e.n + ' を消す');
      x.style.cssText = SBTN + 'justify-self:end;width:28px;height:28px;padding:0;font-size:18px;line-height:1;color:#d0306f;border:2px solid #ff8fb8;background:#fff';
      row.append(no, nm, sc, rt, x);
      list.appendChild(row);
    });
  }

  // ★ スタッフ画面の中のクリック
  function staffClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    b.blur();                                                 // ★ フォーカスを外す（このあと Space などで、もう一度押されないように）
    if (b.dataset.song !== undefined) {                       // ★ 曲のタブ
      staffK = +b.dataset.song;
      renderStaff();
    } else if (b.dataset.at !== undefined) {                  // ★ 「×」
      const at = +b.dataset.at;
      const e = Ranking.top10(staffK).find(x => x.at === at);
      if (e && confirm('「' + e.n + '」（' + SONGS[staffK].name + '・' + e.s.toLocaleString() + '点）を消します。よろしいですか？')) {
        Ranking.remove(staffK, at);                           // ★ 1件消す（ranking.js）
      }
      renderStaff();
    } else if (b.hasAttribute('data-all')) {                  // ★ 「ぜんぶ消す」
      if (confirm('ランキングを全部消します。よろしいですか？')) {   // ★ 今までのリセットと同じ確認
        Ranking.reset();                                      // ★ 全曲の記録を消す（ranking.js）
      }
      renderStaff();
    } else if (b.hasAttribute('data-close')) {                // ★ 「とじる」
      closeStaff();
    }
    idleAt = Date.now();                                      // ★ 確認ダイアログを見ていた時間も、操作として数え直す
  }

  // ★ スタッフ画面を閉じて、タイトル画面に戻る
  function closeStaff() {
    if (!staff) return;
    staff.remove();
    staff = null;
    renderToday();                                            // ★ 本日のトップ3を読み直す（消した記録を反映）
  }

  // ★ 0.25秒ごとに、残り時間を見る
  setInterval(() => {
    if (staff) {                                              // ★ 【スタッフ画面】開いている間は、3分操作がなければ自動で閉じる
      cd.style.display = 'none';
      if (Date.now() - idleAt >= STAFF_SEC * 1000) closeStaff();
      return;
    }
    if (state === 'title' || playing || fading) {             // ★ タイトル画面と、遊んでいる最中と、ふわっと切りかえている最中は数えない
      cd.style.display = 'none';
      return;
    }
    const left = IDLE_SEC - (Date.now() - idleAt) / 1000;     // ★ 残りの秒数
    if (left <= 0) {
      cd.style.display = 'none';
      idleHome();
    } else if (left <= WARN_SEC) {
      cd.textContent = 'あと ' + Math.ceil(left) + ' びょうで タイトルへ';   // ★ 例：あと 10 びょうで タイトルへ（長いと、セレクト画面の下の案内と重なる）
      cd.style.display = '';
    } else {
      cd.style.display = 'none';
    }
  }, 250);

  // 【ゲームの終わり】game.js が結果を渡してくるので、リザルト画面を出す（仕様書 10.2）
  Game.onFinish = showResult;

  // 【はじめに1回だけ】
  buildCards();
  show('title');

  return { show };                                            // ★ 外に出すのは show だけ（仕様書 10.1）
})();
