import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import fs from "fs";
import mqtt from 'mqtt';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== CONFIGURAÇÃO MQTT ======
const MQTT_BROKER = process.env.MQTT_BROKER || "SEU-CLUSTER.hivemq.cloud";
const MQTT_PORT = process.env.MQTT_PORT || 8883;
const MQTT_USER = process.env.MQTT_USER || "esp32-receptor";
const MQTT_PASS = process.env.MQTT_PASS || "SuaSenhaSegura123";

// Tópicos
const TOPIC_DADOS = "caixas/agua/dados";
const TOPIC_STATUS = "caixas/agua/status";

// ====== VARIÁVEIS GLOBAIS (iguais ao seu código) ======
let historico = [];
let caixaConfig = { altura: 0, volumeTotal: 0, distanciaCheia: 0, distanciaVazia: 0, updatedAt: null };
let systemStatus = {
  receptor: { connected: false, lastSeen: Date.now(), wifiSignal: -50 },
  lora: { connected: false, lastPacket: null, quality: 0, rssi: null },
  sensor: { hasError: false }
};

let lastReceptorRequest = Date.now();

// ====== CONEXÃO MQTT ======
console.log(`🔌 Conectando ao HiveMQ: ${MQTT_BROKER}...`);

const client = mqtt.connect(`mqtts://${MQTT_BROKER}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASS,
  rejectUnauthorized: true, // Verificar certificado TLS
  clientId: `server-node-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('✅ Conectado ao HiveMQ Cloud!');
  
  // Inscrever-se nos tópicos
  client.subscribe([TOPIC_DADOS, TOPIC_STATUS], (err) => {
    if (err) {
      console.error('❌ Erro ao inscrever:', err);
    } else {
      console.log(`📡 Inscrito em: ${TOPIC_DADOS}, ${TOPIC_STATUS}`);
    }
  });
});

client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    lastReceptorRequest = Date.now();
    
    if (topic === TOPIC_DADOS) {
      console.log(`📥 Dados recebidos de ${payload.device}`);
      
      // Atualizar status
      systemStatus.receptor.connected = true;
      systemStatus.receptor.lastSeen = Date.now();
      systemStatus.receptor.wifiSignal = payload.wifi_rssi || -50;
      systemStatus.lora.connected = true;
      systemStatus.lora.lastPacket = Date.now();
      systemStatus.lora.quality = payload.signal_quality || 0;
      systemStatus.lora.rssi = payload.lora_rssi;
      
      // Verificar erro no sensor
      if (payload.sensor_ok === false || payload.distance === -1) {
        systemStatus.sensor.hasError = true;
      } else {
        systemStatus.sensor.hasError = false;
      }
      
      // Atualizar config da caixa se vier nos dados
      if (payload.config_volume_total > 0) {
        caixaConfig = {
          altura: payload.config_altura,
          volumeTotal: payload.config_volume_total,
          distanciaCheia: payload.config_distancia_cheia,
          distanciaVazia: payload.config_distancia_vazia,
          updatedAt: new Date().toISOString()
        };
        // Salvar em arquivo para não perder
        fs.writeFileSync('config-caixa.json', JSON.stringify(caixaConfig));
      }
      
      // Adicionar ao histórico
      const registro = {
        device: payload.device || "ESP32",
        distance: payload.distance,
        level: payload.level,
        percentage: payload.percentage,
        liters: payload.liters,
        sensor_ok: payload.sensor_ok,
        timestamp: new Date().toISOString(),
        status: systemStatus.sensor.hasError ? "sensor_error" : "normal",
        lora_signal: {
          rssi: payload.lora_rssi,
          snr: payload.lora_snr,
          quality: payload.signal_quality
        }
      };
      
      historico.push(registro);
      if (historico.length > 500) historico.shift();
      console.log(`✅ Dados processados: ${payload.percentage}% | ${payload.liters}L`);
    }
    
    else if (topic === TOPIC_STATUS) {
      if (payload.status === "online") {
        systemStatus.receptor.connected = true;
        console.log("✅ Receptor reportou status: ONLINE");
      } else if (payload.status === "offline") {
        systemStatus.receptor.connected = false;
        console.log("⚠️ Receptor desconectou (Last Will)");
      }
    }
    
  } catch (e) {
    console.error('❌ Erro ao processar mensagem:', e);
  }
});

