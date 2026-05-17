import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Sparkles, Send, Loader2, CheckCircle2, AlertCircle, Zap, ChevronDown } from "lucide-react";

const GOLD = "#D4AF37";
const CARD = "#0A1A2F";

interface IAStatus {
  gemini: boolean;
  deepseek: boolean;
  geminiErro?: string;
  deepseekErro?: string;
}

interface Cliente {
  id: string;
  nome: string;
  provedor: string;
}

export default function IAConfig() {
  const [mensagem, setMensagem] = useState("");
  const [provedor, setProvedor] = useState<"gemini" | "deepseek">("gemini");
  const [clienteId, setClienteId] = useState("");
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState("");
  const [testing, setTesting] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [respostaGemini, setRespostaGemini] = useState("");
  const [respostaDeepseek, setRespostaDeepseek] = useState("");

  const { data: iaStatus, isLoading: iaLoading, refetch: refetchIA } = useQuery<IAStatus>({
    queryKey: ["ia-status"],
    queryFn: () => fetch("/ia/status").then(r => r.json()),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => fetch("/clientes").then(r => r.json()),
  });

  async function testar() {
    if (!mensagem.trim()) return;
    setTesting(true);
    setResposta("");
    setErro("");
    try {
      const res = await fetch("/testar-resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem, provedor, clienteId: clienteId || undefined }),
      });
      const data = await res.json();
      if (data.resposta) setResposta(data.resposta);
      else setErro(data.error ?? "Erro desconhecido");
    } catch {
      setErro("Falha na requisição.");
    } finally {
      setTesting(false);
    }
  }

  async function comparar() {
    if (!mensagem.trim()) return;
    setComparando(true);
    setRespostaGemini("");
    setRespostaDeepseek("");
    setErro("");

    const [r1, r2] = await Promise.allSettled([
      fetch("/testar-resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem, provedor: "gemini", clienteId: clienteId || undefined }),
      }).then(r => r.json()),
      fetch("/testar-resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem, provedor: "deepseek", clienteId: clienteId || undefined }),
      }).then(r => r.json()),
    ]);

    if (r1.status === "fulfilled") setRespostaGemini(r1.value.resposta ?? r1.value.error ?? "Erro");
    else setRespostaGemini("Falha na requisição");
    if (r2.status === "fulfilled") setRespostaDeepseek(r2.value.resposta ?? r2.value.error ?? "Erro");
    else setRespostaDeepseek("Falha na requisição");

    setComparando(false);
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Configurar IA</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          T.I.Z — Gerir e testar os modelos de inteligência artificial
        </p>
      </div>

      {/* Status das IAs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gemini */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: CARD }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(66,133,244,0.15)" }}>
                <Brain size={16} style={{ color: "#4285F4" }} />
              </div>
              <span className="font-semibold text-white">Google Gemini</span>
            </div>
            {iaLoading ? (
              <Loader2 size={14} className="animate-spin" style={{ color: GOLD }} />
            ) : iaStatus?.gemini ? (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                <CheckCircle2 size={11} /> Activo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <AlertCircle size={11} /> Indisponível
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Modelo: gemini-2.0-flash</p>
          {iaStatus?.geminiErro && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#ef4444" }}>
              {iaStatus.geminiErro}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
            Chave: {process.env.GEMINI_KEY ? "configurada" : "GEMINI_KEY"}
          </p>
        </div>

        {/* DeepSeek */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: CARD }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,187,255,0.12)" }}>
                <Zap size={16} style={{ color: "#00BBFF" }} />
              </div>
              <span className="font-semibold text-white">DeepSeek</span>
            </div>
            {iaLoading ? (
              <Loader2 size={14} className="animate-spin" style={{ color: GOLD }} />
            ) : iaStatus?.deepseek ? (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                <CheckCircle2 size={11} /> Activo
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <AlertCircle size={11} /> Indisponível
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Modelo: deepseek-chat</p>
          {iaStatus?.deepseekErro && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#ef4444" }}>
              {iaStatus.deepseekErro}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Fallback automático quando Gemini falha</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => refetchIA()}
          className="text-xs px-4 py-2 rounded-lg"
          style={{ backgroundColor: "rgba(212,175,55,0.08)", color: GOLD }}
        >
          Verificar disponibilidade novamente
        </button>
      </div>

      {/* Testar IA */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD }}>
        <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
          <Send size={15} style={{ color: GOLD }} />
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Testar Resposta
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provedor */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Modelo de IA</label>
              <div className="relative">
                <select
                  value={provedor}
                  onChange={e => setProvedor(e.target.value as "gemini" | "deepseek")}
                  style={selectStyle}
                >
                  <option value="gemini">🔵 Google Gemini</option>
                  <option value="deepseek">🟦 DeepSeek</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
            </div>
            {/* Cliente (opcional) */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                Cliente (opcional — usa o prompt do cliente)
              </label>
              <div className="relative">
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">— Prompt padrão —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.id})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
            </div>
          </div>

          {/* Input + botões */}
          <div className="flex gap-3">
            <input
              type="text"
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && testar()}
              placeholder="Ex: Qual é o horário de funcionamento?"
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(212,175,55,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(212,175,55,0.15)")}
            />
            <button
              onClick={testar}
              disabled={testing || !mensagem.trim()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0"
              style={{ backgroundColor: GOLD, color: "#000" }}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? "A testar…" : "Testar"}
            </button>
            <button
              onClick={comparar}
              disabled={comparando || !mensagem.trim()}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0"
              style={{ backgroundColor: "rgba(212,175,55,0.12)", color: GOLD, border: "1px solid rgba(212,175,55,0.2)" }}
            >
              {comparando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {comparando ? "Comparando…" : "Comparar"}
            </button>
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          {/* Resposta individual */}
          {resposta && (
            <div className="rounded-xl p-5 text-sm leading-relaxed" style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,175,55,0.12)", color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: GOLD }}>
                <Sparkles size={12} />
                Resposta — {provedor === "gemini" ? "Gemini" : "DeepSeek"}
              </div>
              {resposta}
            </div>
          )}

          {/* Comparação lado a lado */}
          {(respostaGemini || respostaDeepseek) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl p-5 text-sm leading-relaxed" style={{ backgroundColor: "rgba(66,133,244,0.05)", border: "1px solid rgba(66,133,244,0.2)", color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>
                <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: "#4285F4" }}>
                  <Brain size={12} /> Gemini 2.0 Flash
                </div>
                {comparando ? <Loader2 size={16} className="animate-spin" style={{ color: "#4285F4" }} /> : respostaGemini || "—"}
              </div>
              <div className="rounded-xl p-5 text-sm leading-relaxed" style={{ backgroundColor: "rgba(0,187,255,0.05)", border: "1px solid rgba(0,187,255,0.2)", color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>
                <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: "#00BBFF" }}>
                  <Zap size={12} /> DeepSeek Chat
                </div>
                {comparando ? <Loader2 size={16} className="animate-spin" style={{ color: "#00BBFF" }} /> : respostaDeepseek || "—"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
