function warm(w, r) { return { w: w, r: r, done: false, warmup: true } }
function reps(w, r) { return { w: w, r: r, done: false } }
function side(w, r) { return { done: false, sides: { L: { w: w, r: r, done: false }, R: { w: w, r: r, done: false } } } }
function ex(id, name, restSec, step, last, sets, extra) {
  var o = { id: id, name: name, mode: 'reps', restSec: restSec, step: step, last: last, sets: sets }
  if (extra) for (var k in extra) o[k] = extra[k]
  return o
}
function repSets(n, w, r) {
  var a = []
  for (var i = 0; i < n; i++) a.push(reps(w, r))
  return a
}
function sideSets(n, w, r) {
  var a = []
  for (var i = 0; i < n; i++) a.push(side(w, r))
  return a
}

export function defaultReady() {
  var push = [
    ex('0025', '杠铃卧推', 120, 2.5, '50 kg × 8', [warm(30, 10), warm(40, 8)].concat(repSets(3, 50, 8)), { best: { w: 50, r: 8 } }),
    ex('0314', '哑铃上斜卧推', 90, 2, '16 kg × 10', repSets(3, 16, 10)),
    ex('0290', '哑铃凳上坐姿推举', 90, 2, '12 kg × 10', repSets(3, 12, 10)),
    ex('0334', '哑铃侧平举', 60, 1, '7.5 kg × 12', repSets(3, 7.5, 12)),
    ex('0241', '绳索三头肌下压(V形把手)', 60, 2.5, '20 kg × 12', repSets(3, 20, 12))
  ]
  var pull = [
    ex('0150', '绳索杠高位下拉', 90, 2.5, '40 kg × 10', [warm(25, 10)].concat(repSets(4, 40, 10))),
    ex('0292', '哑铃单臂俯身划船', 90, 2, '16 kg × 10', sideSets(3, 16, 10), { perSide: true }),
    ex('0160', '绳索地板坐姿宽握划船', 90, 2.5, '35 kg × 10', repSets(3, 35, 10)),
    ex('0380', '哑铃后侧平举', 60, 1, '5 kg × 12', repSets(3, 5, 12)),
    ex('0294', '哑铃二头弯举', 60, 1, '10 kg × 12', repSets(3, 10, 12))
  ]
  var legs = [
    ex('0043', '杠铃全蹲', 120, 2.5, '60 kg × 8', [warm(40, 8), warm(50, 6)].concat(repSets(3, 60, 8))),
    ex('0085', '杠铃罗马尼亚硬拉', 90, 2.5, '50 kg × 10', [warm(30, 8)].concat(repSets(3, 50, 10))),
    ex('0585', '杠杆腿屈伸', 60, 2.5, '30 kg × 12', repSets(3, 30, 12)),
    ex('0586', '杠杆俯卧腿弯举', 60, 2.5, '25 kg × 12', repSets(3, 25, 12)),
    ex('3018', '站姿提踵', 60, 1, '15 次', repSets(3, 0, 15), { bodyweight: true })
  ]
  return {
    today: { routineIds: ['r-push'], name: '推日训练 (胸/肩/三头)', entries: push },
    others: [
      { routineIds: ['r-pull'], name: '拉日训练 (背/后束/二头)', entries: pull },
      { routineIds: ['r-legs'], name: '腿日训练 (股四/腘绳/臀/小腿)', entries: legs }
    ]
  }
}
