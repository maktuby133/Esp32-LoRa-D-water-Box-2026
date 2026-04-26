// ╔══════════════════════════════════════════════════════╗
// ║   SERVICE WORKER — Monitor Caixa d'Água (LoRa) v2   ║
// ╚══════════════════════════════════════════════════════╝

const SW_VERSION = 'v2.0';
const ICON_URL   = 'https://cdn-icons-png.flaticon.com/512/2933/2933245.png';

// ── Instala e ativa imediatamente ───────────────────────
self.addEventListener('install',  () => { console.log('[SW]', SW_VERSION, 'instalado'); self.skipWaiting(); });
self.addEventListener('activate', e  => { console.log('[SW]', SW_VERSION, 'ativado');  e.waitUntil(clients.claim()); });

// ═══════════════════════════════════════════════════════
//  RECEBE postMessage da página (canal alternativo)
// ═══════════════════════════════════════════════════════
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'NOTIFICAR') return;

  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body:     data.corpo,
      icon:     ICON_URL,
      badge:    ICON_URL,
      tag:      data.tag || 'monitor-agua',
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { url: self.registration.scope + 'index_LoRa.html' }
    })
  );
});

// ═══════════════════════════════════════════════════════
//  CLIQUE NA NOTIFICAÇÃO — abre/foca a aba do monitor
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('index_LoRa') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
