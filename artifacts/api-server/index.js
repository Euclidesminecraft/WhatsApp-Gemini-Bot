import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';

// In-memory prompt storage
const prompts = {};
let defaultPrompt =
  'Você é um assistente virtual prestativo e simpático. Responda sempre em português de forma clara e objetiva.';

// ── Gemini ────────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ── WhatsApp ──────────────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'cliente1' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('Escaneie o QR Code abaixo com o WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('BOT CONECTADO');
});

client.on('message', async (message) => {
  // Ignore group messages
  if (message.from.endsWith('@g.us')) return;
  // Ignore own messages
  if (message.fromMe) return;

  try {
    const prompt = `${defaultPrompt}\n\nMensagem do usuário: ${message.body}`;
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    await message.reply(response);
  } catch (err) {
    console.error('Erro ao processar mensagem com Gemini:', err);
    await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
});

client.initialize();

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// POST /salvar-prompt — save or update a prompt by id
app.post('/salvar-prompt', (req, res) => {
  const { id, prompt } = req.body;
  if (!id || !prompt) {
    return res.status(400).json({ error: 'Os campos "id" e "prompt" são obrigatórios.' });
  }
  prompts[id] = prompt;
  // If saving the "default" prompt, update the bot's active prompt
  if (id === 'default') {
    defaultPrompt = prompt;
    console.log('Prompt padrão atualizado.');
  }
  return res.json({ message: 'Prompt salvo com sucesso.', id });
});

// GET /pegar-prompt/:id — retrieve a saved prompt by id
app.get('/pegar-prompt/:id', (req, res) => {
  const { id } = req.params;
  if (!prompts[id]) {
    return res.status(404).json({ error: `Prompt com id "${id}" não encontrado.` });
  }
  return res.json({ id, prompt: prompts[id] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
});
