/* Text -> sung syllables. English spelling rules + a small list of common irregular words.
 * Output syllables are {on:[consonants], v:vowel, off:[consonants], label} in ARPAbet. */
function LyricsFactory() {
  'use strict';
  const VOW = new Set(['AA', 'AE', 'AH', 'AX', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
  const CONS = new Set(['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH']);
  const DICT_SRC = `a:AX|about:AX B AW T|above:AX B AH V|across:AX K R AO S|after:AE F T ER|again:AX G EH N|against:AX G EH N S T|ago:AX G OW|air:EH R|all:AO L|alone:AX L OW N|along:AX L AO NG|always:AO L W EY Z|am:AE M|among:AX M AH NG|an:AE N|and:AE N D|angel:EY N JH AX L|another:AX N AH DH ER|answer:AE N S ER|any:EH N IY|are:AA R|around:AX R AW N D|as:AE Z|at:AE T|away:AX W EY|baby:B EY B IY|be:B IY|beautiful:B Y UW T IH F AX L|because:B IH K AH Z|been:B IH N|before:B IH F AO R|behind:B IH HH AY N D|believe:B IH L IY V|between:B IH T W IY N|blood:B L AH D|blue:B L UW|body:B AA D IY|bone:B OW N|both:B OW TH|bread:B R EH D|break:B R EY K|breath:B R EH TH|broken:B R OW K AX N|brother:B R AH DH ER|build:B IH L D|busy:B IH Z IY|but:B AH T|buy:B AY|by:B AY|child:CH AY L D|choir:K W AY ER|city:S IH T IY|climb:K L AY M|cold:K OW L D|color:K AH L ER|come:K AH M|coming:K AH M IH NG|could:K UH D|country:K AH N T R IY|dance:D AE N S|danger:D EY N JH ER|dead:D EH D|do:D UW|does:D AH Z|done:D AH N|door:D AO R|down:D AW N|dream:D R IY M|early:ER L IY|earth:ER TH|eat:IY T|echo:EH K OW|either:IY DH ER|else:EH L S|end:EH N D|enough:IH N AH F|even:IY V AX N|ever:EH V ER|every:EH V R IY|everything:EH V R IY TH IH NG|eye:AY|eyes:AY Z|father:F AA DH ER|find:F AY N D|fire:F AY ER|floor:F L AO R|flower:F L AW ER|for:F AO R|forever:F ER EH V ER|four:F AO R|friend:F R EH N D|from:F R AH M|ghost:G OW S T|give:G IH V|go:G OW|going:G OW IH NG|gold:G OW L D|gone:G AO N|good:G UH D|great:G R EY T|guess:G EH S|guy:G AY|had:HH AE D|has:HH AE Z|have:HH AE V|he:HH IY|head:HH EH D|hear:HH IH R|heart:HH AA R T|heaven:HH EH V AX N|her:HH ER|here:HH IH R|him:HH IH M|his:HH IH Z|hold:HH OW L D|home:HH OW M|hour:AW ER|how:HH AW|i:AY|if:IH F|in:IH N|into:IH N T UW|is:IH Z|island:AY L AX N D|it:IH T|its:IH T S|just:JH AH S T|kind:K AY N D|knew:N UW|know:N OW|laugh:L AE F|learn:L ER N|light:L AY T|like:L AY K|listen:L IH S AX N|little:L IH T AX L|live:L IH V|lonely:L OW N L IY|long:L AO NG|look:L UH K|love:L AH V|machine:M AX SH IY N|many:M EH N IY|me:M IY|mind:M AY N D|money:M AH N IY|moon:M UW N|more:M AO R|mother:M AH DH ER|move:M UW V|music:M Y UW Z IH K|my:M AY|never:N EH V ER|new:N UW|night:N AY T|no:N OW|none:N AH N|nothing:N AH TH IH NG|now:N AW|ocean:OW SH AX N|of:AH V|off:AO F|oh:OW|old:OW L D|on:AA N|once:W AH N S|one:W AH N|only:OW N L IY|onto:AA N T UW|open:OW P AX N|or:AO R|other:AH DH ER|our:AW ER|out:AW T|over:OW V ER|own:OW N|people:P IY P AX L|please:P L IY Z|pretty:P R IH T IY|pure:P Y UH R|put:P UH T|quiet:K W AY AX T|rain:R EY N|really:R IH L IY|rhythm:R IH DH AX M|river:R IH V ER|road:R OW D|said:S EH D|says:S EH Z|sea:S IY|see:S IY|she:SH IY|should:SH UH D|silent:S AY L AX N T|sing:S IH NG|singing:S IH NG IH NG|sky:S K AY|so:S OW|some:S AH M|someone:S AH M W AH N|something:S AH M TH IH NG|sometimes:S AH M T AY M Z|son:S AH N|song:S AO NG|soul:S OW L|strange:S T R EY N JH|sugar:SH UH G ER|sure:SH UH R|talk:T AO K|the:DH AX|their:DH EH R|them:DH EH M|then:DH EH N|there:DH EH R|these:DH IY Z|they:DH EY|thing:TH IH NG|think:TH IH NG K|this:DH IH S|those:DH OW Z|though:DH OW|thought:TH AO T|through:TH R UW|time:T AY M|to:T UW|today:T AX D EY|together:T AX G EH DH ER|tomorrow:T AX M AA R OW|tonight:T AX N AY T|too:T UW|touch:T AH CH|tough:T AH F|toward:T AO R D|true:T R UW|two:T UW|under:AH N D ER|until:AH N T IH L|up:AH P|us:AH S|very:V EH R IY|voice:V OY S|walk:W AO K|want:W AA N T|war:W AO R|warm:W AO R M|was:W AH Z|watch:W AA CH|water:W AO T ER|we:W IY|were:W ER|what:W AH T|when:W EH N|where:W EH R|which:W IH CH|while:W AY L|who:HH UW|whole:HH OW L|whose:HH UW Z|why:W AY|wild:W AY L D|wind:W IH N D|with:W IH DH|without:W IH TH AW T|woman:W UH M AX N|women:W IH M AX N|wonder:W AH N D ER|wood:W UH D|word:W ER D|work:W ER K|world:W ER L D|worse:W ER S|would:W UH D|yeah:Y EH|year:Y IH R|yes:Y EH S|yesterday:Y EH S T ER D EY|you:Y UW|young:Y AH NG|your:Y AO R|la:L AA|da:D AA|ooh:UW|ah:AA|mm:M AH M|hmm:HH AH M|hello:HH EH L OW`;
  const DICT = {};
  DICT_SRC.split('|').forEach((e) => { const i = e.indexOf(':'); DICT[e.slice(0, i)] = e.slice(i + 1).split(' '); });

  const UNV = new Set(['P', 'T', 'K', 'F', 'TH', 'S', 'SH', 'CH']);
  const isV = (c) => 'aeiou'.indexOf(c) >= 0;
  const LONG = { a: ['EY'], e: ['IY'], i: ['AY'], o: ['OW'], u: ['UW'], y: ['AY'] };
  const SHORT = { a: ['AE'], e: ['EH'], i: ['IH'], o: ['AA'], u: ['AH'], y: ['IH'] };
  const SIMPLE = { b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', z: 'Z', q: 'K' };
  // longest match first; each entry: [letters, phones, test(word, index) optional]
  const RULES = [
    ['tion', ['SH', 'AX', 'N']], ['sion', ['ZH', 'AX', 'N']], ['ture', ['CH', 'ER']], ['ough', ['OW']], ['augh', ['AO']],
    ['eigh', ['EY']], ['ight', ['AY', 'T']], ['tch', ['CH']], ['dge', ['JH']], ['igh', ['AY']], ['sch', ['S', 'K']],
    ['air', ['EH', 'R']], ['ear', ['IH', 'R']], ['eer', ['IH', 'R']], ['oor', ['AO', 'R']], ['our', ['AW', 'ER']],
    ['ous', ['AX', 'S']], ['all', ['AO', 'L']], ['are', ['EH', 'R'], (w, i) => i + 3 === w.length], ['ore', ['AO', 'R'], (w, i) => i + 3 === w.length],
    ['ire', ['AY', 'ER'], (w, i) => i + 3 === w.length], ['ure', ['Y', 'UH', 'R'], (w, i) => i + 3 === w.length],
    ['ch', ['CH']], ['sh', ['SH']], ['th', ['TH']], ['ph', ['F']], ['wh', ['W']], ['ck', ['K']], ['ng', ['NG']], ['nk', ['NG', 'K']],
    ['qu', ['K', 'W']], ['kn', ['N'], (w, i) => i === 0], ['wr', ['R'], (w, i) => i === 0], ['gh', ['G'], (w, i) => i === 0], ['gh', []],
    ['mb', ['M'], (w, i) => i + 2 === w.length],
    ['ee', ['IY']], ['ea', ['IY']], ['ai', ['EY']], ['ay', ['EY']], ['oa', ['OW']], ['oo', ['UW']], ['ou', ['AW']],
    ['ow', ['OW'], (w, i) => i + 2 === w.length], ['ow', ['AW']], ['oi', ['OY']], ['oy', ['OY']], ['au', ['AO']], ['aw', ['AO']],
    ['ew', ['UW']], ['ie', ['AY'], (w, i) => i + 2 === w.length], ['ie', ['IY']], ['ei', ['EY']], ['ue', ['UW']], ['ui', ['UW']],
    ['ar', ['AA', 'R']], ['or', ['AO', 'R']], ['er', ['ER']], ['ir', ['ER']], ['ur', ['ER']], ['yr', ['ER']],
    ['les', ['AX', 'L', 'Z'], (w, i) => i + 3 === w.length && i > 0 && !isV(w[i - 1])],
    ['le', ['AX', 'L'], (w, i) => i + 2 === w.length && i > 0 && !isV(w[i - 1])],
    ['es', ['AX', 'Z'], (w, i) => i + 2 === w.length && i > 1 && /(s|sh|ch|x|z|ce|ge)$/.test(w.slice(0, i))],
    ['ed', ['AX', 'D'], (w, i) => i + 2 === w.length && i > 1 && /[td]$/.test(w.slice(0, i))],
    ['ed', ['D'], (w, i) => i + 2 === w.length && i > 1]
  ];
  function rulesWord(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return [];
    const out = [];
    let magic = -1;
    const m = /([aeiouy])([^aeiouywx])e(s|d)?$/.exec(w);
    if (m && w.length > 2 && !/[aeiou]{2}/.test(w.slice(m.index - 1, m.index + 1))) magic = m.index;
    let i = 0;
    while (i < w.length) {
      if (i === magic) { out.push(...LONG[w[i]]); i++; continue; }
      if (magic >= 0 && i === w.length - 1 - (m[3] ? 1 : 0) && w[i] === 'e') { i++; continue; }
      let hit = false;
      for (const [pat, ph, test] of RULES) {
        if (w.startsWith(pat, i) && (!test || test(w, i))) { out.push(...ph); i += pat.length; hit = true; break; }
      }
      if (hit) continue;
      const c = w[i], nx = w[i + 1] || '';
      if (c === w[i + 1] && !isV(c)) { i++; continue; }                     // doubled consonant
      if (c === 'c') { out.push('eiy'.indexOf(nx) >= 0 && nx ? 'S' : 'K'); i++; continue; }
      if (c === 'g') { out.push('eiy'.indexOf(nx) >= 0 && nx && i > 0 ? 'JH' : 'G'); i++; continue; }
      if (c === 'x') { out.push('K', 'S'); i++; continue; }
      if (c === 's') { out.push(i === w.length - 1 && i > 0 && !UNV.has(out[out.length - 1]) ? 'Z' : 'S'); i++; continue; }
      if (c === 'y') {
        if (i === 0) out.push('Y');
        else if (i === w.length - 1) out.push(w.length <= 3 ? 'AY' : 'IY');
        else out.push(isV(nx) ? 'Y' : 'IH');
        i++; continue;
      }
      if (c === 'e' && i === w.length - 1) { if (!/[aeiouy]/.test(w.slice(0, i))) out.push('IY'); i++; continue; }
      if (isV(c) && /^[^aeiouy](tion|sion|ture|ia|io)/.test(w.slice(i + 1)) ) { out.push(...LONG[c]); i++; continue; }
      if (isV(c)) {
        const last = i === w.length - 1;
        if (last) out.push(...(c === 'o' ? ['OW'] : c === 'a' ? ['AX'] : c === 'i' ? (w.length <= 3 ? ['AY'] : ['IY']) : c === 'u' ? ['UW'] : SHORT[c]));
        else out.push(...SHORT[c]);
        i++; continue;
      }
      if (SIMPLE[c]) out.push(SIMPLE[c]);
      i++;
    }
    if (/[^e]ed$/.test(w) && out[out.length - 1] === 'D' && UNV.has(out[out.length - 2])) out[out.length - 1] = 'T';
    if (!out.some((p) => VOW.has(p))) out.push('AX');
    return out;
  }

  const ONSET2 = new Set(['P L', 'P R', 'B L', 'B R', 'T R', 'D R', 'K L', 'K R', 'G L', 'G R', 'F L', 'F R', 'TH R', 'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'T W', 'K W', 'D W', 'P Y', 'B Y', 'K Y', 'M Y', 'F Y', 'HH Y']);
  function syllabify(ph) {
    const vIdx = []; ph.forEach((p, i) => { if (VOW.has(p)) vIdx.push(i); });
    if (!vIdx.length) return [];
    const syl = vIdx.map((vi) => ({ on: [], v: ph[vi], off: [] }));
    for (let i = 0; i < vIdx[0]; i++) syl[0].on.push(ph[i]);
    for (let i = vIdx[vIdx.length - 1] + 1; i < ph.length; i++) syl[syl.length - 1].off.push(ph[i]);
    for (let k = 0; k < vIdx.length - 1; k++) {
      const cl = ph.slice(vIdx[k] + 1, vIdx[k + 1]);
      let nOn = Math.min(cl.length, 1);
      if (cl.length >= 2 && ONSET2.has(cl.slice(-2).join(' '))) nOn = 2;
      if (cl.length >= 3 && cl[cl.length - 3] === 'S' && ONSET2.has(cl.slice(-2).join(' '))) nOn = 3;
      if (cl.length === 1 && cl[0] === 'NG') nOn = 0;
      syl[k].off.push(...cl.slice(0, cl.length - nOn));
      syl[k + 1].on.push(...cl.slice(cl.length - nOn));
    }
    return syl;
  }
  const SAY = { AA: 'ah', AE: 'a', AH: 'uh', AX: 'uh', AO: 'aw', AW: 'ow', AY: 'eye', EH: 'e', ER: 'er', EY: 'ay', IH: 'i', IY: 'ee', OW: 'oh', OY: 'oy', UH: 'oo', UW: 'oo',
    B: 'b', CH: 'ch', D: 'd', DH: 'th', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ng', P: 'p', R: 'r', S: 's', SH: 'sh', T: 't', TH: 'th', V: 'v', W: 'w', Y: 'y', Z: 'z', ZH: 'zh' };
  const label = (s) => s.on.map((p) => SAY[p]).join('') + SAY[s.v] + s.off.map((p) => SAY[p]).join('');

  /* text -> {words:[{text, src, syl:[...]}], flat:[...]}
   * [respell] uses spelling rules only; {HH EH L OW} gives phonemes directly */
  function parse(text) {
    const words = [];
    const re = /\{([^}]*)\}|\[([^\]]*)\]|([A-Za-z][A-Za-z'\-]*)/g;
    let m;
    while ((m = re.exec(text || ''))) {
      let ph, src, shown;
      if (m[1] !== undefined) {
        ph = m[1].toUpperCase().split(/[\s,]+/).map((p) => p.replace(/[0-9]/g, '')).filter((p) => VOW.has(p) || CONS.has(p));
        src = 'phonemes'; shown = '{' + m[1].trim() + '}';
      } else if (m[2] !== undefined) {
        ph = []; for (const part of m[2].split(/\s+/)) if (part) ph.push(...rulesWord(part));
        src = 'respelled'; shown = '[' + m[2].trim() + ']';
      } else {
        const key = m[3].toLowerCase().replace(/-/g, '');
        const k2 = key.replace(/'s$/, '').replace(/'/g, '');
        if (DICT[key.replace(/'/g, '')]) { ph = DICT[key.replace(/'/g, '')].slice(); src = 'dictionary'; }
        else if (DICT[k2] && /'s$/.test(key)) { ph = DICT[k2].concat(['Z']); src = 'dictionary'; }
        else { ph = rulesWord(key); src = 'rules'; }
        shown = m[3];
      }
      const syl = syllabify(ph);
      syl.forEach((s) => { s.label = label(s); });
      if (syl.length) words.push({ text: shown, src, syl });
    }
    const flat = [];
    words.forEach((w, wi) => w.syl.forEach((s) => flat.push(Object.assign({ w: wi }, s))));
    return { words, flat };
  }
  return { parse, rulesWord, syllabify, DICT };
}
if (typeof module !== 'undefined') module.exports = LyricsFactory;
