# Appmax Desafio - Sistema Centralizador de Notificações

[![Node.js Version](https://img.shields.io/badge/node.js-24.x-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/tests-215/215_passing-brightgreen.svg)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Um sistema robusto para centralizar todos os disparos de notificações (email, SMS, Telegram) com sistema de filas, tentativas automáticas.

## 📋 Sobre o Desafio

Este projeto foi desenvolvido como resposta ao desafio de construir um sistema que:

- ✅ **Centraliza disparos de notificações** (email, SMS, Telegram)
- ✅ **Consome disparos de um sistema de filas** com processamento assíncrono
- ✅ **Sistema de tentativas configurável** em caso de indisponibilidade dos serviços
- ✅ **Envios fake** para desenvolvimento e testes
- ✅ **Cobertura completa de testes** (215/215 testes passando)
- ✅ **Suporte completo a ES Modules** com mocking avançado
- ✅ **Rate limiting** e controle de retry configurável

## 🏗️ Arquitetura

### Componentes Principais

```
├── api/
│   ├── app.js              # Servidor Express principal com middleware CORS
│   ├── controller.js       # Controladores de serviços registrados dinamicamente
│   ├── helpers/
│   │   ├── queue.js        # Sistema de filas personalizado com UUID e callbacks
│   │   └── service-router.js # Roteador de serviços com retry configurável
│   ├── services/
│   │   ├── email.js        # Serviço de email (Nodemailer + Ethereal para dev)
│   │   ├── sms.js          # Serviço de SMS (SMS.to API com encoding correto)
│   │   └── telegram.js     # Serviço Telegram (Bot API com rate limiting)
│   └── __tests__/          # Suite completa de testes (215 testes)
│       ├── setup.js        # Configuração global de mocks
│       ├── *.test.js       # Testes unitários e integração
│       └── coverage/       # Relatórios de cobertura
```

### Fluxo de Funcionamento

1. **Recepção**: API REST recebe requisições de notificação
2. **Registro Dinâmico**: Serviços são registrados via ServiceRouter
3. **Enfileiramento**: Mensagens são adicionadas à fila com UUID único  
4. **Processamento Sequencial**: Queue processa itens um por vez
5. **Retry Logic Configurável**: Falhas são repetidas até MAX_RETRIES (padrão: 5)
6. **Logging Inteligente**: Fake em desenvolvimento, real em produção
7. **Estado Persistente**: Redis para armazenamento de estado dos serviços

## 🚀 Quick Start

### Pré-requisitos

- Node.js 24.x ou superior
- Docker e Docker Compose
- Git

### Instalação com Docker

1. **Clone o repositório**
```bash
git clone <repository-url>
cd appmax-desafio
```

2. **Configure variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

3. **Execute com Docker Compose**
```bash
docker-compose up -d
```

O sistema estará disponível em `http://localhost:3000`

### Instalação Manual

1. **Clone e instale dependências**
```bash
git clone <repository-url>
cd appmax-desafio/api
npm install
```

2. **Configure variáveis de ambiente**
```bash
cp ../.env.example ../.env
# Edite o arquivo .env
```

3. **Execute o servidor**
```bash
# Desenvolvimento (com nodemon)
npm run development

# Produção
npm run production
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
NODE_ENV=development                    # development | production | test
EMAIL_USER=your_email@example.com      # Email para SMTP (Gmail recomendado)
EMAIL_PASS=your_email_password          # Senha de app do email
TELEGRAM_BOT_TOKEN=your_telegram_token  # Token do bot Telegram (@BotFather)
SMS_API_KEY=your_sms_api_key           # Chave da API SMS.to
MAX_RETRIES=5                          # Máximo de tentativas (padrão: 5)
```

### Modo de Desenvolvimento

Em desenvolvimento (`NODE_ENV=development`):
- **Emails**: Usar contas de teste do Ethereal (geradas automaticamente)
- **SMS e Telegram**: Simulados com logs detalhados
- **Preview URLs**: Geradas para emails de teste
- **Mock Services**: Todos os serviços externos são simulados

### Modo de Teste

Em teste (`NODE_ENV=test`):
- **Todos os serviços**: Completamente simulados
- **ES Modules Mocking**: `jest.unstable_mockModule` para mocking avançado
- **Cobertura Completa**: 215 testes cobrindo todos os componentes
- **Isolation**: Cada teste é isolado com mocks resetados

### Modo de Produção

Em produção (`NODE_ENV=production`):
- **Emails**: SMTP real configurado (Gmail/SendGrid/etc)
- **SMS**: API SMS.to com chave válida
- **Telegram**: Bot real com token válido
- **Retry Logic**: Configurável via MAX_RETRIES

## 📡 API Endpoints

### Health Check

```http
GET /ready
```

**Resposta:**
```json
{
  "message": "I am ready!"
}
```

### Envio de Email

```http
POST /email
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Assunto do email",
  "message": "Conteúdo da mensagem"
}
```

**Resposta:**
```json
{
  "status": "in queue",
  "position": 1,
  "id": "uuid-da-mensagem"
}
```

### Envio de SMS

```http
POST /sms
Content-Type: application/json

{
  "to": "+5511999999999",
  "message": "Sua mensagem SMS",
  "senderId": "SMSto"
}
### Consultando Status de Serviço

```http
GET /service/:id
```

**Resposta (em processamento):**
```json
{
  "data": {...},
  "completed": false,
  "position": 2,
  "timestamp": 1694812800000
}
```

**Resposta (concluído):**
```json
{
  "data": {...},
  "completed": true,
  "timestamp": 1694812800000
}
```

**Resposta (não encontrado):**
```json
{
  "error": "Service not found",
  "message": "Service not found."
}
```

## 🧪 Testing

### Executando Testes

```bash
# Executar todos os testes
docker compose exec api npm test

# Executar testes específicos
docker compose exec api npm test -- __tests__/email-service.test.js

# Executar com cobertura
docker compose exec api npm test -- --coverage

# Executar testes em watch mode
docker compose exec api npm test -- --watch
```

### Suite de Testes

**Estatísticas de Testes:**
- ✅ **215 testes passando** (100% success rate)
- ✅ **7 suites de teste** completas
- ✅ **Cobertura completa** de todos os componentes
- ✅ **ES Modules Mocking** com `jest.unstable_mockModule`

**Testes por Componente:**
- **Controller Tests** (31 testes): Registro e execução de serviços
- **EmailService Tests** (29 testes): SMTP, Ethereal, configurações
- **Queue Tests** (26 testes): Processamento, callbacks, concorrência
- **ServiceRouter Tests** (28 testes): Retry logic, Redis, erros
- **SMSService Tests** (26 testes): API integration, encoding, timeouts
- **TelegramService Tests** (32 testes): Bot API, rate limiting, formatting
- **App Integration Tests** (42 testes): Express app, endpoints, CORS

### Configuração de Testes

**Jest Configuration (`jest.config.js`):**
```javascript
export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],
  coverageDirectory: '__tests__/coverage',
  verbose: true
};
```

**Mock Setup (`__tests__/setup.js`):**
- Global mocks para `fetch`, `console.log`
- Redis mock para ServiceRouter
- Nodemailer mock para EmailService
- Environment variable management

## 🔧 Funcionalidades Técnicas

### Sistema de Filas Avançado

- **Processamento Sequencial**: Uma mensagem por vez para evitar sobrecarga
- **IDs Únicos**: Cada item da fila recebe um UUID v4
- **Posicionamento**: Consulta da posição na fila em tempo real
- **Callbacks de Progresso**: Notificações assíncronas de mudanças de estado
- **Tratamento de Erros**: Continuidade mesmo com falhas individuais
- **Concorrência Segura**: Thread-safe para múltiplas operações simultâneas

### Sistema de Retry Configurável

- **MAX_RETRIES**: Configurável via environment variable (padrão: 5)
- **Delay Incremental**: 1 segundo entre cada tentativa
- **Logging Detalhado**: Falhas são logadas com stack trace completo
- **Recuperação Automática**: Sistema continua processando após falhas
- **Prevenção de Loop Infinito**: Limite rígido de tentativas evita travamentos

### Serviços de Notificação

#### Email Service (Nodemailer)
- **Provider SMTP**: Gmail, SendGrid, ou qualquer provedor SMTP
- **Desenvolvimento**: Ethereal.email para testes (auto-gerado)
- **Preview URLs**: Links para visualizar emails em desenvolvimento
- **Configuração Flexível**: Host, porta, autenticação customizáveis
- **Error Handling**: Timeouts, falhas de conexão, credenciais inválidas
- **Content Types**: HTML e texto plano suportados

#### SMS Service (SMS.to API)
- **API Integration**: RESTful com `application/x-www-form-urlencoded`
- **Números Internacionais**: Suporte completo a formatos globais
- **Callback URLs**: Webhooks opcionais para status de entrega
- **Sender ID**: Configurável por mensagem
- **URL Encoding**: Correto para caracteres especiais e emojis
- **Rate Limiting**: Respeita limites da API SMS.to

#### Telegram Service (Bot API)
- **Bot Token**: Obtido via @BotFather
- **Chat IDs**: Suporte a usuários, grupos e canais
- **Formatting**: Texto plano e Markdown
- **URL Construction**: Query parameters com encoding correto
- **Error Handling**: Rate limiting, bot bloqueado, chat inexistente
- **Message Limits**: Respeita limite de 4096 caracteres

### Redis Integration

- **Service State**: Armazenamento persistente do estado dos serviços
- **Queue Position**: Tracking de posição em tempo real
- **Completion Status**: Marcação de serviços concluídos
- **Connection Handling**: Graceful degradation em caso de falha do Redis

## 🔍 Logs e Monitoramento

### Logs de Desenvolvimento
```bash
# Visualizar logs em tempo real
docker-compose logs -f api
```

### Estrutura de Logs
- **Email enviado**: Preview URL e Message ID
- **SMS enviado**: Status da API e detalhes
- **Telegram enviado**: Resposta da API
- **Erros**: Stack trace completo
- **Queue**: Processamento de filas

## 🧪 Testando o Sistema

### Teste Completo da API

1. **Health Check**
```bash
curl http://localhost:3000/ready
```

2. **Testando Email**
```bash
curl -X POST http://localhost:3000/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Teste Sistema",
    "message": "Este é um teste do sistema de notificações"
  }'
