// 11.22 Wenyuan Night Market roadshow. Hidden after 23 Nov 2026 (China time).
const UNTIL=Date.parse('2026-11-24T00:00:00+08:00');
module.exports=function poster(zh,now=Date.now()){
  if(now>=UNTIL)return null;
  return {
    id:'roadshow-20261122',
    kind:'roadshow',
    kicker:zh?'路演推广':'CAMPUS ROADSHOW',
    dateHero:'11.22',
    dateLabel:zh?'11月22日 周日':'Sun 22 Nov',
    place:zh?'文缘夜市':'Wenyuan Night Market',
    title:zh?'Uniearn 来文缘夜市了':'Uniearn at Wenyuan Night Market',
    subtitle:zh?'现场了解校园代取，欢迎来找我们':'Come say hi and see how campus pick-ups work',
    campus:'XJTLU · SIP',
    date:zh?'2026年11月22日':'22 November 2026',
    body:zh?'11月22日，Uniearn 将在文缘夜市做路演推广。欢迎过来了解校园代取，和我们现场聊聊。':'On 22 November, Uniearn will be at Wenyuan Night Market for a campus roadshow. Come by to learn about campus pick-ups and say hello to the team.'
  };
};
