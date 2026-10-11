// Edit campaign values here, then redeploy orderService. All times use China time.
module.exports={
 campaigns:[
 {id:'golden2026',bannerLabel:'EVENT · 1–7 OCT',headline:'Golden Week on campus: free delivery every evening, 18:00–20:00',blurb:'Staying at XJTLU for the holiday? One free delivery a day in the evening window, for the first 30 orders each evening. Runners still get their full fee.',title:'Golden Week evening delivery',short:'Golden Week free',face:'FREE',sub:'18–20h',description:'One free delivery a day, 18:00–20:00 · up to ¥8',max:8,kind:'delivery',start:'2026-10-01T00:00:00+08:00',end:'2026-10-08T00:00:00+08:00',hours:[18,20],daily:true,event:true,dailyOrderLimit:30},
 {id:'welcome-free',title:'Free delivery',short:'Free delivery',face:'FREE',sub:'delivery',description:'Up to ¥8 off the delivery fee · takeaway or parcels',max:8,kind:'delivery',days:7,automatic:true},
 {id:'welcome-two',title:'¥2 off any order',short:'¥2 off',face:'¥2',sub:'off',description:'For your next order of any size',max:2,kind:'total',days:30,automatic:true},
 {id:'return2026',title:'¥1 off × 3 orders',short:'¥1 off',face:'¥1',sub:'off',description:'Welcome back · for students who ordered last month',max:1,kind:'total',days:30,returning:true,count:3}
 ],
 weekly:{enabled:true,target:5,amount:5},rush:{enabled:true,station:'North gate',timeLabel:'11:30–13:00',hours:[11.5,13],amount:1},
 news:[{title:'South gate pick-ups are open',body:'Takeaway at South gate can now be posted and taken. Same rules as North gate.',date:'2026-10-01'},{title:'Meet us at the Clubs & Societies fair',body:'Ask the UniEarn team about upcoming campus activities.',date:'2026-09-28'}]
};
