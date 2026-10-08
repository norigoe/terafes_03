/* ============================================================
   view.js（中山）
   プレイ画面の部品 View：レーン、ウイルス、HUD、ヒット演出（仕様書 3.4）。
   まだ空。サンプルの lx / mkVirus / buildLanes / setHud / say / burst が出発点。
   ・ウイルスの見た目は、タイトル画面と同じキャラ（chara.css）を使う。mkVirus は次の形を作る：
       <div class="v"><div class="ch">（chara.css の先頭にある、3種類のHTML）</div></div>
     ジングルベルのときは、フィッシングを class="fc c1 santa" にする（サンタの帽子）。
     .v は大きさ0の点。位置は .v の transform:translate() で動かす（大きさは style.css の .v .ch の --s）。
   ============================================================ */
