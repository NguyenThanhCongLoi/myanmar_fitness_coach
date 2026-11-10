self.addEventListener('push',event=>{
  if(!event.data)return;
  let message;try{message=event.data.json();}catch{return;}
  event.waitUntil(self.registration.showNotification(message.title,{body:message.body,tag:message.id,renotify:false,data:{url:'/?view=inbox'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const url=new URL('/?view=inbox',self.location.origin).href;
    if(windows.length){await windows[0].navigate(url);return windows[0].focus();}
    return self.clients.openWindow(url);
  }));
});
