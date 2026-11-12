// Server (cloud function) messages are English; the app is bilingual, so map the
// handful the UI can actually surface before showing them to a Chinese reader.
const ZH={
 'Complete student certification first.':'请先提交学生认证，再进行这一步。',
 'Complete your student check before accepting jobs.':'接单前请先完成学生认证。',
 'Read and accept the runner rules first.':'请先阅读并同意跑腿规则。',
 'Save your profile / log in in Me first.':'请先在「我的」里完成资料或登录。',
 'Complete your name and phone number first.':'请先填写姓名和手机号。',
 'Choose XJTLU SIP campus before posting or taking jobs.':'发布或接单前请先选择西浦园区校区。'
};
function message(error,zh){
 const text=String(error&&error.message||error||'');
 return zh?(ZH[text]||text):text;
}
module.exports={ZH,message};
