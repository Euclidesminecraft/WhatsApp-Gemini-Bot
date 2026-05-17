import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Trash2, RefreshCw, Wifi, WifiOff, Loader2,
  QrCode, AlertCircle, CheckCircle2, X, Brain
} from "lucide-react";

interface Cliente {
  id: string;
  nome: string;
  status: "connected" | "offline" | "awaiting_qr";
  provedor: "gemini" | "deepseek";
  totalHoje: number;
  qrCode: string | null;
  prompt: string;
}

const GOLD = "#D4AF37";
const CARD = "#0A1A2F";

function StatusDot({ status }: { status: Cliente["status"] }) {
  const map = {
    connected: { label: "Conectado", color: "#22c55e" },
    offline: { label: "Offline", color: "#ef4444" },
    awaiting_qr: { label: "Aguardando QR", color: "#f59e0b" },
  };
  const cfg = map[status] ?? map.offline;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function QRModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["qr", cliente.id],
    queryFn: () => fetch(`/clientes/${cliente.id}/qr`).then(r => r.json()),
    refetchInterval: 8000,
    retry: false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="rounded-2xl p-8 max-w-sm w-full relative" style={{ backgroundColor: "#0D1F35", border: "1px solid rgba(212,175,55,0.2)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-6">
          <QrCode size={18} style={{ color: GOLD }} />
          <h3 className="font-semibold text-white">QR Code — {cliente.nome}</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
          </div>
        ) : data?.qrCode ? (
          <>
            <img src={data.qrCode} alt="QR Code" className="w-full rounded-xl" />
            <p className="text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Abra o WhatsApp → Dispositivos Vinculados → Escanear QR
            </p>
          </>
        ) : (
          <div className="py-8 text-center">
            {cliente.status === "connected" ? (
              <>
                <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
                <p className="text-white font-medium">Já conectado!</p>
              </>
            ) : (
              <>
                <AlertCircle size={40} className="mx-auto mb-3" style={{ color: "#f59e0b" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  QR ainda a ser gerado. Aguarda alguns segundos…
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Clientes() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [novoId, setNovoId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [qrCliente, setQrCliente] = useState<Cliente | null>(null);
  const [erro, setErro] = useState("");

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => fetch("/clientes").then(r => r.json()),
    refetchInterval: 5000,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      fetch("/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: novoId.trim(), nome: novoNome.trim() || undefined }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) { setErro(data.error); return; }
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setShowForm(false);
      setNovoId("");
      setNovoNome("");
      setErro("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/clientes/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });

  const reiniciarMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/clientes/${id}/reiniciar`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });

  const provedorMutation = useMutation({
    mutationFn: ({ id, provedor }: { id: string; provedor: string }) =>
      fetch(`/clientes/${id}/provedor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provedor }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  });

  const inputStyle = {
    backgroundColor: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(212,175,55,0.2)",
    color: "#fff",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  return (
    <div className="space-y-8">
      {qrCliente && <QRModal cliente={qrCliente} onClose={() => setQrCliente(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Clientes</h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Gerir números WhatsApp e sessões do bot
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setErro(""); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: GOLD, color: "#000", boxShadow: "0 0 20px rgba(212,175,55,0.3)" }}
        >
          <Plus size={16} />
          Novo Cliente
        </button>
      </div>

      {/* Formulário novo cliente */}
      {showForm && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: CARD, border: "1px solid rgba(212,175,55,0.15)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            Adicionar Novo Cliente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                ID do cliente <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                style={inputStyle}
                placeholder="ex: empresa1"
                value={novoId}
                onChange={e => setNovoId(e.target.value.replace(/\s/g, "_"))}
              />
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Sem espaços. Usado como identificador único.</p>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Nome de exibição</label>
              <input
                style={inputStyle}
                placeholder="ex: Empresa Tal"
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
              />
            </div>
          </div>
          {erro && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              <AlertCircle size={14} /> {erro}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { if (!novoId.trim()) { setErro("O ID é obrigatório."); return; } addMutation.mutate(); }}
              disabled={addMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: GOLD, color: "#000" }}
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar Cliente
            </button>
            <button
              onClick={() => { setShowForm(false); setErro(""); }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          <Loader2 size={20} className="animate-spin mr-2" /> Carregando clientes…
        </div>
      ) : clientes.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: CARD }}>
          <Users size={40} className="mx-auto mb-4" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-white font-medium mb-1">Nenhum cliente ainda</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            Clica em "Novo Cliente" para adicionar o primeiro número WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clientes.map((c) => (
            <div key={c.id} className="rounded-2xl p-6" style={{ backgroundColor: CARD, border: "1px solid rgba(212,175,55,0.08)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-bold text-white text-lg">{c.nome}</span>
                    <StatusDot status={c.status} />
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(212,175,55,0.1)", color: GOLD }}>
                      {c.totalHoje} msgs hoje
                    </span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                    ID: <span className="font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{c.id}</span>
                  </p>

                  {/* Seletor de IA */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <Brain size={12} /> IA:
                    </span>
                    {(["gemini", "deepseek"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => provedorMutation.mutate({ id: c.id, provedor: p })}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: c.provedor === p ? (p === "gemini" ? "rgba(66,133,244,0.2)" : "rgba(0,187,255,0.15)") : "rgba(255,255,255,0.05)",
                          color: c.provedor === p ? (p === "gemini" ? "#4285F4" : "#00BBFF") : "rgba(255,255,255,0.4)",
                          border: c.provedor === p ? `1px solid ${p === "gemini" ? "rgba(66,133,244,0.4)" : "rgba(0,187,255,0.3)"}` : "1px solid transparent",
                        }}
                      >
                        {p === "gemini" ? "🔵 Gemini" : "🟦 DeepSeek"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Acções */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {(c.status === "awaiting_qr" || c.status === "offline") && (
                    <button
                      onClick={() => setQrCliente(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: "rgba(212,175,55,0.1)", color: GOLD }}
                    >
                      <QrCode size={13} /> Ver QR
                    </button>
                  )}
                  {c.status === "connected" && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                      <Wifi size={13} /> Online
                    </div>
                  )}
                  <button
                    onClick={() => reiniciarMutation.mutate(c.id)}
                    disabled={reiniciarMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}
                    title="Reiniciar sessão"
                  >
                    <RefreshCw size={13} className={reiniciarMutation.isPending ? "animate-spin" : ""} />
                    Reiniciar
                  </button>
                  <button
                    onClick={() => { if (confirm(`Remover cliente "${c.nome}"?`)) deleteMutation.mutate(c.id); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
                    title="Remover cliente"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
