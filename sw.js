
// ╔══════════════════════════════════════════════════════╗
// ║   SERVICE WORKER — Monitor Caixa d'Água (LoRa)      ║
// ║   Permite notificações mesmo com a aba fechada       ║
// ╚══════════════════════════════════════════════════════╝

const SW_VERSION = 'v1.0';
const ICON_URL   = 'https://cdn-icons-png.flaticon.com/512/2933/2933245.png';

// ── Instalação ───────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalado', SW_VERSION);
  self.skipWaiting(); // ativa imediatamente sem esperar fechar abas antigas
});

// ── Ativação ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Ativado', SW_VERSION);
  event.waitUntil(clients.claim()); // assume controle de todas as abas abertas
});

// ═══════════════════════════════════════════════════════
//  RECEBE MENSAGENS DA PÁGINA (postMessage)
//  A página envia { type, titulo, corpo, tag } quando
//  detecta nível crítico ou caixa abastecida.
// ═══════════════════════════════════════════════════════
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'NOTIFICAR') return;

  const { titulo, corpo, tag } = data;

  // Mostra a notificação via Service Worker
  // → funciona mesmo com aba em background ou fechada
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body:    corpo,
      icon:    ICON_URL,
      badge:   ICON_URL,
      tag:     tag || 'monitor-agua',   // evita duplicatas
      renotify: true,
      vibrate: [200, 100, 200],
      data:    { url: self.location.origin + self.location.pathname.replace('sw.js','') + 'index_LoRa.html' }
    })
  );
});

// ═══════════════════════════════════════════════════════
//  RECEBE PUSH DO SERVIDOR (para uso futuro com FCM/VAPID)
//  Por ora, o acionamento é via postMessage da página.
// ═══════════════════════════════════════════════════════
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch(e) { payload = { titulo: '💧 Monitor', corpo: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.titulo || '💧 Monitor Caixa d\'Água', {
      body:    payload.corpo  || 'Verifique o nível da sua caixa.',
      icon:    ICON_URL,
      badge:   ICON_URL,
      tag:     payload.tag   || 'monitor-agua',
      vibrate: [200, 100, 200],
      data:    { url: payload.url || '/' }
    })
  );
});

// ═══════════════════════════════════════════════════════
//  CLIQUE NA NOTIFICAÇÃO — abre/foca a aba do monitor
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se já há uma aba aberta com a página, foca nela
      for (const client of clientList) {
        if (client.url.includes('index_LoRa') && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova aba
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
