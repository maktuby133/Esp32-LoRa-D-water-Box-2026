
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <RadioLib.h>
#include <WebServer.h>
#include <EEPROM.h>

// ====== CONFIGURAÇÕES MQTT HIVEMQ ======
const char* MQTT_SERVER = "seu-broker.hivemq.cloud";  // Substitua pelo seu endereço HiveMQ
const int MQTT_PORT = 8883;  // Porta TLS padrão do HiveMQ
const char* MQTT_USER = "seu_usuario";  // Substitua pelo seu usuário
const char* MQTT_PASSWORD = "sua_senha";  // Substitua pela sua senha
const char* MQTT_CLIENT_ID = "RECEPTOR_CAIXA_01";

// Tópicos MQTT
const char* TOPIC_DATA = "caixa/dados";  // Publica dados do sensor
const char* TOPIC_STATUS = "caixa/status";  // Publica status do sistema
const char* TOPIC_CONFIG = "caixa/config";  // Recebe configurações

// ====== DEFINIÇÕES EEPROM ======
#define EEPROM_SIZE 512
#define SSID_ADDR 0
#define PASS_ADDR 100
#define CONFIG_FLAG_ADDR 250
#define CONFIG_FLAG_VALUE 0xAB

// ====== PINO DO BOTÃO RESET ======
#define RESET_BUTTON_PIN 25

// ====== VARIÁVEIS WiFi ======
char* AP_SSID = "RECEPTOR_LORA";
char* AP_PASSWORD = "12345678";
bool wifiConfigured = false;
String wifiSSID = "";
String wifiPassword = "";
WebServer server(80);
bool apModeActive = false;

// ====== CLIENTES WiFi E MQTT ======
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ====== CONFIG LoRa ======
LLCC68 radio = new Module(5, 33, 14, 32);

// Configuração LoRa (DEVE SER IDÊNTICA AO TRANSMISSOR):
float LORA_FREQ = 868.0;
float LORA_BW = 125.0;
uint8_t LORA_SF = 9;
uint8_t LORA_CR = 7;
uint8_t LORA_SYNC_WORD = 0x12;
int8_t LORA_POWER = 17;
uint8_t LORA_PREAMBLE = 12;

// ====== VARIÁVEIS ======
unsigned long lastLoRaReceive = 0;
const unsigned long LORA_TIMEOUT_MS = 30000;
unsigned long lastConnectionCheck = 0;
const unsigned long CONNECTION_CHECK_INTERVAL = 1000;
int16_t lastRssi = 0;
float lastSnr = 0;
volatile bool packetReceived = false;

// ====== VARIÁVEIS MQTT ======
unsigned long lastMqttAttempt = 0;
const unsigned long MQTT_RETRY_INTERVAL = 5000;
unsigned long lastStatusPublish = 0;
const unsigned long STATUS_PUBLISH_INTERVAL = 10000;

// ====== VARIÁVEIS BOTÃO ======
bool buttonPressed = false;
unsigned long buttonPressStart = 0;
const unsigned long RESET_HOLD_TIME = 5000;
const unsigned long BOOT_DELAY = 3000;
unsigned long bootCompleteTime = 0;
bool bootComplete = false;

// ====== ESTRUTURA DE DADOS (DEVE SER IDÊNTICA AO TRANSMISSOR) ======
struct SensorData {
  float distance;
  int level;
  int percentage;
  int liters;
  bool sensorOK;
  unsigned long timestamp;
  char deviceID[20];
  uint16_t crc;
  float config_altura;
  float config_volume_total;
  float config_distancia_cheia;
  float config_distancia_vazia;
};

// ====== PÁGINA HTML PARA CONFIGURAÇÃO ======
const char* htmlPage = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Configuração Receptor LoRa + MQTT</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f0f0f0;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      text-align: center;
    }
    input {
      width: 100%;
      padding: 12px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 5px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 15px;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 10px;
    }
    .connect-btn {
      background: #4CAF50;
    }
    .reset-btn {
      background: #f44336;
    }
    button:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚙️ Configurar WiFi</h1>
    <form action="/configure" method="POST">
      <input type="text" name="ssid" placeholder="Nome da Rede WiFi (SSID)" required>
      <input type="password" name="password" placeholder="Senha do WiFi" required>
      <button type="submit" class="connect-btn">Conectar</button>
    </form>
    
    <form action="/reset" method="POST" onsubmit="return confirm('Tem certeza que deseja resetar as configurações WiFi?');">
      <button type="submit" class="reset-btn">Resetar Configurações WiFi</button>
    </form>
  </div>
