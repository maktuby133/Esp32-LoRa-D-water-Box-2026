// ╔══════════════════════════════════════════════════════╗
// ║   SERVIDOR MQTT + WEB PUSH — Monitor Caixa d'Água   ║
// ║   Deploy: Railway                                    ║
// ╚══════════════════════════════════════════════════════╝

const express    = require('express');
const cors       = require('cors');
const mqtt       = require('mqtt');
const webpush    = require('web-push');
const { GoogleAuth } = require('google-auth-library');

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS explícito — aceita qualquer origem (necessário para Railway + browsers)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Responde preflight OPTIONS em todas as rotas
app.options('*', cors());

app.use(express.json());

// ── VAPID (Web Push) ─────────────────────────────────
const VAPID_PUBLIC  = 'BAr__h-peUzkzXFpUc0azRN70irT6bQVz1PHsUbsWIH2w5BDV1KligHC116A6bXXg_BVW7SpkvCNNm0gadgEuMc';
const VAPID_PRIVATE = '4zqMat_A0PLPWh9Nn9OaVFPcqocvFWp0tQgdslBkMV4';
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:seu@email.com';

console.log('[VAPID] Public key:', VAPID_PUBLIC.substring(0, 20) + '...');
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

// ── FCM via Service Account ──────────────────────────
const FCM_PROJECT_ID = 'monitor-caixa-agua-ce666';
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

// Service account carregado da env var (JSON stringificado)
let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
} catch(e) {
  console.error('[FCM] Erro ao parsear FIREBASE_SERVICE_ACCOUNT:', e.message);
}

async function getFCMToken() {
  if (!serviceAccount || !serviceAccount.private_key) return null;
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });
    const client = await auth.getClient();
    const token  = await client.getAccessToken();
    return token.token;
  } catch(e) {
    console.error('[FCM] Erro ao obter token:', e.message);
    return null;
  }
}

// ── MQTT ─────────────────────────────────────────────
const MQTT_HOST = 'cee37ceeb13242b3a9099f84327c2c1c.s1.eu.hivemq.cloud';
const MQTT_USER = 'monitortemp';
const MQTT_PASS = '061084Cc@';

const mqttClient = mqtt.connect(`mqtts://${MQTT_HOST}:8883`, {
  username:           MQTT_USER,
  password:           MQTT_PASS,
  clientId:           'render-server-01',
  rejectUnauthorized: false,
  reconnectPeriod:    5000,
  keepalive:          60,
  clean:              true
});

mqttClient.on('connect', () => {
  console.log('[MQTT] Conectado ao HiveMQ');
  // Subscreve nos dois formatos possíveis de tópico
  mqttClient.subscribe(['/agua/+/dados', 'agua/+/dados', 'caixas/agua/+/dados'], err => {
    if (!err) console.log('[MQTT] Subscrito em /agua/+/dados, agua/+/dados e caixas/agua/+/dados');
    else console.error('[MQTT] Erro ao subscrever:', err.message);
  });
});

mqttClient.on('error',     e  => console.error('[MQTT] Erro:', e.message, '| user:', MQTT_USER, '| host:', MQTT_HOST));
mqttClient.on('reconnect', () => console.log('[MQTT] Reconectando...'));

// ── ARMAZENAMENTO ────────────────────────────────────
// subscriptions[deviceId] = [ { subscription, nivelCritico, nivelEnchendo }, ... ]
const subscriptions = {};

// fcmTokens[deviceId] = [ { token, nivelCritico, nivelEnchendo }, ... ]
const fcmTokens = {};

// Controle de alertas: evita spam
// lastAlert[deviceId] = timestamp do último alerta enviado
const lastAlert = {};
const ALERT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos entre alertas