```

3. **Testando SMS**
```bash
curl -X POST http://localhost:3000/sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5511999999999",
    "message": "Teste SMS do sistema",
    "senderId": "AppMax"
  }'
```

4. **Testando Telegram**
```bash
curl -X POST http://localhost:3000/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "123456789",
    "message": "🚀 Teste Telegram do sistema"
  }'
```

5. **Consultando Status**
```bash
# Use o ID retornado na resposta anterior
curl http://localhost:3000/service/[UUID_DO_SERVICO]
```

### Testando com Postman

Uma coleção do Postman está disponível em:
```
appmax.postman_collection.json
```

**Importando no Postman:**
1. Abra o Postman
2. File > Import
3. Selecione o arquivo da coleção
4. Configure as variáveis de ambiente se necessário

### Testando Cenários Específicos

**Teste de Retry (simulando falha):**
```bash
# Configure MAX_RETRIES=2 no .env e pare o serviço temporariamente
curl -X POST http://localhost:3000/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@fail.com", "subject": "Teste Retry"}'
```

**Teste de Concurrent Requests:**
```bash
# Execute múltiplas requisições simultâneas
for i in {1..5}; do
  curl -X POST http://localhost:3000/email \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"test$i@example.com\", \"subject\": \"Teste $i\"}" &
