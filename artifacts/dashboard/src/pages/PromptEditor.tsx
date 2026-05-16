import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Send, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface BotStatus {
  status: string;
  mensagensHoje: number;
  clienteAtivo: string;
  promptPadrao: string;
}

export default function PromptEditor() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () => fetch("/status").then((r) => r.json() as Promise<BotStatus>),
  });

  // Populate prompt from server once on first load
  useEffect(() => {
    if (statusData?.promptPadrao && !prompt) setPrompt(statusData.promptPadrao);
  }, [statusData?.promptPadrao]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch("/salvar-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "default", prompt }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["status"] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  async function runTest() {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse("");
    setTestError("");
    try {
      const res = await fetch("/testar-resposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: testMessage }),
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Prompt Editor</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Personalize o comportamento do seu bot com IA
        </p>
      </div>

      {/* Prompt Editor Card */}
      <div
        className="rounded-2xl card-shadow overflow-hidden"
        style={{ backgroundColor: "#0A1A2F" }}
      >
        <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
          <Sparkles size={15} style={{ color: "#D4AF37" }} />
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Prompt Padrão do Bot
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Este prompt é enviado ao Gemini antes de cada mensagem do usuário. Defina o tom, idioma e comportamento do bot.
          </p>

          {statusLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              <Loader2 size={16} className="animate-spin" />
              Carregando prompt atual…
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder="Digite o prompt do bot aqui…"
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(212,175,55,0.15)",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
                lineHeight: "1.6",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.15)")}
            />
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              {prompt.length} caracteres
            </span>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !prompt.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50"
              style={{
                backgroundColor: "#D4AF37",
                color: "#000",
                boxShadow: "0 0 20px rgba(212,175,55,0.3)",
              }}
              onMouseEnter={(e) => !saveMutation.isPending && ((e.target as HTMLElement).style.boxShadow = "0 0 32px rgba(212,175,55,0.5)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.boxShadow = "0 0 20px rgba(212,175,55,0.3)")}
            >
              {saveMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {saveMutation.isPending ? "Salvando…" : saved ? "Salvo!" : "Salvar Prompt"}
            </button>
          </div>

          {saved && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e" }}
            >
              <CheckCircle2 size={14} />
              Prompt salvo e ativo. O bot responderá com o novo comportamento.
            </div>
          )}

          {saveMutation.isError && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
            >
              <AlertCircle size={14} />
              Erro ao salvar o prompt. Tente novamente.
            </div>
          )}
        </div>
      </div>

      {/* Test Section */}
      <div
        className="rounded-2xl card-shadow overflow-hidden"
        style={{ backgroundColor: "#0A1A2F" }}
      >
        <div className="px-6 py-5 border-b flex items-center gap-2" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
          <Send size={15} style={{ color: "#D4AF37" }} />
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Testar Resposta
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Simule uma mensagem de usuário e veja como o Gemini responderia com o prompt atual.
          </p>

          <div className="flex gap-3">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runTest()}
              placeholder="Ex: Qual é o horário de funcionamento?"
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(212,175,55,0.15)",
                color: "#fff",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.15)")}
            />
            <button
              onClick={runTest}
              disabled={testing || !testMessage.trim()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 shrink-0"
              style={{ backgroundColor: "#D4AF37", color: "#000" }}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {testing ? "Testando…" : "Testar"}
            </button>
          </div>

          {testError && (
            <div
              className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {testError}
            </div>
          )}

          {testResponse && (
            <div
              className="rounded-xl p-5 text-sm leading-relaxed"
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(212,175,55,0.12)",
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "pre-wrap",
              }}
            >
              <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: "#D4AF37" }}>
                <Sparkles size={12} />
                Resposta do Gemini
              </div>
              {testResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
