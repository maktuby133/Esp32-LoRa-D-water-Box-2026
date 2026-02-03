import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import fs from "fs";
import mqtt from 'mqtt';
import http from 'http';

// ==========================================
// TRATAMENTO GLOBAL DE ERROS — IMPEDE CRASH
// ==========================================
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});

// ==========================================
// SETUP
// ==========================================
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ==========================================
// CONFIGURAÇÃO MQTT
// ==========================================
const MQTT_BROKER = process.env.MQTT_BROKER || "006d70cbbb9d44c2a347d2a3903c8f9a.s1.eu.hivemq.cloud";
const MQTT_PORT   = parseInt(process.env.MQTT_PORT) || 8883;
const MQTT_USER   = process.env.MQTT_USER || "esp32-receptor";
const MQTT_PASS   = process.env.MQTT_PASS || "061084Cc@";

const TOPIC_DADOS    = "caixas/agua/dados";
const TOPIC_STATUS   = "caixas/agua/status";
const TOPIC_COMANDOS = "caixas/agua/comandos";

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let historico   = [];
let ultimoDado  = null;
let caixaConfig = { altura: 0, volumeTotal: 0, distanciaCheia: 0, distanciaVazia: 0, updatedAt: null };
let systemStatus = { receptorOnline: false, ultimaMensagem: null, mqttConectado: false };

// Carrega config salva anteriormente
try {
  if (fs.existsSync('config.json')) {
    caixaConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    console.log('📂 Config carregada:', caixaConfig);
  }
} catch (e) {
  console.warn('⚠️ Não foi possível carregar config.json:', e.message);
}

// ==========================================
// MQTT — CONEXÃO COM RECONEXÃO MANUAL
// ==========================================
let mqttClient         = null;
let mqttReconnectTimer = null;

function conectarMQTT() {
  if (mqttClient) {
    try { mqttClient.removeAllListeners(); mqttClient.end(true); } catch (e) { /* ignora */ }
    mqttClient = null;
  }

  console.log('🔄 Conectando ao MQTT...');

  try {
    mqttClient = mqtt.connect(`mqtts://${MQTT_BROKER}:${MQTT_PORT}`, {
      username:           MQTT_USER,
      password:           MQTT_PASS,
      rejectUnauthorized: false,
      clientId:           `render-${Date.now()}-${Math.random().toString(16).substr(2,6)}`,
      clean:              true,
      connectTimeout:     10000,
      reconnectPeriod:    0,
      keepAlive:          60,
    });

    mqttClient.on('connect', () => {
      console.log('✅ CONECTADO AO HIVE MQ!');
      systemStatus.mqttConectado = true;
      if (mqttReconnectTimer) { clearTimeout(mqttReconnectTimer); mqttReconnectTimer = null; }

      mqttClient.subscribe([TOPIC_DADOS, TOPIC_STATUS], (err) => {
        if (err) console.error('❌ Erro ao inscrever:', err);
        else {
          console.log(`📡 Inscrito em: ${TOPIC_DADOS}`);
          console.log(`📡 Inscrito em: ${TOPIC_STATUS}`);
        }
      });
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        systemStatus.ultimaMensagem = new Date().toISOString();
        systemStatus.receptorOnline = true;

        if (topic === TOPIC_DADOS) {
          console.log(`📥 ${payload.percentage}% | ${payload.liters}L | RSSI:${payload.lora_rssi}`);

          if (payload.config_volume_total > 0) {
            caixaConfig = {
              altura:         payload.config_altura,
              volumeTotal:    payload.config_volume_total,
              distanciaCheia: payload.config_distancia_cheia,
              distanciaVazia: payload.config_distancia_vazia,
              updatedAt:      new Date().toISOString()
            };
            try { fs.writeFileSync('config.json', JSON.stringify(caixaConfig)); }
            catch (e) { console.warn('⚠️ Falha ao salvar config.json:', e.message); }
          }

          const registro = {
            device:     payload.device || "TX_CAIXA_01",
            distance:   payload.distance,
            level:      payload.level,
            percentage: payload.percentage,
            liters:     payload.liters,
            sensor_ok:  payload.sensor_ok,
            timestamp:  new Date().toISOString(),
            status:     payload.sensor_ok ? "normal" : "sensor_error",
            lora_signal: { rssi: payload.lora_rssi, snr: payload.lora_snr, quality: payload.signal_quality || 85 }
          };

          historico.push(registro);
          ultimoDado = registro;
          if (historico.length > 500) historico.shift();
        }

        if (topic === TOPIC_STATUS) {
          if (payload.status === "online")  { console.log("✅ Receptor: ONLINE");  systemStatus.receptorOnline = true;  }
          if (payload.status === "offline") { console.log("⚠️ Receptor: OFFLINE"); systemStatus.receptorOnline = false; }
        }
      } catch (e) {
        console.error('❌ Erro ao processar mensagem:', e.message);
      }
    });

    mqttClient.on('error',      (err) => { console.error('❌ MQTT erro:', err.message);  systemStatus.mqttConectado = false; agendarReconexao(); });
    mqttClient.on('disconnect', ()    => { console.log('⚠️ MQTT desconectado');         systemStatus.mqttConectado = false; agendarReconexao(); });
    mqttClient.on('close',      ()    => { console.log('⚠️ MQTT conexão fechada');      systemStatus.mqttConectado = false; agendarReconexao(); });

  } catch (e) {
    console.error('❌ Falha ao criar cliente MQTT:', e.message);
    systemStatus.mqttConectado = false;
    agendarReconexao();
  }
}

