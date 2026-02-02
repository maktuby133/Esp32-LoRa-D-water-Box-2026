import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import fs from "fs";
import mqtt from 'mqtt';

// Carrega variáveis do arquivo .env (se existir localmente)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public")); // Pasta onde está o HTML

// ==========================================
// CONFIGURAÇÃO MQTT - SEUS DADOS HIVE MQ
// ==========================================
const MQTT_BROKER = process.env.MQTT_BROKER || "006d70cbbb9d44c2a347d2a3903c8f9a.s1.eu.hivemq.cloud";
const MQTT_PORT = parseInt(process.env.MQTT_PORT) || 8883;
const MQTT_USER = process.env.MQTT_USER || "esp32-receptor";
const MQTT_PASS = process.env.MQTT_PASS || "061084Cc@";

const TOPIC_DADOS = "caixas/agua/dados";
const TOPIC_STATUS = "caixas/agua/status";
const TOPIC_COMANDOS = "caixas/agua/comandos";

// ==========================================
// VARIÁVEIS GLOBAIS (memória do servidor)
// ==========================================
let historico = []; // Últimas 500 leituras
let ultimoDado = null; // Dado mais recente
let caixaConfig = {
  altura: 0,
  volumeTotal: 0,
  distanciaCheia: 0,
  distanciaVazia: 0,
  updatedAt: null
};

let systemStatus = {
  receptorOnline: false,
  ultimaMensagem: null,
  mqttConectado: false
};

// ==========================================
// CONEXÃO MQTT COM HIVE MQ
// ==========================================
console.log(`🔌 Iniciando conexão MQTT...`);
console.log(`   Broker: ${MQTT_BROKER}:${MQTT_PORT}`);
console.log(`   User: ${MQTT_USER}`);

const client = mqtt.connect(`mqtts://${MQTT_BROKER}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASS,
  rejectUnauthorized: true, // Verifica certificado SSL
  clientId: `render-server-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 5000, // Tenta reconectar a cada 5s se cair
});

// Evento: Conectou com sucesso
client.on('connect', () => {
  console.log('✅ CONECTADO AO HIVE MQ!');
  systemStatus.mqttConectado = true;
  
  // Se inscreve nos tópicos para receber dados
  client.subscribe([TOPIC_DADOS, TOPIC_STATUS], (err) => {
    if (err) {
      console.error('❌ Erro ao se inscrever:', err);
    } else {
      console.log(`📡 Inscrito em: ${TOPIC_DADOS}`);
      console.log(`📡 Inscrito em: ${TOPIC_STATUS}`);
      console.log('⏳ Aguardando dados do ESP32...');
    }
  });
});

// Evento: Recebeu mensagem do ESP32
client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    systemStatus.ultimaMensagem = new Date().toISOString();
    systemStatus.receptorOnline = true;
    
    // Se for dados do sensor (tópico dados)
    if (topic === TOPIC_DADOS) {
      console.log(`📥 Recebido: ${payload.percentage}% | ${payload.liters}L | RSSI:${payload.lora_rssi}`);
      
      // Atualiza config da caixa se vier nos dados
      if (payload.config_volume_total > 0) {
        caixaConfig = {
          altura: payload.config_altura,
          volumeTotal: payload.config_volume_total,
          distanciaCheia: payload.config_distancia_cheia,
          distanciaVazia: payload.config_distancia_vazia,
          updatedAt: new Date().toISOString()
        };
        // Salva em arquivo para não perder se servidor reiniciar
        fs.writeFileSync('config.json', JSON.stringify(caixaConfig));
      }
      
      // Adiciona ao histórico
      const registro = {
        device: payload.device || "TX_CAIXA_01",
        distance: payload.distance,
        level: payload.level,
        percentage: payload.percentage,
        liters: payload.liters,
        sensor_ok: payload.sensor_ok,
        timestamp: new Date().toISOString(),
        status: payload.sensor_ok ? "normal" : "sensor_error",
        lora_signal: {
          rssi: payload.lora_rssi,
          snr: payload.lora_snr,
          quality: payload.signal_quality || 85
        }
      };
      
      historico.push(registro);
      ultimoDado = registro;
      
      // Mantém apenas últimos 500 registros
      if (historico.length > 500) {
        historico.shift();
      }
    }
    
    // Se for status do receptor (online/offline)
    if (topic === TOPIC_STATUS) {
      if (payload.status === "online") {
        console.log("✅ Receptor reportou: ONLINE");
        systemStatus.receptorOnline = true;
      } else if (payload.status === "offline") {
        console.log("⚠️ Receptor desconectou");
        systemStatus.receptorOnline = false;
      }
    }
    
  } catch (e) {
    console.error('❌ Erro ao processar:', e.message);
  }
});

// Evento: Erro de conexão
client.on('error', (err) => {
  console.error('❌ Erro MQTT:', err.message);
  systemStatus.mqttConectado = false;
});

// Evento: Desconectou
client.on('disconnect', () => {
  console.log('⚠️ Desconectado do HiveMQ');
  systemStatus.mqttConectado = false;
});

// ==========================================
// API HTTP (para o Dashboard consultar)
// ==========================================

// Rota principal do Dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API que o HTML consulta a cada 5 segundos
app.get("/api/lora", (req, res) => {
  // Verifica se está desatualizado (mais de 2 minutos sem dados)
  const agora = new Date();
  const ultima = systemStatus.ultimaMensagem ? new Date(systemStatus.ultimaMensagem) : null;
  const desatualizado = ultima ? (agora - ultima) > 120000 : true;
  
  let resposta;
  
  if (!systemStatus.receptorOnline || desatualizado || !ultimoDado) {
    resposta = {
      device: "TX_CAIXA_01",
      distance: -1,
      level: -1,
      percentage: -1,
      liters: -1,
      sensor_ok: false,
      status: "waiting_lora",
      timestamp: new Date().toISOString(),
      message: desatualizado ? "Aguardando dados..." : "Receptor offline",
      receptor_connected: systemStatus.receptorOnline,
      lora_connected: !desatualizado,
      caixa_config: caixaConfig,
      historico: historico.slice(-20).reverse() // Últimos 20, mais recentes primeiro
    };
  } else {
    resposta = {
      ...ultimoDado,
      receptor_connected: true,
      lora_connected: true,
      caixa_config: caixaConfig,
      historico: historico.slice(-20).reverse()
    };
  }
  
  res.json(resposta);
});

// Rota de teste
app.get("/api/test", (req, res) => {
  res.json({
    status: "OK",
    mqtt_conectado: systemStatus.mqttConectado,
    receptor_online: systemStatus.receptorOnline,
    ultima_mensagem: systemStatus.ultimaMensagem,
    total_registros: historico.length
  });
});

// Rota para enviar comandos ao ESP32 (reboot, etc)
app.post("/api/comando", express.json(), (req, res) => {
  const { comando } = req.body;
  
  if (!client.connected()) {
    return res.status(503).json({ error: "MQTT desconectado" });
  }
  
  client.publish(TOPIC_COMANDOS, comando);
  console.log(`📤 Comando enviado: ${comando}`);
  
  res.json({ success: true, comando: comando });
});

// ==========================================
// INICIA SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 SERVIDOR HTTP RODANDO NA PORTA ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`   ou no Render: https://seu-app.onrender.com`);
  console.log(`\n⏳ Conectando ao HiveMQ...`);
});
