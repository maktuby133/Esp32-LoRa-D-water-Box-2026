# 🌊 Sistema de Monitoramento de Caixa d'Água via LoRa + MQTT

Sistema completo de monitoramento de nível de caixa d'água usando comunicação LoRa e MQTT (HiveMQ Cloud).

---

## 📋 VISÃO GERAL

Este projeto permite monitorar em tempo real o nível de água da sua caixa d'água de qualquer lugar do mundo através de um dashboard web.

### Como Funciona:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Transmissor    │         │    Receptor      │         │   HiveMQ Cloud  │
│    ESP32        │ --LoRa→ │     ESP32        │ --MQTT→ │    (Broker)     │
│  + Sensor HC-SR04│        │   + WiFi         │         │                 │
└─────────────────┘         └──────────────────┘         └────────┬────────┘
                                                                   │
      📏 Mede distância                                      WebSocket
         da água                                                   │
                                                          ┌────────▼────────┐
                                                          │   Dashboard     │
                                                          │    Web HTML     │
                                                          └─────────────────┘
                                                           🖥️ Veja de qualquer
                                                              lugar!
```

---

## ✨ FUNCIONALIDADES

- ✅ **Monitoramento em tempo real** do nível da caixa
- ✅ **Comunicação LoRa** de longo alcance (até 1.5km)
- ✅ **Dashboard web** acessível de qualquer dispositivo
- ✅ **Gráfico de histórico** das últimas 24 horas
- ✅ **Visualização em litros e percentual**
- ✅ **Indicadores de qualidade de sinal** (WiFi e LoRa)
- ✅ **Alertas visuais** de nível baixo
- ✅ **100% Gratuito** (HiveMQ Cloud plano Free)
- ✅ **Sempre online** (não desliga como Render)

---

## 🛠️ COMPONENTES NECESSÁRIOS

### Hardware:

**Para o Transmissor:**
- 1x ESP32 (qualquer modelo)
- 1x Módulo LoRa LLCC68 (ou SX1262/SX1268)
- 1x Sensor Ultrassônico HC-SR04
- 1x Antena LoRa 868MHz
- Cabos jumper
- Fonte de alimentação 5V

**Para o Receptor:**
- 1x ESP32 (qualquer modelo)
- 1x Módulo LoRa LLCC68 (ou SX1262/SX1268)
- 1x Antena LoRa 868MHz
- Cabos jumper
- Fonte de alimentação 5V
- Acesso WiFi

### Software:
- Arduino IDE (1.8.x ou 2.x)
- Navegador web moderno (Chrome, Firefox, Edge)
- Conta gratuita no HiveMQ Cloud

---

## 📦 ARQUIVOS DO PROJETO

```
📁 Sistema Caixa d'Água - MQTT
│
├── 📄 RECEPTOR_MQTT.ino              ← Código do ESP32 Receptor
├── 📄 CODIGO_TRANSMISSOR.txt         ← Código do ESP32 Transmissor (não muda!)
├── 📄 dashboard_mqtt.html            ← Dashboard web
│
├── 📖 GUIA_CONFIGURACAO_HIVEMQ.md    ← Guia completo passo a passo
├── 📖 BIBLIOTECAS_NECESSARIAS.md     ← Lista de bibliotecas Arduino
└── 📖 README.md                      ← Este arquivo
```

---

## 🚀 INSTALAÇÃO RÁPIDA

### 1️⃣ Criar Conta no HiveMQ Cloud
1. Acesse: https://www.hivemq.com/mqtt-cloud-broker/
2. Crie uma conta gratuita
3. Crie um cluster (broker) MQTT
4. Anote: URL do broker, usuário e senha

### 2️⃣ Configurar ESP32 Receptor
1. Instale as bibliotecas necessárias (veja `BIBLIOTECAS_NECESSARIAS.md`)
2. Abra `RECEPTOR_MQTT.ino` no Arduino IDE
3. Edite as configurações MQTT com seus dados do HiveMQ
4. Compile e envie para o ESP32
5. Configure o WiFi via Access Point (veja instruções abaixo)

### 3️⃣ Configurar Dashboard
1. Abra `dashboard_mqtt.html` em um editor de texto
2. Edite as configurações MQTT no código HTML
3. Abra o arquivo no navegador ou hospede online (Netlify, GitHub Pages)

### 4️⃣ Ligar Transmissor
1. O transmissor não precisa ser alterado!
2. Use o código que você já tem (`CODIGO_TRANSMISSOR.txt`)
3. Configure a caixa d'água pelo Access Point
4. Ligue e pronto!

📖 **Para instruções detalhadas, veja:** `GUIA_CONFIGURACAO_HIVEMQ.md`

---

## ⚙️ CONFIGURAÇÃO INICIAL DO RECEPTOR

### Conectar ao WiFi:

**Primeira vez ou após reset:**

1. Ligue o ESP32 Receptor
2. Ele criará uma rede WiFi chamada **"RECEPTOR_LORA"**
3. Conecte-se a esta rede (senha: **12345678**)
4. Abra o navegador em: **http://192.168.4.1**
5. Digite SSID e senha do seu WiFi
6. Clique em **"Conectar"**
7. O ESP32 reiniciará e conectará ao WiFi

**Para resetar configurações WiFi:**
- Pressione e segure o botão no GPIO 25 por 5 segundos
- O ESP32 apagará as configurações e reiniciará

---

## 📊 TÓPICOS MQTT

O sistema usa 2 tópicos MQTT:

### 📨 `caixa/dados` (Publicação a cada 10s)
Dados do sensor em JSON:
```json
{
  "device": "TX_CAIXA_01",
  "distance": 45.2,
  "level": 65,
  "percentage": 72,
  "liters": 3600,
  "sensor_ok": true,
  "timestamp": 123456789,
  "lora_signal": {
    "rssi": -85,
    "snr": 9.5,
    "quality": 75
  },
  "config": {
    "altura": 110,
    "volume_total": 5000,
    "distancia_cheia": 10,
    "distancia_vazia": 120
  },
  "wifi_rssi": -65
}
```

### 📡 `caixa/status` (Publicação a cada 10s)
Status do sistema:
```json
{
  "device": "RECEPTOR_CAIXA_01",
  "status": "online",
  "uptime": 3600,
  "wifi_rssi": -65,
  "lora_last_receive": 5,
  "free_heap": 234560
}
```

---

## 🔧 CONFIGURAÇÕES TÉCNICAS

### Comunicação LoRa:
- **Frequência:** 868 MHz (Europa)
- **Spreading Factor:** 9
- **Bandwidth:** 125 kHz
- **Coding Rate:** 4/7
- **Potência TX:** 20 dBm (transmissor) / 17 dBm (receptor)
- **Alcance:** Até 1500 metros em área aberta

### Intervalo de Transmissão:
- Dados enviados a cada **10 segundos**
- Pode ser alterado em `TX_INTERVAL` no código do transmissor

### Limites HiveMQ (Plano Gratuito):
- 100 conexões simultâneas
- 10 GB dados/mês
- Latência: ~50-200ms

---

## 📱 ACESSAR DASHBOARD REMOTAMENTE

### Opção 1: Netlify (Mais Fácil)
1. Acesse: https://app.netlify.com/drop
2. Arraste `dashboard_mqtt.html` para a página
3. Você receberá um link público (ex: `https://xyz123.netlify.app`)
4. Acesse de qualquer lugar!

