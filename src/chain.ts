import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CONTRACT = "0xC0CEa82374C4F1bcE296FCDF6818F10A1a20a1aA" as `0x${string}`;
export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const REPO = "https://github.com/MIKI4222/genlayer-dependency-release-gate";

const reader = createClient({ chain: testnetBradbury });
let wallet: any = null;

const bigintSafe = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v);
const str = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v, bigintSafe) : String(v));

const READS = ["get_status", "get_cycle_id", "get_decision", "get_package_version", "get_reason", "get_challenge_deadline", "get_challenge_evidence", "get_completed_cycles", "can_finalize", "can_claim", "get_claim_label"];
export type Snapshot = Record<string, string>;

export async function readAll(): Promise<Snapshot> {
  const out: Snapshot = {};
  await Promise.all(READS.map(async (fn) => {
    try { out[fn] = str(await reader.readContract({ address: CONTRACT, functionName: fn, args: [] })); }
    catch { out[fn] = ""; }
  }));
  return out;
}

export async function connectWallet(): Promise<string> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask to send transactions.");
  const [address] = await eth.request({ method: "eth_requestAccounts" });
  wallet = createClient({ chain: testnetBradbury, account: address });
  try { await (wallet as any).connect("testnetBradbury"); } catch { /* user can switch network manually */ }
  return address as string;
}

export type Step = "signing" | "submitted" | "consensus" | "accepted" | "failed";

export async function send(fn: string, args: unknown[], on: (s: Step, hash?: string, msg?: string) => void) {
  if (!wallet) throw new Error("Connect a wallet first.");
  on("signing");
  let hash = "";
  try {
    hash = await wallet.writeContract({ address: CONTRACT, functionName: fn, args, value: 0n });
    on("submitted", hash);
    on("consensus", hash);
    const receipt = await wallet.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 5000 });
    if (JSON.stringify(receipt, bigintSafe).includes("FINISHED_WITH_ERROR")) {
      on("failed", hash, "The contract rejected this call (execution finished with an error). The state did not change.");
      return;
    }
    on("accepted", hash);
  } catch (e: any) {
    on("failed", hash || undefined, e?.shortMessage || e?.message || "Transaction failed.");
  }
}
