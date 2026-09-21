const http=require('http');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
http.createServer((req,res)=>{
  let u=req.url.split('?')[0];
  if(u==='/') u='/index.html';
  if(u==='/crear-cuenta') u='/crear-cuenta.html';
  const file=path.join(root,u);
  if(!file.startsWith(root)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  });
}).listen(process.env.PORT||3000);
