const http=require('http');
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8'};

const routes={
  '/':'/index.html',
  '/crear-cuenta':'/crear-cuenta.html',
  '/login':'/login.html',
  '/usuario-listo':'/usuario-listo.html',
  '/elegir-viaje':'/elegir-viaje.html',
  '/mi-perfil':'/mi-perfil.html',
  '/perfil-listo':'/perfil-listo.html',
  '/mi-viaje':'/mi-viaje.html',
  '/datos-viaje':'/datos-viaje.html',
  '/extras-viaje':'/extras-viaje.html',
  '/permisos-viaje':'/permisos-viaje.html',
  '/home':'/home.html',
  '/tour':'/tour.html'
};

http.createServer((req,res)=>{
  let u=req.url.split('?')[0];
  if(routes[u]) u=routes[u];
  const file=path.join(root,u);
  if(!file.startsWith(root)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});return res.end('Not found');}
    const ext=path.extname(file);
    const headers={'Content-Type':types[ext]||'application/octet-stream'};
    if(ext==='.html'||ext==='.js'||ext==='.webmanifest'){headers['Cache-Control']='no-store, no-cache, must-revalidate, proxy-revalidate';headers['Pragma']='no-cache';headers['Expires']='0';}
    res.writeHead(200,headers);res.end(data);
  });
}).listen(process.env.PORT||3000);