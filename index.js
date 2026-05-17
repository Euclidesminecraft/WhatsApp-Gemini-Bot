// T.I.Z — Talk In Zap | Bot WhatsApp + API
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import qrcodeImg from "qrcode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import express from "express";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Verificação de arranque ───────────────────────────────────────────────────
if (!process.env.GEMINI_KEY &&!process.env.DEEPSEEK_KEY) {
  console.warn(
    "[T.I.Z] AVISO: Nenhuma chave de IA configurada. O servidor vai iniciar, mas respostas vão falhar até definir GEMINI_KEY ou DEEPSEEK_KEY.",
  );
}
if (!process.env.GEMINI_KEY) {
  console.warn(
    "[T.I.Z] AVISO: GEMINI_KEY não definida — a usar apenas DeepSeek.",
  );
}

// ── Chromium ──────────────────────────────────────────────────────────────────
let chromiumPath;
try {
  chromiumPath = execSync(
    "which chromium 2>/dev/null || which chromium-browser 2>/dev/null",
  )
   .toString()
   .trim();
} catch {
  chromiumPath = undefined;
}

// ── Clientes IA ───────────────────────────────────────────────────────────────
const geminiClient = process.env.GEMINI_KEY
 ? new GoogleGenerativeAI(process.env.GEMINI_KEY)
  : null;

const deepseekClient = process.env.DEEPSEEK_KEY
 ? new OpenAI({
      apiKey: process.env.DEEPSEEK_KEY,
      baseURL: "https://api.deepseek.com",
    })
  : null;

// ── Cache de respostas (5 minutos por pergunta+provedor) ──────────────────────
const respostaCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(provedor, mensagem) {
  const key = `${provedor}:${mensagem}`;
  const entry = respostaCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    respostaCache.delete(key);
    return null;
  }
  return entry.resposta;
}

function setCache(provedor, mensagem, resposta) {
  respostaCache.set(`${provedor}:${mensagem}`, { resposta, ts: Date.now() });
  if (respostaCache.size > 200) {
    const firstKey = respostaCache.keys().next().value;
    respostaCache.delete(firstKey);
  }
}

// ── Gerar resposta com IA ─────────────────────────────────────────────────────
async function gerarResposta(promptSistema, mensagem, provedor = "gemini", historico = []) {
  const mensagemTruncada = mensagem.length > 500? mensagem.slice(0, 497) + "…" : mensagem;
  const cached = getCached(provedor, mensagemTruncada);
  if (cached) {
    console.log(`[T.I.Z] Cache hit para: "${mensagemTruncada.slice(0, 40)}"`);
    return cached;
  }

  let resposta;
  if (provedor === "deepseek") {
    if (!deepseekClient) throw new Error("DEEPSEEK_KEY não configurada.");
    const messages = [
      { role: "system", content: promptSistema },
     ...historico.slice(-10),
      { role: "user", content: mensagemTruncada },
    ];
    const res = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages,
      max_tokens: 250,
      temperature: 0.7,
    });
    resposta = res.choices[0].message.content;
  } else {
    if (geminiClient) {
      try {
        const model = geminiClient.getGenerativeModel({
          model: "gemini-1.5-flash",
          systemInstruction: promptSistema,
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
        });
        const history = historico
         .filter((_, i) => i < historico.length - 1 || historico[i].role!== "user")
         .map((m) => ({ role: m.role === "assistant"? "model" : "user", parts: [{ text: m.content }] }));
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(mensagemTruncada);
        resposta = result.response.text();
      } catch (err) {
        console.warn("[T.I.Z] Gemini falhou, fallback DeepSeek:", err.message?.slice(0, 80));
        if (deepseekClient) {
          const messages = [
            { role: "system", content: promptSistema },
           ...historico.slice(-10),
            { role: "user", content: mensagemTruncada },
          ];
          const res = await deepseekClient.chat.completions.create({
            model: "deepseek-chat",
            messages,
            max_tokens: 250,
            temperature: 0.7,
          });
          resposta = res.choices[0].message.content;
        } else {
          throw err;
        }
      }
    } else if (deepseekClient) {
      const messages = [
        { role: "system", content: promptSistema },
       ...historico.slice(-10),
        { role: "user", content: mensagemTruncada },
      ];
      const res = await deepseekClient.chat.completions.create({
        model: "deepseek-chat",
        messages,
        max_tokens: 250,
        temperature: 0.7,
      });
      resposta = res.choices[0].message.content;
    } else {
      throw new Error("Nenhuma chave de IA configurada.");
    }
  }
  setCache(provedor, mensagemTruncada, resposta);
  return resposta;
}

// ── Estado global ─────────────────────────────────────────────────────────────
const clientes = {};
const historicoUsers = {};
const DEFAULT_PROMPT = "Você é um assistente virtual prestativo e simpático do T.I.Z — Talk In Zap. Responda sempre em português de forma clara e objetiva. Seja conciso.";

function criarEstadoCliente(id, nome) {
  return { id, nome: nome || `Cliente ${id}`, prompt: DEFAULT_PROMPT, provedor: "gemini", status: "offline", qrCode: null, client: null, mensagens: [], totalHoje: 0, lastCountDate: new Date().toDateString() };
}

