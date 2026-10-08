import { useCallback, useEffect, useState } from "react";
import { CONTRACT, EXPLORER, REPO, Snapshot, Step, connectWallet, readAll, send } from "./chain";

const STATES = [["READY", "Waiting for a proposal"], ["OPEN", "Challenge window"], ["CHALLENGED", "Blocked by evidence"], ["FINALIZED", "Eligibility confirmed"], ["CLAIMED", "Authorization recorded"]];
const TXS: [string, string, string][] = [
  ["Eligibility consensus", "0xe1c8a5c3da394857a28cbea6dad17d0ab96ebb358be22df187280f295d5e475e", "Validators fetched npm metadata and agreed on ELIGIBLE"],
  ["Eligibility finalization", "0x53ceef940e7478641e049a67c288471f81b969f3f4f434c386b975a7de177611", "Challenge window expired, state became FINALIZED"],
  ["Public authorization claim", "0x183572339e2e6be89267f00483dc18b6cafe8fec5f4de4ff5c0bf5250f506a04", "One-time claim recorded, state became CLAIMED"],
  ["New cycle reset", "0x9749430907006bcf4f9d157d0395b89168c7614738e8d91cc60f299d1163b74e", "Owner started a fresh cycle"],
  ["Challenge submitted", "0x93d917028dc9921aefd0e2669deadd51428bddd30e7f6f17c872ec470f409b4e", "Evidence URL recorded, proposal moved to CHALLENGED"],
  ["Finalization blocked", "0x92ba22ad93ff7c23bf64fde087ac8db523120a50e1b45a62230cd06854594dff", "Finalize correctly failed while challenged"],
  ["Challenged cycle reopened", "0x24eab2238bbb39b3e56884eaab8e6d5dd6f2434bcc0cdf07d079e169bdfef11b", "Owner cleared the challenge, new consensus required"],
];
const clean = (s?: string) => (s ?? "").replace(/^"|"$/g, "").trim();
const short = (h: string) => h.slice(0, 10) + "…" + h.slice(-6);
const Tx = ({ h }: { h: string }) => <a className="mono" href={`${EXPLORER}/tx/${h}`} target="_blank" rel="noreferrer">{short(h)}</a>;

