/* SURF WORLD: 예전 저장 방식(서비스 워커)을 스스로 지우고, 항상 최신 게임을 열게 해요 */
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch(_){}try{await self.registration.unregister()}catch(_){}try{const cs=await self.clients.matchAll({type:'window'});cs.forEach(c=>{try{c.navigate(c.url)}catch(_){}})}catch(_){}})())});
self.addEventListener('fetch',()=>{});