client.on('error', (err) => {
  console.error('❌ Erro MQTT:', err);
});

client.on('disconnect', () => {
  console.log('⚠️ Desconectado do MQTT');
});

// ====== VERIFICAÇÃO DE TIMEOUT (60s sem mensagens) ======
setInterval(() => {
  const timeSinceLast = Date.now() - lastReceptorRequest;
  if (timeSinceLast > 60000) {
    if (systemStatus.receptor.connected) {
      systemStatus.receptor.connected = false;
      console.log(`⏰ Receptor offline (sem mensagens há ${Math.floor(timeSinceLast/1000)}s)`);
    }
  }
}, 10000);

// ====== API HTTP (mantida para o Dashboard) ======

// Função auxiliar cálculo consumo (copiar do seu código atual)
function calcularConsumo(index) {
  // ... (mesma função do seu server.js atual)
  return { uso1h: null, usoSemana: null, usoMes: null };
}

// Rota principal do Dashboard (GET /api/lora)
app.get("/api/lora", (req, res) => {
  // Preparar resposta igual ao seu código atual
  let responseData;
  const hasRecentData = historico.length > 0 && 
    (Date.now() - new Date(historico[historico.length-1].timestamp).getTime()) < 120000;

  if (!systemStatus.receptor.connected) {
    responseData = {
      device: "RECEPTOR_CASA",
      distance: -1, level: -1, percentage: -1, liters: -1,
      status: "receptor_disconnected",
      receptor_connected: false,
      message: "Receptor offline"
    };
  } else if (systemStatus.sensor.hasError) {
    const last = historico[historico.length-1] || {};
    responseData = { ...last, status: "sensor_error", sensor_error: true };
  } else if (historico.length > 0 && hasRecentData) {
    const last = historico[historico.length-1];
    responseData = {
      ...last,
      display_mode: "normal",
      receptor_connected: true,
      lora_connected: true
    };
  } else {
    // Aguardando dados LoRa (receptor online mas sem pacotes recentes)
    responseData = {
      device: "RECEPTOR_CASA",
      distance: -1, level: -1, percentage: -1, liters: -1,
      status: "waiting_lora",
      receptor_connected: true,
      lora_connected: false,
      message: "Aguardando dados LoRa"
    };
  }

  // Adicionar histórico e configs
  const historicoComConsumo = historico.slice(-100).map((item, idx) => {
    const consumo = calcularConsumo(historico.indexOf(item));
    return { ...item, uso_1h: consumo.uso1h, uso_semana: consumo.usoSemana };
  }).reverse();

  res.json({
    ...responseData,
    caixa_config: caixaConfig,
    receptor_status: systemStatus.receptor,
    lora_status: systemStatus.lora,
    historico: historicoComConsumo,
    system_info: {
      server_time: new Date().toISOString(),
      mqtt_connected: client.connected
    }
  });
});

// Rota de teste
app.get("/api/test", (req, res) => {
  res.json({ 
    status: "MQTT Server funcionando", 
    mqtt_connected: client.connected,
    historico_count: historico.length 
  });
});

// Comandos (exemplo: reiniciar receptor remotamente)
app.post("/api/comando", (req, res) => {
  const { comando } = req.body;
  if (client.connected) {
    client.publish("caixas/agua/comandos", comando);
    res.json({ success: true, message: `Comando ${comando} enviado` });
  } else {
    res.status(503).json({ error: "MQTT desconectado" });
  }
});

// Servir arquivos estáticos (dashboard HTML)
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor HTTP na porta ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 Sistema MQTT ativo (HiveMQ Cloud)`);
});
