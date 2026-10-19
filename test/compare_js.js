const E = require(process.argv[4]); const eng = E(); const fs = require('fs');
const scen = +process.argv[2], sr = +process.argv[3];
const s = new eng.Synth(sr);
const ph = [{on:['HH'],v:'EH',off:[]},{on:['L'],v:'OW',off:[]},{on:['M'],v:'UW',off:['N']},{on:['S'],v:'IH',off:['NG']},{on:['T'],v:'AY',off:['M']},{on:['K'],v:'AA',off:['T','S']},{on:['CH'],v:'ER',off:[]}];
let ev = [];
if (scen === 0) ev = [[0,'on',57,0.8,0],[0.6,'on',64,0.6,0],[1.2,'off',57,0,0],[1.5,'off',64,0,0]];
if (scen === 1) { s.setParam('phOn',1); s.setParam('mono',1); s.setPhrase(ph); ev = [[0.02,'on',57,0.8,0],[3.0,'off',57,0,0]]; }
if (scen === 2) { s.setParam('phOn',1); s.setParam('mpe',1); s.setPhrase(ph); s.setMod('lfo1','pitch',0.02); s.setMod('env2','y',-0.6); s.setMod('press','lips',0.5); s.setMod('lfo2','x',0.3);
  ev = [[0,'on',57,0.8,1],[0.01,'on',61,0.8,2],[0.012,'on',64,0.8,3]];
  for (let i=0;i<40;i++){ ev.push([0.1+i*0.03,'press',i/40,2,0]); ev.push([0.1+i*0.03,'bend',i/80,3,0]); }
  ev.push([1.8,'off',57,1,0],[1.8,'off',61,2,0],[1.8,'off',64,3,0]); }
if (scen === 3) { s.setParam('vel',0.8); s.setParam('room',0.5); s.setParam('l1sync',1); s.setMod('lfo1','length',0.3); s.setParam('mono',1); s.setParam('glide',200);
  ev = [[0,'on',50,0.9,0],[0.5,'on',62,0.9,0],[0.9,'off',62,0,0],[1.6,'off',50,0,0]]; }
const n = Math.floor(Math.floor(2.5*sr)/128)*128, L = new Float32Array(n), R = new Float32Array(n); let ei = 0;
for (let p=0;p<n;p+=128) {
  while (ei < ev.length && ev[ei][0]*sr <= p) { const e = ev[ei++];
    if (e[1]==='on') s.noteOn(e[2],e[3],e[4]); else if (e[1]==='off') s.noteOff(e[2],e[3]); else if (e[1]==='press') s.setPressure(e[2],e[3]); else if (e[1]==='bend') s.setBend(e[2],e[3]); }
  s.render(L.subarray(p,p+128), R.subarray(p,p+128), 128);
}
fs.writeFileSync(process.argv[5], Buffer.concat([Buffer.from(L.buffer), Buffer.from(R.buffer)]));