</body>
</html>
)rawliteral";

// ====== FUNÇÃO CRC (DEVE SER IDÊNTICA AO TRANSMISSOR) ======
uint16_t calculateCRC(uint8_t *data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (int j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return crc;
}

// ====== FUNÇÕES EEPROM ======
void initEEPROM() {
  EEPROM.begin(EEPROM_SIZE);
  Serial.println("📁 EEPROM inicializada");
}

bool hasSavedWiFiConfig() {
  uint8_t flag = EEPROM.read(CONFIG_FLAG_ADDR);
  return (flag == CONFIG_FLAG_VALUE);
}

void saveWiFiConfig(String ssid, String password) {
  for (int i = 0; i < 200; i++) {
    EEPROM.write(i, 0);
  }
  
  for (int i = 0; i < ssid.length(); i++) {
    EEPROM.write(SSID_ADDR + i, ssid[i]);
  }
  EEPROM.write(SSID_ADDR + ssid.length(), '\0');
  
  for (int i = 0; i < password.length(); i++) {
    EEPROM.write(PASS_ADDR + i, password[i]);
  }
  EEPROM.write(PASS_ADDR + password.length(), '\0');
  
  EEPROM.write(CONFIG_FLAG_ADDR, CONFIG_FLAG_VALUE);
  
  if (EEPROM.commit()) {
    Serial.println("💾 Configuração WiFi salva na EEPROM!");
  } else {
    Serial.println("❌ ERRO ao salvar na EEPROM!");
  }
}

void loadWiFiConfig() {
  char ssid[100];
  char password[100];
  
  for (int i = 0; i < 100; i++) {
    ssid[i] = EEPROM.read(SSID_ADDR + i);
    if (ssid[i] == '\0') break;
  }
  
  for (int i = 0; i < 100; i++) {
    password[i] = EEPROM.read(PASS_ADDR + i);
    if (password[i] == '\0') break;
  }
  
  wifiSSID = String(ssid);
  wifiPassword = String(password);
  
  if (wifiSSID.length() > 0) {
    wifiConfigured = true;
    Serial.println("✅ Configuração WiFi carregada:");
    Serial.println("   SSID: " + wifiSSID);
  }
}

void clearWiFiConfig() {
  for (int i = 0; i < 200; i++) {
    EEPROM.write(i, 0);
  }
  EEPROM.write(CONFIG_FLAG_ADDR, 0x00);
  
  if (EEPROM.commit()) {
    Serial.println("🗑️  Configuração WiFi apagada!");
    wifiConfigured = false;
    wifiSSID = "";
    wifiPassword = "";
  }
}

// ====== CONECTAR AO WIFI SALVO ======
bool connectToSavedWiFi() {
  if (!hasSavedWiFiConfig()) {
    Serial.println("⚠️  Nenhuma configuração WiFi salva");
    return false;
  }
  
  loadWiFiConfig();
  
  Serial.println("\n📡 Conectando ao WiFi: " + wifiSSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi conectado!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("   RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    return true;
  } else {
    Serial.println("❌ Falha ao conectar ao WiFi");
    return false;
  }
}

// ====== HANDLERS DO SERVIDOR WEB ======
void handleRoot() {
  server.send(200, "text/html", htmlPage);
}

void handleConfigure() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    String newSSID = server.arg("ssid");
    String newPassword = server.arg("password");
    
    Serial.println("\n📝 Nova configuração WiFi recebida:");
    Serial.println("   SSID: " + newSSID);
    
    saveWiFiConfig(newSSID, newPassword);
    
    server.send(200, "text/plain", "Configuração salva com sucesso! Reiniciando...");
    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Parâmetros inválidos");
  }
}

void handleReset() {
  Serial.println("\n🔄 Reset WiFi solicitado via web");
  
  for(int i = 0; i < 3; i++) {
    digitalWrite(2, HIGH);
    delay(200);
    digitalWrite(2, LOW);
    delay(200);
  }
  
  clearWiFiConfig();
  
  server.send(200, "text/plain", "Configurações resetadas! Reiniciando...");
  delay(2000);
  ESP.restart();
}

// ====== MODO AP ======
void setupWiFiAP() {
  Serial.println("\n📱 Iniciando Modo AP...");
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  delay(100);
  
  Serial.println("✅ Modo AP ativo!");
  Serial.println("   SSID: " + String(AP_SSID));
  Serial.println("   Senha: " + String(AP_PASSWORD));
  Serial.print("   IP: ");
  Serial.println(WiFi.softAPIP());
  
  server.on("/", handleRoot);
  server.on("/configure", HTTP_POST, handleConfigure);
  server.on("/reset", HTTP_POST, handleReset);
  server.begin();
  
  apModeActive = true;
}

