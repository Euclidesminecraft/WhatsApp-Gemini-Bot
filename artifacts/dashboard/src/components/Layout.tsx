import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, MessageSquareText, Brain, Zap } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/prompt", label: "Prompt Editor", icon: MessageSquareText },
  { href: "/ia", label: "Configurar IA", icon: Brain },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#000000" }}>
      {/* Sidebar */}
      <aside
        className="w-60 shrink-0 flex flex-col border-r"
        style={{ backgroundColor: "#000000", borderColor: "rgba(212,175,55,0.12)" }}
      >
        {/* Logo */}
        <div className="px-6 py-7 border-b" style={{ borderColor: "rgba(212,175,55,0.12)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#D4AF37" }}>
              <Zap size={16} style={{ color: "#000" }} />
            </div>
            <div>
              <span className="text-base font-bold tracking-wide" style={{ color: "#D4AF37" }}>T.I.Z</span>
              <span className="text-xs block font-medium tracking-wider" style={{ color: "rgba(212,175,55,0.55)", marginTop: "-2px" }}>Talk In Zap</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  backgroundColor: active ? "#0A1A2F" : "transparent",
                  color: active ? "#D4AF37" : "rgba(255,255,255,0.5)",
                  borderLeft: active ? "2px solid #D4AF37" : "2px solid transparent",
                }}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(212,175,55,0.12)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>T.I.Z — Talk In Zap v2.0</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
