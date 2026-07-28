/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
import { PayCmdRuntimeProvider } from "@/components/paycmd-runtime";
import { Toaster } from "@/components/ui/sonner";
import { WagmiProvider } from "@/components/wagmi-provider";
import "./globals.css";

const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Payna - Stablecoin payments by command",
  description:
    "Chatbox-first demo for agentic stablecoin payments on Arc and Circle Gateway.",
  icons: {
    icon: [
      { url: "/brand/payna-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/payna-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/payna-apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WagmiProvider>
            <I18nProvider>
              <PayCmdRuntimeProvider>
                {children}
                <Toaster toastOptions={{ style: { width: "450px", maxWidth: "90vw" } }} />
              </PayCmdRuntimeProvider>
            </I18nProvider>
          </WagmiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