// ====== VERIFICAR BOTÃO RESET ======
void checkResetButton() {
  int buttonState = digitalRead(RESET_BUTTON_PIN);
  
  if (buttonState == LOW && !buttonPressed) {
    buttonPressed = true;
    buttonPressStart = millis();
    Serial.println("🔘 Botão pressionado - aguardando 5 segundos...");
  }
  
  if (buttonPressed && buttonState == LOW) {
    if (millis() - buttonPressStart >= RESET_HOLD_TIME) {
      Serial.println("\n⏰ Botão pressionado por 5 segundos!");
      Serial.println("🔄 Resetando WiFi...");
      
      for(int i = 0; i < 5; i++) {
        digitalWrite(2, HIGH);
        delay(200);
        digitalWrite(2, LOW);
        delay(200);
      }
      
      clearWiFiConfig();
      
      Serial.println("🔄 Reiniciando ESP32 em 2 segundos...");
      delay(2000);
      ESP.restart();
    }
  }
  
  if (buttonState == HIGH && buttonPressed) {
    buttonPressed = false;
  }
}

// ====== CALLBACK MQTT ======
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 Mensagem recebida no tópico: ");
  Serial.println(topic);
  
  // Processar mensagens de configuração se necessário
  if (strcmp(topic, TOPIC_CONFIG) == 0) {
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload, length);
    
    // Processar configurações recebidas
    Serial.println("⚙️ Configuração recebida do servidor");
  }
}

// ====== CONECTAR AO MQTT ======
bool connectMQTT() {
  if (!wifiConfigured || WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  if (mqttClient.connected()) {
    return true;
  }
  
  if (millis() - lastMqttAttempt < MQTT_RETRY_INTERVAL) {
    return false;
  }
  
  lastMqttAttempt = millis();
  
  Serial.print("📡 Conectando ao MQTT HiveMQ...");
  
  // Configurar TLS (importante para HiveMQ Cloud)
  espClient.setInsecure(); // Para testes - em produção use certificados
  
  if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
    Serial.println(" ✅ Conectado!");
    
    // Subscrever tópico de configuração
    mqttClient.subscribe(TOPIC_CONFIG);
    
    // Publicar status de conexão
    DynamicJsonDocument doc(256);
    doc["device"] = MQTT_CLIENT_ID;
    doc["status"] = "online";
    doc["timestamp"] = millis();
    
    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_STATUS, buffer);
    
    return true;
  } else {
    Serial.print(" ❌ Falha, rc=");
    Serial.println(mqttClient.state());
    return false;
  }
}

// ====== PUBLICAR DADOS NO MQTT ======
void publishSensorData(SensorData &data, int16_t rssi, float snr) {
  if (!mqttClient.connected()) {
    return;
  }
  
  // Criar JSON com os dados
  DynamicJsonDocument doc(1024);
  
  doc["device"] = data.deviceID;
  doc["distance"] = data.distance;
  doc["level"] = data.level;
  doc["percentage"] = data.percentage;
  doc["liters"] = data.liters;
  doc["sensor_ok"] = data.sensorOK;
  doc["timestamp"] = millis();
  
  // Sinal LoRa
  JsonObject lora = doc.createNestedObject("lora_signal");
  lora["rssi"] = rssi;
  lora["snr"] = snr;
  lora["quality"] = calculateSignalQuality(rssi, snr);
  
  // Configuração da caixa
  JsonObject config = doc.createNestedObject("config");
  config["altura"] = data.config_altura;
  config["volume_total"] = data.config_volume_total;
  config["distancia_cheia"] = data.config_distancia_cheia;
  config["distancia_vazia"] = data.config_distancia_vazia;
  
  // Sinal WiFi
  doc["wifi_rssi"] = WiFi.RSSI();
  
  char buffer[1024];
  serializeJson(doc, buffer);
  
  if (mqttClient.publish(TOPIC_DATA, buffer)) {
    Serial.println("✅ Dados publicados no MQTT!");
  } else {
    Serial.println("❌ Falha ao publicar no MQTT");
  }
}

