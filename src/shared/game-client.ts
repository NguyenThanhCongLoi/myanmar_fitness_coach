export async function gameApi<T>(path:string,body?:unknown):Promise<T>{
  if(body!==undefined&&!navigator.onLine)throw new Error('offline');
  const response=await fetch('/api/game/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const value=await response.json();if(!response.ok)throw new Error(value.error??'error');return value;
}