function agendarReconexao() {
  if (mqttReconnectTimer) return;
  console.log('🔄 Reconexão MQTT agendada em 10s...');
  mqttReconnectTimer = setTimeout(() => { mqttReconnectTimer = null; conectarMQTT(); }, 10000);
}

conectarMQTT();

// ==========================================
// ROTAS HTTP
// ==========================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health",     (req, res) => res.status(200).json({ status: "OK", uptime: process.uptime().toFixed(1) + "s", mqtt: systemStatus.mqttConectado, ts: new Date().toISOString() }));
app.get("/keep-alive", (req, res) => res.status(200).json({ alive: true, ts: new Date().toISOString() }));

app.get("/api/lora", (req, res) => {
  const agora         = new Date();
  const ultima        = systemStatus.ultimaMensagem ? new Date(systemStatus.ultimaMensagem) : null;
  const desatualizado = ultima ? (agora - ultima) > 120000 : true;

  if (!systemStatus.receptorOnline || desatualizado || !ultimoDado) {
    return res.json({
      device: "TX_CAIXA_01", distance: -1, level: -1, percentage: -1, liters: -1,
      sensor_ok: false, status: "waiting_lora",
      timestamp:          new Date().toISOString(),
      message:            desatualizado ? "Aguardando dados..." : "Receptor offline",
      receptor_connected: systemStatus.receptorOnline,
      lora_connected:     !desatualizado,
      caixa_config:       caixaConfig,
      historico:          historico.slice(-20).reverse()
    });
  }

  res.json({ ...ultimoDado, receptor_connected: true, lora_connected: true, caixa_config: caixaConfig, historico: historico.slice(-20).reverse() });
});

app.get("/api/test", (req, res) => {
  res.json({ status: "OK", mqtt_conectado: systemStatus.mqttConectado, receptor_online: systemStatus.receptorOnline, ultima_mensagem: systemStatus.ultimaMensagem, total_registros: historico.length });
});

app.post("/api/comando", (req, res) => {
  const { comando } = req.body;
  if (!comando)                             return res.status(400).json({ error: "Comando não informado" });
  if (!mqttClient || !mqttClient.connected) return res.status(503).json({ error: "MQTT desconectado" });

  try {
    mqttClient.publish(TOPIC_COMANDOS, comando);
    console.log(`📤 Comando enviado: ${comando}`);
    res.json({ success: true, comando });
  } catch (e) {
    res.status(500).json({ error: "Falha ao enviar: " + e.message });
  }
});

// ==========================================
// INICIA SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SERVIDOR HTTP NA PORTA ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}\n`);
});

// ==========================================
// KEEP-ALIVE INTERNO (SELF-PING)
// Faz ping para si mesmo via http nativo a cada 14 min.
// Mantém o Render free plan ativo sem serviço externo.
// ==========================================
const PING_INTERVAL = 14 * 60 * 1000;

console.log(`🤖 Keep-alive interno: self-ping a cada 14 min`);

function selfPing() {
  const req = http.get({ hostname: 'localhost', port: PORT, path: '/health', method: 'GET' }, (res) => {
    res.resume();
    console.log(`🏓 Self-ping: ${res.statusCode} — ${new Date().toLocaleTimeString()}`);
  });
  req.on('error', (err) => console.warn(`⚠️ Self-ping falhou: ${err.message}`));
  req.end();
}

setTimeout(selfPing, 5000);
setInterval(selfPing, PING_INTERVAL);