### Opção 2: GitHub Pages
1. Crie repositório no GitHub
2. Faça upload do arquivo HTML
3. Ative GitHub Pages
4. Acesse via: `https://seu-usuario.github.io/repo/dashboard_mqtt.html`

### Opção 3: Abrir Localmente
- Clique duas vezes no arquivo HTML
- Funciona, mas só no seu computador

---

## 🔒 SEGURANÇA

### Recomendações:
- ✅ Mude a senha padrão do MQTT no HiveMQ
- ✅ Use senhas fortes (letras, números, símbolos)
- ✅ Não compartilhe suas credenciais publicamente
- ✅ Para produção, use certificados TLS válidos

### Conexão Segura:
- HiveMQ usa TLS/SSL por padrão (porta 8883)
- WebSocket também usa WSS (porta 8884)
- Dados criptografados em trânsito

---

## 🐛 PROBLEMAS COMUNS

### ESP32 não conecta ao MQTT
- Verifique URL do broker
- Verifique usuário e senha
- Certifique-se de usar porta 8883

### Dashboard não mostra dados
- Verifique se ESP32 está conectado (LED piscando)
- Veja Console do navegador (F12) para erros
- Confirme que tópicos estão corretos

### Dados LoRa não chegam
- Verifique se transmissor está ligado
- Verifique antenas LoRa
- Reduza distância para teste

📖 **Mais soluções:** Veja seção "Solução de Problemas" em `GUIA_CONFIGURACAO_HIVEMQ.md`

---

## 📈 MELHORIAS FUTURAS

- [ ] Notificações por email quando nível < 20%
- [ ] Integração com Alexa/Google Home
- [ ] Previsão de consumo com IA
- [ ] Suporte para múltiplas caixas
- [ ] App mobile nativo
- [ ] Modo econômico de energia (deep sleep)

---

## 📄 LICENÇA

Este projeto é open-source e está disponível sob a licença MIT.

---

## 🙏 CRÉDITOS

- **Comunicação LoRa:** RadioLib by jgromes
- **Cliente MQTT:** PubSubClient by Nick O'Leary
- **JSON:** ArduinoJson by Benoit Blanchon
- **Broker MQTT:** HiveMQ Cloud
- **Gráficos:** Chart.js

---

## 📞 SUPORTE

### Documentação:
- HiveMQ: https://docs.hivemq.com/
- RadioLib: https://jgromes.github.io/RadioLib/
- MQTT.js: https://github.com/mqttjs/MQTT.js

### Comunidade:
- HiveMQ Community: https://community.hivemq.com/

---

## 🎯 RESUMO

**Vantagens em relação ao sistema anterior (Render):**

| Característica | Render (Antes) | HiveMQ (Agora) |
|----------------|----------------|----------------|
| Custo | Grátis* | Totalmente Grátis |
| Sempre Online | ❌ Dorme após 15min | ✅ Sempre ativo |
| Velocidade | Lenta (HTTP) | ⚡ Tempo real (MQTT) |
| Configuração | Complicada | Simples |
| Servidor Node.js | ✅ Necessário | ❌ Não precisa |
| Keep-alive | ✅ Necessário | ❌ Não precisa |
| Confiabilidade | Regular | Excelente |

*Render grátis tem limitações que fazem o servidor dormir

---

## ✅ CHECKLIST RÁPIDO

Para ter o sistema funcionando:

- [ ] Conta criada no HiveMQ Cloud
- [ ] Cluster MQTT criado
- [ ] Bibliotecas Arduino instaladas
- [ ] Código receptor configurado e enviado
- [ ] ESP32 receptor conectado ao WiFi
- [ ] Dashboard HTML configurado
- [ ] Transmissor ligado e funcionando
- [ ] Dados aparecendo no dashboard

**Se todos ✅ = Sistema funcionando!** 🎉

---

**Criado com ❤️ para facilitar o monitoramento de caixas d'água**

**Versão:** 2.0 (MQTT)  
**Data:** 2024  
**Arquitetura:** ESP32 + LoRa + MQTT + Web
