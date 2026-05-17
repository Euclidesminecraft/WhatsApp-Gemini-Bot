import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Send, Sparkles, CheckCircle2, AlertCircle, Loader2, ChevronDown } from "lucide-react";

interface Cliente {
  id: string;
  nome: string;
  prompt: string;
  provedor: string;
}

const GOLD = "#D4AF37";
const CARD = "#0A1A2F";

const TEMPLATES = [
  {
    nome: "Assistente Geral",
    texto: "Você é um assistente virtual prestativo e simpático. Responda sempre em português de forma clara e objetiva.",
  },
  {
    nome: "Restaurante / Loja",
    texto: "Você é o assistente virtual de um negócio em Moçambique. Seja cordial, responda dúvidas sobre produtos, preços e horários. Fale sempre em português. Se não souber a resposta, peça ao cliente para contactar diretamente.",
  },
  {
    nome: "Clínica / Saúde",
    texto: "Você é o assistente virtual de uma clínica. Responda dúvidas sobre consultas, marcações e horários. Nunca dê diagnósticos médicos. Encaminhe casos urgentes para o médico de plantão. Responda sempre em português.",
  },
  {
    nome: "Suporte Técnico",
    texto: "Você é um agente de suporte técnico. Ajude o cliente a resolver problemas passo a passo. Se o problema for complexo, recolha o nome e contacto e diga que um técnico irá ligar. Responda sempre em português.",
  },
  {
    nome: "Imobiliária",
    texto: "Você é um assistente imobiliário em Moçambique. Responda dúvidas sobre imóveis, alugueres e vendas. Peça sempre o orçamento e preferências do cliente para sugerir opções adequadas. Responda em português.",
  },
];

export default function PromptEditor() {
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testError, setTestError] = useState("");
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const { data: clientes = [], isLoading: clientesLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => fetch("/clientes").then(r => r.json()),
  });

  // Seleccionar primeiro cliente automaticamente
  useEffect(() => {
    if (clientes.length > 0 && !clienteId) {
      setClienteId(clientes[0].id);
    }
  }, [clientes]);

  // Carregar prompt quando muda cliente
  useEffect(() => {
    const c = clientes.find(c => c.id === clienteId);
    if (c) setPrompt(c.prompt);
  }, [clienteId, clientes]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`/clientes/${clienteId}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      }).then(r => r.json()),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  async function runTest() {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse("");
    setTestError("");
    try {
      const res = await fetch("/testar-resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: testMessage, clienteId: clienteId || undefined }),
      });
      const data = await res.json();
      if (data.resposta) setTestResponse(data.resposta);
      else setTestError(data.error ?? "Erro desconhecido");
    } catch {
      setTestError("Falha na requisição. Verifique se o bot está em execução.");
    } finally {
      setTesting(false);
    }
  }

  const inputStyle = {
    backgroundColor: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(212,175,55,0.15)",
    color: "#fff",
    outline: "none",
  };

  const selectStyle = {
    ...inputStyle,
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    appearance: "none" as const,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Prompt Editor</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          T.I.Z — Personaliza o comportamento do bot para cada cliente
        </p>
      </div>

      {/* Selector de cliente */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: CARD }}>
        <label className="text-xs mb-2 block font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
          Cliente
        </label>
        {clientesLoading ? (
          <div className="flex items-center gap-2 text-sm py-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Loader2 size={14} className="animate-spin" /> A carregar clientes…
          </div>
        ) : clientes.length === 0 ? (
          <p className="text-sm" style={{ color: "#ef4444" }}>
            Nenhum cliente criado. Vai a Clientes → Novo Cliente primeiro.
          </p>
        ) : (
          <div className="relative">
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              style={selectStyle}
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.provedor === "gemini" ? "🔵 Gemini" : "🟦 DeepSeek"}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
          </div>
        )}
      </div>

      {/* Editor */}
      {clienteId && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
            <div className="flex items-center gap-2">
              <Sparkles size={15} style={{ color: GOLD }} />
              <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
                Prompt do Bot
              </h2>
            </div>
            {/* Templates dropdown */}
            <div className="relative">
              <button
                onClick={() => setTemplateOpen(o => !o)}
                className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                style={{ backgroundColor: "rgba(212,175,55,0.08)", color: GOLD }}
              >
                Templates <ChevronDown size={12} />
              </button>
              {templateOpen && (
                <div
                  className="absolute right-0 top-9 z-20 rounded-xl overflow-hidden min-w-[200px] shadow-xl"
                  style={{ backgroundColor: "#0D1F35", border: "1px solid rgba(212,175,55,0.2)" }}
                >
                  {TEMPLATES.map(t => (
                    <button
                      key={t.nome}
                      onClick={() => { setPrompt(t.texto); setTemplateOpen(false); }}
                      className="block w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {t.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Este texto define o comportamento do bot. Podes usar um template acima ou escrever do zero.
            </p>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={8}
              placeholder="Digite o prompt do bot aqui…"
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(212,175,55,0.15)",
                color: "#fff",
                lineHeight: "1.6",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(212,175,55,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(212,175,55,0.15)")}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{prompt.length} caracteres</span>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !prompt.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: GOLD, color: "#000", boxShadow: "0 0 20px rgba(212,175,55,0.3)" }}
              >
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saveMutation.isPending ? "A guardar…" : saved ? "Guardado!" : "Guardar Prompt"}
              </button>
            </div>

            {saved && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                <CheckCircle2 size={14} /> Prompt guardado e activo.
              </div>
            )}
            {saveMutation.isError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                <AlertCircle size={14} /> Erro ao guardar. Tenta novamente.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Testar resposta */}
      {clienteId && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD }}>
          <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
            <Send size={15} style={{ color: GOLD }} />
            <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
              Testar Resposta
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Simula uma mensagem usando o prompt e o modelo de IA deste cliente.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runTest()}
                placeholder="Ex: Qual é o horário de funcionamento?"
                className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "rgba(212,175,55,0.4)")}
                onBlur={e => (e.target.style.borderColor = "rgba(212,175,55,0.15)")}
              />
              <button
                onClick={runTest}
                disabled={testing || !testMessage.trim()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0"
                style={{ backgroundColor: GOLD, color: "#000" }}
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {testing ? "A testar…" : "Testar"}
              </button>
            </div>

            {testError && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> {testError}
              </div>
            )}

            {testResponse && (
              <div className="rounded-xl p-5 text-sm leading-relaxed" style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,175,55,0.12)", color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>
                <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: GOLD }}>
                  <Sparkles size={12} /> Resposta do Bot
                </div>
                {testResponse}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
