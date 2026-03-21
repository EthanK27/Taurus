import Image from "next/image";
import Link from "next/link";

const navItems = [
    { href: "/", label: "Chat" },
    { href: "/graphs", label: "Graphs" },
];

export function AppShell({ children, activePath = "/" }) {
    return (
        <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(68,112,255,0.16),transparent_28%),linear-gradient(180deg,#08111f_0%,#0a1424_45%,#0a1220_100%)] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[72px_72px] opacity-20" />

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="flex items-center justify-between px-5 py-5 sm:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5">
                            <Image
                                src="/TaurusLogo.png"
                                alt="Taurus logo"
                                width={34}
                                height={34}
                                priority
                                className="h-8 w-8 object-contain sm:h-8.5 sm:w-8.5"
                            />
                            <span className="text-[1.4rem] font-semibold tracking-tight text-white sm:text-2xl">
                                Taurus
                            </span>
                        </div>
                    </div>

                    <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
                        {navItems.map((item) => {
                            const isActive = activePath === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${isActive
                                        ? "bg-blue-400 text-slate-950 shadow-[0_0_24px_rgba(96,165,250,0.25)]"
                                        : "text-slate-300 hover:bg-white/6 hover:text-white"
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </header>

                {children}
            </div>
        </main>
    );
}