// ====== PUBLICAR STATUS ======
void publishStatus() {
  if (!mqttClient.connected()) {
    return;
  }
  
  if (millis() - lastStatusPublish < STATUS_PUBLISH_INTERVAL) {
    return;
  }
  
  lastStatusPublish = millis();
  
  DynamicJsonDocument doc(512);
  doc["device"] = MQTT_CLIENT_ID;
  doc["status"] = "online";
  doc["uptime"] = millis() / 1000;
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["lora_last_receive"] = (millis() - lastLoRaReceive) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  
  char buffer[512];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_STATUS, buffer);
}

// ====== CALCULAR QUALIDADE DO SINAL ======
int calculateSignalQuality(int16_t rssi, float snr) {
  int quality = 0;
  
  if (rssi >= -40) quality = 100;
  else if (rssi >= -50) quality = 95;
  else if (rssi >= -60) quality = 85;
  else if (rssi >= -70) quality = 75;
  else if (rssi >= -80) quality = 65;
  else if (rssi >= -90) quality = 50;
  else if (rssi >= -100) quality = 30;
  else if (rssi >= -110) quality = 15;
  else quality = 5;
  
  if (snr > 10) quality = min(100, quality + 15);
  else if (snr > 5) quality = min(100, quality + 10);
  else if (snr < -5) quality = max(0, quality - 20);
  else if (snr < 0) quality = max(0, quality - 10);
  
  return quality;
}

// ====== CALLBACK DE INTERRUPÇÃO LoRa ======
void IRAM_ATTR onReceive() {
  packetReceived = true;
}

// ====== INICIALIZAÇÃO LORA ======
bool initLoRaRX() {
  Serial.println("\n📡 Inicializando receptor LoRa...");
  
  int state = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR, 
                         LORA_SYNC_WORD, LORA_POWER, LORA_PREAMBLE);
  
  if (state == RADIOLIB_ERR_NONE) {
    radio.setCRC(true);
    radio.setDio1Action(onReceive);
    
    int rxState = radio.startReceive();
    if (rxState == RADIOLIB_ERR_NONE) {
      Serial.println("✅ Receptor LoRa inicializado!");
      Serial.println("📊 Configuração:");
      Serial.printf("   📶 Frequência: %.1f MHz\n", LORA_FREQ);
      Serial.printf("   📏 Spreading Factor: %d\n", LORA_SF);
      Serial.printf("   🔧 Coding Rate: 4/%d\n", LORA_CR);
      Serial.println("   🔔 Modo: Interrupção DIO1");
      
      return true;
    }
  }
  
  Serial.printf("❌ Falha LoRa: %d\n", state);
  return false;
}

// ====== SETUP ======
void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n🚀 ====== RECEPTOR LoRa + MQTT HiveMQ =====");
  Serial.println("📅 Versão MQTT " __DATE__ " " __TIME__);
  Serial.println("=======================================\n");

  pinMode(2, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(2, LOW);
  
  // Piscar LED durante inicialização
  for(int i = 0; i < 5; i++) {
    digitalWrite(2, HIGH);
    delay(200);
    digitalWrite(2, LOW);
    delay(200);
  }

  // Inicializar EEPROM
  initEEPROM();
  
  Serial.println("⏳ Aguardando inicialização completa...");
  delay(BOOT_DELAY);
  
  // Tentar conectar ao WiFi salvo
  bool connected = connectToSavedWiFi();
  
  if (!connected) {
    setupWiFiAP();
    digitalWrite(2, HIGH);
  } else {
    apModeActive = false;
    Serial.println("✅ WiFi conectado - Modo AP não ativado");
    
    // Configurar MQTT
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(1024);
    
    // Tentar conectar ao MQTT
    connectMQTT();
    
    digitalWrite(2, HIGH);
  }

  // Inicializar LoRa
  if (initLoRaRX()) {
    Serial.println("\n✅ Sistema LoRa inicializado!");
    lastLoRaReceive = millis();
  } else {
    Serial.println("\n❌ Falha crítica LoRa");
    while(1) {
      digitalWrite(2, HIGH);
      delay(100);
      digitalWrite(2, LOW);
      delay(100);
    }
  }

  bootCompleteTime = millis();
  bootComplete = true;
  
  Serial.println("\n🎯 SISTEMA PRONTO!");
  if (!wifiConfigured) {
    Serial.println("📱 Conecte-se ao WiFi do receptor para configurar");
  } else {
    Serial.println("📡 Conectado ao WiFi e MQTT HiveMQ");
  }
  Serial.println("📶 Aguardando dados LoRa...");
  Serial.println("🔘 Botão no pino 25 - pressione 5s para reset WiFi\n");
}

