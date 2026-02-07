# 🌊 Sistema de Monitoramento de Caixa d'Água com LoRa e MQTT

## 📋 Descrição do Projeto

Sistema completo de monitoramento remoto do nível de caixa d'água utilizando comunicação LoRa de longo alcance (até 1500m) e MQTT para visualização em tempo real via dashboard web.

O sistema é composto por:
- **Transmissor** (ESP32 + LoRa + Sensor Ultrassônico) - Instalado na caixa d'água
- **Receptor** (ESP32 + LoRa + WiFi) - Instalado próximo ao roteador
- **Dashboard Web** - Visualização em tempo real via navegador

---

## 🎯 Características Principais

### ✨ Funcionalidades

- 📡 **Comunicação LoRa de longo alcance** (868 MHz, até 1500m)
- 🌐 **Dashboard web em tempo real** via MQTT (HiveMQ Cloud)
- 📊 **Gráfico histórico** de nível da água
- 🔔 **Alertas visuais** de falhas e problemas
- 🚨 **Detecção robusta de falhas** do sensor ultrassônico
- ⚙️ **Configuração via WiFi** (sem necessidade de recompilar)
- 💾 **Armazenamento de configurações** em EEPROM
- 📱 **Interface responsiva** (funciona em celular, tablet e desktop)
- 🔋 **Baixo consumo** de energia
- 🔐 **Comunicação segura** (SSL/TLS no MQTT)

### 🎨 Interface Visual

- 🌊 Visualização animada do nível da caixa
- 📈 Gráfico de histórico em tempo real
- 🎛️ Painel de status completo
- 🔴 Alertas visuais destacados
- 📊 Indicadores de qualidade de sinal
- 📝 Log de eventos do sistema

---

## 🛠️ Hardware Necessário

### Transmissor (Caixa d'Água)

| Componente | Modelo | Quantidade |
|------------|--------|------------|
| Microcontrolador | ESP32 DevKit | 1 |
| Módulo LoRa | LLCC68 (868 MHz) | 1 |
| Sensor Ultrassônico | HC-SR04 | 1 |
| Antena LoRa | 868 MHz (3-5 dBi) | 1 |
| Fonte de Alimentação | 5V / 1A | 1 |

**Pinagem do Transmissor:**
```
HC-SR04:
- TRIG → GPIO 12
- ECHO → GPIO 13
- VCC  → 5V
- GND  → GND

LLCC68 LoRa:
- NSS  → GPIO 5
- DIO1 → GPIO 33
- BUSY → GPIO 14
- RST  → GPIO 32
- MOSI → GPIO 23
- MISO → GPIO 19
- SCK  → GPIO 18

LED:
- LED  → GPIO 2

BOTÃO CONFIG:
- BOOT → GPIO 25 (com pull-up)
```

### Receptor (Casa/Roteador)

| Componente | Modelo | Quantidade |
|------------|--------|------------|
| Microcontrolador | ESP32 DevKit | 1 |
| Módulo LoRa | LLCC68 (868 MHz) | 1 |
| Antena LoRa | 868 MHz (3-5 dBi) | 1 |
| Fonte de Alimentação | 5V / 1A | 1 |

**Pinagem do Receptor:**
```
LLCC68 LoRa:
- NSS  → GPIO 5
- DIO1 → GPIO 33
- BUSY → GPIO 14
- RST  → GPIO 32
- MOSI → GPIO 23
- MISO → GPIO 19
- SCK  → GPIO 18

LED:
- LED  → GPIO 2

BOTÃO RESET:
- RESET → GPIO 25 (com pull-up)
```

---

## 📡 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CAIXA D'ÁGUA                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Sensor HC-SR04 → ESP32 → LoRa LLCC68 (TX)          │   │
│  │  [Mede nível]     [Processa] [Transmite 868MHz]     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ LoRa 868MHz
                              │ (até 1500m)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        CASA/ROTEADOR                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  LoRa LLCC68 (RX) → ESP32 → WiFi → MQTT (HiveMQ)    │   │
│  │  [Recebe 868MHz]   [Processa] [Publica na nuvem]    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ MQTT over SSL
                              │ (Internet)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    HIVEMQ CLOUD BROKER                      │
