const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1];
const appid=args.includes('--appid')?arg('--appid'):'',envId=args.includes('--env')?arg('--env'):'';
if(!/^wx[a-f0-9]{16}$/i.test(appid)||!envId||!/^[a-zA-Z0-9_-]+$/.test(envId)){
 console.error('Usage: node scripts/configure.js --appid wx0123456789abcdef --env YOUR_CLOUDBASE_ENV_ID');process.exit(1);
}
const root=path.resolve(__dirname,'..'),file=root+'/project.config.json',config=JSON.parse(fs.readFileSync(file));config.appid=appid;fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');fs.writeFileSync(root+'/utils/ocr-config.js','// Public IDs only. Never place API secret keys here.\nmodule.exports='+JSON.stringify({envId})+';\n');console.log('AppID and CloudBase environment configured. Deploy both cloud functions next.');
