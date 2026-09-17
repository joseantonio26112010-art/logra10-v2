import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { Home, NotebookPen, Presentation, Wand2 } from "lucide-react";
import { ThemeToggle } from "@/components/logra/theme-toggle";
import { LanguageToggle } from "@/components/logra/language-toggle";
import { AISettingsDialog } from "@/components/logra/ai-settings";
import { I18nProvider, useI18n } from "@/lib/logra/i18n";
import logo from "@/assets/logra10-logo.png";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}

function AppShell() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 grid grid-cols-[1fr_auto_1fr] items-center">
          <Link to="/" className="flex items-center gap-2 group justify-self-start">
            <img
              src={logo}
              alt="Logra10"
              className="h-10 w-auto group-hover:scale-105 transition"
            />
            <span className="font-semibold tracking-tight text-lg">
              Logra<span className="text-primary">10</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm justify-self-center">
            <NavItem to="/" icon={<Home className="size-4" />} label={t("nav_home")} />
            <NavItem to="/classes" icon={<Presentation className="size-4" />} label={t("nav_classes")} />
            <NavItem to="/conversion" icon={<Wand2 className="size-4" />} label={t("nav_conversion")} />
            <NavItem to="/notes" icon={<NotebookPen className="size-4" />} label={t("nav_notes")} />
          </nav>
          <div className="justify-self-end flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
            <AISettingsDialog />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {t("footer")}
      </footer>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      preload="intent"
      activeOptions={{ exact: to === "/" }}
      activeProps={{ className: "bg-secondary text-secondary-foreground" }}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition font-medium"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
