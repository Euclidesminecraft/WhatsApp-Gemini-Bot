import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── State ──────────────────────────────────────────────────────────────────────
const prompts = {};
let defaultPrompt =
  'Você é um assistente virtual prestativo e simpático. Responda sempre em português de forma clara e objetiva.';

let botStatus = 'offline';
let todayCount = 0;
let lastCountDate = new Date().toDateString();
const recentMessages = [];

function resetDailyCount() {
  const today = new Date().toDateString();
  if (today !== lastCountDate) {
    todayCount = 0;
    lastCountDate = today;
  }
}

function addRecentMessage(from, body, reply) {
  resetDailyCount();
  todayCount++;
  recentMessages.unshift({
    id: Date.now(),
    from,
    body,
    reply,
    timestamp: new Date().toISOString(),
  });
  if (recentMessages.length > 30) recentMessages.pop();
}

// ── Gemini ────────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// ── WhatsApp ──────────────────────────────────────────────────────────────────
let chromiumPath;
try {
  chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null').toString().trim();
} catch {
  chromiumPath = undefined;
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cliente1' }),
  puppeteer: {
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  botStatus = 'awaiting_qr';
  console.log('[T.I.Z] Escaneie o QR Code abaixo com o WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  botStatus = 'connected';
  console.log('[T.I.Z] Bot conectado e pronto para atender!');
});

client.on('disconnected', () => {
  botStatus = 'offline';
  console.log('[T.I.Z] Bot desconectado.');
});

client.on('message', async (message) => {
  if (message.from.endsWith('@g.us')) return;
  if (message.fromMe) return;

  try {
    const prompt = `${defaultPrompt}\n\nMensagem do usuário: ${message.body}`;
    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    await message.reply(reply);
    const contact = message.from.replace('@c.us', '');
    addRecentMessage(contact, message.body, reply);
  } catch (err) {
    console.error('[T.I.Z] Erro ao processar mensagem com Gemini:', err.message ?? err);
    await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.');
  }
});

client.initialize();

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// GET /status — bot status + stats
app.get('/status', (req, res) => {
  resetDailyCount();
  res.json({
    status: botStatus,
    mensagensHoje: todayCount,
    clienteAtivo: 'cliente1',
    promptPadrao: defaultPrompt,
  });
});

// GET /mensagens — recent messages list
app.get('/mensagens', (req, res) => {
  res.json(recentMessages);
});

// POST /testar-resposta — send test message to Gemini and return response
app.post('/testar-resposta', async (req, res) => {
  const { mensagem } = req.body;
  if (!mensagem) {
    return res.status(400).json({ error: 'O campo "mensagem" é obrigatório.' });
  }
  try {
    const prompt = `${defaultPrompt}\n\nMensagem do usuário: ${mensagem}`;
    const result = await model.generateContent(prompt);
    const resposta = result.response.text();
    return res.json({ resposta });
  } catch (err) {
    console.error('Erro ao testar resposta:', err);
    return res.status(500).json({ error: 'Erro ao gerar resposta com Gemini.' });
  }
});

// POST /salvar-prompt
app.post('/salvar-prompt', (req, res) => {
  const { id, prompt } = req.body;
  if (!id || !prompt) {
    return res.status(400).json({ error: 'Os campos "id" e "prompt" são obrigatórios.' });
  }
  prompts[id] = prompt;
  if (id === 'default') {
    defaultPrompt = prompt;
    console.log('[T.I.Z] Prompt padrão atualizado.');
  }
  return res.json({ message: 'Prompt salvo com sucesso.', id });
});

// GET /pegar-prompt/:id
app.get('/pegar-prompt/:id', (req, res) => {
  const { id } = req.params;
  if (!prompts[id]) {
    return res.status(404).json({ error: `Prompt com id "${id}" não encontrado.` });
  }
  return res.json({ id, prompt: prompts[id] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[T.I.Z] Servidor Express rodando na porta ${PORT}`);
});
