// Faithful port of minigameMarket.js M.tick (v2.058), no Supreme Intellect aura.
const choose = a => a[Math.floor(Math.random() * a.length)];
export function makeMarket(n, bankLevel) {
  const rest = id => 10 + 10 * id + (bankLevel - 1);
  const goods = [];
  for (let id = 0; id < n; id++) goods.push({ id, val: rest(id), d: Math.random() * 0.2 - 0.1, mode: choose([0,1,1,2,2,3,4,5]), dur: Math.floor(10 + Math.random() * 690) });
  function tick() {
    let globD = 0; const globP = Math.random();
    if (Math.random() < 0.1) globD = (Math.random() - 0.5) * 2;
    for (const me of goods) {
      me.d *= 0.97;
      if (me.mode == 0) { me.d *= 0.95; me.d += 0.05 * (Math.random() - 0.5); }
      else if (me.mode == 1) { me.d *= 0.99; me.d += 0.05 * (Math.random() - 0.1); }
      else if (me.mode == 2) { me.d *= 0.99; me.d -= 0.05 * (Math.random() - 0.1); }
      else if (me.mode == 3) { me.d += 0.15 * (Math.random() - 0.1); me.val += Math.random() * 5; }
      else if (me.mode == 4) { me.d -= 0.15 * (Math.random() - 0.1); me.val -= Math.random() * 5; }
      else if (me.mode == 5) me.d += 0.3 * (Math.random() - 0.5);
      me.val += (rest(me.id) - me.val) * 0.01;
      if (globD != 0 && Math.random() < globP) { me.val -= (1 + me.d * Math.pow(Math.random(), 3) * 7) * globD; me.val -= globD * (1 + Math.pow(Math.random(), 3) * 7); me.d += globD * (1 + Math.random() * 4); me.dur = 0; }
      me.val += Math.pow((Math.random() - 0.5) * 2, 11) * 3;
      me.d += 0.1 * (Math.random() - 0.5);
      if (Math.random() < 0.15) me.val += (Math.random() - 0.5) * 3;
      if (Math.random() < 0.03) me.val += (Math.random() - 0.5) * 10;
      if (Math.random() < 0.1) me.d += (Math.random() - 0.5) * 0.3;
      if (me.mode == 5) { if (Math.random() < 0.5) me.val += (Math.random() - 0.5) * 10; if (Math.random() < 0.2) me.d = (Math.random() - 0.5) * 2; }
      if (me.mode == 3 && Math.random() < 0.3) { me.d += (Math.random() - 0.5) * 0.1; me.val += (Math.random() - 0.7) * 10; }
      if (me.mode == 3 && Math.random() < 0.03) me.mode = 4;
      if (me.mode == 4 && Math.random() < 0.3) { me.d += (Math.random() - 0.5) * 0.1; me.val += (Math.random() - 0.3) * 10; }
      if (me.val > (100 + (bankLevel - 1) * 3) && me.d > 0) me.d *= 0.9;
      me.val += me.d;
      if (me.val < 5) me.val += (5 - me.val) * 0.5;
      if (me.val < 5 && me.d < 0) me.d *= 0.95;
      me.val = Math.max(me.val, 1);
      me.dur--;
      if (me.dur <= 0) { me.dur = Math.floor(10 + Math.random() * 690); if (Math.random() < 0.7 && (me.mode == 3 || me.mode == 4)) me.mode = 5; else me.mode = choose([0,1,1,2,2,3,4,5]); }
    }
  }
  return { goods, tick, rest };
}
