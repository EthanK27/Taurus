import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
    variable: "--font-sora",
    subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
    variable: "--font-plex-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

export const metadata = {
    title: "Taurus AI",
    description: "AI-powered trading strategy builder and backtesting interface.",
};

export default function RootLayout({ children }) {
    return (
        <html
            lang="en"
            className={`${sora.variable} ${plexMono.variable} h-full antialiased`}
        >
            <body className="min-h-full">{children}</body>
        </html>
    );
}
