// 物件名と号室の切り分け（画面とGASで同じルール。gas/Code.gs の splitPropertyRoom_ と中身を揃える。tests/room-split.cjs で照合）
// names（空室一覧の物件名）があれば、その名前で始まる所で分ける。無ければ末尾の形（402／Ｂ１０２／１０２Ａ／1A／A-3／402号室）で分ける
function splitPropertyRoom(text, names) {
  const s = String(text || '').trim();
  const nz = v => String(v || '').normalize('NFKC').replace(/[\s・･]/g, '').toLowerCase();
  const tail = v => v.replace(/^[\s・･\-－‐]+/, '').replace(/(?:号室|号)$/, '').trim();
  if (names && names.length) {
    const set = {}; names.forEach(n => { const k = nz(n); if (k) set[k] = true; });
    for (let i = s.length; i > 0; i--) {
      if (!set[nz(s.slice(0, i))]) continue;
      const room = tail(s.slice(i));
      if (/^[0-9０-９A-Za-zＡ-Ｚａ-ｚ\-－‐]{0,6}$/.test(room)) return {prop: s.slice(0, i).trim(), room: room};
    }
  }
  // 英字が英単語の途中（ABE103 の E）なら号室に含めない。ローマ数字（Ⅰ・Ⅱ）は物件名の一部
  const m = s.match(/^(.*?)[\s・･\-－‐]*([0-9０-９]{2,4}[A-Za-zＡ-Ｚａ-ｚ]?|[0-9０-９][A-Za-zＡ-Ｚａ-ｚ]|(?<![A-Za-zＡ-Ｚａ-ｚ])[A-Za-zＡ-Ｚａ-ｚ][\-－‐]?[0-9０-９]{1,3})(?:号室|号)?$/);
  return m && m[1] ? {prop: m[1].trim(), room: m[2]} : {prop: s, room: ''};
}
if (typeof window !== 'undefined') window.splitPropertyRoom = splitPropertyRoom;
