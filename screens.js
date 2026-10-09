/* ============================================================
   screens.js（松井）　画面の切り替え、キー入力の振り分け、曲カード、本日のトップ（仕様書 2.2）
   ------------------------------------------------------------
   ・いまできていること：画面の拡大縮小、背景の演出、画面の切り替え（Screens.show）、
     画面ごとのキー入力の振り分け（仕様書 4章）、ボタン、曲カードの選択。
   ・このあと足すもの：曲カードを SONGS から作る、本日のトップ、ランキング、リザルトの表示。
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
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();                          // ★ 押したボタンのフォーカスを外す（Enter でボタンが二重に押されるのを防ぐ）
    }
  }

  // 【曲を始める】曲の番号を覚えてから、game.js に渡す。プレイ画面への切り替えは game.js がする（仕様書 10.1）
  function start(k) {
    last = k;                                                 // ★ リザルトの「もういちどあそぶ」用
    Game.start(k);                                            // ★ game.js が準備して、Screens.show('play') を呼ぶ
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
  pick(0);
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
