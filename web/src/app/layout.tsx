// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LoginModal from "@/components/LoginModal";
import { Toaster } from "sonner";
import { LoginModalProvider } from "@/contexts/LoginModalContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CareerCraft — AI-Powered Hiring Platform",
    template: "%s · CareerCraft",
  },
  description:
    "CareerCraft automates every stage of hiring — AI resume building, semantic job search, voice interviews, and recruiter copilot tools.",
};

// Runs before hydration: applies the saved theme (dark by default) so there is no flash.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light') document.documentElement.classList.add('dark');
  } catch (e) { document.documentElement.classList.add('dark'); }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body
        className="bg-[var(--cc-bg)] text-[var(--cc-text)] transition-colors duration-200 antialiased"
        suppressHydrationWarning={true}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <AuthProvider>
            <FeatureFlagsProvider>
            <LoginModalProvider>
              <div className="flex flex-col min-h-screen">
                {/* Ambient aurora background */}
                <div aria-hidden className="cc-aurora fixed inset-0 -z-20 overflow-hidden">
                  <div className="cc-aurora-blob cc-aurora-1" />
                  <div className="cc-aurora-blob cc-aurora-2" />
                  <div className="cc-aurora-blob cc-aurora-3" />
                  <div className="cc-noise" />
                </div>
                <Navbar />
                <main className="flex-1 pt-16">{children}</main>
                <LoginModal />
              </div>
              <Toaster richColors position="top-right" closeButton />
            </LoginModalProvider>
            </FeatureFlagsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
