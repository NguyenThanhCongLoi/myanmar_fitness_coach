import variants from './video-variants.json';
export function prefersLightVideo() {
  if(typeof navigator==='undefined')return false;
  try{if(localStorage.getItem('mingalar-lowdata')==='on')return true;}catch{/* optional */}
  const c=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string;downlink?:number}}).connection;
  return !!(c?.saveData||['slow-2g','2g','3g'].includes(c?.effectiveType??'')||(c?.downlink!==undefined&&c.downlink<1));
}
export function playbackSource(url:string|null|undefined,light:boolean) {
  return url&&light?(variants as Record<string,string>)[url]??url:url;
}