│                  (MQTT Broker na Nuvem)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket Secure
                              │ (wss://)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DASHBOARD WEB (Navegador)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [Interface Visual] ← MQTT.js ← HiveMQ Cloud        │   │
│  │  • Nível da caixa                                    │   │
│  │  • Gráficos                                          │   │
│  │  • Alertas                                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Instalação e Configuração

### 1️⃣ Preparação do Ambiente

#### Arduino IDE

1. Instale o [Arduino IDE](https://www.arduino.cc/en/software)
2. Adicione suporte ao ESP32:
   - Vá em `Arquivo` → `Preferências`
   - Em "URLs Adicionais para Gerenciadores de Placas" adicione:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Vá em `Ferramentas` → `Placa` → `Gerenciador de Placas`
   - Procure por "ESP32" e instale

3. Instale as bibliotecas necessárias:
   - `PubSubClient` (para MQTT)
   - `ArduinoJson` (para JSON)
   - `RadioLib` (para LoRa)
   - `WebServer` (já incluído no ESP32)

### 2️⃣ Upload do Código no Transmissor

1. Abra o arquivo `CODIGO_TRANSMISSOR_MELHORADO.txt` no Arduino IDE
2. Selecione a placa: `ESP32 Dev Module`
3. Selecione a porta COM correta
4. Clique em "Upload"
5. Aguarde a mensagem "Upload completo"

#### Configuração do Transmissor

1. Após o upload, **pressione o botão BOOT por 3 segundos**
2. O ESP32 criará um WiFi chamado: `CAIXA_AGUA_CONFIG`
3. Senha: `12345678`
4. Conecte-se a este WiFi pelo celular/computador
5. Abra o navegador e acesse: `http://192.168.4.1`
6. Preencha:
   - **Distância CHEIA**: Meça com fita métrica a distância do sensor até a superfície da água quando a caixa está CHEIA (exemplo: 10 cm)
   - **Distância VAZIA**: Meça a distância do sensor até o fundo quando VAZIA (exemplo: 100 cm)
   - **Capacidade Total**: Capacidade da caixa em litros (exemplo: 500)
   - **ID Dispositivo**: Nome do dispositivo (exemplo: TX_CAIXA_01)
7. Clique em "Salvar"
8. O ESP32 reinicia e começa a transmitir!

### 3️⃣ Upload do Código no Receptor

1. Abra o arquivo `CODIGO_RECEPTOR_MELHORADO.txt` no Arduino IDE
2. Selecione a placa: `ESP32 Dev Module`
3. Selecione a porta COM correta
4. Clique em "Upload"
5. Aguarde a mensagem "Upload completo"

#### Configuração do Receptor

1. Após o upload, o ESP32 criará um WiFi: `RECEPTOR_LORA_MQTT`
2. Senha: `12345678`
3. Conecte-se a este WiFi pelo celular/computador
4. Abra o navegador e acesse o IP mostrado no Serial Monitor (geralmente `192.168.4.1`)
5. Preencha:
   - **Nome do WiFi**: Nome da sua rede WiFi
   - **Senha do WiFi**: Senha da sua rede
6. Clique em "Conectar"
7. O receptor conecta ao WiFi, ao HiveMQ Cloud e começa a receber dados!

### 4️⃣ Configuração do Dashboard

#### Opção A: GitHub Pages (Recomendado)

1. Crie uma conta no [GitHub](https://github.com) (se não tiver)
2. Crie um novo repositório
3. Faça upload do arquivo `index_CORRIGIDO_FINAL.html`
4. Renomeie para `index.html`
5. Vá em `Settings` → `Pages`
6. Em "Source" selecione `main` branch
7. Clique em "Save"
8. Aguarde alguns minutos
9. Acesse pelo link fornecido (exemplo: `https://seuusuario.github.io/nome-repo`)

#### Opção B: Abrir Localmente

1. Baixe o arquivo `index_CORRIGIDO_FINAL.html`
2. Abra diretamente no navegador (Chrome, Firefox, Edge)
3. Funciona sem servidor!

---

## 📊 Configuração MQTT (HiveMQ Cloud)

O sistema usa o HiveMQ Cloud gratuito (já configurado nos códigos).

**Credenciais configuradas:**
- **Broker**: `006d70cbbb9d44c2a347d2a3903c8f9a.s1.eu.hivemq.cloud`
- **Porta**: 8883 (SSL)
- **Usuário**: `esp32-receptor`
- **Senha**: `061084Cc@`

**Tópicos MQTT:**
- `caixas/agua/dados` - Dados do sensor (nível, litros, etc)
- `caixas/agua/status` - Status do receptor (heartbeat)
- `caixas/agua/comandos` - Comandos (reboot, etc)

### Criar Sua Própria Conta HiveMQ (Opcional)

Se quiser usar seu próprio broker:

1. Acesse [HiveMQ Cloud](https://console.hivemq.cloud/)
2. Crie uma conta gratuita
3. Crie um novo cluster
4. Crie credenciais de acesso
5. Atualize as credenciais nos códigos:
   - `CODIGO_RECEPTOR_MELHORADO.txt` (linhas 18-21)
   - `index_CORRIGIDO_FINAL.html` (linhas 928-933)

---

## 🔧 Funcionamento do Sistema

### Ciclo de Operação

1. **Transmissor (a cada 10 segundos)**:
   - Lê sensor ultrassônico (3 leituras + filtro de mediana)
   - Calcula nível, porcentagem e litros
   - Monta pacote de dados com CRC
   - Transmite via LoRa (868 MHz)
   - Pisca LED de confirmação

2. **Receptor (sempre ativo)**:
   - Escuta continuamente canal LoRa
   - Recebe pacote de dados
   - Valida CRC
   - Publica no MQTT (HiveMQ Cloud)
   - Pisca LED de confirmação

3. **Dashboard (tempo real)**:
   - Conecta ao MQTT via WebSocket
   - Recebe dados publicados
   - Atualiza interface visual
   - Atualiza gráfico histórico
   - Mostra alertas se necessário

### Detecção de Falhas

O sistema detecta automaticamente:

#### 🔴 Falha do Sensor Ultrassônico

**Detecção:**
- Timeout (sensor desconectado)
- Leituras fora do range (< 2cm ou > 400cm)
- 3 falhas consecutivas

**Indicações no Dashboard:**
1. 🔴 Banner vermelho: "FALHA NO SENSOR"
2. 🔴 Status: "Sensor Ultrassônico: FALHA"
3. 🔴 Nível zerado mostrando "ERRO"
4. 🔴 Valores: "---"
5. 📝 Log: "🚨 FALHA NO SENSOR ULTRASSÔNICO DETECTADA!"

#### 📡 Perda de Sinal LoRa

**Detecção:**
- Sem dados por mais de 30 segundos

**Indicação:**
- Banner laranja: "SEM SINAL DO TRANSMISSOR"

#### 📶 Receptor Offline

**Detecção:**
- MQTT desconectado

**Indicação:**
- Banner vermelho: "RECEPTOR DESCONECTADO"

---

## 📐 Especificações Técnicas

### Comunicação LoRa

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| Frequência | 868 MHz | Banda ISM Europa |
| Spreading Factor | SF9 | Compromisso alcance/velocidade |
| Bandwidth | 125 kHz | Largura de banda |
| Coding Rate | 4/7 | Taxa de correção de erros |
| Potência TX | 20 dBm | Máxima (100 mW) |
| Sync Word | 0x12 | Palavra de sincronização |
| CRC | Habilitado | Verificação de integridade |
| **Alcance Estimado** | **1500+ metros** | Linha de visada |

### Sensor Ultrassônico HC-SR04

| Parâmetro | Valor |
|-----------|-------|
| Alcance | 2 - 400 cm |
| Resolução | 0.3 cm |
| Ângulo de medição | 15° |
| Trigger | Pulso 10µs |
| Echo | Pulso proporcional à distância |
| Frequência ultrassônica | 40 kHz |

### Transmissão de Dados

**Estrutura do Pacote LoRa:**
```cpp
struct SensorData {
  float distance;              // Distância medida (cm)
  int level;                   // Altura da água (cm)
  int percentage;              // Percentual (0-100%)
  int liters;                  // Litros atuais
  bool sensorOK;               // Status do sensor
  unsigned long timestamp;     // Timestamp
  char deviceID[20];           // ID do dispositivo
  uint16_t crc;                // CRC16 para validação
  float config_altura;         // Range de medição
  float config_volume_total;   // Capacidade total
  float config_distancia_cheia;
  float config_distancia_vazia;
  int failureCount;            // Contador de falhas
  unsigned long timeSinceLastValid; // Tempo sem leitura
};
```

**Tamanho do pacote**: ~116 bytes  
**Intervalo de transmissão**: 10 segundos (normal) / 3 segundos (sensor com falha)

---

## 🎨 Interface do Dashboard

### Elementos da Interface

#### 1. Cabeçalho
- Título do sistema
- Status de conexão MQTT (verde/amarelo/vermelho)

#### 2. Banners de Alerta
- Alerta de falha do sensor (vermelho)
- Alerta de timeout LoRa (laranja)
- Alerta de receptor offline (vermelho)

#### 3. Painel de Status
- MQTT Broker
- Receptor WiFi
- **Sensor Ultrassônico** (OK / FALHA)
- Status LoRa
- Qualidade de sinal (barras + porcentagem)
- Última atualização
- WiFi RSSI do receptor

#### 4. Visualização da Caixa
- Animação do nível de água
- Cores dinâmicas:
  - Vermelho (0-10%): Crítico
  - Laranja (10-25%): Baixo
  - Amarelo (25-50%): Médio
  - Azul claro (50-80%): Bom
  - Azul escuro (80-100%): Cheio
  - **Vermelho com "ERRO"**: Sensor com falha

#### 5. Dados Numéricos
- Volume atual (litros)
- Capacidade total
- Distância do sensor (cm)
- Altura da água (cm)

#### 6. Gráfico Histórico
- Evolução do nível (%)
- Últimas 50 leituras
- Tempo real

#### 7. Log de Eventos
- Conexões MQTT
- Recebimento de dados
- Alertas de falhas
- Status do sistema

---

## 🧪 Testes e Diagnóstico

### Teste do Transmissor

1. **Monitor Serial** (115200 baud):
```
🚀 TRANSMISSOR - DETECÇÃO APRIMORADA DE FALHAS
==============================================
📋 CONFIG:
   ✅ CONFIGURADO
   Cheia: 10.0 cm | Vazia: 100.0 cm | Cap: 500 L
📡 Inicializando LoRa...
✅ LoRa OK!

🔍 Testando sensor...
📏 OK: 45.3 cm (3/3 válidas)
✅ Sensor funcionando!

✅ Sistema pronto!

📤 ============ TX ============
   ✅ SENSOR OK
   45.3 cm | 61% | 305 L
   📦 116 bytes | CRC: 0xA3F2
   ✅ TX OK!
==============================
```

2. **Teste de Falha do Sensor**:
   - Desconecte o cabo ECHO ou TRIG
   - Observe no serial:
```
❌ FALHA: Timeout - sensor desconectado!
🔴 SENSOR FALHOU: 0/3 leituras válidas
⚠️  Falha #1/3
⚠️  Falha #2/3
⚠️  Falha #3/3
🚨 SENSOR DECLARADO COMO FALHO! 🚨

📤 ============ TX ============
   ❌ SENSOR FALHOU!
   Falhas: 3 | Tempo: 5240 ms
   📦 116 bytes | CRC: 0xB4E1
   ✅ TX OK!
==============================
```

### Teste do Receptor

1. **Monitor Serial** (115200 baud):
```
🚀 RECEPTOR - DETECÇÃO APRIMORADA DE FALHAS
============================================
📂 WiFi carregado: MinhaRede
📡 Conectando a: MinhaRede
......
✅ WiFi conectado! IP: 192.168.1.100
🔄 Conectando MQTT... ✅ OK!

📡 Iniciando LoRa...
✅ LoRa OK!

📡 Aguardando dados LoRa...

📦 LoRa OK: 61% | RSSI: -45 | ID: TX_CAIXA_01
📤 MQTT: 61% | 305L | 512 bytes
✅ Enviado!
```

2. **Teste de Falha do Sensor**:
```
📦 LoRa RX: SENSOR FALHOU! | Falhas: 3 | RSSI: -47
🚨 SENSOR COM FALHA DETECTADO!
   Falhas consecutivas: 3
   ⏱️  Tempo sem leitura: 5240 ms
📤 MQTT: SENSOR FALHOU | 543 bytes
✅ Enviado!
```

### Teste do Dashboard

1. **Abra o console do navegador** (F12)
2. **Verifique conexão MQTT**:
```
🔄 Conectando ao HiveMQ Cloud...
✅ MQTT conectado!
📡 Inscrito nos tópicos
```

3. **Simule falha do sensor**:
   - Desconecte sensor no transmissor
   - Aguarde 3-5 segundos
   - Verifique no dashboard:
     - ✅ Banner vermelho aparece
     - ✅ Status mostra "FALHA"
     - ✅ Nível zera
     - ✅ Valores mostram "---"
     - ✅ Log mostra alerta

---

## 🐛 Solução de Problemas

### Transmissor não transmite

**Sintomas**: LED não pisca, nada no serial  
**Soluções**:
- ✅ Verifique conexão USB
- ✅ Selecione a porta COM correta
- ✅ Pressione botão RESET no ESP32
- ✅ Verifique alimentação (5V estável)

### Sensor não funciona

**Sintomas**: Sempre mostra "FALHA"  
**Soluções**:
- ✅ Verifique conexões TRIG (GPIO12) e ECHO (GPIO13)
- ✅ Verifique alimentação do sensor (5V)
- ✅ Sensor deve estar a >2cm de obstáculos
- ✅ Teste sensor com código simples (exemplo Arduino)

### LoRa não comunica

**Sintomas**: Receptor não recebe dados  
**Soluções**:
- ✅ Verifique antenas conectadas (868 MHz)
- ✅ Verifique pinagem do módulo LoRa
- ✅ Teste alcance (comece perto, ~5 metros)
- ✅ Verifique que TX e RX têm mesma frequência (868 MHz)
- ✅ Reinicie ambos os ESP32

### Receptor não conecta WiFi

**Sintomas**: Fica em "Conectando..."  
**Soluções**:
- ✅ Verifique nome e senha do WiFi
- ✅ WiFi deve ser 2.4 GHz (ESP32 não suporta 5 GHz)
- ✅ Aproxime ESP32 do roteador
- ✅ Reinicie o ESP32
- ✅ Apague configuração (botão RESET 10s) e reconfigure

### MQTT não conecta

**Sintomas**: Dashboard mostra "Conectando..."  
**Soluções**:
- ✅ Verifique internet
- ✅ Verifique credenciais MQTT
- ✅ Teste em outro navegador
- ✅ Desabilite ad-blockers
- ✅ Verifique console do navegador (F12)

### Dashboard não atualiza

**Sintomas**: Valores parados, sem atualização  
**Soluções**:
- ✅ Verifique se receptor está conectado ao MQTT
- ✅ Verifique se transmissor está enviando dados
- ✅ Recarregue a página (F5)
- ✅ Limpe cache do navegador
- ✅ Verifique console (F12) para erros JavaScript

### Alerta de falha não aparece

**Sintomas**: Sensor desconectado mas dashboard mostra normal  
**Soluções**:
- ✅ Aguarde 3-5 segundos (precisa de 3 falhas consecutivas)
- ✅ Verifique se transmissor detecta falha (monitor serial)
- ✅ Verifique se receptor recebe falha (monitor serial)
- ✅ Verifique se MQTT está conectado
- ✅ Use a versão correta do HTML (`index_CORRIGIDO_FINAL.html`)

---

## 📏 Medições e Calibração

### Como Medir Distâncias

1. **Instale o sensor** na tampa da caixa (centralizado)
2. **Encha a caixa completamente**
3. **Meça com fita métrica** a distância do sensor até a superfície da água
   - Exemplo: 10 cm
   - Este é o valor de **"Distância CHEIA"**
4. **Esvazie a caixa**
5. **Meça com fita métrica** a distância do sensor até o fundo
   - Exemplo: 100 cm
   - Este é o valor de **"Distância VAZIA"**
6. **Calcule o volume** da caixa ou veja na documentação
   - Exemplo: 500 litros
   - Este é o valor de **"Capacidade Total"**

### Fórmulas Utilizadas

```
Range = Distância VAZIA - Distância CHEIA
Nível de Água (cm) = Distância VAZIA - Distância Atual
Percentual (%) = (Nível de Água / Range) × 100
Litros = (Percentual / 100) × Capacidade Total
```

**Exemplo:**
- Distância CHEIA: 10 cm
- Distância VAZIA: 100 cm
- Capacidade: 500 L
- Range: 100 - 10 = 90 cm

Se sensor mede 45 cm:
- Nível: 100 - 45 = 55 cm de água
- Percentual: (55 / 90) × 100 = 61%
- Litros: (61 / 100) × 500 = 305 L

---

## 🔋 Consumo de Energia

### Transmissor
- **Em espera**: ~80 mA
- **Transmitindo**: ~120 mA (pico)
- **Média**: ~85 mA
- **Consumo diário**: ~2 Ah (48 Wh)

### Receptor
- **WiFi conectado**: ~100 mA
- **Recebendo LoRa**: ~85 mA
- **Média**: ~95 mA
- **Consumo diário**: ~2.3 Ah (55 Wh)

### Alimentação Recomendada
- ✅ Fonte 5V / 1A (mínimo)
- ✅ Fonte 5V / 2A (recomendado)
- 🔋 Bateria: 18650 (3000 mAh) = ~30h de autonomia

---

## 📚 Bibliotecas Utilizadas

| Biblioteca | Versão | Uso |
|------------|--------|-----|
| RadioLib | Latest | Comunicação LoRa |
| PubSubClient | 2.8+ | Cliente MQTT |
| ArduinoJson | 6.x | Serialização JSON |
| WiFi | Built-in | Conexão WiFi |
| WebServer | Built-in | Servidor web de config |
| EEPROM | Built-in | Armazenamento de config |

---

## 🔐 Segurança

### Comunicação LoRa
- ✅ CRC16 para validação de integridade
- ✅ Sync Word customizada
- ⚠️ Sem criptografia (dados em texto claro)

### Comunicação MQTT
- ✅ SSL/TLS (porta 8883)
- ✅ Autenticação usuário/senha
- ✅ WebSocket Secure (wss://)

### Recomendações
- 🔒 Não compartilhe credenciais MQTT
- 🔒 Use senhas fortes no WiFi
- 🔒 Mantenha firmware atualizado

---

## 🎓 Aprendizados e Melhorias Futuras

### Possíveis Melhorias

1. **Criptografia LoRa**
   - AES-128 para comunicação segura

2. **Deep Sleep**
   - Reduzir consumo do transmissor
   - Acordar a cada 5 minutos

3. **Múltiplos Transmissores**
   - Monitorar várias caixas d'água
   - Identificação por deviceID

4. **Notificações Push**
   - Alertas no celular (Telegram, WhatsApp)
   - E-mail em caso de falhas

5. **Histórico em Banco de Dados**
   - Armazenar dados em MySQL/PostgreSQL
   - Análise de longo prazo

6. **Previsão de Consumo**
   - Machine Learning para prever quando esvazia
   - Alertas proativos

7. **Controle de Bomba**
   - Automação do enchimento
   - Relay controlado pelo ESP32

---

## 📄 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

Você é livre para:
- ✅ Usar comercialmente
- ✅ Modificar
- ✅ Distribuir
- ✅ Uso privado

Desde que:
- 📋 Inclua a licença original
- 📋 Mantenha o copyright

---

## 👥 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:

1. 🍴 Fork o projeto
2. 🌿 Criar uma branch (`git checkout -b feature/MinhaFeature`)
3. 💾 Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. 📤 Push para a branch (`git push origin feature/MinhaFeature`)
5. 🎯 Abrir um Pull Request

---

## 📞 Suporte

### Problemas Comuns
- Consulte a seção "Solução de Problemas"
- Verifique os monitores seriais
- Teste componentes individualmente

### Comunidade
- 💬 Issues no GitHub
- 📧 E-mail de suporte
- 🌐 Fórum Arduino/ESP32

---

## 📖 Referências

- [Documentação ESP32](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)
- [RadioLib Documentation](https://jgromes.github.io/RadioLib/)
- [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/)
- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)
- [HC-SR04 Datasheet](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf)

---

## 🏆 Créditos

Desenvolvido para monitoramento residencial de caixa d'água com foco em:
- ✅ Facilidade de instalação
- ✅ Baixo custo
- ✅ Confiabilidade
- ✅ Interface intuitiva
- ✅ Detecção robusta de falhas

---

## 📊 Changelog

### v2.0 - Detecção Aprimorada de Falhas (Atual)
- ✅ Detecção robusta de falhas do sensor ultrassônico
- ✅ Múltiplas verificações por leitura
- ✅ Contador de falhas consecutivas
- ✅ Recuperação automática do sensor
- ✅ Transmissão urgente em caso de falha
- ✅ Diagnóstico detalhado (número de falhas, tempo)
- ✅ Indicação visual destacada no dashboard
- ✅ Status do sensor na barra superior
- ✅ Nível zerado quando sensor falha
- ✅ Múltiplos alertas visuais

### v1.0 - Versão Inicial
- ✅ Comunicação LoRa funcional
- ✅ MQTT com HiveMQ Cloud
- ✅ Dashboard web básico
- ✅ Configuração via WiFi
- ✅ Detecção básica de falhas

---

**Desenvolvido com ❤️ para monitoramento inteligente de caixa d'água**

**Versão**: 2.0  
**Data**: Fevereiro 2026  
**Status**: ✅ Produção
