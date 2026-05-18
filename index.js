import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const { Client, LocalAuth } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
  console.log('Escaneie o QR no WhatsApp:');
  qrcode.generate(qr, {small: true});
});

client.on('ready', () => console.log('✅ Bot pronto!'));

client.on('message', async msg => {
  if (msg.body.startsWith('!')) {
    const prompt = msg.body.slice(1);
    try {
      const result = await model.generateContent(prompt);
      await msg.reply(result.response.text());
    } catch(e) {
      await msg.reply('Erro Gemini: ' + e.message);
    }
  }
});

client.initialize();

app.get('/', (req,res)=> res.send('T.I.Z Bot online'));
app.listen(PORT, ()=> console.log('Server na porta '+PORT));
