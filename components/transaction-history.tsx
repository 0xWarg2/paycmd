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

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  ChainRoute,
  ExplorerTxLink,
  RailBadge,
  getChainMeta,
  getTransactionExplorerChain,
  inferRailFromTransactionType,
} from "@/components/chain-identity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TransactionType = "fund" | "deposit" | "withdraw" | "transfer" | "unify" | "bridge" | "swap";
type TransactionStatus = "pending" | "pending_gateway_finality" | "success" | "failed";

interface Transaction {
  id: string;
  user_id: string;
  chain: string;
  tx_type: TransactionType;
  amount: number | string;
  tx_hash: string | null;
  gateway_wallet_address: string | null;
  destination_chain: string | null;
  status: TransactionStatus;
  reason: string | null;
  created_at: string;
}

const transactionTypeLabels: Record<TransactionType, string> = {
  fund: "Fund",
  deposit: "Deposit",
  withdraw: "Withdraw",
  transfer: "Transfer",
  unify: "Unify",
  bridge: "Bridge",
  swap: "Swap",
};

function formatAmount(value: number | string) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0 USDC";
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(amount)} USDC`;
}

function swapReason(tx: Transaction) {
  if (tx.tx_type !== "swap" || !tx.reason) return null;
  try {
    const parsed = JSON.parse(tx.reason) as { tokenIn?: string; tokenOut?: string; amountOut?: string };
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function formatTransactionAmount(tx: Transaction) {
  const reason = swapReason(tx);
  if (!reason?.tokenIn) return formatAmount(tx.amount);

  const amount = Number(tx.amount ?? 0);
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(amount)
    : "0";
  return `${formatted} ${reason.tokenIn}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatTxType(type: Transaction["tx_type"]) {
  return transactionTypeLabels[type] ?? type;
}

function getStatusBadge(status: TransactionStatus) {
  switch (status) {
    case "success":
      return <Badge className="bg-green-600 hover:bg-green-700">Success</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "pending_gateway_finality":
      return (
        <Badge variant="secondary" className="border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          Gateway finality
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TransactionHistory() {
  const [isMounted, setIsMounted] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"none" | "asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/transactions");
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message ?? data?.error ?? `Error: ${response.statusText}`);
        }

        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load transaction history");
      } finally {
        setLoading(false);
      }
    }

    if (isMounted) {
      void fetchTransactions();
    }
  }, [isMounted]);

  const filteredAndSortedTransactions = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      const sourceMeta = getChainMeta(tx.chain);
      const destinationMeta = getChainMeta(tx.destination_chain);
      const searchable = [
        tx.tx_hash,
        tx.chain,
        tx.destination_chain,
        sourceMeta?.label,
        sourceMeta?.shortLabel,
        destinationMeta?.label,
        destinationMeta?.shortLabel,
        tx.tx_type,
        tx.status,
        tx.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchLower || searchable.includes(searchLower);
      const matchesType = typeFilter === "all" || tx.tx_type === typeFilter;
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });

    if (sortOrder !== "none") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter, statusFilter, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedTransactions.length / rowsPerPage);
  const paginatedTransactions = filteredAndSortedTransactions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleSort = () => {
    if (sortOrder === "none") setSortOrder("desc");
    else if (sortOrder === "desc") setSortOrder("asc");
    else setSortOrder("none");
  };

  const SortIcon = () => {
    if (sortOrder === "asc") {
      return <ArrowUp className="ml-2 inline h-4 w-4" />;
    }

    if (sortOrder === "desc") {
      return <ArrowDown className="ml-2 inline h-4 w-4" />;
    }

    return <ArrowUpDown className="ml-2 inline h-4 w-4" />;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  if (!isMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Please connect your wallet to view your transactions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent>
          <div className="mt-7 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Input
                placeholder="Search hash, chain, status, reason"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="fund">Fund</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdraw">Withdraw</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="bridge">Bridge</SelectItem>
                  <SelectItem value="swap">Swap</SelectItem>
                  <SelectItem value="unify">Unify</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-[210px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_gateway_finality">Gateway finality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Explorer</TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={handleSort} className="h-8 p-0">
                        Date
                        <SortIcon />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-red-500">
                        Error: {error}
                      </TableCell>
                    </TableRow>
                  ) : paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((tx) => {
                      const explorerChain = getTransactionExplorerChain(tx);
                      const statusBadge = getStatusBadge(tx.status);

                      return (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="font-medium">{formatTxType(tx.tx_type)}</div>
                              <RailBadge rail={inferRailFromTransactionType(tx.tx_type)} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChainRoute sourceChain={tx.chain} destinationChain={tx.destination_chain} />
                          </TableCell>
                          <TableCell className="font-mono">{formatTransactionAmount(tx)}</TableCell>
                          <TableCell>
                            {tx.reason ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {statusBadge}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[300px] text-xs break-words">{tx.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              statusBadge
                            )}
                          </TableCell>
                          <TableCell>
                            <ExplorerTxLink chain={explorerChain} txHash={tx.tx_hash} compact />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                  {Math.min(currentPage * rowsPerPage, filteredAndSortedTransactions.length)} of{" "}
                  {filteredAndSortedTransactions.length} transactions
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
