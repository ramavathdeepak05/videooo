const {chromium}=require('/opt/node-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const FPS=30,DUR=33,out=process.argv[2]||'frames';
 fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 await p.goto('file://'+__dirname+'/index.html');
 await p.waitForLoadState('load');
 const only=process.argv[3]?process.argv[3].split(',').map(Number):null;
 const n=FPS*DUR;
 for(let i=0;i<n;i++){
  if(only&&!only.includes(i))continue;
  await p.evaluate(t=>render(t),i/FPS);
  await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.png`});
 }
 await b.close();
})();
