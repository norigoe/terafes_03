/* ============================================================
   view.js（中山）
   プレイ画面の部品 View：レーン、ウイルス、HUD、判定表示、ヒット演出（仕様書 3.4、6章）。
   ・View は「画面に出す・書きかえる」だけを受け持つ。点数やミスの計算は game.js がする。
   ・ウイルスの見た目は、タイトル画面と同じキャラ（chara.css の先頭にある、3種類のHTML）を使う。
       <div class="v"><div class="ch">…</div></div>
     .v は大きさ0の点。位置は .v の transform:translate() で動かす（大きさは style.css の .v .ch の --s）。
     ジングルベルのときは、フィッシングを class="fc c1 santa" にする（サンタの帽子）。
   ・名前の衝突をさけるため、数字や色は View の中に入れて、外に名前を増やさない
     （screens.js に const W があるので、ここで W を作るとエラーになる。仕様書 2.2）。
   ============================================================ */

const View = {                                                // ★ View という1つの入れ物（オブジェクト）に、部品の関数をまとめる

  // 【数字と色】仕様書 3.4
  STAGE_W: 1067,                                              // ★ 舞台（画面）の横幅 1067px
  HY: 500,                                                    // ★ 判定ライン・判定リングの高さ（y=500）。game.js もウイルスの位置の計算に使う
  LANE_W: 110,                                                // ★ レーン1本の幅 110px
  COLORS: ['#ff8fc7', '#4fd8ff', '#9ff2d0', '#ffe66b'],       // ★ レーンの色（左から ピンク・水色・ミント・黄）

  // 【キャラのHTML】ty＝種類（0：ランサム、1：フィッシング、2：DDoS）、santa＝true ならサンタの帽子（仕様書 6章）
  chara(ty, santa) {
    const html = [                                            // ★ 3種類のHTMLを配列に入れておき、ty 番目を取り出す
      '<div class="ch"><i class="stars"></i><div class="fc c0"><i class="lk"></i><i class="e"></i><i class="e r"></i><i class="bl"></i><i class="bl r"></i><i class="m"></i></div></div>',   // ★ 0：ランサムちゃん（星のトゲ・南京錠）
      '<div class="ch"><div class="fc c1' + (santa ? ' santa' : '') + '"><i class="hk"></i><i class="cr"></i><i class="br"></i><i class="e"></i><i class="e r"></i><i class="bl"></i><i class="bl r"></i><i class="m"></i></div></div>',   // ★ 1：フィッシング（santa のときだけ class に santa を足す）
      '<div class="ch"><div class="fc c2"><i class="an"></i><i class="an r"></i><i class="xx">&gt;_&lt;</i><i class="bl"></i><i class="bl r"></i></div></div>',   // ★ 2：DDoS（触角と >_< の顔）
    ];
    return html[ty];                                          // ★ 選んだ1つを返す
  },

  // 【レーン l の真ん中の x】n＝レーン数。レーンは画面の真ん中にそろえて並べる
  lx(n, l) {
    const left = (this.STAGE_W - n * this.LANE_W) / 2;        // ★ いちばん左のレーンの左はし（例：2レーンなら (1067-220)÷2＝423.5）
    return left + l * this.LANE_W + this.LANE_W / 2;          // ★ l 本目の左はし ＋ 幅の半分 ＝ 真ん中
  },

  // 【プレイ画面を作る】レーン・判定ライン・判定リング・キー札を作り、前のプレイの表示を消す（仕様書 3.4）
  build(song) {
    const n = song.lanes;                                     // ★ レーン数（きらきら星は 2）
    const left = (this.STAGE_W - n * this.LANE_W) / 2;        // ★ いちばん左のレーンの左はし
    const keys = n === 2 ? ['F', 'J'] : ['D', 'F', 'J', 'K']; // ★ キー札の文字（2レーンは F J、4レーンは D F J K。仕様書 4章）
    let h = '<div class="jl" style="left:' + left + 'px;width:' + n * this.LANE_W + 'px"></div>';   // ★ 判定ライン（ピンクの横線）をレーン全体の幅で
    for (let l = 0; l < n; l++) {                             // ★ レーンの数だけくり返す
      const x = left + l * this.LANE_W;                       // ★ このレーンの左はし
      h += '<div class="lane" style="left:' + x + 'px"></div>';                                        // ★ レーン（半透明の白い帯）
      h += '<div class="rc" id="rc' + l + '" style="left:' + (x + 15) + 'px;--c:' + this.COLORS[l] + '"></div>';   // ★ 判定リング（幅80なので 15 ずらすと真ん中）。id は rc0, rc1 …
      h += '<div class="kl" style="left:' + (x + 27) + 'px">' + keys[l] + '</div>';                   // ★ キー札（幅56なので 27 ずらすと真ん中）
    }
    $('lanes').innerHTML = h;                                 // ★ できたHTMLを #lanes に入れる（前のプレイのレーンは消える）
    $('field').innerHTML = '';                                // ★ ウイルスの置き場を空にする
    $('sn').textContent = song.name;                          // ★ 左上の札に曲名
    $('jd').textContent = '';                                 // ★ 判定表示を空にする
    $('jd').className = '';                                   // ★ アニメーション用のクラス（pop）も外す
    $('jd').removeAttribute('style');                         // ★ 前のプレイで say が付けた色（style）を取る
    $('rd').textContent = '';                                 // ★ 開始表示を空にする
  },

  // 【ウイルスを1体作る】#field に入れて、その要素を返す（game.js が位置を動かすのに使う）
  mkVirus(ty, santa) {
    const v = document.createElement('div');                  // ★ 新しい div を作る
    v.className = 'v';                                        // ★ class="v"（大きさ0の点。style.css）
    v.innerHTML = this.chara(ty, santa);                      // ★ 中にキャラのHTMLを入れる
    $('field').appendChild(v);                                // ★ 画面（#field）に足す
    return v;                                                 // ★ 作った要素を返す
  },

  // 【動かす】要素 el を (x, y) の位置へ。transform で動かすと軽い（仕様書 9章）
  move(el, x, y) {
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';   // ★ 例：translate(478.5px,330px)
  },

  // 【スコア・コンボ・HP】S＝ゲームの状態。点数などが変わったときだけ呼ぶ
  setHud(S) {
    $('sc').textContent = S.score.toLocaleString();           // ★ スコア。toLocaleString で 12340 → 12,340（3けたごとにカンマ）
    $('cb').textContent = S.combo > 1 ? S.combo + ' COMBO' : '';   // ★ 2コンボ以上のときだけ「◯ COMBO」（仕様書 3.4）
    const hp = Math.max(S.hp, 0);                             // ★ HP（マイナスにはしない）
    $('hp').innerHTML = '<i>♥</i>'.repeat(hp) + '<i class="off">♥</i>'.repeat(10 - hp);   // ★ 残りのハート＋減ったハート（薄い色）で、いつも10個
  },

  // 【のこり時間と進行バー】left＝のこりの秒数、rate＝曲の進み具合（0〜1）
  setTime(left, rate) {
    const s = Math.max(0, Math.ceil(left));                   // ★ 秒を切り上げて整数に（0より小さくしない）
    const mm = Math.floor(s / 60);                            // ★ 分
    const ss = String(s % 60).padStart(2, '0');               // ★ 秒（2けたにそろえる。5 → '05'）
    $('tm').textContent = 'のこり ' + mm + ':' + ss;          // ★ 例：のこり 0:22
    const p = Math.min(100, Math.max(0, rate * 100));         // ★ 0〜100% の間におさめる
    $('bi').style.width = p + '%';                            // ★ バーの中身の長さ
  },

  // 【開始表示】tx を画面の真ん中に出す。'' を渡すと消える（出す言葉は game.js が決める）
  ready(tx) {
    $('rd').textContent = tx;                                 // ★ 例：View.ready('じゅんびしてね…')、View.ready('')
  },

  // 【判定表示】tx＝文字（大優勝！など）、c＝色。0.6秒で上に消える（仕様書 3.4、5.3）
  say(tx, c) {
    const j = $('jd');                                        // ★ 判定表示の要素
    j.textContent = tx;                                       // ★ 文字を入れる
    j.style.color = c;                                        // ★ 色を変える
    j.classList.remove('pop');                                // ★ いったんアニメーションのクラスを外す
    void j.offsetWidth;                                       // ★ 外したことをブラウザに確定させる（これがないと、続けて叩いたときにアニメーションが最初から動かない）
    j.classList.add('pop');                                   // ★ もう一度付けると、アニメーションが最初から動く
  },

  // 【判定リングを光らせる】l＝レーン。押すと100ms、色で塗りつぶして大きくなる（仕様書 3.4）
  flash(l) {
    const r = $('rc' + l);                                    // ★ l 本目のリング（id="rc0" など）
    r.classList.add('f');                                     // ★ class="f" を付けると塗りつぶし（style.css の .rc.f）
    setTimeout(() => r.classList.remove('f'), 100);           // ★ 100ミリ秒後に元にもどす
  },

  // 【ヒット演出】x＝リングの真ん中。色付きの粒12個が0.5秒で四方に飛び散る（仕様書 3.4）
  burst(x) {
    for (let i = 0; i < 12; i++) {                            // ★ 12回くり返す
      const p = document.createElement('div');                // ★ 粒を1つ作る
      const a = Math.random() * Math.PI * 2;                  // ★ 飛ぶ向き（0〜360度をラジアンで）
      const d = 40 + Math.random() * 50;                      // ★ 飛ぶ距離（40〜90px）
      p.className = 'p';                                      // ★ class="p"（style.css の burst アニメーションで飛んで消える）
      p.style.left = (x - 5) + 'px';                          // ★ 粒の大きさが10px なので、5 ずらして真ん中に
      p.style.top = (this.HY - 5) + 'px';                     // ★ 高さは判定リングの位置
      p.style.setProperty('--c', this.COLORS[i % 4]);         // ★ 色（4色を順番に）
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');    // ★ 横に飛ぶ量（cos）
      p.style.setProperty('--dy', Math.sin(a) * d + 'px');    // ★ 縦に飛ぶ量（sin）
      p.onanimationend = () => p.remove();                    // ★ アニメーションが終わったら、粒を消す
      $('field').appendChild(p);                              // ★ 画面に足す
    }
  },

  // 【画面を揺らす】ミスしたときの演出。r＝揺れののこり時間（秒、0.25 → 0）。毎フレーム game.js の loop から呼ぶ
  //   keysound（中山の自分用アプリ）と同じ揺れ方：のこりが多いほど大きく、ランダムな向きにずらす（最初は横±5px・縦±3px）
  //   #lanes に transform を付けるとレーンの帯（top:0・bottom:0）の高さがつぶれるので、プレイ画面 #play ごと動かす
  shake(r) {
    const p = $('play');                                      // ★ プレイ画面
    if (r > 0) {                                              // ★ 揺れの時間がのこっていれば
      const x = (Math.random() - 0.5) * 40 * r;               // ★ 横のずれ（-0.5〜0.5 × 40 × のこり。のこり 0.25秒なら ±5px）
      const y = (Math.random() - 0.5) * 24 * r;               // ★ 縦のずれ（のこり 0.25秒なら ±3px）
      p.style.transform = 'translate(' + x + 'px,' + y + 'px)';   // ★ ずらす
    } else {                                                  // ★ 揺れが終わったら
      p.style.transform = '';                                 // ★ 元の位置にもどす
    }
  },

  // 【ウイルスと粒を全部消す】ゲームの終わり・中断のとき
  clear() {
    $('field').innerHTML = '';                                // ★ #field の中を空にする
    this.shake(0);                                            // ★ 揺れの途中で終わっても、画面を元の位置にもどす
  },
};