done
wait
```

**Teste de Rate Limiting:**
```bash
# Teste com muitas requisições seguidas
seq 1 10 | xargs -n1 -P10 -I{} curl -X POST http://localhost:3000/telegram \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456789", "message": "Teste Rate Limit {}"}'
```

## 📦 Estrutura do Projeto

```
appmax-desafio/
├── .env                     # Configuração de ambiente (criado a partir do .example)
├── .env.example            # Exemplo de configuração
├── .gitignore             # Arquivos ignorados pelo Git
├── compose.yaml           # Configuração Docker Compose com Redis
├── README.md              # Este arquivo (documentação completa)
├── postman/               # Coleção do Postman para testes
│   └── Appmax-Notifications.postman_collection.json
└── api/                   # Código da aplicação Node.js
    ├── app.js            # Servidor Express principal (CORS, middleware, rotas)
    ├── controller.js     # Controladores com registro dinâmico de serviços
    ├── Dockerfile        # Imagem Docker multi-stage
    ├── package.json      # Dependências e scripts (ES modules)
    ├── jest.config.js    # Configuração Jest para ES modules
    ├── helpers/          # Utilitários do sistema
    │   ├── queue.js      # Sistema de filas com UUID e callbacks
    │   └── service-router.js # Roteamento com retry configurável
    ├── services/         # Serviços de notificação
    │   ├── email.js      # Nodemailer + Ethereal para desenvolvimento
    │   ├── sms.js        # SMS.to API com encoding correto
    │   └── telegram.js   # Telegram Bot API com rate limiting
    └── __tests__/        # Suite completa de testes (215 testes)
        ├── setup.js      # Configuração global de mocks
        ├── app.test.js           # Testes de integração Express (42 testes)
        ├── controller.test.js    # Testes do controller (31 testes)
        ├── email-service.test.js # Testes do EmailService (29 testes)
        ├── queue.test.js         # Testes do Queue (26 testes)
        ├── service-router.test.js # Testes do ServiceRouter (28 testes)
        ├── sms-service.test.js   # Testes do SMSService (26 testes)
        ├── telegram-service.test.js # Testes do TelegramService (32 testes)
        └── coverage/            # Relatórios de cobertura gerados pelo Jest
