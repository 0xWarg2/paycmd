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

import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseReqResClient } from "@/lib/supabase/server-client";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Bail out *before* touching Supabase. These paths never read `user` below, but the
  // auth call used to run first — so every request to them paid a full round-trip to
  // Supabase auth and then threw the answer away. Under load that tax was measured at
  // 23.7s in `proxy.ts` on a single `/api/notifications` call, and it landed on every
  // API request in flight, including the `/api/user/fund` call that `fund` waits on
  // before it can open MetaMask.
  //
  // This is security-neutral, not a relaxation: the `/api` branch already returned before
  // reaching the `!user` redirect below, so middleware never gated API routes. The auth
  // call's result was computed and discarded. Route handlers build their own client and
  // authenticate independently (`app/api/gateway/balance/route.ts` returns its own 401).
  //
  // Session refresh is also unaffected: `createBrowserClient` runs with `autoRefreshToken`
  // on and persists to cookies, so the client refreshes its own token and route handlers
  // read the fresh one.
  if (
    // The page itself is environment-gated and calls notFound() in production. Let it reach
    // that guard so production returns a real 404 instead of leaking an auth redirect.
    pathname.startsWith("/dev/ui-preview") ||
    pathname.startsWith("/api") ||
    // Framework internals, never a page that could need an auth redirect. The matcher below
    // only excludes `_next/static` and `_next/image`, so `_next/webpack-hmr` and `_next/data`
    // were reaching the auth call — and HMR polls constantly while the dev server is running.
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/") ||
    pathname === "/" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest"
  ) {
    return response;
  }

  const supabase = createSupabaseReqResClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (PWA metadata)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
