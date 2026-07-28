"use client";

import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  MessageSquareText,
  Network,
  ShieldCheck,
  WalletCards,
  Waypoints,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { CIRCLE_TESTNET_FAUCET_URL } from "@/lib/paycmd/cctp-bridge";
import { useI18n, type Locale } from "@/lib/i18n";

const ARC_SCAN_URL = "https://testnet.arcscan.app";

const docs = {
  en: {
    nav: {
      overview: "Overview",
      stack: "Tech stack",
      funding: "Funding",
      commands: "Commands",
      swap: "Swap on Arc",
      proof: "Onchain proof",
      safety: "Safety",
      faq: "FAQ",
    },
    onThisPage: "On this page",
    quickstartTitle: "Quickstart",
    heroEyebrow: "Payna Docs",
    title: "Build, fund, and move USDC from one chatbox",
    description:
      "Payna combines Circle wallet rails, MetaMask CCTP v2 bridge, AskSurf research, and an Arc Testnet proof contract into a chat-first dapp.",
    quickLinks: "Quick links",
    launch: "Launch app",
    faucet: "Circle Faucet",
    arcscan: "ArcScan",
    quickstart: [
      ["1", "Connect wallet", "Sign in with MetaMask, then link the external wallet to Payna."],
      ["2", "Fund USDC", "Use Circle Faucet and /fund to move testnet USDC into your Circle wallet."],
      ["3", "Run commands", "Ask Payna to pay, transfer, bridge, swap, or research, then confirm the preview."],
    ],
    overviewTitle: "What Payna does",
    overview: [
      "Payna is a stablecoin copilot. The first screen inside the app is not a dashboard: it is a chatbox that can understand payment intent.",
      "Payna supports Circle wallet actions such as create wallet, check balance, pay contacts, payment requests, and cross-chain transfer flows.",
      "For MetaMask users, Payna supports CCTP v2 bridge flows and records bridge/swap activity in app history.",
      "For research questions, AskSurf mode bypasses payment routing and returns sourced crypto research with sections and follow-up questions.",
    ],
    stackTitle: "Technology map",
    stack: [
      ["Next.js App Router", "Frontend app, API routes, auth pages, docs, and chat UI."],
      ["Supabase", "Auth, profile, contacts, transaction history, payment requests, notifications."],
      ["Circle Wallets", "SCA wallet, Gateway signer, balances, deposit, withdraw, pay, transfer."],
      ["Circle Gateway", "Unified USDC liquidity path for cross-chain transfer flows."],
      ["CCTP v2 / Bridge Kit", "MetaMask bridge flow for supported testnet routes."],
      ["Payna Swap Adapter", "Arc Testnet swap adapter for USDC, EURC, and cirBTC with MetaMask signing."],
      ["Arc Testnet contract", "Payna receipt proof contract emits public transaction proof events."],
      ["AskSurf", "Crypto research mode with sources, markdown sections, tables, and related questions."],
    ],
    fundingTitle: "How to fund and prepare wallets",
    fundingSteps: [
      "Sign in with MetaMask so Payna can connect your external wallet.",
      "Use Circle Faucet to get testnet USDC on supported networks such as Base Sepolia or Arc Testnet.",
      "If MetaMask does not know a testnet, Payna will prompt you to add the network before bridge/fund actions.",
      "Run /link metamask to attach your wallet to the current account.",
      "Run /wallet create to create your Circle wallet if it does not exist yet.",
      "Run /fund 10 from metamask on base to move testnet USDC from MetaMask into the Circle SCA wallet.",
    ],
    commandsTitle: "Common commands",
    commands: [
      ["/wallet create", "Create Circle wallet and Gateway signer if needed."],
      ["/wallet balance arc", "Check Circle SCA wallet USDC on Arc Testnet."],
      ["/balance", "Check unified USDC balance across supported rails."],
      ["/fund 10 from metamask on base", "Move USDC from MetaMask to Circle wallet on Base Sepolia."],
      ["/pay 5 to Minh on arc", "Pay a saved contact or address with preview and confirmation."],
      ["/transfer 5 from base to arc", "Move Circle wallet/Gateway USDC across chains."],
      ["/bridge 5 usdc from base to arc on my metamask", "Bridge USDC through MetaMask with CCTP v2."],
      ["/swap 1 USDC to EURC", "Swap on Arc Testnet through the Payna adapter using MetaMask."],
      ["/swap 0.001 cirBTC to USDC", "Swap cirBTC back to USDC on Arc and record the swap in history."],
      ["Monad la gi?", "Switch to AskSurf mode for sourced crypto research."],
    ],
    swapTitle: "Swap on Arc",
    swapIntro:
      "Payna supports MetaMask swaps on Arc Testnet across three assets: USDC, EURC, and cirBTC. The swap is signed by the connected wallet and then recorded in Payna transaction history.",
    swapTokens: [
      ["USDC", "USD Coin", "0x3600000000000000000000000000000000000000", "6 decimals"],
      ["EURC", "Euro Coin", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", "6 decimals"],
      ["cirBTC", "Circle BTC", "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", "8 decimals"],
    ],
    swapSteps: [
      "Connect MetaMask and make sure the selected network is Arc Testnet.",
      "Hold one of the supported tokens in your MetaMask wallet: USDC, EURC, or cirBTC.",
      "Run a command such as /swap 1 USDC to EURC.",
      "Payna estimates the route, output amount, and minimum output with the default slippage guard.",
      "Confirm in MetaMask. After the tx is returned, Payna records the swap and attempts to write a proof receipt.",
    ],
    swapNotes: [
      "Direct routes are used when either side is USDC. Non-USDC routes go through USDC, for example EURC -> USDC -> cirBTC.",
      "The default slippage guard is 1%. The AMM math uses a 0.3% fee assumption.",
      "Swap is an Arc Testnet MetaMask flow, not a Circle Gateway transfer. It requires Arc gas and token balance in the connected wallet.",
    ],
    proofTitle: "Onchain proof contract",
    proof: [
      "Circle contracts already write burn/mint or Gateway-related transactions on source and destination chains.",
      "Payna adds one more proof layer: a small Solidity contract deployed on Arc Testnet. It does not move money. It emits a receipt event that links app command type, amount, participants, and source/mint transaction hashes.",
      "The relayer wallet signs recordReceipt after a successful pay, transfer, or bridge. The emitted event becomes public on ArcScan and is stored back into Payna history as proof metadata.",
    ],
    safetyTitle: "Safety model",
    safety: [
      "Natural language can parse intent, but it does not execute money movement by itself.",
      "Every payment-like command becomes a preview first. The user must confirm before the backend or MetaMask executes.",
      "MetaMask bridge/fund actions require the connected wallet to sign on the correct chain.",
      "AskSurf research mode is separated from Payna command mode so research questions do not accidentally route as transactions.",
      "This is a testnet dapp and not financial advice.",
    ],
    faqTitle: "FAQ",
    faqs: [
      [
        "Do docs require sign in?",
        "No. The landing page and docs are public. Sign in is only required for app surfaces that read or write user data, such as chat history, contacts, wallet actions, notifications, and payment requests.",
      ],
      [
        "Does the proof contract move funds?",
        "No. Payna's Arc Testnet contract only emits receipt events. Circle contracts and MetaMask-signed transactions handle the actual USDC movement.",
      ],
      [
        "Why are there source tx and mint tx links?",
        "CCTP-style flows have a source-side burn/message transaction and a destination-side mint/receive transaction. Payna displays both so the route is inspectable on explorers.",
      ],
      [
        "When should I use Payna mode versus AskSurf mode?",
        "Use Payna for actions such as pay, transfer, bridge, swap, balance, and wallet operations. Use AskSurf for crypto research questions that need sources and sections.",
      ],
      [
        "Which tokens can I swap on Arc?",
        "Current swap support is USDC, EURC, and cirBTC on Arc Testnet. The route is direct for USDC pairs and routes through USDC for EURC/cirBTC pairs.",
      ],
      [
        "Is this production money?",
        "No. Current docs and UI are written for testnet usage. Treat balances, faucets, and proof links as demo/testnet data.",
      ],
    ],
  },
  vi: {
    nav: {
      overview: "Tổng quan",
      stack: "Công nghệ",
      funding: "Nạp tiền",
      commands: "Lệnh mẫu",
      swap: "Swap trên Arc",
      proof: "Onchain proof",
      safety: "An toàn",
      faq: "FAQ",
    },
    onThisPage: "Trong trang này",
    quickstartTitle: "Bắt đầu nhanh",
    heroEyebrow: "Tài liệu Payna",
    title: "Build, nạp tiền và chuyển USDC từ một chatbox",
    description:
      "Payna kết hợp Circle wallet rails, MetaMask bridge bằng CCTP v2, AskSurf research và contract proof trên Arc Testnet vào một dapp chat-first.",
    quickLinks: "Liên kết nhanh",
    launch: "Mở app",
    faucet: "Circle Faucet",
    arcscan: "ArcScan",
    quickstart: [
      ["1", "Kết nối ví", "Đăng nhập bằng MetaMask, rồi link ví ngoài vào Payna."],
      ["2", "Nạp USDC", "Dùng Circle Faucet và /fund để chuyển testnet USDC vào Circle wallet."],
      ["3", "Chạy lệnh", "Bảo Payna pay, transfer, bridge, swap hoặc research, sau đó confirm preview."],
    ],
    overviewTitle: "Payna làm gì",
    overview: [
      "Payna là stablecoin copilot. Màn hình chính trong app không phải dashboard truyền thống mà là chatbox hiểu ý định thanh toán.",
      "Payna hỗ trợ các thao tác Circle wallet như tạo ví, xem balance, pay contact, tạo payment request và transfer cross-chain.",
      "Với MetaMask, Payna hỗ trợ bridge bằng CCTP v2 và lưu lịch sử bridge/swap trong app.",
      "Với câu hỏi research, mode AskSurf bỏ qua router thanh toán và trả bài nghiên cứu crypto có nguồn, sections và câu hỏi liên quan.",
    ],
    stackTitle: "Bản đồ công nghệ",
    stack: [
      ["Next.js App Router", "Frontend app, API routes, auth pages, docs và chat UI."],
      ["Supabase", "Auth, profile, contacts, transaction history, payment requests, notifications."],
      ["Circle Wallets", "SCA wallet, Gateway signer, balances, deposit, withdraw, pay, transfer."],
      ["Circle Gateway", "Đường thanh khoản USDC unified cho cross-chain transfer."],
      ["CCTP v2 / Bridge Kit", "Luồng bridge bằng MetaMask cho các testnet route được hỗ trợ."],
      ["Payna Swap Adapter", "Swap adapter trên Arc Testnet cho USDC, EURC và cirBTC, ký bằng MetaMask."],
      ["Arc Testnet contract", "Contract proof của Payna phát event receipt công khai trên blockchain."],
      ["AskSurf", "Mode research crypto có sources, markdown sections, tables và related questions."],
    ],
    fundingTitle: "Cách nạp tiền và chuẩn bị ví",
    fundingSteps: [
      "Đăng nhập bằng MetaMask để Payna kết nối ví ngoài của bạn.",
      "Dùng Circle Faucet để lấy testnet USDC trên các mạng được hỗ trợ như Base Sepolia hoặc Arc Testnet.",
      "Nếu MetaMask chưa có testnet, Payna sẽ hiện popup để add network trước khi fund/bridge.",
      "Chạy /link metamask để gắn ví MetaMask vào tài khoản hiện tại.",
      "Chạy /wallet create để tạo Circle wallet nếu chưa có.",
      "Chạy /fund 10 from metamask on base để chuyển testnet USDC từ MetaMask vào Circle SCA wallet.",
    ],
    commandsTitle: "Các lệnh hay dùng",
    commands: [
      ["/wallet create", "Tạo Circle wallet và Gateway signer nếu cần."],
      ["/wallet balance arc", "Xem USDC trong Circle SCA wallet trên Arc Testnet."],
      ["/balance", "Xem unified USDC balance trên các rails được hỗ trợ."],
      ["/fund 10 from metamask on base", "Chuyển USDC từ MetaMask vào Circle wallet trên Base Sepolia."],
      ["/pay 5 to Minh on arc", "Pay cho contact hoặc địa chỉ ví, luôn có preview và confirm."],
      ["/transfer 5 from base to arc", "Chuyển USDC của Circle wallet/Gateway giữa các chain."],
      ["/bridge 5 usdc from base to arc on my metamask", "Bridge USDC bằng MetaMask qua CCTP v2."],
      ["/swap 1 USDC to EURC", "Swap trên Arc Testnet qua Payna adapter bằng MetaMask."],
      ["/swap 0.001 cirBTC to USDC", "Swap cirBTC về USDC trên Arc và lưu vào history."],
      ["Monad la gi?", "Chuyển sang AskSurf mode để hỏi research crypto có nguồn."],
    ],
    swapTitle: "Swap trên Arc",
    swapIntro:
      "Payna hỗ trợ swap bằng MetaMask trên Arc Testnet với ba tài sản: USDC, EURC và cirBTC. Transaction do ví đang connect ký, sau đó Payna lưu swap vào transaction history.",
    swapTokens: [
      ["USDC", "USD Coin", "0x3600000000000000000000000000000000000000", "6 decimals"],
      ["EURC", "Euro Coin", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", "6 decimals"],
      ["cirBTC", "Circle BTC", "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", "8 decimals"],
    ],
    swapSteps: [
      "Connect MetaMask và đảm bảo network đang là Arc Testnet.",
      "Ví MetaMask cần có một trong ba token được hỗ trợ: USDC, EURC hoặc cirBTC.",
      "Chạy command ví dụ /swap 1 USDC to EURC.",
      "Payna estimate route, output amount và minimum output với slippage guard mặc định.",
      "Confirm trong MetaMask. Sau khi có tx hash, Payna lưu swap và cố ghi proof receipt.",
    ],
    swapNotes: [
      "Route trực tiếp được dùng khi một trong hai token là USDC. Nếu cả hai token không phải USDC thì route đi qua USDC, ví dụ EURC -> USDC -> cirBTC.",
      "Slippage guard mặc định là 1%. AMM math đang dùng giả định fee 0.3%.",
      "Swap là luồng MetaMask trên Arc Testnet, không phải Circle Gateway transfer. Ví cần có Arc gas và token balance.",
    ],
    proofTitle: "Contract onchain proof",
    proof: [
      "Các contract của Circle đã ghi burn/mint hoặc Gateway transaction lên source và destination chain.",
      "Payna thêm một lớp proof riêng: một Solidity contract nhỏ deploy trên Arc Testnet. Contract này không giữ tiền và không chuyển tiền. Nó chỉ emit receipt event để liên kết command type, amount, người gửi/nhận, source tx và mint tx.",
      "Relayer wallet ký recordReceipt sau khi pay, transfer hoặc bridge thành công. Event này public trên ArcScan và được lưu lại vào transaction history của Payna.",
    ],
    safetyTitle: "Mô hình an toàn",
    safety: [
      "Ngôn ngữ tự nhiên chỉ dùng để hiểu ý định, không tự động chuyển tiền.",
      "Mọi lệnh liên quan payment đều thành preview trước. User phải confirm thì backend hoặc MetaMask mới chạy.",
      "Bridge/fund qua MetaMask yêu cầu ví đang connect ký trên đúng chain.",
      "AskSurf research mode tách khỏi Payna command mode để câu hỏi research không bị route nhầm thành giao dịch.",
      "Đây là testnet dapp, không phải lời khuyên tài chính.",
    ],
    faqTitle: "FAQ",
    faqs: [
      [
        "Docs có cần đăng nhập không?",
        "Không. Landing page và docs là public. Chỉ các khu vực app có đọc/ghi dữ liệu user như chat history, contacts, wallet actions, notifications và payment requests mới cần sign in.",
      ],
      [
        "Contract proof có chuyển tiền không?",
        "Không. Contract Payna trên Arc Testnet chỉ emit receipt event. Việc chuyển USDC thật trong testnet do Circle contracts hoặc transaction ký bằng MetaMask xử lý.",
      ],
      [
        "Vì sao có source tx và mint tx?",
        "Luồng CCTP thường có transaction ở source chain để burn/gửi message và transaction ở destination chain để mint/receive. Payna hiển thị cả hai để bạn inspect trên explorer.",
      ],
      [
        "Khi nào dùng Payna mode, khi nào dùng AskSurf?",
        "Dùng Payna cho action như pay, transfer, bridge, swap, balance và wallet. Dùng AskSurf cho câu hỏi research crypto cần nguồn, sections và câu hỏi liên quan.",
      ],
      [
        "Swap trên Arc hỗ trợ token nào?",
        "Hiện tại Payna hỗ trợ USDC, EURC và cirBTC trên Arc Testnet. Pair có USDC đi route trực tiếp, pair EURC/cirBTC route qua USDC.",
      ],
      [
        "Đây có phải tiền production không?",
        "Không. UI và docs hiện đang viết cho testnet. Balance, faucet và proof link nên được hiểu là dữ liệu demo/testnet.",
      ],
    ],
  },
} satisfies Record<Locale, any>;

const sectionIcons = {
  overview: MessageSquareText,
  stack: Network,
  funding: CircleDollarSign,
  commands: BookOpen,
  swap: ArrowRightLeft,
  proof: FileCheck2,
  safety: ShieldCheck,
  faq: HelpCircle,
};

export default function DocsPage() {
  const { locale } = useI18n();
  const copy = docs[locale];
  const navEntries = Object.entries(copy.nav) as Array<[keyof typeof copy.nav, string]>;

  return (
    <main className="relative h-dvh overflow-y-auto overflow-x-hidden scroll-smooth bg-[#07090d] text-[#f4f7f8]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(99,244,200,.16),transparent_32rem),radial-gradient(circle_at_90%_6%,rgba(67,120,255,.12),transparent_26rem),#07090d]" />
        <div className="paycmd-stars absolute inset-0 opacity-35" />
        <div className="paycmd-hero-grid absolute inset-0 opacity-25" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090d]/76 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="payna-logo-frame relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15">
              <Image src="/brand/antlers_transparent.png" alt="Payna" fill className="object-contain p-1" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-normal">Payna</div>
              <div className="truncate text-xs text-white/48">Docs</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="outline" className="hidden rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link href="/">
                Home
              </Link>
            </Button>
            <Button asChild className="paycmd-button-shine rounded-full bg-white px-5 text-[#07090d] hover:bg-[#dffdf5]">
              <Link href="/app">
                {copy.launch}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,780px)] xl:grid-cols-[240px_minmax(0,780px)_220px]">
          <aside className="hidden lg:block">
            <nav className="sticky top-28 rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold text-white">
                <BookOpen className="h-4 w-4 text-[#63f4c8]" />
                {copy.heroEyebrow}
              </div>
              <div className="space-y-1">
                {navEntries.map(([id, label]) => {
                  const Icon = sectionIcons[id];
                  return (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/58 transition hover:bg-white/[0.055] hover:text-white"
                    >
                      <Icon className="h-4 w-4 text-[#63f4c8]" />
                      {label}
                    </a>
                  );
                })}
              </div>
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-8 border-b border-white/10 pb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#63f4c8]/35 bg-[#63f4c8]/10 px-4 py-2 text-sm text-[#caffee]">
                <Code2 className="h-4 w-4" />
                {copy.heroEyebrow}
              </div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/62">
                {copy.description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-white text-[#07090d] hover:bg-[#dffdf5]">
                  <Link href="/app">
                    {copy.launch}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                  <a href={CIRCLE_TESTNET_FAUCET_URL} target="_blank" rel="noreferrer">
                    {copy.faucet}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                  <a href={ARC_SCAN_URL} target="_blank" rel="noreferrer">
                    {copy.arcscan}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="mb-8 grid gap-3 md:grid-cols-3">
              {copy.quickstart.map((item: string[]) => {
                const [step, title, description] = item;
                return (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#63f4c8]/12 text-sm font-semibold text-[#63f4c8]">
                      {step}
                    </div>
                    <div className="font-semibold text-white">{title}</div>
                    <p className="mt-2 text-sm leading-6 text-white/56">{description}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-6">
              <DocSection id="overview" title={copy.overviewTitle} icon={MessageSquareText}>
                <BulletList items={copy.overview} />
              </DocSection>

              <DocSection id="stack" title={copy.stackTitle} icon={Network}>
                <div className="grid gap-3 md:grid-cols-2">
                  {copy.stack.map((item: string[]) => {
                    const [title, detail] = item;
                    return (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <CheckCircle2 className="h-4 w-4 text-[#63f4c8]" />
                          {title}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/58">{detail}</p>
                      </div>
                    );
                  })}
                </div>
              </DocSection>

              <DocSection id="funding" title={copy.fundingTitle} icon={CircleDollarSign}>
                <NumberedList items={copy.fundingSteps} />
              </DocSection>

              <DocSection id="commands" title={copy.commandsTitle} icon={BookOpen}>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase text-white/48 md:grid">
                    <span>Command</span>
                    <span>Description</span>
                  </div>
                  {copy.commands.map((item: string[]) => {
                    const [command, description] = item;
                    return (
                      <div key={command} className="grid gap-3 border-b border-white/8 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                        <code className="min-w-0 break-words rounded-xl bg-black/28 px-3 py-2 text-sm text-[#dffdf5]">
                          {command}
                        </code>
                        <p className="text-sm leading-6 text-white/62">{description}</p>
                      </div>
                    );
                  })}
                </div>
              </DocSection>

              <DocSection id="swap" title={copy.swapTitle} icon={ArrowRightLeft}>
                <div className="space-y-5">
                  <p className="text-sm leading-7 text-white/64">{copy.swapIntro}</p>

                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <div className="grid border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase text-white/48 md:grid-cols-[110px_130px_minmax(0,1fr)_100px]">
                      <span>Token</span>
                      <span>Name</span>
                      <span>Address</span>
                      <span>Decimals</span>
                    </div>
                    {copy.swapTokens.map((item: string[]) => {
                      const [symbol, name, address, decimals] = item;
                      return (
                        <div key={symbol} className="grid gap-2 border-b border-white/8 px-4 py-3 last:border-b-0 md:grid-cols-[110px_130px_minmax(0,1fr)_100px]">
                          <span className="font-semibold text-white">{symbol}</span>
                          <span className="text-sm text-white/62">{name}</span>
                          <code className="min-w-0 break-all rounded-xl bg-black/28 px-3 py-2 text-xs text-[#dffdf5]">
                            {address}
                          </code>
                          <span className="text-sm text-white/62">{decimals}</span>
                        </div>
                      );
                    })}
                  </div>

                  <NumberedList items={copy.swapSteps} />
                  <BulletList items={copy.swapNotes} />
                </div>
              </DocSection>

              <DocSection id="proof" title={copy.proofTitle} icon={FileCheck2}>
                <BulletList items={copy.proof} />
              </DocSection>

              <DocSection id="safety" title={copy.safetyTitle} icon={ShieldCheck}>
                <BulletList items={copy.safety} />
              </DocSection>

              <DocSection id="faq" title={copy.faqTitle} icon={HelpCircle}>
                <FaqList items={copy.faqs} />
              </DocSection>
            </div>
          </div>

          <aside className="hidden xl:block">
            <nav className="sticky top-28 border-l border-white/10 pl-4">
              <div className="mb-3 text-xs font-semibold uppercase text-white/38">{copy.onThisPage}</div>
              <div className="space-y-1">
                {navEntries.map(([id, label]) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="block rounded-lg px-2 py-1.5 text-sm text-white/46 transition hover:bg-white/[0.045] hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </nav>
          </aside>
        </div>
      </section>
    </main>
  );
}

function DocSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: typeof MessageSquareText;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-white/10 bg-[#0b1017]/76 p-5 shadow-[0_16px_60px_rgba(0,0,0,.18)] backdrop-blur-xl md:p-7">
      <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#63f4c8]/25 bg-[#63f4c8]/10 text-[#63f4c8]">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#63f4c8]" />
          <p className="text-sm leading-7 text-white/64">{item}</p>
        </div>
      ))}
    </div>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#63f4c8]/12 text-sm font-semibold text-[#63f4c8]">
            {index + 1}
          </span>
          <p className="text-sm leading-7 text-white/64">{item}</p>
        </div>
      ))}
    </div>
  );
}

function FaqList({ items }: { items: string[][] }) {
  return (
    <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
      {items.map(([question, answer], index) => (
        <details key={question} className="group bg-white/[0.025] open:bg-white/[0.04]" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.035]">
            <span>{question}</span>
            <HelpCircle className="h-4 w-4 shrink-0 text-[#63f4c8] transition group-open:rotate-45" />
          </summary>
          <div className="px-4 pb-5 text-sm leading-7 text-white/62">
            {answer}
          </div>
        </details>
      ))}
    </div>
  );
}
