// 11.15 Wenyuan Night Market roadshow. Hidden after 16 Nov 2026 (China time).
const UNTIL=Date.parse('2026-11-17T00:00:00+08:00');
module.exports=function poster(zh,now=Date.now()){
  if(now>=UNTIL)return null;
  return {
    id:'roadshow-20261115',
    kind:'roadshow',
    kicker:zh?'路演推广':'CAMPUS ROADSHOW',
    dateHero:'11.15',
    dateLabel:zh?'11月15日 周日':'Sun 15 Nov',
    place:zh?'文缘夜市':'Wenyuan Night Market',
    title:zh?'UniEarn 来文缘夜市了':'UniEarn at Wenyuan Night Market',
    subtitle:zh?'现场了解校园代取，欢迎来找我们':'Come say hi and see how campus pick-ups work',
    campus:'XJTLU · SIP',
    date:zh?'2026年11月15日':'15 November 2026',
    body:zh?'11月15日，UniEarn 将在文缘夜市做路演推广。欢迎过来了解校园代取，和我们现场聊聊。':'On 15 November, UniEarn will be at Wenyuan Night Market for a campus roadshow. Come by to learn about campus pick-ups and say hello to the team.'
  };
};