// ====== LOOP ======
void loop() {
  static unsigned long packetCount = 0;
  static unsigned long lastStatus = 0;
  static unsigned long lastTimestamp = 0;
  static unsigned long lastRxCheck = 0;
  
  // Verificar botão reset
  if (bootComplete && (millis() - bootCompleteTime > 5000)) {
    checkResetButton();
  }
  
  // Servir página web se AP ativo
  if (apModeActive) {
    server.handleClient();
    
    // Piscar LED lentamente em modo AP
    static unsigned long apBlink = 0;
    if (millis() - apBlink >= 1000) {
      digitalWrite(2, !digitalRead(2));
      apBlink = millis();
    }
  } else {
    // Manter conexão MQTT
    if (!mqttClient.connected()) {
      connectMQTT();
    }
    mqttClient.loop();
    
    // Publicar status periodicamente
    publishStatus();
    
    // VERIFICAÇÃO PERIÓDICA: Garantir que LoRa está em modo RX
    if (millis() - lastRxCheck >= 5000) {
      lastRxCheck = millis();
      radio.startReceive();
    }
    
    // Verificar se recebeu pacote LoRa
    if (packetReceived) {
      packetReceived = false;
      
      uint8_t buffer[256];
      int state = radio.readData(buffer, sizeof(SensorData));
      
      if (state == RADIOLIB_ERR_NONE) {
        SensorData data;
        memcpy(&data, buffer, sizeof(SensorData));
        
        // Verificar CRC
        uint16_t receivedCRC = data.crc;
        data.crc = 0;
        uint16_t calculatedCRC = calculateCRC((uint8_t*)&data, sizeof(SensorData));
        data.crc = receivedCRC;
        
        if (receivedCRC == calculatedCRC && data.timestamp != lastTimestamp) {
          // PACOTE NOVO E VÁLIDO
          packetCount++;
          lastRssi = radio.getRSSI();
          lastSnr = radio.getSNR();
          lastLoRaReceive = millis();
          lastTimestamp = data.timestamp;
          
          Serial.println("\n🎉 PACOTE RECEBIDO! 🎉");
          Serial.printf("📦 Pacote #%lu | RSSI: %d dBm | SNR: %.1f dB\n", 
                        packetCount, lastRssi, lastSnr);
          
          // Piscar LED
          for(int i = 0; i < 3; i++) {
            digitalWrite(2, HIGH);
            delay(50);
            digitalWrite(2, LOW);
            delay(50);
          }
          digitalWrite(2, HIGH);
          
          Serial.println("✅ Dados válidos recebidos!");
          Serial.printf("📱 Dispositivo: %s\n", data.deviceID);
          Serial.printf("📏 Distância: %.2f cm\n", data.distance);
          Serial.printf("💧 Nível: %d%% (%d L)\n", data.percentage, data.liters);
          
          // PUBLICAR NO MQTT
          if (mqttClient.connected()) {
            publishSensorData(data, lastRssi, lastSnr);
          } else {
            Serial.println("⚠️  MQTT desconectado - dados não enviados");
          }
          
          Serial.println("================================\n");
        }
      }
      
      radio.startReceive();
      lastRxCheck = millis();
    }
    
    // Reconectar WiFi se necessário
    if (wifiConfigured && WiFi.status() != WL_CONNECTED) {
      static unsigned long lastReconnectAttempt = 0;
      if (millis() - lastReconnectAttempt > 10000) {
        Serial.println("📡 WiFi desconectado - tentando reconectar...");
        WiFi.reconnect();
        lastReconnectAttempt = millis();
      }
    }
  }
  
  // Status a cada 30 segundos
  if (millis() - lastStatus >= 30000) {
    lastStatus = millis();
    
    if (apModeActive) {
      Serial.println("📱 MODO AP: Aguardando configuração WiFi");
    } else if (!wifiConfigured) {
      Serial.println("❌ WiFi não configurado");
    } else {
      String wifiStatus = (WiFi.status() == WL_CONNECTED) ? "Conectado" : "Desconectado";
      String mqttStatus = mqttClient.connected() ? "Conectado" : "Desconectado";
      
      Serial.printf("📊 STATUS | WiFi: %s | MQTT: %s | Pacotes: %lu | Último LoRa: %lu seg\n",
                    wifiStatus.c_str(), mqttStatus.c_str(), packetCount, 
                    (millis() - lastLoRaReceive) / 1000);
    }
  }
  
  delay(10);
}
