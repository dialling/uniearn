// Merged user agreement + privacy policy.
// Structure follows the other mini program's 4-page terms; the content is
// rewritten for UniEarn: test ledger (no real payment/withdrawal), XJTLU
// campuses, and the pricing / cancel rules this app actually implements.
const store=require('../../utils/store');

const TABS=[
  {id:'notice',zh:'用户须知',en:'Before you order'},
  {id:'terms',zh:'服务条款',en:'Terms of service'},
  {id:'privacy',zh:'隐私政策',en:'Privacy policy'},
  {id:'disclaimer',zh:'免责声明',en:'Disclaimer'}
];

const DOC={
 notice:{
  zh:{title:'UniEarn · 用户须知',intro:'下单前请花两分钟读完。这里写清价格、取消、送达和结算，避免误会。',sections:[
   {h:'一、这是什么',ps:['UniEarn（下称“本平台”）是西交利物浦大学校内的同学互助跑腿工具：外卖代取、快递代取、夜市代买和其他校内代办。平台负责发布、撮合和记录，跑腿由接单的同学完成。','当前为团队测试版：不接入真实微信支付，不产生真实扣款，也不能提现。']},
   {h:'二、价格怎么算',ps:['外卖代取：每袋 ¥3 起，发布时可上下调整，最低 ¥3。','快递代取：小件 ¥3、中件 ¥4、大件 ¥5、超大件 ¥10，按件数叠加。','夜市代买：固定 ¥4/单，必须写清店名或摊位，跑手凭这个找店。','楼层加价：文星宿舍区 3 楼及以上每单 +¥1；A05 有电梯免收；文缘、文萃、文荟不加价。','多件代取：单档最多 9 件、合计最多 12 件，超出请分两次下单。','小费（选填）：1.88 / 2.66 / 5.55 / 6.66 / 8.88 元，整单只算一份，不按件摊分。']},
   {h:'三、下单与取消',ps:['外卖代取和夜市代买无人接单时：选择已送达，下单 30 分钟后自动取消；选择未送达，填写的预计送达时间后 30 分钟自动取消；快递和其他任务不设自动取消，会一直留在接单大厅。','跑手在取货前可以取消接单，订单会重新开放；取货后不可取消。','发布人需要取消时，请先在订单里和跑手沟通。']},
   {h:'四、取件与送达',ps:['跑手接单后到指定取件点取件，送到你的房间门口或大堂；需要面交的请在备注里写清。','送达后请尽快确认；其他任务需要跑手提交照片和说明。','外卖送达后 30 分钟内可在订单里反馈问题；洒漏或损坏请附照片。']},
   {h:'五、结算（测试账本）',ps:['本版本只做模拟结算：订单确认后记入测试账本，不产生真实资金流转，也暂不支持提现。','所有订单在跑手送达后进入待入账；用户确认后立即入账，未确认的在送达 2 小时后自动确认入账。有争议时暂停结算。','对订单有疑问的，先在订单里反馈，由团队核实处理。']},
   {h:'六、隐私摘要',ps:['接单大厅显示路线、寝室性别、外卖柜、宿舍区、楼栋、房间号、赏金和时间，不显示姓名、手机号或取件码。','手机号和取件码只提供给该订单的发布人与跑手。','学生认证材料只用于身份核验，仅管理员在审核时可见。','常用路线默认只保存在本设备上。']},
   {h:'七、禁止行为',ps:['虚报快递档位（用低价档位下大件）、恶意下单、冒领他人外卖或快递、骚扰其他同学。','违反者视情节予以拒单、警告、暂停接单或封号处理。']}
  ]},
  en:{title:'UniEarn · Before you order',intro:'Two minutes now saves a misunderstanding later. This page covers pricing, cancellations, delivery and settlement.',sections:[
   {h:'1. What this is',ps:['UniEarn is a student-to-student errand tool for XJTLU: takeaway pickup, parcel pickup, night-market shopping and other on-campus errands. The platform posts, matches and records; the delivery itself is done by the student who accepts the job.','This is a team test build: no real WeChat Pay, no real charge and no withdrawal.']},
   {h:'2. Pricing',ps:['Takeaway: from ¥3 per bag, adjustable when posting, minimum ¥3.','Parcels: small ¥3, medium ¥4, large ¥5, extra large ¥10, added up per item.','Night market: a flat ¥4 per order, and the shop or stall name is required so the runner can find it.','Floor surcharge: Wenxing, 3rd floor and above, +¥1 per order. A05 has a lift and is exempt. Wenyuan, Wencui and Wenhui are not surcharged.','Multiple parcels: at most 9 of one size and 12 in total per request; split larger orders.','Tip (optional): ¥1.88 / 2.66 / 5.55 / 6.66 / 8.88. One tip per order, never split across items.']},
   {h:'3. Posting and cancelling',ps:['If nobody accepts, takeaway and night-market orders marked arrived are cancelled 30 minutes after posting; those marked not yet arrived are cancelled 30 minutes after the entered ETA. Parcels and other tasks stay in the hall until someone takes them.','A runner may cancel before pickup, and the order goes back to the hall. After pickup it cannot be cancelled.','If you need to cancel, talk to the runner in the order first.']},
   {h:'4. Pickup and delivery',ps:['The runner collects at the pickup point you chose and brings it to your door or lobby; write it in the note if you need to meet in person.','Confirm as soon as it arrives. Other tasks require a photo and a short note from the runner.','For takeaway, report a problem in the order within 30 minutes of delivery; attach a photo for spills or damage.']},
   {h:'5. Settlement (test ledger)',ps:['This build settles in a test ledger only: confirmed orders are recorded, no real money moves and withdrawal is not available.','All orders become pending after delivery. Customer confirmation credits immediately; otherwise they auto-confirm and credit 2 hours after delivery. Disputes pause settlement.','If something looks wrong, report it in the order and the team will review it.']},
   {h:'6. Privacy at a glance',ps:['The hall shows routes, dorm gender, takeaway lockers, dorm area, building, room, reward and time. Names, phone numbers and pickup codes stay private.','Phone number and pickup codes go only to the two people on that order.','Student verification material is used for identity checks and is visible to admins only.','Saved routes stay on this device by default.']},
   {h:'7. Not allowed',ps:['Under-declaring a parcel size, posting in bad faith, taking someone else’s food or parcel, or harassing other students.','Depending on severity: refusal, warning, suspension or a ban.']}
  ]}
 },
 terms:{
  zh:{title:'UniEarn · 服务条款',intro:'本条款是你与 UniEarn 运营方之间关于使用本小程序的约定。继续使用即表示你接受本条款。',sections:[
   {h:'一、总则',ps:['本服务条款是你与 UniEarn（下称“我们”）之间关于使用本小程序的法律协议。访问或使用本小程序，即视为同意本条款。','我们可能更新、修改或终止部分服务，变更在小程序内公布后生效。']},
   {h:'二、服务内容',ps:['本小程序提供外卖代取、快递代取、夜市代买、其他校内代办及配套的发布、接单、消息与记录功能。','我们尽力保证服务稳定，但不承诺服务不中断、无延迟或无差错。']},
   {h:'三、注册与登录',ps:['使用前需完成微信登录。你应保证提供的姓名、手机号等信息真实、准确、完整。','账号仅限本人使用，不得转让或出售。因你自身原因造成的账号或信息泄露，由你自行承担。']},
   {h:'四、用户权利与义务',ps:['不得利用本小程序从事违法活动，不得侵犯他人知识产权、隐私或其他权益。','交易应诚实守信：不得恶意下单、虚报档位、冒领或采取其他不正当手段。','发布人应及时确认送达；跑手应按约定时间取件、送达，并保护订单中的个人信息。']},
   {h:'五、知识产权',ps:['本小程序内的文本、图片、界面等内容受法律保护。未经授权不得复制、修改或传播。']},
   {h:'六、隐私保护',ps:['我们按照《隐私政策》处理你的个人信息。除为完成订单、履行法定义务或取得你同意外，不会向第三方提供你的个人信息。']},
   {h:'七、交易与结算（测试账本）',ps:['当前版本为团队测试版，订单只记录在测试账本中：不接入真实微信支付，不产生真实扣款、转账或提现。','订单确认或自动确认后，账本记录对应金额；如对金额有疑问，可在订单内反馈，由团队核实。','平台不向发布人加价、不向跑手抽成。']},
   {h:'八、费用与取消',ps:['跑腿费按小程序内公示的定价计算（见「用户须知」）。','外卖代取、夜市代买无人接单时，已送达订单在下单 30 分钟后自动取消；未送达订单在填写的预计送达时间后 30 分钟自动取消；快递与其他任务不设自动取消。','跑手取货前可取消接单；取货后订单不可取消。发布人取消前请先与跑手沟通。']},
   {h:'九、责任限制',ps:['本服务按“现状”提供。因不可抗力、第三方行为或你自身原因造成的损失，我们不承担责任，法律另有规定的除外。','你应自行判断并承担使用本服务可能带来的风险。']},
   {h:'十、争议解决',ps:['因本条款产生的争议，双方应先友好协商；协商不成的，可向运营方所在地有管辖权的人民法院提起诉讼。','本条款适用中华人民共和国法律。']},
   {h:'十一、其他',ps:['本条款自你首次使用本小程序之日起生效。','本条款部分无效不影响其余条款的效力。']}
  ]},
  en:{title:'UniEarn · Terms of service',intro:'These terms govern your use of this mini program. By continuing to use it you accept them.',sections:[
   {h:'1. General',ps:['These terms are a legal agreement between you and the UniEarn operator. Accessing or using the mini program means you accept them.','We may update, modify or discontinue parts of the service; changes take effect once published in the mini program.']},
   {h:'2. The service',ps:['The mini program provides takeaway pickup, parcel pickup, night-market shopping, other on-campus errands, and the posting, accepting, messaging and record features around them.','We work to keep the service stable but do not promise it will be uninterrupted, timely or error-free.']},
   {h:'3. Signing in',ps:['WeChat login is required. The name, phone number and other details you provide must be true, accurate and complete.','Your account is for you alone; do not transfer or sell it. You are responsible for leaks caused by your own actions.']},
   {h:'4. Your rights and duties',ps:['Do not use the mini program for anything unlawful or to infringe intellectual property, privacy or other rights.','Deal honestly: no bad-faith orders, no under-declared sizes, no taking someone else’s delivery.','Publishers should confirm promptly; runners should collect and deliver on time and protect the personal data in the order.']},
   {h:'5. Intellectual property',ps:['Text, images and interface elements in the mini program are protected by law. Do not copy, modify or redistribute them without permission.']},
   {h:'6. Privacy',ps:['We handle personal data under the Privacy policy. We do not give it to third parties except to complete an order, to meet legal duties, or with your consent.']},
   {h:'7. Transactions and settlement (test ledger)',ps:['This is a team test build. Orders are recorded in a test ledger only: no real WeChat Pay, no real charge, transfer or withdrawal.','Once an order is confirmed or auto-confirmed, the ledger records the amount. Questions about an amount can be raised in the order for the team to review.','The platform adds no markup for publishers and takes no commission from runners.']},
   {h:'8. Fees and cancellations',ps:['Errand fees follow the pricing published in the mini program (see “Before you order”).','Unaccepted takeaway and night-market orders marked arrived are cancelled 30 minutes after posting; those marked not yet arrived are cancelled 30 minutes after the entered ETA. Parcels and other tasks are not auto-cancelled.','A runner may cancel before pickup; after pickup the order cannot be cancelled. Publishers should talk to the runner before cancelling.']},
   {h:'9. Limits of liability',ps:['The service is provided “as is”. We are not liable for losses caused by force majeure, third parties or your own actions, except where the law says otherwise.','You judge and bear the risks of using the service.']},
   {h:'10. Disputes',ps:['Disputes under these terms should first be discussed in good faith; failing that, either side may sue in the competent court where the operator is based.','These terms are governed by the laws of the People’s Republic of China.']},
   {h:'11. Miscellaneous',ps:['These terms take effect when you first use the mini program.','If one clause is invalid, the rest stay in force.']}
  ]}
 },
 privacy:{
  zh:{title:'UniEarn · 隐私政策',intro:'本政策说明我们收集哪些信息、怎么用、给谁看，以及你可以要求什么。',sections:[
   {h:'一、引言',ps:['UniEarn 是西交利物浦大学校内的同学互助跑腿小程序。我们只收集完成跑腿所必需的信息，并尽量少收集。']},
   {h:'二、我们收集的信息',ps:['账号信息：微信登录标识、昵称、你填写或授权的手机号。','订单信息：取件点、宿舍区/楼栋/楼层、房间号、取件码、备注、照片、金额与订单状态。','身份核验：申请成为跑手时提交的姓名、学号、学生证照片（仅管理员审核时可见）。','设备与日志：语言、外观设置、常用路线（默认只存本设备）、必要的运行日志。']},
   {h:'三、信息的使用',ps:['发布订单、撮合跑手、送达确认和问题处理。','身份核验与安全风控（例如防止冒领、虚报档位）。','改进产品与排查故障。','我们不会把你的信息用于与跑腿无关的广告推送。']},
   {h:'四、信息的共享',ps:['接单大厅：展示配送所需的寝室性别、外卖柜、宿舍区、楼栋和房间号；手机号、取件码只提供给该订单的发布人与跑手。','管理团队：处理争议、审核跑手时可见必要信息。','法律要求：依法配合司法机关或监管部门的合法要求。','除此之外，未经你同意不会向第三方出售或共享你的个人信息。']},
   {h:'五、存储与安全',ps:['数据存储于微信云开发环境，仅授权人员可访问。','传输使用 HTTPS 加密；账号与订单按最小必要原则保存。','互联网没有绝对安全，请勿在备注中填写与跑腿无关的敏感信息。']},
   {h:'六、你的权利',ps:['你可以查看、更正个人资料与常用路线。','你可以要求删除账号及相关数据：在「我的 → 帮助与支持」提交，团队核实后处理。','你可以随时撤回授权；撤回不影响此前已完成的处理。']},
   {h:'七、未成年人',ps:['本服务面向高校在校学生。若你未满 18 周岁，请在监护人指导下使用。']},
   {h:'八、政策更新',ps:['本政策可能随功能调整而更新，更新后在「用户须知 / 隐私政策」内公布并生效。']},
   {h:'九、联系我们',ps:['对本政策有疑问，可在「我的 → 帮助与支持」联系我们。']}
  ]},
  en:{title:'UniEarn · Privacy policy',intro:'This policy explains what we collect, how we use it, who can see it, and what you can ask us to do.',sections:[
   {h:'1. Introduction',ps:['UniEarn is a student-to-student errand mini program for XJTLU. We collect only what an errand needs, and as little as possible.']},
   {h:'2. What we collect',ps:['Account: WeChat login identifier, nickname, and the phone number you enter or authorise.','Orders: pickup point, area/building/floor, room number, pickup codes, notes, photos, amounts and status.','Verification: name, student number and student card photo submitted when applying to run jobs (admins only).','Device and logs: language, appearance, saved routes (kept on this device by default) and basic runtime logs.']},
   {h:'3. How we use it',ps:['To publish orders, match runners, confirm delivery and handle problems.','For identity checks and safety (for example, preventing someone from taking another student’s delivery).','To improve the product and debug failures.','We do not use your data for advertising unrelated to errands.']},
   {h:'4. Sharing',ps:['Job hall: dorm gender, takeaway locker, dorm area, building and room are visible for delivery. Phone number and pickup codes go only to the publisher and runner on that order.','The team: sees what is needed to resolve disputes and review runner applications.','Legal: we cooperate with lawful requests from courts or regulators.','Otherwise we do not sell or share your personal data without your consent.']},
   {h:'5. Storage and security',ps:['Data is stored in the WeChat cloud environment and reachable only by authorised people.','Traffic is encrypted with HTTPS; accounts and orders are kept only as long as needed.','No internet system is perfectly secure; please keep unrelated sensitive information out of order notes.']},
   {h:'6. Your rights',ps:['You can view and correct your profile and saved routes.','You can ask us to delete your account and data via Me → Help and support; the team handles it after verification.','You can withdraw consent at any time; withdrawal does not affect processing already completed.']},
   {h:'7. Minors',ps:['The service is for university students. If you are under 18, please use it with a guardian’s guidance.']},
   {h:'8. Changes',ps:['This policy may change as features change. Updates are published in Before you order / Privacy policy and take effect there.']},
   {h:'9. Contact',ps:['Questions about this policy: reach us at Me → Help and support.']}
  ]}
 },
 disclaimer:{
  zh:{title:'UniEarn · 免责声明',intro:'请在使用前阅读。',sections:[
   {h:'一、服务提供',ps:['本小程序基于现有技术和条件提供服务，我们尽力保证稳定，但不对连续性、及时性、安全性或准确性作任何保证。']},
   {h:'二、信息准确性',ps:['你应确保填写的姓名、手机号、地址、取件码等信息真实准确。因填写错误造成的损失由你自行承担。']},
   {h:'三、使用规范',ps:['你应遵守法律法规、社会公德和小程序规则，不得从事违法或侵害他人权益的行为。']},
   {h:'四、第三方行为',ps:['对于其他用户或第三方服务造成的损失，我们不承担责任；请自行判断交易风险。']},
   {h:'五、不可抗力',ps:['因自然灾害、网络故障、政府行为等不可抗力造成的服务中断或数据丢失，我们不承担责任。']},
   {h:'六、测试版本',ps:['当前为团队测试版：不接入真实支付，不产生真实扣款或提现；测试账本中的金额仅用于演示与对账。']},
   {h:'七、账户处理',ps:['对恶意下单、冒领、骚扰等行为，我们有权视情节拒单、警告、暂停或终止账号。']},
   {h:'八、条款修改',ps:['我们可修改本声明，修改后在小程序内公布即生效，继续使用视为接受。']},
   {h:'九、可分割性与完整协议',ps:['部分条款无效不影响其余条款；本声明与《服务条款》《隐私政策》共同构成完整约定。']},
   {h:'十、语言与联系',ps:['本声明以中文书写，译本仅供参考，以中文版为准。','有疑问可在「我的 → 帮助与支持」联系我们。']}
  ]},
  en:{title:'UniEarn · Disclaimer',intro:'Please read before using the service.',sections:[
   {h:'1. Service',ps:['The mini program runs on current technology and conditions. We work to keep it stable but make no guarantee of continuity, timeliness, security or accuracy.']},
   {h:'2. Accuracy of information',ps:['You are responsible for the name, phone number, address and pickup codes you enter. Losses from wrong details are yours.']},
   {h:'3. Conduct',ps:['Follow the law, common decency and the mini program’s rules. Do not do anything unlawful or harmful to others.']},
   {h:'4. Third parties',ps:['We are not liable for losses caused by other users or third-party services. Judge the risks yourself.']},
   {h:'5. Force majeure',ps:['We are not liable for outages or data loss caused by natural disasters, network failures or government action.']},
   {h:'6. Test build',ps:['This is a team test build: no real payment, no real charge and no withdrawal. Amounts in the test ledger are for demonstration and reconciliation only.']},
   {h:'7. Account action',ps:['For bad-faith orders, taking another student’s delivery or harassment, we may refuse, warn, suspend or close the account depending on severity.']},
   {h:'8. Changes',ps:['We may change this disclaimer; changes take effect when published in the mini program, and continued use means acceptance.']},
   {h:'9. Severability and entire agreement',ps:['If one clause is invalid the rest stay in force. This disclaimer, the Terms of service and the Privacy policy form the complete agreement.']},
   {h:'10. Language and contact',ps:['This disclaimer is written in Chinese; translations are for reference and the Chinese version prevails.','Questions: Me → Help and support.']}
  ]}
 }
};

Page({
  data:{tab:0,zh:true,tabs:[],doc:DOC.notice.zh,updated:''},
  onLoad(o={}){
    const i=TABS.findIndex(t=>t.id===o.id||String(t.id)===String(o.tab));
    if(i>=0)this.setData({tab:i});
    this.localize();
  },
  onShow(){this.localize();},
  localize(){
    const zh=store.get().language!=='en';
    const tab=this.data.tab;
    this.setData({zh,tabs:TABS.map(t=>({id:t.id,label:zh?t.zh:t.en})),doc:DOC[TABS[tab].id][zh?'zh':'en'],updated:zh?'更新日期：2026 年 10 月':'Updated October 2026'});
  },
  choose(e){
    const i=Number(e.currentTarget.dataset.i)||0;
    const zh=store.get().language!=='en';
    this.setData({tab:i,doc:DOC[TABS[i].id][zh?'zh':'en']});
    if(typeof wx!=='undefined'&&wx.pageScrollTo)wx.pageScrollTo({scrollTop:0,duration:0});
  }
});
module.exports={DOC,TABS};
