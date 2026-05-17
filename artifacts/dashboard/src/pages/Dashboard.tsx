import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, MessageCircle, Users, Clock, CheckCircle2, Brain } from "lucide-react";

interface BotStatus {
  status: "connected" | "offline" | "awaiting_qr";
  mensagensHoje: number;
  clienteAtivo: string;
  promptPadrao: string;
  totalClientes: number;
  clientesConectados: number;
}

interface RecentMessage {
  id: number;
  from: string;
  body: string;
  reply: string;
  timestamp: string;
  clienteId?: string;
  clienteNome?: string;
}

interface Cliente {
  id: string;
  nome: string;
  status: "connected" | "offline" | "awaiting_qr";
  provedor: "gemini" | "deepseek";
  totalHoje: number;
}

const GOLD = "#D4AF37";
const CARD = "#0A1A2F";

function StatusBadge({ status }: { status: BotStatus["status"] }) {
  const map: Record<string, { label: string; color: string }> = {
    connected: { label: "Conectado", color: "#22c55e" },
    offline: { label: "Offline", color: "#ef4444" },
    awaiting_qr: { label: "Aguardando QR", color: "#f59e0b" },
  };
  const cfg = map[status] ?? map.offline;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl p-6 card-shadow flex flex-col gap-4" style={{ backgroundColor: CARD }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,175,55,0.12)" }}>
          <Icon size={15} style={{ color: GOLD }} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: GOLD }}>{value}</div>
      {sub && <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function Dashboard() {
  const { data: status, isLoading: statusLoading, isError: statusError } = useQuery<BotStatus>({
    queryKey: ["status"],
    queryFn: () => fetch("/status").then(r => r.json()),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<RecentMessage[]>({
    queryKey: ["mensagens"],
    queryFn: () => fetch("/mensagens").then(r => r.json()),
    refetchInterval: 5000,
    retry: false,
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => fetch("/clientes").then(r => r.json()),
    refetchInterval: 5000,
    retry: false,
  });

  const botStatus = statusError ? "offline" : (status?.status ?? "offline");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          T.I.Z — Talk In Zap · Visão geral do sistema
        </p>
      </div>

      {statusError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <WifiOff size={14} />
          Bot offline ou a iniciar — aguardando ligação na porta 3000…
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={botStatus === "connected" ? Wifi : WifiOff} label="Status"
          value={statusLoading ? <span className="text-white/30">—</span> : <StatusBadge status={botStatus} />}
          sub="Atualizado a cada 5s" />
        <StatCard icon={MessageCircle} label="Mensagens Hoje"
          value={statusLoading ? "—" : (status?.mensagensHoje ?? 0)}
          sub="Total de todos os clientes" />
        <StatCard icon={Users} label="Clientes Activos"
          value={statusLoading ? "—" : `${status?.clientesConectados ?? 0}/${status?.totalClientes ?? 0}`}
          sub="Conectados / Total" />
        <StatCard icon={Brain} label="Modelos IA"
          value={clientes.length === 0 ? "—" : `${clientes.filter(c => c.provedor === "gemini").length}G ${clientes.filter(c => c.provedor === "deepseek").length}D`}
          sub="Gemini / DeepSeek" />
      </div>

      {/* Clientes ao vivo */}
      {clientes.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD }}>
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
            <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Clientes</h2>
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(212,175,55,0.1)", color: GOLD }}>{clientes.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(212,175,55,0.06)" }}>
            {clientes.map(c => {
              const statusMap = { connected: { label: "Conectado", color: "#22c55e" }, offline: { label: "Offline", color: "#ef4444" }, awaiting_qr: { label: "Aguardando QR", color: "#f59e0b" } };
              const s = statusMap[c.status] ?? statusMap.offline;
              return (
                <div key={c.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-white text-sm">{c.nome}</span>
                    <span className="text-xs ml-2 font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{c.id}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(212,175,55,0.08)", color: GOLD }}>{c.totalHoje} msgs</span>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: c.provedor === "gemini" ? "rgba(66,133,244,0.12)" : "rgba(0,187,255,0.1)", color: c.provedor === "gemini" ? "#4285F4" : "#00BBFF" }}>
                      {c.provedor === "gemini" ? "Gemini" : "DeepSeek"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${s.color}18`, color: s.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection card — só sem clientes */}
      {clientes.length === 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: CARD }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Conexão WhatsApp</h2>
            <StatusBadge status={botStatus} />
          </div>
          {botStatus === "connected" ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
                <CheckCircle2 size={24} style={{ color: "#22c55e" }} />
              </div>
              <div>
                <p className="font-semibold text-white">Bot conectado com sucesso</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Recebendo e respondendo mensagens automaticamente</p>
              </div>
            </div>
          ) : (
            <p className="text-sm py-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Vai a <span className="text-white font-medium">Clientes</span> para adicionar um número WhatsApp.
            </p>
          )}
        </div>
      )}

      {/* Mensagens recentes */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD }}>
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Mensagens Recentes</h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(212,175,55,0.1)", color: GOLD }}>{messages.length}</span>
        </div>
        {msgsLoading ? (
          <div className="px-6 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>A carregar…</div>
        ) : messages.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <MessageCircle size={32} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              Nenhuma mensagem ainda. Envia uma mensagem ao bot para começar!
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(212,175,55,0.06)" }}>
            {messages.map(msg => (
              <li key={msg.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: GOLD }}>+{msg.from}</span>
                      {msg.clienteNome && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(212,175,55,0.08)", color: "rgba(212,175,55,0.6)" }}>
                          {msg.clienteNome}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <Clock size={10} className="inline mr-0.5" />{timeAgo(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 truncate">{msg.body}</p>
                    <p className="text-xs mt-1 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>↳ {msg.reply}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
