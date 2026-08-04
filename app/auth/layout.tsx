import { ThemeSwitcher } from "@/components/theme-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="fixed right-4 top-4 z-50 h-11 w-11 rounded-full border border-border bg-background/80 shadow-sm backdrop-blur-md">
        <ThemeSwitcher />
      </div>
      {children}
    </div>
  );
}
