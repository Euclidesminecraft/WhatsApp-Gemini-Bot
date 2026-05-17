import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import qrcodeImg from 'qrcode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import express from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Chromium path ─────────────────────────────────────────────────────────────
let chromiumPath;
try {
  chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null').toString().trim();
} catch {
  chromiumPath = undefined;
}

// ── AI Clients ────────────────────────────────────────────────────────────────
const geminiClient = process.env.GEMINI_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_KEY)
  : null;

const deepseekClient = process.env.DEEPSEEK_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_KEY, baseURL: 'https://api.deepseek.com' })
  : null;

async function gerarResposta(promptSistema, mensagem, provedor = 'gemini') {
  const textoCompleto = `${promptSistema}\n\nMensagem do usuário: ${mensagem}`;

  if (provedor === 'deepseek') {
    if (!deepseekClient) throw new Error('DEEPSEEK_KEY não configurada.');
    const res = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: mensagem },
      ],
      max_tokens: 800,
    });
    return res.choices[0].message.content;
  }

  // gemini (padrão) com fallback para deepseek
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(textoCompleto);
      return result.response.text();
    } catch (err) {
      console.warn('[T.I.Z] Gemini falhou, tentando DeepSeek:', err.message?.slice(0, 80));
      if (deepseekClient) {
        const res = await deepseekClient.chat.completions.create({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: promptSistema },
            { role: 'user', content: mensagem },
          ],
          max_tokens: 800,
        });
        return res.choices[0].message.content;
      }
      throw err;
    }
  }

  if (deepseekClient) {
    const res = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: mensagem },
      ],
      max_tokens: 800,
    });
    return res.choices[0].message.content;
  }

  throw new Error('Nenhuma chave de IA configurada (GEMINI_KEY ou DEEPSEEK_KEY).');
}

// ── Estado global ─────────────────────────────────────────────────────────────
// clientes: { [id]: { id, nome, prompt, provedor, status, qrCode, client, mensagens, totalHoje, lastCountDate } }
const clientes = {};

const DEFAULT_PROMPT = 'Você é um assistente virtual prestativo e simpático do T.I.Z. Responda sempre em português de forma clara e objetiva.';

function criarEstadoCliente(id, nome) {
  return {
    id,
    nome: nome || `Cliente ${id}`,
    prompt: DEFAULT_PROMPT,
    provedor: 'gemini',
    status: 'offline',
    qrCode: null,
    client: null,
    mensagens: [],
    totalHoje: 0,
    lastCountDate: new Date().toDateString(),
  };
}

function addMensagem(clienteId, from, body, reply) {
  const c = clientes[clienteId];
  if (!c) return;
  const today = new Date().toDateString();
  if (today !== c.lastCountDate) { c.totalHoje = 0; c.lastCountDate = today; }
  c.totalHoje++;
  c.mensagens.unshift({ id: Date.now(), from, body, reply, timestamp: new Date().toISOString() });
  if (c.mensagens.length > 50) c.mensagens.pop();
}

