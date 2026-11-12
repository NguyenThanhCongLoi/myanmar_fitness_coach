self.addEventListener('push',event=>{
  if(!event.data)return;
  let message;try{message=event.data.json();}catch{return;}
  event.waitUntil(self.registration.showNotification(message.title,{body:message.body,icon:'/assets/mascot/bee/avatars/bee_avatar_happy-192.webp',tag:message.id,renotify:false,data:{url:'/?view=inbox'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const url=new URL('/?view=inbox',self.location.origin).href;
    if(windows.length){await windows[0].navigate(url);return windows[0].focus();}
    return self.clients.openWindow(url);
  }));
});

// Offline + low-data: cache-first for immutable static files, exercise media and mascot images only.
// API responses are never cached (always fresh, owner-scoped). The root page is a static, user-agnostic shell:
// network-first, falling back to the cached shell after 2.5 s (cold start) or offline.
const STATIC_CACHE='mingalar-static-v1',SHELL_CACHE='mingalar-shell-v1';
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'&&url.pathname==='/'){
    event.respondWith(caches.open(SHELL_CACHE).then(async cache=>{
      const network=fetch(event.request).then(res=>{if(res.ok&&res.status===200&&!res.redirected)cache.put('/',res.clone());return res;});
      const cached=await cache.match('/');
      if(!cached)return network;
      return Promise.race([network.catch(()=>cached),new Promise(r=>setTimeout(()=>r(cached),2500))]);
    }));
    return;
  }
  if(!/^\/(_next\/static|assets|media)\//.test(url.pathname))return;
  if(event.request.headers.get('range'))return;
  event.respondWith(caches.open(STATIC_CACHE).then(async cache=>{const hit=await cache.match(event.request);if(hit)return hit;const res=await fetch(event.request);if(res.ok&&res.status===200)cache.put(event.request,res.clone());return res;}));
});