function getHistorico(clienteId, from) {
  if (!historicoUsers[clienteId]) historicoUsers[clienteId] = {};
  if (!historicoUsers[clienteId][from]) historicoUsers[clienteId][from] = [];
  return historicoUsers[clienteId][from];
}

function addAoHistorico(clienteId, from, mensagem, resposta) {
  const hist = getHistorico(clienteId, from);
  hist.push({ role: "user", content: mensagem });
  hist.push({ role: "assistant", content: resposta });
  if (hist.length > 10) hist.splice(0, hist.length - 10);
}

function addMensagem(clienteId, from, body, reply) {
  const c = clientes[clienteId];
  if (!c) return;
  const today = new Date().toDateString();
  if (today!== c.lastCountDate) { c.totalHoje = 0; c.lastCountDate = today; }
  c.totalHoje++;
  c.mensagens.unshift({ id: Date.now(), from, body, reply, timestamp: new Date().toISOString() });
  if (c.mensagens.length > 50) c.mensagens.pop();
}

// ── Inicializar cliente WhatsApp ──────────────────────────────────────────────
function iniciarCliente(clienteId) {
  const estado = clientes[clienteId];
  if (!estado) return;
  if (estado.client) { try { estado.client.destroy(); } catch {} }

  try {
    const lockDir = path.join("/tmp/wwebjs", `session-${clienteId}`, "Default");
    execSync(`rm -f "${lockDir}/SingletonLock" "${lockDir}/SingletonSocket" "${lockDir}/SingletonCookie" 2>/dev/null || true`);
  } catch {}

  const waClient = new Client({
    authStrategy: new LocalAuth({ clientId: clienteId, dataPath: "/tmp/wwebjs" }),
    puppeteer: {
     ...(chromiumPath? { executablePath: chromiumPath } : {}),
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-zygote","--single-process"],
    },
  });

  waClient.on("qr", async (qr) => {
    estado.status = "awaiting_qr";
    console.log(`[T.I.Z][${clienteId}] QR Code gerado — escaneia com o WhatsApp.`);
    qrcode.generate(qr, { small: true });
    try { estado.qrCode = await qrcodeImg.toDataURL(qr); } catch { estado.qrCode = null; }
  });

  waClient.on("ready", () => {
    estado.status = "connected";
    estado.qrCode = null;
    console.log(`[T.I.Z][${clienteId}] ✓ Conectado ao WhatsApp!`);
  });

  waClient.on("disconnected", (reason) => {
    estado.status = "offline";
    estado.qrCode = null;
    console.log(`[T.I.Z][${clienteId}] Desconectado: ${reason}`);
  });

  waClient.on("message", async (message) => {
    if (message.from.endsWith("@g.us")) return;
    if (message.fromMe) return;
    const from = message.from.replace("@c.us", "");
    const hist = getHistorico(clienteId, from);
    try {
      const reply = await gerarResposta(estado.prompt, message.body, estado.provedor, hist);
      await message.reply(reply);
      addAoHistorico(clienteId, from, message.body, reply);
      addMensagem(clienteId, from, message.body, reply);
    } catch (err) {
      console.error(`[T.I.Z][${clienteId}] Erro IA:`, err.message?? err);
      await message.reply("Desculpe, ocorreu um erro temporário. Tenta novamente em instantes.");
    }
  });

  estado.client = waClient;
  console.log(`[T.I.Z][${clienteId}] A inicializar sessão…`);
  setTimeout(() => {
    waClient.initialize().catch(err => console.error(`[T.I.Z][${clienteId}] Falha ao iniciar WhatsApp:`, err.message));
  }, 3000);
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/", (req, res) => { res.json({ app: "T.I.Z — Talk In Zap", version: "2.0.0", status: "running", clientes: Object.keys(clientes).length, ia: { gemini:!!geminiClient, deepseek:!!deepseekClient } }); });
app.get("/health", (req, res) => { res.json({ ok: true, ts: new Date().toISOString() }); });
app.get("/clientes", (req, res) => { res.json(Object.values(clientes).map(c => ({ id: c.id, nome: c.nome, status: c.status, provedor: c.provedor, totalHoje: c.totalHoje, qrCode: c.qrCode, prompt: c.prompt }))); });
app.post("/clientes", (req, res) => { const { id, nome } = req.body; if (!id) return res.status(400).json({ error: 'Campo "id" é obrigatório.' }); if (clientes[id]) return res.status(409).json({ error: `Cliente "${id}" já existe.` }); const estado = criarEstadoCliente(id, nome); clientes[id] = estado; iniciarCliente(id); res.json({ message: "Cliente criado e a iniciar.", id, nome: estado.nome }); });
app.delete("/clientes/:id", (req, res) => { const { id } = req.params; if (!clientes[id]) return res.status(404).json({ error: "Cliente não encontrado." }); try { clientes[id].client?.destroy(); } catch {} delete clientes[id]; delete historicoUsers[id]; res.json({ message: "Cliente removido." }); });
app.post("/clientes/:id/reiniciar", (req, res) => { const { id } = req.params; if (!clientes[id]) return res.status(404).json({ error: "Cliente não encontrado." }); iniciarCliente(id); res.json({ message: "Sessão reiniciada." }); });
app.get("/clientes/:id/qr", (req, res) => { const c = clientes[req.params.id]; if (!c) return res.status(404).json({ error: "Cliente não encontrado." }); if (!c.qrCode) return res.status(404).json({ error: "QR não disponível." }); res.json({ qrCode: c.qrCode }); });
app.get("/clientes/:id/mensagens", (req, res) => { const c = clientes[req.params.id]; if (!c) return res.status(404).json({ error: "Cliente não encontrado." }); res.json(c.mensagens); });
app.post("/clientes/:id/prompt", (req, res) => { const { id } = req.params; const { prompt } = req.body; if (!prompt) return res.status(400).json({ error: 'Campo "prompt" é obrigatório.' }); if (!clientes[id]) return res.status(404).json({ error: "Cliente não encontrado." }); clientes[id].prompt = prompt; console.log(`[T.I.Z][${id}] Prompt atualizado.`); res.json({ message: "Prompt salvo.", id }); });
app.post("/clientes/:id/provedor", (req, res) => { const { id } = req.params; const { provedor } = req.body; if (!["gemini","deepseek"].includes(provedor)) return res.status(400).json({ error: 'Provedor inválido. Use "gemini" ou "deepseek".' }); if (!clientes[id]) return res.status(404).json({ error: "Cliente não encontrado." }); clientes[id].provedor = provedor; res.json({ message: `Provedor alterado para ${provedor}.`, id }); });
app.get("/status", (req, res) => { const lista = Object.values(clientes); const conectados = lista.filter(c => c.status === "connected").length; const totalMensagens = lista.reduce((sum, c) => sum + c.totalHoje, 0); const primeiro = lista[0]; res.json({ status: primeiro?.status?? "offline", mensagensHoje: totalMensagens, clienteAtivo: primeiro?.id?? "—", promptPadrao: primeiro?.prompt?? DEFAULT_PROMPT, totalClientes: lista.length, clientesConectados: conectados }); });
app.get("/mensagens", (req, res) => { const todas = Object.values(clientes).flatMap(c => c.mensagens.map(m => ({...m, clienteId: c.id, clienteNome: c.nome }))).sort((a,b) => b.id - a.id).slice(0,50); res.json(todas); });
app.post("/testar-resposta", async (req, res) => { const { mensagem, provedor = "gemini", clienteId } = req.body; if (!mensagem) return res.status(400).json({ error: 'Campo "mensagem" é obrigatório.' }); const prompt = clienteId && clientes[clienteId]? clientes[clienteId].prompt : DEFAULT_PROMPT; try { const resposta = await gerarResposta(prompt, mensagem, provedor); return res.json({ resposta, provedor }); } catch (err) { console.error("[T.I.Z] Erro ao testar:", err.message); return res.status(500).json({ error: err.message?? "Erro ao gerar resposta." }); } });
app.post("/salvar-prompt", (req, res) => { const { id, prompt } = req.body; if (!id ||!prompt) return res.status(400).json({ error: 'Campos "id" e "prompt" são obrigatórios.' }); const clienteId = id === "default"? Object.keys(clientes)[0] : id; if (clienteId && clientes[clienteId]) { clientes[clienteId].prompt = prompt; } return res.json({ message: "Prompt salvo.", id }); });
app.get("/pegar-prompt/:id", (req, res) => { const { id } = req.params; const clienteId = id === "default"? Object.keys(clientes)[0] : id; if (!clienteId ||!clientes[clienteId]) return res.status(404).json({ error: `Prompt com id "${id}" não encontrado.` }); return res.json({ id, prompt: clientes[clienteId].prompt }); });
app.get("/ia/status", async (req, res) => { const resultado = { gemini: false, deepseek: false }; if (geminiClient) { try { const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { maxOutputTokens: 5 } }); await model.generateContent("ok"); resultado.gemini = true; } catch (e) { resultado.geminiErro = e.message?.slice(0,120); } } else { resultado.geminiErro = "GEMINI_KEY não configurada"; } if (deepseekClient) { try { await deepseekClient.chat.completions.create({ model: "deepseek-chat", messages: [{ role: "user", content: "ok" }], max_tokens: 5 }); resultado.deepseek = true; } catch (e) { resultado.deepseekErro = e.message?.slice(0,120); } } else { resultado.deepseekErro = "DEEPSEEK_KEY não configurada"; } res.json(resultado); });

// ── Servidor ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[T.I.Z] ✓ T.I.Z — Talk In Zap rodando em 0.0.0.0:${PORT}`);
  console.log(`[T.I.Z] Gemini: ${geminiClient? "✓ configurado (gemini-1.5-flash)" : "✗ sem chave"} | DeepSeek: ${deepseekClient? "✓ configurado" : "✗ sem chave"}`);
  console.log(`[T.I.Z] Cache activo: até 200 entradas, TTL 5 minutos`);
  console.log(`[T.I.Z] Optimizações: maxTokens=250, truncagem=500chars, histórico=5 trocas`);
});