// ── Inicializar cliente WhatsApp ──────────────────────────────────────────────
function iniciarCliente(clienteId) {
  const estado = clientes[clienteId];
  if (!estado) return;
  if (estado.client) {
    try { estado.client.destroy(); } catch {}
  }

  // Limpar lock files do Chromium
  try {
    const lockDir = path.join(__dirname, '.wwebjs_auth', `session-${clienteId}`, 'Default');
    execSync(`rm -f "${lockDir}/SingletonLock" "${lockDir}/SingletonSocket" "${lockDir}/SingletonCookie" 2>/dev/null || true`);
  } catch {}

  const waClient = new Client({
    authStrategy: new LocalAuth({ clientId: clienteId }),
    puppeteer: {
      ...(chromiumPath ? { executablePath: chromiumPath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

  waClient.on('qr', async (qr) => {
    estado.status = 'awaiting_qr';
    console.log(`[T.I.Z][${clienteId}] QR Code gerado.`);
    qrcode.generate(qr, { small: true });
    try {
      estado.qrCode = await qrcodeImg.toDataURL(qr);
    } catch { estado.qrCode = null; }
  });

  waClient.on('ready', () => {
    estado.status = 'connected';
    estado.qrCode = null;
    console.log(`[T.I.Z][${clienteId}] Conectado!`);
  });

  waClient.on('disconnected', () => {
    estado.status = 'offline';
    estado.qrCode = null;
    console.log(`[T.I.Z][${clienteId}] Desconectado.`);
  });

  waClient.on('message', async (message) => {
    if (message.from.endsWith('@g.us')) return;
    if (message.fromMe) return;
    try {
      const reply = await gerarResposta(estado.prompt, message.body, estado.provedor);
      await message.reply(reply);
      const contact = message.from.replace('@c.us', '');
      addMensagem(clienteId, contact, message.body, reply);
    } catch (err) {
      console.error(`[T.I.Z][${clienteId}] Erro IA:`, err.message ?? err);
      await message.reply('Desculpe, ocorreu um erro. Tente novamente em instantes.');
    }
  });

  waClient.initialize();
  estado.client = waClient;
  console.log(`[T.I.Z][${clienteId}] Iniciando...`);
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Endpoints de clientes ─────────────────────────────────────────────────────

// GET /clientes — lista todos os clientes
app.get('/clientes', (req, res) => {
  const lista = Object.values(clientes).map(c => ({
    id: c.id,
    nome: c.nome,
    status: c.status,
    provedor: c.provedor,
    totalHoje: c.totalHoje,
    qrCode: c.qrCode,
    prompt: c.prompt,
  }));
  res.json(lista);
});

// POST /clientes — adicionar novo cliente
app.post('/clientes', (req, res) => {
  const { id, nome } = req.body;
  if (!id) return res.status(400).json({ error: 'Campo "id" é obrigatório.' });
  if (clientes[id]) return res.status(409).json({ error: `Cliente "${id}" já existe.` });
  const estado = criarEstadoCliente(id, nome);
  clientes[id] = estado;
  iniciarCliente(id);
  res.json({ message: 'Cliente criado e a iniciar.', id, nome: estado.nome });
});

// DELETE /clientes/:id — remover cliente
app.delete('/clientes/:id', (req, res) => {
  const { id } = req.params;
  if (!clientes[id]) return res.status(404).json({ error: 'Cliente não encontrado.' });
  try { clientes[id].client?.destroy(); } catch {}
  delete clientes[id];
  res.json({ message: 'Cliente removido.' });
});

// POST /clientes/:id/reiniciar — reiniciar sessão
app.post('/clientes/:id/reiniciar', (req, res) => {
  const { id } = req.params;
  if (!clientes[id]) return res.status(404).json({ error: 'Cliente não encontrado.' });
  iniciarCliente(id);
  res.json({ message: 'Sessão reiniciada.' });
});

// GET /clientes/:id/qr — QR code como imagem base64
app.get('/clientes/:id/qr', (req, res) => {
  const c = clientes[req.params.id];
  if (!c) return res.status(404).json({ error: 'Cliente não encontrado.' });
  if (!c.qrCode) return res.status(404).json({ error: 'QR não disponível.' });
  res.json({ qrCode: c.qrCode });
});

// GET /clientes/:id/mensagens — mensagens recentes
app.get('/clientes/:id/mensagens', (req, res) => {
  const c = clientes[req.params.id];
  if (!c) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(c.mensagens);
});

// POST /clientes/:id/prompt — salvar prompt
app.post('/clientes/:id/prompt', (req, res) => {
  const { id } = req.params;
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Campo "prompt" é obrigatório.' });
  if (!clientes[id]) return res.status(404).json({ error: 'Cliente não encontrado.' });
  clientes[id].prompt = prompt;
  console.log(`[T.I.Z][${id}] Prompt atualizado.`);
  res.json({ message: 'Prompt salvo.', id });
});

// POST /clientes/:id/provedor — trocar provedor de IA
app.post('/clientes/:id/provedor', (req, res) => {
  const { id } = req.params;
  const { provedor } = req.body;
  if (!['gemini', 'deepseek'].includes(provedor)) {
    return res.status(400).json({ error: 'Provedor inválido. Use "gemini" ou "deepseek".' });
  }
  if (!clientes[id]) return res.status(404).json({ error: 'Cliente não encontrado.' });
  clientes[id].provedor = provedor;
  res.json({ message: `Provedor alterado para ${provedor}.`, id });
});

// ── Endpoints globais (compatibilidade + stats) ───────────────────────────────

// GET /status — status geral (todos os clientes)
app.get('/status', (req, res) => {
  const lista = Object.values(clientes);
  const conectados = lista.filter(c => c.status === 'connected').length;
  const totalMensagens = lista.reduce((sum, c) => sum + c.totalHoje, 0);
  const primeiro = lista[0];
  res.json({
    status: primeiro?.status ?? 'offline',
    mensagensHoje: totalMensagens,
    clienteAtivo: primeiro?.id ?? '—',
    promptPadrao: primeiro?.prompt ?? DEFAULT_PROMPT,
    totalClientes: lista.length,
    clientesConectados: conectados,
  });
});

// GET /mensagens — mensagens de todos os clientes
app.get('/mensagens', (req, res) => {
  const todas = Object.values(clientes)
    .flatMap(c => c.mensagens.map(m => ({ ...m, clienteId: c.id, clienteNome: c.nome })))
    .sort((a, b) => b.id - a.id)
    .slice(0, 50);
  res.json(todas);
});

// POST /testar-resposta — testar IA
app.post('/testar-resposta', async (req, res) => {
  const { mensagem, provedor = 'gemini', clienteId } = req.body;
  if (!mensagem) return res.status(400).json({ error: 'Campo "mensagem" é obrigatório.' });
  const prompt = clienteId && clientes[clienteId]
    ? clientes[clienteId].prompt
    : DEFAULT_PROMPT;
  try {
    const resposta = await gerarResposta(prompt, mensagem, provedor);
    return res.json({ resposta, provedor });
  } catch (err) {
    console.error('[T.I.Z] Erro ao testar:', err.message);
    return res.status(500).json({ error: err.message ?? 'Erro ao gerar resposta.' });
  }
});

// POST /salvar-prompt (compatibilidade)
app.post('/salvar-prompt', (req, res) => {
  const { id, prompt } = req.body;
  if (!id || !prompt) return res.status(400).json({ error: 'Campos "id" e "prompt" são obrigatórios.' });
  const clienteId = id === 'default' ? Object.keys(clientes)[0] : id;
  if (clienteId && clientes[clienteId]) {
    clientes[clienteId].prompt = prompt;
    console.log(`[T.I.Z] Prompt atualizado para ${clienteId}.`);
  }
  return res.json({ message: 'Prompt salvo.', id });
});

// GET /pegar-prompt/:id (compatibilidade)
app.get('/pegar-prompt/:id', (req, res) => {
  const { id } = req.params;
  const clienteId = id === 'default' ? Object.keys(clientes)[0] : id;
  if (!clienteId || !clientes[clienteId]) {
    return res.status(404).json({ error: `Prompt com id "${id}" não encontrado.` });
  }
  return res.json({ id, prompt: clientes[clienteId].prompt });
});

// GET /ia/status — verificar disponibilidade das IAs
app.get('/ia/status', async (req, res) => {
  const resultado = { gemini: false, deepseek: false };

  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('ok');
      resultado.gemini = true;
    } catch (e) {
      resultado.geminiErro = e.message?.slice(0, 100);
    }
  } else {
    resultado.geminiErro = 'GEMINI_KEY não configurada';
  }

  if (deepseekClient) {
    try {
      await deepseekClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'ok' }],
        max_tokens: 5,
      });
      resultado.deepseek = true;
    } catch (e) {
      resultado.deepseekErro = e.message?.slice(0, 100);
    }
  } else {
    resultado.deepseekErro = 'DEEPSEEK_KEY não configurada';
  }

  res.json(resultado);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[T.I.Z] Servidor Express rodando na porta ${PORT}`);
  console.log(`[T.I.Z] Gemini: ${geminiClient ? 'configurado' : 'sem chave'} | DeepSeek: ${deepseekClient ? 'configurado' : 'sem chave'}`);
});
