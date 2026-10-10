/* ============================================================
   screens.js（松井）　画面の切り替え、キー入力の振り分け、曲カード、本日のトップ（仕様書 2.2）
   ------------------------------------------------------------
   ・いまできていること：画面の拡大縮小、背景の演出、画面の切り替え（Screens.show）、
     画面ごとのキー入力の振り分け（仕様書 4章）、ボタン、曲カード（SONGS から作る）、本日のトップ、ランキングのリセット。
   ・このあと足すもの：リザルトの表示（認定証・ランキング・名前の入力）。
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
  d.style.cssText = 'left:' + (i * 41 % W) + 'px;animation-duration:' + (8 + i % 5 * 3) + 's;animation-delay:-' + (i * 1.7) + 's';
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
  let state = 'title';                                        // ★ いま表示している画面
  let sel = 0;                                                // ★ セレクト画面で選択中の曲の番号
  let last = 0;                                               // ★ 最後に遊んだ曲の番号（リザルトの「もういちどあそぶ」で使う）

  // 【画面を切り替える】name の画面だけに class="on" を付ける（表示する画面は常に1つ）
  function show(name) {
    NAMES.forEach(id => $(id).classList.toggle('on', id === name));   // ★ 一致した画面だけ on、ほかは外す
    state = name;                                             // ★ キー入力の振り分けに使う
    if (name === 'title') renderToday();                      // ★ タイトル画面を出すたびに、本日のトップを読み直す（仕様書 8.3）
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();                          // ★ 押したボタンのフォーカスを外す（Enter でボタンが二重に押されるのを防ぐ）
    }
  }

  // 【本日のトップ】曲ごとに「曲名：スコア点」を横に並べる。今日の記録がない曲は「--」（仕様書 3.2、8.3）
  function renderToday() {
    const tr = document.querySelector('#today .tr');          // ★ 「★ 本日のトップ ★」の下の行
    tr.innerHTML = '';                                        // ★ 前の表示（モックの見本の数字）を消す
    SONGS.forEach((s, k) => {                                 // ★ 曲の数だけくり返す（k は曲の番号）
      const e = Ranking.todayTop(k);                          // ★ その曲の、今日のいちばん高い記録（なければ null）
      const span = document.createElement('span');            // ★ 1曲分の入れ物
      const em = document.createElement('em');                // ★ 点数の部分（太字）
      span.textContent = s.name + '：';                       // ★ textContent で入れる（HTMLとして解釈させない）
      em.textContent = e ? e.s.toLocaleString() + '点' : '--';   // ★ 12340 → '12,340点'。記録がなければ '--'
      span.appendChild(em);
      tr.appendChild(span);
    });
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

  // 【曲カードを作る】SONGS の曲の数だけ作る（仕様書 3.3）
  function buildCards() {
    $('cards').innerHTML = SONGS.map((s, i) =>                // ★ 曲1つ（s）から、カード1枚のHTMLを作り、join('') で全部つなげて #cards に入れる
      '<div class="card" data-i="' + i + '">' +
        '<div class="scn"><b style="background:' + s.col + '">' + (i + 1) + '</b>' + s.name + '</div>' +                // ★ 番号と曲名
        '<div class="slot">' + charaHTML(s.chara, s.santa) + '</div>' +                                                  // ★ キャラ
        '<div class="srow"><span class="sstar" style="color:' + s.col + '">' + '★'.repeat(s.star) + '☆'.repeat(5 - s.star) + '</span>' +
          '<span class="slb" style="background:' + s.col + '">' + s.label + '</span></div>' +                           // ★ 星と難易度ラベル
        '<div class="sinfo">' + s.lanes + 'レーン／約' + songSec(s) + '秒</div>' +                                       // ★ レーン数と長さ
        '<div class="skey">キー：' + (s.lanes === 2 ? 'F J' : 'D F J K') + '</div>' +                                    // ★ 使うキー
      '</div>'
    ).join('');
    // ★ キー案内の数字も、曲の数に合わせる（曲を足したとき 1〜4 になる）
    document.querySelector('#select .hint').innerHTML =
      '← → で選んで Enter ／ <kbd>1</kbd>〜<kbd>' + SONGS.length + '</kbd>キーですぐスタート（Esc：タイトルへ）';
    pick(0);                                                  // ★ はじめは1曲目を選択中にする
  }

  // 【曲カードを選ぶ】i 番目のカードだけ青い枠にする（仕様書 3.3）
  function pick(i) {
    sel = i;
    document.querySelectorAll('#cards .card').forEach((c, k) => c.classList.toggle('on', k === i));
  }

  // 【キー入力の振り分け】画面ごとにキーの意味を変える（仕様書 4章）
  addEventListener('keydown', e => {
    if (e.repeat) return;                                     // ★ 押しっぱなし（リピート）は無視する
    const c = e.code;                                         // ★ キーの名前（Enter、KeyF、Digit1 など）
    const num = /^Digit([1-9])$/.exec(c);                     // ★ 上段の数字キーなら、その数字（テンキー Numpad は入れない）
    const n = SONGS.length;                                   // ★ 曲の数

    if (state === 'title') {
      if (c === 'Enter') { e.preventDefault(); show('select'); }

    } else if (state === 'select') {
      if (c === 'ArrowRight' || c === 'ArrowDown') pick((sel + 1) % n);          // ★ 次の曲（右端なら左端へ回り込む）
      else if (c === 'ArrowLeft' || c === 'ArrowUp') pick((sel + n - 1) % n);    // ★ 前の曲（左端なら右端へ）
      else if (c === 'Enter') { e.preventDefault(); start(sel); }                // ★ 選択中の曲を開始
      else if (num && +num[1] <= n) start(+num[1] - 1);                          // ★ 数字キー 1〜（曲の数）ですぐ開始
      else if (c === 'Escape') show('title');

    } else if (state === 'play') {
      if (c === 'Escape') { Game.stop(); show('select'); }    // ★ 中断（結果は残らない。仕様書 3.1）
      else Game.key(c);                                       // ★ それ以外のキーは game.js に渡す（レーンのキーかどうかは game.js が決める）

    } else if (state === 'result') {
      if (c === 'Enter') { e.preventDefault(); start(last); } // ★ もういちどあそぶ（同じ曲）
      else if (c === 'Escape') show('select');                // ★ きょくをえらぶ
    }
  });

  // 【ボタンとカードのクリック】
  $('go').onclick = () => show('select');                     // ★ タイトル：あそぶ
  $('sback').onclick = () => show('title');                   // ★ セレクト：← タイトルへ
  $('again').onclick = () => start(last);                     // ★ リザルト：もういちどあそぶ
  $('home').onclick = () => show('select');                   // ★ リザルト：きょくをえらぶ
  $('rback').onclick = () => show('title');                   // ★ リザルト：← タイトルへ
  $('rst').onclick = () => {                                  // ★ タイトル：ランキングをリセット（スタッフ用。仕様書 3.2）
    if (confirm('ランキングを全部消します。よろしいですか？')) {   // ★ 確認ダイアログで「OK」を押したときだけ
      Ranking.reset();                                        // ★ 全曲の記録を消す（ranking.js）
      renderToday();                                          // ★ 本日のトップを「--」に戻す
    }
    $('rst').blur();                                          // ★ フォーカスを外す（このあと Enter を押したとき、もう一度押されないように）
  };

  // ★ カードは #cards にまとめて登録する（あとでカードを SONGS から作り直しても、登録しなおさなくてよい）
  $('cards').addEventListener('click', e => {
    const card = e.target.closest('.card');                   // ★ クリックした場所を含むカード
    if (card) start(+card.dataset.i);                         // ★ data-i が曲の番号
  });
  $('cards').addEventListener('mouseover', e => {
    const card = e.target.closest('.card');
    if (card) pick(+card.dataset.i);                          // ★ マウスを乗せたカードを選択中にする
  });

  // 【ゲームの終わり】いまはリザルト画面に切り替えるだけ（認定証・ランキングの表示は、このあと足す。仕様書 10.2）
  Game.onFinish = result => {
    last = result.k;
    show('result');
  };

  // 【はじめに1回だけ】
  buildCards();
  show('title');

  return { show };                                            // ★ 外に出すのは show だけ（仕様書 10.1）
})();

// ------------------------------------------------------------
// 【仮】モックアップ確認用：ボタンで画面を切り替える（本番では削除する）
//  ・Screens.show を使うので、キー入力の振り分けも、切り替えた画面に合わせて変わる。
// ------------------------------------------------------------
document.querySelectorAll('#mockbar button').forEach(b => {
  b.onclick = () => Screens.show(b.dataset.go);
});