// ── PROCESSAR MENSAGEM MQTT ──────────────────────────
mqttClient.on('message', async (topic, message) => {
  try {
    // Extrai deviceId do tópico independente do formato:
    // /agua/DEVICEID/dados  → parts = ['', 'agua', 'DEVICEID', 'dados']
    // agua/DEVICEID/dados   → parts = ['agua', 'DEVICEID', 'dados']
    // caixas/agua/DEVICEID/dados → parts = ['caixas', 'agua', 'DEVICEID', 'dados']
    const parts    = topic.split('/').filter(p => p !== ''); // remove strings vazias
    // deviceId é sempre o penúltimo segmento (antes de 'dados')
    const deviceId = parts[parts.length - 2];
    const payload  = JSON.parse(message.toString());

    if (payload.cached) return; // ignora dados de cache

    const pct = parseInt(payload.percentage);
    if (isNaN(pct)) return;

    console.log(`[MQTT] Tópico: ${topic} | Device: ${deviceId} | Nível: ${pct}%`);

    // Verificar subscriptions deste device
    const subs = subscriptions[deviceId] || [];
    const tkns = fcmTokens[deviceId]     || [];

    if (subs.length === 0 && tkns.length === 0) return;

    // Throttle — não spama notificações
    const agora    = Date.now();
    const lastTime = lastAlert[deviceId] || 0;
    if (agora - lastTime < ALERT_INTERVAL_MS) return;

    // Verificar se algum subscriber tem alerta para este nível
    let titulo = null;
    let corpo  = null;

    // Checa nível crítico e enchimento para cada subscriber individualmente
    // (cada um pode ter limites diferentes)
    // Por simplicidade usa o primeiro subscriber como referência de limites
    const nivelCritico  = subs[0]?.nivelCritico  || tkns[0]?.nivelCritico  || 20;
    const nivelEnchendo = subs[0]?.nivelEnchendo || tkns[0]?.nivelEnchendo || 80;

    if (pct <= nivelCritico) {
      titulo = '⚠️ Caixa d\'água crítica!';
      corpo  = `Nível em ${pct}% — abaixo de ${nivelCritico}%. Verifique a caixa.`;
    } else if (pct >= nivelEnchendo) {
      titulo = '💧 Caixa abastecida!';
      corpo  = `Nível atingiu ${pct}% — caixa com bom volume.`;
    }

    if (!titulo) return;

    lastAlert[deviceId] = agora;
    console.log(`[NOTIF] Disparando alerta para device ${deviceId}: ${titulo}`);

    // Enviar Web Push para todos os subscribers
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({ titulo, corpo }));
        console.log(`[WEBPUSH] Enviado com sucesso`);
      } catch(e) {
        console.error(`[WEBPUSH] Erro:`, e.statusCode, e.body);
        // Remove subscription inválida (410 = expirada)
        if (e.statusCode === 410 || e.statusCode === 404) {
          subscriptions[deviceId] = subscriptions[deviceId].filter(s => s !== sub);
        }
      }
    }

    // Enviar FCM para tokens registrados
    const fcmToken = await getFCMToken();
    if (fcmToken) {
      for (const tk of tkns) {
        try {
          const res = await fetch(FCM_URL, {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${fcmToken}`,
              'Content-Type':  'application/json'
            },
            body: JSON.stringify({
              message: {
                token: tk.token,
                notification: { title: titulo, body: corpo },
                webpush: {
                  notification: {
                    title: titulo,
                    body:  corpo,
                    icon:  '/icon-192.png',
                    badge: '/icon-192.png'
                  }
                }
              }
            })
          });
          const data = await res.json();
          if (!res.ok) console.error('[FCM] Erro:', JSON.stringify(data));
          else console.log('[FCM] Enviado com sucesso');
        } catch(e) {
          console.error('[FCM] Erro ao enviar:', e.message);
        }
      }
    }
  } catch(e) {
    console.error('[MQTT] Erro ao processar mensagem:', e.message);
  }
});

// ── ROTAS HTTP ───────────────────────────────────────

// Ping — mantém o Render acordado (UptimeRobot chama esta rota)
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) + 's' });
});

// Retorna a VAPID public key para o browser registrar o SW
app.get('/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// Browser registra subscription Web Push
app.post('/subscribe', (req, res) => {
  const { deviceId, subscription, nivelCritico, nivelEnchendo } = req.body;
  if (!deviceId || !subscription) return res.status(400).json({ error: 'Faltam dados' });

  if (!subscriptions[deviceId]) subscriptions[deviceId] = [];

  // Evita duplicata (mesmo endpoint)
  const existe = subscriptions[deviceId].find(s => s.subscription.endpoint === subscription.endpoint);
  if (!existe) {
    subscriptions[deviceId].push({ subscription, nivelCritico: nivelCritico || 20, nivelEnchendo: nivelEnchendo || 80 });
    console.log(`[SUB] Nova subscription Web Push para device ${deviceId} (total: ${subscriptions[deviceId].length})`);
  } else {
    // Atualiza limites
    existe.nivelCritico  = nivelCritico  || 20;
    existe.nivelEnchendo = nivelEnchendo || 80;
    console.log(`[SUB] Subscription atualizada para device ${deviceId}`);
  }

  res.json({ ok: true });
});

// Browser registra token FCM
app.post('/subscribe-fcm', (req, res) => {
  const { deviceId, token, nivelCritico, nivelEnchendo } = req.body;
  if (!deviceId || !token) return res.status(400).json({ error: 'Faltam dados' });

  if (!fcmTokens[deviceId]) fcmTokens[deviceId] = [];

  const existe = fcmTokens[deviceId].find(t => t.token === token);
  if (!existe) {
    fcmTokens[deviceId].push({ token, nivelCritico: nivelCritico || 20, nivelEnchendo: nivelEnchendo || 80 });
    console.log(`[FCM] Novo token FCM para device ${deviceId}`);
  } else {
    existe.nivelCritico  = nivelCritico  || 20;
    existe.nivelEnchendo = nivelEnchendo || 80;
  }

  res.json({ ok: true });
});

// Atualiza limites de notificação para um device
app.post('/update-config', (req, res) => {
  const { deviceId, nivelCritico, nivelEnchendo } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId obrigatório' });

  const subs = subscriptions[deviceId] || [];
  subs.forEach(s => {
    s.nivelCritico  = nivelCritico  ?? s.nivelCritico;
    s.nivelEnchendo = nivelEnchendo ?? s.nivelEnchendo;
  });

  const tkns = fcmTokens[deviceId] || [];
  tkns.forEach(t => {
    t.nivelCritico  = nivelCritico  ?? t.nivelCritico;
    t.nivelEnchendo = nivelEnchendo ?? t.nivelEnchendo;
  });

  console.log(`[CONFIG] Device ${deviceId}: crítico=${nivelCritico}% enchendo=${nivelEnchendo}%`);
  res.json({ ok: true });
});

// Status geral
app.get('/', (req, res) => {
  const totalSubs = Object.values(subscriptions).reduce((a, b) => a + b.length, 0);
  const totalFcm  = Object.values(fcmTokens).reduce((a, b) => a + b.length, 0);
  res.json({
    status:   'online',
    mqtt:     mqttClient.connected ? 'conectado' : 'desconectado',
    webpush:  totalSubs + ' subscriptions',
    fcm:      totalFcm  + ' tokens',
    uptime:   Math.floor(process.uptime()) + 's'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Rodando na porta ${PORT}`);
});
