import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import { Logo } from "@/components/ui/logo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClassFlow",
  description: "Platforma do zarządzania zajęciami",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <header className="sticky top-0 z-50 w-full flex items-center justify-between px-4 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Logo />
            <div className="flex items-center gap-3 md:gap-4">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="text-sm font-medium hover:text-primary transition-colors">Zaloguj</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-sm hover:bg-primary/90 transition-colors">Zarejestruj</button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          <main className="flex-1 flex flex-col w-full">
            {children}
          </main>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}