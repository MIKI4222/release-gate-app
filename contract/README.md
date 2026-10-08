# GenLayer Dependency Release Gate

A reusable GenLayer Intelligent Contract that creates a consensus-backed authorization gate for software deployments, DAO grants, and supply-chain adapters.

Validators independently fetch npm package metadata, interpret a fixed release policy, and agree on a canonical `ELIGIBLE` or `INELIGIBLE` result. An eligible result enters an optimistic challenge period before a one-time public authorization claim can be recorded.

## Deployed Contract

- **Network:** GenLayer Bradbury Testnet
- **Contract:** `0xC0CEa82374C4F1bcE296FCDF6818F10A1a20a1aA`
- **Source file:** `genlayer_dependency_release_gate_public.py`
- **Default source:** `https://registry.npmjs.org/axios/latest`

## Why this is useful

Deployment pipelines, DAO grant programs, and software supply-chain adapters often need an external release condition before authorizing the next step. Traditional contracts cannot independently inspect public package metadata or interpret incomplete external responses.

This contract provides a reusable state machine:

```text
READY
  ↓
propose_eligibility()
  ↓
OPEN  ── challenge_eligibility() ──> CHALLENGED
  ↓                                      ↓
challenge period expires          reopen_challenged_cycle()
  ↓                                      ↓
FINALIZED                         READY → new consensus
  ↓
CLAIMED
```

The contract records authorization only. It does not transfer tokens, deploy software, or move physical assets by itself. An external deployment, treasury, or grant adapter can consume the authorization state.

## Eligibility policy

A package is eligible only when the validators agree that the external metadata proves all of the following:

1. The package name matches the configured name.
2. A package version is present.
3. `dist.integrity` is present and non-empty.
4. The package is not marked deprecated.
5. `dist.tarball` is present and uses HTTPS.

Consensus-critical output fields are:

```text
ELIGIBLE|package|version|integrity_present|deprecated|tarball_present|reason
```

For example:

```text
ELIGIBLE|axios|1.20.0|YES|NO|YES|package eligible
```

The free-form reason is informational. Authorization depends only on the canonical decision and policy fields.

## GenLayer consensus design

The contract uses the GenLayer Equivalence Principle through `gl.eq_principle.prompt_comparative()`.

For every verification cycle:

1. The leader and validators independently call `gl.nondet.web.get()` on the configured package URL.
2. Each execution passes the external response to `gl.nondet.exec_prompt()`.
3. The prompt treats the response as untrusted data and prohibits following instructions contained in it.
4. Validators compare the package name, observed version, integrity-presence flag, deprecated flag, and HTTPS-tarball flag.
5. Malformed output, missing fields, prompt injection, and policy contradictions are rejected.
6. Only a canonical result can open the challenge period.

The challenge period adds an optimistic review window. Any account can submit an evidence URL while the proposal is open. The challenge blocks finalization, and the owner must reopen the cycle before a fresh consensus assessment can be performed.

## Contract methods

### Write methods

| Method | Purpose |
|---|---|
| `set_package_source(url, name)` | Owner changes the external package source and expected package name. |
| `set_challenge_period(seconds)` | Owner configures the optimistic challenge window. |
| `propose_eligibility()` | Fetches external metadata and starts a consensus verification. |
| `challenge_eligibility(evidence_url)` | Blocks an open proposal and records challenge evidence. |
| `reopen_challenged_cycle()` | Owner clears a challenge and requires a new consensus call. |
| `finalize_eligibility()` | Finalizes an eligible proposal after the challenge period. |
| `claim_authorization(label)` | Records the one-time public authorization claim. |
| `reset_cycle()` | Owner starts a new reusable cycle after the current cycle is closed. |

### Read methods

```text
get_status()
get_cycle_id()
get_decision()
get_package_version()
get_reason()
get_challenge_deadline()
get_challenge_evidence()
get_completed_cycles()
can_finalize()
can_claim()
```

## Quick test in GenLayer Studio

The constructor has no parameters.

### 1. Deploy

Upload the contract source and deploy it with the pinned dependency declaration at the top of the file.

### 2. Configure a short test period

```text
set_challenge_period(10)
```

For challenge testing, use a longer period such as `300` seconds because consensus transactions can take longer than ten seconds.

### 3. Run external verification

```text
propose_eligibility()
```

Expected state:

```text
get_status()    → OPEN
get_decision()  → ELIGIBLE
```

### 4. Finalize

After the challenge deadline:

```text
can_finalize()       → true
finalize_eligibility()
get_status()         → FINALIZED
```

### 5. Claim authorization

```text
claim_authorization("portal-review-demo")
get_status()         → CLAIMED
get_claim_label()    → portal-review-demo
```

The claim is intentionally public in this standalone demo so reviewers and permissionless adapters can complete the flow from any wallet.

## Verified transaction examples

### Successful eligibility and authorization flow

- Eligibility consensus: `0xe1c8a5c3da394857a28cbea6dad17d0ab96ebb358be22df187280f295d5e475e`
- Eligibility finalization: `0x53ceef940e7478641e049a67c288471f81b969f3f4f434c386b975a7de177611`
- Public authorization claim: `0x183572339e2e6be89267f00483dc18b6cafe8fec5f4de4ff5c0bf5250f506a04`

### Challenge flow

- New cycle reset: `0x9749430907006bcf4f9d157d0395b89168c7614738e8d91cc60f299d1163b74e`
- Challenge submitted: `0x93d917028dc9921aefd0e2669deadd51428bddd30e7f6f17c872ec470f409b4e`
- Finalization correctly blocked: `0x92ba22ad93ff7c23bf64fde087ac8db523120a50e1b45a62230cd06854594dff`
- Challenged cycle reopened: `0x24eab2238bbb39b3e56884eaab8e6d5dd6f2434bcc0cdf07d079e169bdfef11b`

All successful transactions reached `ACCEPTED`, `AGREE`, and `FINISHED_WITH_RETURN`. The blocked finalization intentionally returned `FINISHED_WITH_ERROR` because the proposal was challenged.

## Security and limitations

- The default `/latest` npm endpoint is mutable. Production integrations should configure a stable version-specific endpoint with `set_package_source()`.
- The contract attests to metadata fields; it does not download or cryptographically verify the package tarball.
- Challenge evidence is recorded as a public reference and blocks finalization. It is not automatically adjudicated by the contract.
- `claim_authorization()` is public and one-time. The first caller consumes the authorization receipt. This is intentional for a permissionless adapter/demo and should not be treated as direct asset custody.
- No token transfer, treasury movement, software deployment, or physical delivery is performed by this contract.
- Owner-controlled configuration is frozen during an active `OPEN` or `CHALLENGED` cycle.

## License

MIT