```

## 🛠️ Tecnologias Utilizadas

### Runtime e Framework
- **Node.js 24**: Runtime JavaScript com ES Modules
- **Express 5**: Framework web com middleware moderno
- **ES Modules**: Import/export nativo (não CommonJS)

### Comunicação e APIs
- **Nodemailer 7**: Envio de emails com suporte SMTP
- **SMS.to API**: Serviço de SMS internacional
- **Telegram Bot API**: Messaging via bots
- **CORS**: Cross-Origin Resource Sharing configurado

### Banco de Dados e Cache
- **Redis (IORedis 5)**: Cache e persistência de estado
- **In-Memory Queue**: Sistema de filas personalizado

### Desenvolvimento e Testes
- **Jest 29**: Framework de testes com ES modules
- **Supertest 7**: Testes de integração HTTP
- **Nodemon 3**: Auto-reload em desenvolvimento
- **Docker Compose**: Orquestração de containers

### Qualidade e Monitoramento
- **UUID**: Identificadores únicos para tracking
- **Environment Variables**: Configuração flexível
- **Structured Logging**: Logs organizados por nível
- **Error Handling**: Tratamento robusto de erros

2. **Environment Setup**
```bash
cp .env.example .env
# Configure suas credenciais de desenvolvimento
```

3. **Install Dependencies**
```bash
cd api
npm install
```

4. **Run Tests**
```bash
# Certifique-se que todos os 215 testes passam
npm test
```

5. **Start Development Server**
```bash
npm run development
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

*Desenvolvido como parte do desafio técnico Appmax - Sistema Centralizador de Notificações*