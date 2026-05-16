import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff, MessageCircle, User, Clock, CheckCircle2 } from "lucide-react";

interface BotStatus {
  status: "connected" | "offline" | "awaiting_qr";
  mensagensHoje: number;
  clienteAtivo: string;
  promptPadrao: string;
}

interface RecentMessage {
  id: number;
  from: string;
  body: string;
  reply: string;
  timestamp: string;
}

function fetchStatus(): Promise<BotStatus> {
  return fetch("/status").then((r) => r.json());
}

function fetchMessages(): Promise<RecentMessage[]> {
  return fetch("/mensagens").then((r) => r.json());
}

function StatusBadge({ status }: { status: BotStatus["status"] }) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    connected: { label: "Conectado", color: "#22c55e", dot: "#22c55e" },
    offline: { label: "Offline", color: "#ef4444", dot: "#ef4444" },
    awaiting_qr: { label: "Aguardando QR", color: "#f59e0b", dot: "#f59e0b" },
  };
  const cfg = map[status] ?? map.offline;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 card-shadow flex flex-col gap-4"
      style={{ backgroundColor: "#0A1A2F" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "rgba(212,175,55,0.12)" }}
        >
          <Icon size={15} style={{ color: "#D4AF37" }} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: "#D4AF37" }}>
        {value}
      </div>
      {sub && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          {sub}
        </p>
      )}
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
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    refetchInterval: 5000,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["mensagens"],
    queryFn: fetchMessages,
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          T.I.Z — Talk In Zap · Visão geral do seu bot
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={status?.status === "connected" ? Wifi : WifiOff}
          label="Status"
          value={
            statusLoading ? (
              <span className="text-white/30">—</span>
            ) : (
              <StatusBadge status={status!.status} />
            )
          }
          sub="Atualizado a cada 5s"
        />
        <StatCard
          icon={MessageCircle}
          label="Mensagens Hoje"
          value={statusLoading ? "—" : status!.mensagensHoje}
          sub="Respostas enviadas pelo bot"
        />
        <StatCard
          icon={User}
          label="Cliente Ativo"
          value={statusLoading ? "—" : status!.clienteAtivo}
          sub="ID da sessão LocalAuth"
        />
      </div>

      {/* Connection card */}
      <div
        className="rounded-2xl p-6 card-shadow"
        style={{ backgroundColor: "#0A1A2F" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Conexão WhatsApp
          </h2>
          {status && <StatusBadge status={status.status} />}
        </div>

        {status?.status === "connected" ? (
          <div className="flex items-center gap-3 py-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <CheckCircle2 size={24} style={{ color: "#22c55e" }} />
            </div>
            <div>
              <p className="font-semibold text-white">Bot conectado com sucesso</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Recebendo e respondendo mensagens automaticamente
              </p>
            </div>
          </div>
        ) : status?.status === "awaiting_qr" ? (
          <div className="py-4">
            <p className="text-sm text-white/60">
              Escaneie o QR Code no console do workflow <span className="text-[#D4AF37] font-medium">WhatsApp Bot</span> para conectar.
            </p>
            <div
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: "rgba(212,175,55,0.1)", color: "#D4AF37" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
              Aguardando leitura do QR Code…
            </div>
          </div>
        ) : (
          <div className="py-4">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Bot offline. Verifique se o workflow <span className="text-white font-medium">WhatsApp Bot</span> está em execução.
            </p>
          </div>
        )}
      </div>

      {/* Recent messages */}
      <div
        className="rounded-2xl card-shadow overflow-hidden"
        style={{ backgroundColor: "#0A1A2F" }}
      >
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(212,175,55,0.1)" }}>
          <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Mensagens Recentes
          </h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(212,175,55,0.1)", color: "#D4AF37" }}>
            {messages.length}
          </span>
        </div>

        {msgsLoading ? (
          <div className="px-6 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Carregando…
          </div>
        ) : messages.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <MessageCircle size={32} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              Nenhuma mensagem ainda. Envie uma mensagem para o bot!
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(212,175,55,0.06)" }}>
            {messages.map((msg) => (
              <li key={msg.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: "#D4AF37" }}>
                        +{msg.from}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <Clock size={10} className="inline mr-0.5" />
                        {timeAgo(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 truncate">{msg.body}</p>
                    <p className="text-xs mt-1 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                      ↳ {msg.reply}
                    </p>
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
