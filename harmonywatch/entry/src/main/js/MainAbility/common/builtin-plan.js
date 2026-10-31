// Existing personal PPL test plan, preserved from the prior signed test build.
// Enabled only by prepare.mjs --builtin-plan; phone snapshots replace it normally.
export function builtinReady() {
  function w(a,b){return{w:a,r:b,done:false,warmup:true}}
  function r(a,b){return{w:a,r:b,done:false}}
  function s(a,b){return{done:false,sides:{L:{w:a,r:b,done:false},R:{w:a,r:b,done:false}}}}
  function e(i,n,t,p,l,s,x){var o={id:i,name:n,mode:"reps",restSec:t,step:p,last:l,sets:s};if(x)for(var k in x)o[k]=x[k];return o}
  function a(n,x,y){for(var r_=[],i=0;i<n;i++)r_.push(r(x,y));return r_}
  function sa(n,x,y){for(var r_=[],i=0;i<n;i++)r_.push(s(x,y));return r_}
  var p=[e("0025","杠铃卧推",120,2.5,"50 kg × 8",[w(30,10),w(40,8)].concat(a(3,50,8)),{best:{w:50,r:8}}),
    e("0314","哑铃上斜卧推",90,2,"16 kg × 10",a(3,16,10)),
    e("0290","哑铃凳上坐姿推举",90,2,"12 kg × 10",a(3,12,10)),
    e("0334","哑铃侧平举",60,1,"7.5 kg × 12",a(3,7.5,12)),
    e("0241","绳索三头肌下压(V形把手)",60,2.5,"20 kg × 12",a(3,20,12))];
  var u=[e("0150","绳索杠高位下拉",90,2.5,"40 kg × 10",[w(25,10)].concat(a(4,40,10))),
    e("0292","哑铃单臂俯身划船",90,2,"16 kg × 10",sa(3,16,10),{perSide:true}),
    e("0160","绳索地板坐姿宽握划船",90,2.5,"35 kg × 10",a(3,35,10)),
    e("0380","哑铃后侧平举",60,1,"5 kg × 12",a(3,5,12)),
    e("0294","哑铃二头弯举",60,1,"10 kg × 12",a(3,10,12))];
  var l=[e("0043","杠铃全蹲",120,2.5,"60 kg × 8",[w(40,8),w(50,6)].concat(a(3,60,8))),
    e("0085","杠铃罗马尼亚硬拉",90,2.5,"50 kg × 10",[w(30,8)].concat(a(3,50,10))),
    e("0585","杠杆腿屈伸",60,2.5,"30 kg × 12",a(3,30,12)),
    e("0586","杠杆俯卧腿弯举",60,2.5,"25 kg × 12",a(3,25,12)),
    e("3018","站姿提踵",60,1,"15 次",a(3,0,15),{bodyweight:true})];
  return {today:{routineIds:["r-push"],name:"推日训练 (胸/肩/三头)",entries:p},
    others:[{routineIds:["r-pull"],name:"拉日训练 (背/后束/二头)",entries:u},
      {routineIds:["r-legs"],name:"腿日训练 (股四/腘绳/臀/小腿)",entries:l}]};
}