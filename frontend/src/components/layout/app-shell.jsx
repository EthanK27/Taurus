import Image from "next/image";
import Link from "next/link";

const navItems = [
    { href: "/", label: "Chat" },
    { href: "/graphs", label: "Graphs" },
];

export function AppShell({ children, activePath = "/", headerLeft }) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_52%_34%,rgba(134,208,255,0.34),transparent_16%),radial-gradient(circle_at_68%_12%,rgba(55,132,255,0.34),transparent_26%),radial-gradient(circle_at_20%_70%,rgba(39,98,232,0.2),transparent_28%),linear-gradient(135deg,#0b2e7a_0%,#0a2c78_18%,#103b94_36%,#0f327d_52%,#0a2460_72%,#07193f_100%)] text-white">
            <div className="pointer-events-none absolute inset-0 opacity-25 [background:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[88px_88px]" />
            <div className="pointer-events-none absolute -left-[12%] top-[18%] h-136 w-136 rounded-[42%] border border-white/10 bg-[radial-gradient(circle_at_68%_32%,rgba(255,255,255,0.14),transparent_22%),linear-gradient(180deg,rgba(18,70,183,0.3),rgba(10,32,93,0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_80px_rgba(3,10,28,0.2)] blur-[1px]" />
            <div className="pointer-events-none absolute left-[28%] top-[-18%] h-120 w-152 rounded-[48%] border border-white/8 bg-[radial-gradient(circle_at_56%_72%,rgba(255,255,255,0.08),transparent_18%),linear-gradient(180deg,rgba(38,118,255,0.14),rgba(15,42,108,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]" />
            <div className="pointer-events-none absolute right-[-10%] top-[6%] h-112 w-md rounded-[44%] border border-cyan-100/12 bg-[radial-gradient(circle_at_18%_58%,rgba(255,255,255,0.22),transparent_18%),linear-gradient(180deg,rgba(90,187,255,0.28),rgba(18,69,166,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_80px_rgba(103,232,249,0.12)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(186,238,255,0.28),transparent_8%),radial-gradient(circle_at_50%_38%,rgba(186,238,255,0.14),transparent_18%)]" />
            <div className="pointer-events-none absolute left-[-8%] top-[31%] h-px w-[46%] rotate-6 bg-[linear-gradient(90deg,transparent,rgba(229,255,255,0.82),transparent)] blur-[0.6px]" />
            <div className="pointer-events-none absolute left-[42%] top-[30%] h-px w-[34%] -rotate-11 bg-[linear-gradient(90deg,transparent,rgba(233,255,255,0.95),transparent)] blur-[0.6px]" />
            <div className="pointer-events-none absolute left-[38%] top-[49%] h-px w-[26%] -rotate-14 bg-[linear-gradient(90deg,transparent,rgba(235,255,255,0.78),transparent)] blur-[0.8px]" />

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="flex items-center justify-between px-5 py-5 sm:px-8">
                    <div className="flex items-center gap-3">
                        {headerLeft}
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

                    <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 p-1 backdrop-blur-xl">
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