function useRoute() {
  const get = () => (location.hash.replace(/^#/, "") || "/");
  const [r, setR] = useState(get());
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

function useGate() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const refresh = useCallback(async () => {
    try { setSnap(await readAll()); setErr(""); } catch (e: any) { setErr(e?.message || "Could not read the contract."); }
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);
  return { snap, err, refresh };
}

function Track({ status }: { status: string }) {
  return (
    <div className="track" role="list" aria-label="Gate state">
      {STATES.map(([s, d]) => <div role="listitem" key={s} className={s === status ? `on ${s}` : ""} aria-current={s === status}>{s}<small>{d}</small></div>)}
    </div>
  );
}

function Home({ snap }: { snap: Snapshot | null }) {
  const status = clean(snap?.get_status);
  return (<>
    <h1>Let a release ship only when independent validators agree it is eligible.</h1>
    <p className="lead">Release Gate is a GenLayer Intelligent Contract that checks npm package metadata through validator consensus, holds the result in a public challenge window, and then records a one-time authorization that deployment pipelines and DAO grant programs can read.</p>
    <div className="row"><a href="#/gate"><button>Open the live gate</button></a><a href="#/how"><button className="ghost">See how it works</button></a></div>
    <h2>Live on Bradbury right now</h2>
    {snap ? <><Track status={status} /><p>Cycle {clean(snap.get_cycle_id) || "?"}, decision <b>{clean(snap.get_decision) || "none yet"}</b>, package version <b>{clean(snap.get_package_version) || "unknown"}</b>.</p></> : <p>Reading the contract…</p>}
    <h2>The trust problem</h2>
    <div className="grid">
      <div className="card"><h3>One script is a single point of failure</h3><p>A CI check that fetches package metadata trusts one machine, one network path and one author. Any of them can be wrong or tampered with.</p></div>
      <div className="card"><h3>Registry data is messy</h3><p>Fields go missing, packages get deprecated, responses can contain text that tries to steer an LLM. Validators treat the response as untrusted data.</p></div>
      <div className="card"><h3>Approvals need an audit trail</h3><p>Every proposal, challenge and claim is a public transaction. Anyone can verify who blocked what, and when.</p></div>
    </div>
  </>);
}

function Gate({ snap, err, refresh }: { snap: Snapshot | null; err: string; refresh: () => void }) {
  const [addr, setAddr] = useState("");
  const [msg, setMsg] = useState("");
  const [evidence, setEvidence] = useState("");
  const [label, setLabel] = useState("my-deployment");
  const [step, setStep] = useState<Step | "">("");
  const [hash, setHash] = useState("");
  const [fn, setFn] = useState("");
  const [busy, setBusy] = useState(false);
  const status = clean(snap?.get_status);
  const deadline = Number(clean(snap?.get_challenge_deadline));
  const when = deadline > 1e9 ? new Date((deadline > 1e12 ? deadline : deadline * 1000)).toLocaleString() : "not set";

  const connect = async () => { try { setAddr(await connectWallet()); setMsg(""); } catch (e: any) { setMsg(e.message); } };
  const run = async (name: string, args: unknown[] = []) => {
    setBusy(true); setFn(name); setHash(""); setMsg("");
    await send(name, args, (s, h, m) => { setStep(s); if (h) setHash(h); if (m) setMsg(m); });
    setBusy(false); refresh();
  };
  const can = (cond: boolean) => !addr || busy || !cond;
  const order: Step[] = ["signing", "submitted", "consensus", "accepted"];
  const labels = ["Sign in wallet", "Transaction submitted", "Validators reach consensus", "Accepted, state updated"];

  return (<>
    <h1>The gate</h1>
    <p className="lead">Reads come straight from the contract. Writes are real transactions on GenLayer Bradbury Testnet.</p>
    {err && <p className="err" role="alert">{err}</p>}
    <Track status={status} />
    <div className="card"><dl>
      <dt>Decision</dt><dd>{clean(snap?.get_decision) || "none yet"}</dd>
      <dt>Package version</dt><dd>{clean(snap?.get_package_version) || "unknown"}</dd>
      <dt>Reason</dt><dd>{clean(snap?.get_reason) || "none yet"}</dd>
      <dt>Challenge deadline</dt><dd>{when}</dd>
      <dt>Challenge evidence</dt><dd>{clean(snap?.get_challenge_evidence) || "none"}</dd>
      <dt>Completed cycles</dt><dd>{clean(snap?.get_completed_cycles) || "0"}</dd>
      <dt>Claim label</dt><dd>{clean(snap?.get_claim_label) || "not claimed"}</dd>
      <dt>Contract</dt><dd><a className="mono" href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">{CONTRACT}</a></dd>
    </dl></div>

    <h2>Actions</h2>
    <div className="row">{addr ? <span className="mono">Connected: {addr}</span> : <button onClick={connect}>Connect wallet</button>}</div>
    <div className="grid">
      <div className="card"><h3>1. Propose</h3><p>Validators fetch the npm metadata and vote on eligibility. Needs state READY.</p><button disabled={can(status === "READY")} onClick={() => run("propose_eligibility")}>Verify package</button></div>
      <div className="card"><h3>2. Challenge</h3><p>Block an open proposal with an evidence URL. Needs state OPEN.</p><input aria-label="Evidence URL" placeholder="https://evidence.example/issue" value={evidence} onChange={(e) => setEvidence(e.target.value)} /><div className="row"><button disabled={can(status === "OPEN" && evidence.startsWith("http"))} onClick={() => run("challenge_eligibility", [evidence])}>Submit challenge</button></div></div>
      <div className="card"><h3>3. Finalize</h3><p>Available after the challenge deadline passes without a challenge.</p><button disabled={can(clean(snap?.can_finalize) === "true")} onClick={() => run("finalize_eligibility")}>Finalize</button></div>
      <div className="card"><h3>4. Claim</h3><p>Records the one-time public authorization. Needs state FINALIZED.</p><input aria-label="Claim label" value={label} onChange={(e) => setLabel(e.target.value)} /><div className="row"><button disabled={can(clean(snap?.can_claim) === "true" && label.length > 0)} onClick={() => run("claim_authorization", [label])}>Claim authorization</button></div></div>
    </div>
    <h2>Owner tools</h2>
    <p>These only succeed from the owner account. Other wallets will see the transaction rejected.</p>
    <div className="row"><button className="ghost" disabled={can(status === "CHALLENGED")} onClick={() => run("reopen_challenged_cycle")}>Reopen challenged cycle</button><button className="ghost" disabled={can(status === "CLAIMED" || status === "FINALIZED")} onClick={() => run("reset_cycle")}>Reset cycle</button></div>

    {step && <div className="card" aria-live="polite"><h3>Transaction: {fn}</h3>
      <ul className="tl">{labels.map((l, i) => {
        const idx = step === "failed" ? -1 : order.indexOf(step as Step);
        return <li key={l} className={i < idx || (step === "accepted") ? "done" : i === idx ? "now" : ""}>{l}</li>;
      })}{step === "failed" && <li className="fail">Failed</li>}</ul>
      {hash && <p>Hash: <Tx h={hash} /></p>}
      {msg && <p className="err">{msg}</p>}
      {step === "consensus" && <p>Consensus on GenLayer can take a few minutes. The page keeps polling until the transaction is accepted.</p>}
    </div>}
    {!step && msg && <p className="err" role="alert">{msg}</p>}
  </>);
}

function How() {
  return (<>
    <h1>How the gate decides</h1>
    <p className="lead">A package is eligible only if every check below passes in the validators’ own reading of the registry response.</p>
    <table><tbody>
      <tr><th>1</th><td>The package name equals the configured name.</td></tr>
      <tr><th>2</th><td>A version is present.</td></tr>
      <tr><th>3</th><td><code>dist.integrity</code> exists and is not empty.</td></tr>
      <tr><th>4</th><td>The package is not marked deprecated.</td></tr>
      <tr><th>5</th><td><code>dist.tarball</code> exists and uses HTTPS.</td></tr>
    </tbody></table>
    <h2>Consensus</h2>
    <p>The leader and each validator call <code>gl.nondet.web.get()</code> on the package URL and pass the response to <code>gl.nondet.exec_prompt()</code>, which is told to treat the response as untrusted data. They compare through <code>gl.eq_principle.prompt_comparative()</code> on one canonical line:</p>
    <pre>ELIGIBLE|axios|1.20.0|YES|NO|YES|package eligible</pre>
    <p>The free-form reason is informational. Only the decision and policy fields count. Malformed output, missing fields and prompt-injection attempts are rejected.</p>
    <h2>Lifecycle</h2>
    <pre>{`READY → propose_eligibility() → OPEN
OPEN → challenge_eligibility(url) → CHALLENGED → reopen_challenged_cycle() → READY
OPEN → (deadline passes) finalize_eligibility() → FINALIZED
FINALIZED → claim_authorization(label) → CLAIMED
CLAIMED → reset_cycle() → READY`}</pre>
    <h2>Limits</h2>
    <p>The contract attests to metadata only and does not verify the tarball. The default <code>/latest</code> endpoint is mutable, so production use should pin a version URL with <code>set_package_source()</code>. Challenges block finalization but are not adjudicated on-chain. The claim is public and one-time, and the contract moves no assets.</p>
  </>);
}

function Integrate() {
  return (<>
    <h1>Use the gate in your pipeline</h1>
    <p className="lead">A deployment script, treasury adapter or grant program reads the contract and acts only when the state is <code>CLAIMED</code>.</p>
    <pre>{`import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const client = createClient({ chain: testnetBradbury });
const status = await client.readContract({
  address: "${CONTRACT}",
  functionName: "get_status",
  args: [],
});
if (status !== "CLAIMED") process.exit(1); // block the release`}</pre>
    <table><thead><tr><th>Method</th><th>Purpose</th></tr></thead><tbody>
      {[["propose_eligibility()", "Fetch metadata, run consensus, open challenge window"], ["challenge_eligibility(evidence_url)", "Block an open proposal"], ["finalize_eligibility()", "Finalize after the deadline"], ["claim_authorization(label)", "Record the one-time public claim"], ["set_package_source(url, name)", "Owner: change source and expected name"], ["set_challenge_period(seconds)", "Owner: set window length"], ["reopen_challenged_cycle()", "Owner: clear a challenge"], ["reset_cycle()", "Owner: start a new cycle"], ["get_status(), get_decision(), can_finalize(), can_claim() …", "Read-only views"]].map(([m, p]) => <tr key={m}><td><code>{m}</code></td><td>{p}</td></tr>)}
    </tbody></table>
  </>);
}

function Evidence() {
  return (<>
    <h1>Verified transactions</h1>
    <p className="lead">Every row is a real Bradbury transaction. The blocked finalization is expected to fail: it proves a challenge stops the release.</p>
    <table><thead><tr><th>Step</th><th>What happened</th><th>Transaction</th></tr></thead><tbody>
      {TXS.map(([n, d, h]) => <tr key={h}><td>{n}</td><td>{d}</td><td><Tx h={h} /></td></tr>)}
    </tbody></table>
  </>);
}

export default function App() {
  const route = useRoute();
  const { snap, err, refresh } = useGate();
  const links = [["/", "Overview"], ["/gate", "Gate"], ["/how", "How it works"], ["/integrate", "Integrate"], ["/evidence", "Evidence"]];
  return (<>
    <header><div className="wrap"><a className="brand" href="#/">Release Gate</a>
      <nav aria-label="Main">{links.map(([p, l]) => <a key={p} href={`#${p}`} aria-current={route === p ? "page" : undefined}>{l}</a>)}</nav></div></header>
    <main className="wrap">
      {route === "/gate" ? <Gate snap={snap} err={err} refresh={refresh} /> : route === "/how" ? <How /> : route === "/integrate" ? <Integrate /> : route === "/evidence" ? <Evidence /> : <Home snap={snap} />}
    </main>
    <footer className="wrap">Runs on GenLayer Bradbury Testnet. <a href={REPO} target="_blank" rel="noreferrer">Contract source</a> · MIT</footer>
  </>);
}
