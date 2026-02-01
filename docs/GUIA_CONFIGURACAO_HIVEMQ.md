
# 🚀 GUIA COMPLETO - MIGRAÇÃO PARA HIVEMQ CLOUD

## 📋 ÍNDICE
1. [O que mudou](#o-que-mudou)
2. [Criar conta no HiveMQ Cloud](#criar-conta-hivemq)
3. [Configurar o Broker](#configurar-broker)
4. [Configurar ESP32 Receptor](#configurar-esp32-receptor)
5. [Configurar ESP32 Transmissor](#configurar-esp32-transmissor)
6. [Configurar Dashboard](#configurar-dashboard)
7. [Testar o Sistema](#testar-sistema)
8. [Solução de Problemas](#problemas)

---

## 🔄 O QUE MUDOU

### ANTES (Render com HTTP):
```
[Transmissor LoRa] --LoRa--> [Receptor ESP32] --HTTP--> [Servidor Render] --HTTP--> [Dashboard]
```

### AGORA (HiveMQ com MQTT):
```
[Transmissor LoRa] --LoRa--> [Receptor ESP32] --MQTT--> [HiveMQ Cloud] --WebSocket--> [Dashboard]
```

### Vantagens do MQTT:
✅ **Gratuito**: HiveMQ Cloud tem plano gratuito
✅ **Sempre ativo**: Não desliga como o Render
✅ **Mais rápido**: Comunicação em tempo real
✅ **Mais simples**: Não precisa de servidor Node.js
✅ **Mais confiável**: Protocolo otimizado para IoT

---

## 📝 1. CRIAR CONTA NO HIVEMQ CLOUD

### Passo 1: Acessar o Site
1. Abra seu navegador
2. Acesse: **https://www.hivemq.com/mqtt-cloud-broker/**
3. Clique em **"Get Started for Free"** (Começar Gratuitamente)

### Passo 2: Criar Conta
1. Preencha os dados:
   - Email
   - Senha (mínimo 8 caracteres)
   - Nome da empresa (pode colocar "Pessoal")
2. Marque a caixa de aceitar termos
3. Clique em **"Sign Up"**
4. Confirme seu email (verifique sua caixa de entrada)

### Passo 3: Fazer Login
1. Acesse: **https://console.hivemq.cloud/**
2. Entre com seu email e senha

---

## ⚙️ 2. CONFIGURAR O BROKER

### Passo 1: Criar um Cluster (Broker)
1. No painel do HiveMQ, clique em **"Create Cluster"**
2. Escolha o plano **FREE** (Gratuito)
3. Configure:
   - **Name**: `caixa-agua-mqtt` (ou qualquer nome)
   - **Region**: Escolha a mais próxima do Brasil (exemplo: `us-east-1`)
4. Clique em **"Create"**
5. Aguarde 2-3 minutos até o cluster ficar ativo

### Passo 2: Anotar Informações do Broker
Após o cluster ser criado, você verá:

```
📝 ANOTE ESSAS INFORMAÇÕES:

1. URL DO BROKER:
   Exemplo: abc123.s1.eu.hivemq.cloud

2. PORTA MQTT:
   8883 (TLS/SSL)

3. PORTA WEBSOCKET:
   8884 (WebSocket Secure)
```

### Passo 3: Criar Credenciais de Acesso
1. No painel do cluster, clique em **"Access Management"**
2. Clique em **"Add Credentials"**
3. Configure:
   - **Username**: `caixa_agua_user` (ou outro nome)
   - **Password**: Crie uma senha forte (exemplo: `CaixaAgua@2024!`)
   - **Permissions**: Marque todas as opções (Publish, Subscribe)
4. Clique em **"Add"**

```
📝 ANOTE:
- Usuário: caixa_agua_user
- Senha: 061084Cc@
```

---

## 🔧 3. CONFIGURAR ESP32 RECEPTOR

### Passo 1: Instalar Bibliotecas no Arduino IDE

Vá em **Sketch → Include Library → Manage Libraries** e instale:
1. **PubSubClient** (versão 2.8 ou superior)
2. **ArduinoJson** (versão 6.x)
3. **RadioLib** (já deve ter)

### Passo 2: Editar o Código

Abra o arquivo `RECEPTOR_MQTT.ino` que criei e modifique estas linhas:

```cpp
// ====== CONFIGURAÇÕES MQTT HIVEMQ ======
const char* MQTT_SERVER = "abc123.s1.eu.hivemq.cloud";  // ⬅️ COLE SEU BROKER AQUI
const int MQTT_PORT = 8883;  // Porta TLS (mantenha)
const char* MQTT_USER = "caixa_agua_user";  // ⬅️ SEU USUÁRIO AQUI
const char* MQTT_PASSWORD = "CaixaAgua@2024!";  // ⬅️ SUA SENHA AQUI
```

**IMPORTANTE**: Substitua pelos dados que você anotou!

### Passo 3: Upload do Código
1. Conecte o ESP32 Receptor ao computador
2. Selecione a porta correta
3. Clique em **Upload** (seta →)
4. Aguarde a compilação e upload

### Passo 4: Verificar Funcionamento
1. Abra o **Serial Monitor** (Ctrl+Shift+M)
2. Configure para **115200 baud**
3. Você deve ver:
```
🚀 ====== RECEPTOR LoRa + MQTT HiveMQ =====
✅ WiFi conectado!
📡 Conectando ao MQTT HiveMQ... ✅ Conectado!
📡 Subscrito ao tópico: caixa/dados
📡 Subscrito ao tópico: caixa/status
```

---

## 📡 4. CONFIGURAR ESP32 TRANSMISSOR

### ⚠️ IMPORTANTE:
O transmissor **NÃO PRECISA** ser alterado! Ele continua enviando dados via LoRa para o receptor.

O código do transmissor permanece igual ao que você já tem.

---

## 🖥️ 5. CONFIGURAR DASHBOARD

### Passo 1: Obter Informações WebSocket

O HiveMQ fornece uma URL WebSocket no formato:
```
wss://SEU_BROKER.hivemq.cloud:8884/mqtt
```

Exemplo completo:
```
wss://abc123.s1.eu.hivemq.cloud:8884/mqtt
```

### Passo 2: Editar o Dashboard HTML

Abra o arquivo `dashboard_mqtt.html` que criei e localize estas linhas:

```html
<input type="text" id="mqttBroker" value="wss://seu-broker.hivemq.cloud:8884/mqtt">
<input type="text" id="mqttUser" value="seu_usuario">
<input type="password" id="mqttPassword" value="sua_senha">
```

Substitua por:
```html
<input type="text" id="mqttBroker" value="wss://abc123.s1.eu.hivemq.cloud:8884/mqtt">
<input type="text" id="mqttUser" value="caixa_agua_user">
<input type="password" id="mqttPassword" value="CaixaAgua@2024!">
```

### Passo 3: Abrir o Dashboard

**OPÇÃO 1 - Abrir Direto no Navegador:**
1. Clique duas vezes no arquivo `dashboard_mqtt.html`
2. Ele abrirá no seu navegador padrão

**OPÇÃO 2 - Hospedar Online (Grátis):**

#### Netlify Drop (Mais Fácil):
1. Acesse: **https://app.netlify.com/drop**
2. Arraste o arquivo `dashboard_mqtt.html` para a área indicada
3. Você receberá um link público (ex: `https://xyz123.netlify.app`)
4. Compartilhe este link com quem quiser ver o dashboard!

#### GitHub Pages:
1. Crie uma conta no GitHub
2. Crie um repositório público
3. Faça upload do arquivo HTML
4. Ative GitHub Pages nas configurações
5. Acesse via: `https://seu-usuario.github.io/nome-repo/dashboard_mqtt.html`

### Passo 4: Usar o Dashboard

1. Ao abrir o dashboard, você verá um painel de configuração MQTT no topo
2. Verifique se os dados estão corretos
3. Clique em **"Conectar"**
4. Aguarde a mensagem "Conectado ao MQTT HiveMQ"
5. Os dados começarão a aparecer automaticamente!

---

## 🧪 6. TESTAR O SISTEMA

### Teste Completo:

1. **Verificar Transmissor LoRa:**
   - LED deve piscar a cada 10 segundos (transmissão)
   - Monitor Serial mostra "✅ Transmissão bem-sucedida!"

2. **Verificar Receptor:**
   - LED pisca rápido ao receber dados
   - Serial Monitor mostra: "🎉 PACOTE RECEBIDO!"
   - Deve mostrar: "✅ Dados publicados no MQTT!"

3. **Verificar HiveMQ Cloud:**
   - Acesse o painel do HiveMQ
   - Vá em **"Metrics"**
   - Você deve ver mensagens sendo publicadas

4. **Verificar Dashboard:**
   - Status MQTT deve estar verde "Conectado"
   - Valores devem atualizar a cada 10 segundos
   - Tanque visual deve mostrar o nível
   - Gráfico deve ser desenhado

### Fluxo de Dados Completo:
```
[Sensor] → [TX LoRa] → [RX ESP32] → [MQTT HiveMQ] → [Dashboard Web]
  📏         📡          📡 WiFi        ☁️ Nuvem       🖥️ Navegador
```

---

## 🔍 7. SOLUÇÃO DE PROBLEMAS

### Problema 1: ESP32 Receptor não conecta ao MQTT

**Sintomas:**
```
❌ Falha ao conectar ao MQTT, rc=-2
```

**Soluções:**
1. Verifique se o broker URL está correto
2. Verifique usuário e senha
3. Certifique-se de que usou porta 8883 (não 1883)
4. Teste a conexão WiFi primeiro

**Código de Erros:**
- `-2`: Conexão recusada (usuário/senha incorretos)
- `-4`: Timeout (broker offline ou URL errado)

---

### Problema 2: Dashboard não conecta

**Sintomas:**
- Botão "Conectar" não responde
- Console do navegador mostra erros

**Soluções:**
1. Abra o Console do navegador (F12)
2. Procure erros relacionados a MQTT
3. Verifique se a URL WebSocket começa com `wss://`
4. Verifique se a porta é 8884 (não 8883)
5. Tente outro navegador (Chrome/Firefox)

**Teste de Conexão:**
```javascript
// Cole isso no Console do navegador (F12)
const client = mqtt.connect('wss://seu-broker.hivemq.cloud:8884/mqtt', {
  username: 'seu_usuario',
  password: 'sua_senha'
});

client.on('connect', () => console.log('✅ Conectado!'));
client.on('error', (err) => console.log('❌ Erro:', err));
```

---

### Problema 3: Dados não aparecem no Dashboard

**Verificações:**
1. ESP32 Receptor está conectado ao MQTT?
   → Verifique Serial Monitor

2. Dados estão sendo publicados?
   → No HiveMQ, vá em **"Web Client"** e subscreva ao tópico `caixa/dados`

3. Dashboard está conectado?
   → Verifique se o status mostra "Conectado"

4. Tópicos estão corretos?
   → Devem ser exatamente: `caixa/dados` e `caixa/status`

---

### Problema 4: "SSL Handshake Failed"

**Sintomas:**
```
SSL handshake failed
```

**Solução:**
No código do ESP32, certifique-se de ter:
```cpp
espClient.setInsecure(); // Permite conexão TLS sem validar certificado
```

Para produção, é melhor usar certificados válidos, mas para testes isso funciona.

---

### Problema 5: HiveMQ Cloud - "Cluster Suspended"

**Sintomas:**
- Cluster aparece como "Suspended" no painel

**Causa:**
- Plano gratuito tem limite de dados/conexões
- Cluster inativo por muito tempo

**Solução:**
1. Clique em **"Resume"** no painel
2. Aguarde alguns minutos
3. Se não resolver, crie um novo cluster

**Limites do Plano Gratuito:**
- 100 conexões simultâneas
- 10 GB de dados por mês
- 1 cluster

---

## 📊 MONITORAMENTO NO HIVEMQ

### Ver Estatísticas em Tempo Real:
1. Acesse o painel do HiveMQ
2. Clique no seu cluster
3. Vá em **"Metrics"**

Você verá:
- 📨 Mensagens publicadas/segundo
- 👥 Clientes conectados
- 📊 Uso de banda
- 🔄 Taxa de entrega

### Web Client (Ferramenta de Teste):
1. No painel, clique em **"Web Client"**
2. Clique em **"Connect"**
3. Subscreva ao tópico: `caixa/dados`
4. Você verá as mensagens em JSON ao vivo!

Exemplo de mensagem:
```json
{
  "device": "TX_CAIXA_01",
  "distance": 45.2,
  "level": 65,
  "percentage": 72,
  "liters": 3600,
  "sensor_ok": true,
  "lora_signal": {
    "rssi": -85,
    "snr": 9.5,
    "quality": 75
  },
  "config": {
    "volume_total": 5000,
    "altura": 110
  }
}
```

---

## 🎯 CHECKLIST FINAL

Antes de considerar tudo funcionando, verifique:

- [ ] Conta criada no HiveMQ Cloud
- [ ] Cluster criado e ativo
- [ ] Credenciais (usuário/senha) criadas
- [ ] Código do receptor atualizado com dados do HiveMQ
- [ ] ESP32 Receptor compilado e enviado
- [ ] Serial Monitor mostra "Conectado ao MQTT"
- [ ] Dashboard HTML atualizado com dados do broker
- [ ] Dashboard abre no navegador
- [ ] Dashboard conecta ao MQTT (status verde)
- [ ] Transmissor LoRa está ligado e transmitindo
- [ ] Dados aparecem no dashboard a cada 10 segundos
- [ ] Gráfico está sendo desenhado
- [ ] Nível do tanque visual está animado

---

## 💡 DICAS EXTRAS

### 1. Acessar Dashboard de Qualquer Lugar:
- Hospede o HTML no Netlify (gratuito)
- Compartilhe o link com amigos/família
- Eles podem ver em tempo real!

### 2. Segurança:
- Troque a senha padrão do MQTT
- Use senhas fortes (letras, números, símbolos)
- Não compartilhe suas credenciais publicamente

### 3. Economizar Dados:
- Aumente o intervalo de transmissão (de 10s para 30s)
- No transmissor, mude: `#define TX_INTERVAL 30000`

### 4. Notificações:
- Use IFTTT ou Integromat
- Configure para receber email quando nível < 20%
- Conecte com webhook do HiveMQ

---

## 📞 SUPORTE

### Recursos Oficiais HiveMQ:
- Documentação: https://docs.hivemq.com/
- Tutoriais: https://www.hivemq.com/developers/
- Fórum: https://community.hivemq.com/

### Testes Online:
- MQTT.fx (Cliente Desktop): https://mqttfx.jensd.de/
- MQTT Explorer: http://mqtt-explorer.com/

---

## ✅ RESUMO

**O que você NÃO precisa mais:**
- ❌ Servidor Render
- ❌ Node.js
- ❌ Express
- ❌ Keep-alive scripts
- ❌ Preocupação com servidor dormindo

**O que você tem agora:**
- ✅ Broker MQTT na nuvem (sempre ativo)
- ✅ Dashboard HTML simples (hospeda onde quiser)
- ✅ Comunicação em tempo real
- ✅ Totalmente gratuito
- ✅ Mais confiável

**Arquitetura final:**
```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│ Transmissor │ --LoRa→ │  Receptor   │ --MQTT→ │  HiveMQ      │
│   ESP32     │         │   ESP32     │         │   Cloud      │
└─────────────┘         └─────────────┘         └──────┬───────┘
                                                        │
                                                  WebSocket
                                                        │
                                                ┌───────▼────────┐
                                                │   Dashboard    │
                                                │   HTML/JS      │
                                                └────────────────┘
```

---

🎉 **Parabéns! Seu sistema agora está na nuvem com MQTT!** 🎉

Qualquer dúvida, entre em contato!
