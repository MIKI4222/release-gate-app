# Deployed contract source

`contract.py` is the exact source of the Intelligent Contract deployed on GenLayer Bradbury Testnet at `0xC0CEa82374C4F1bcE296FCDF6818F10A1a20a1aA`.

- Original repository: https://github.com/MIKI4222/genlayer-dependency-release-gate
- Commit: `b7738fdc02d1dd66ef41fa285205621a239f76da`
- Explorer: https://explorer-bradbury.genlayer.com/address/0xC0CEa82374C4F1bcE296FCDF6818F10A1a20a1aA

Notes on the public interface:
- `claim_authorization(label)` requires a non-empty label and returns it inside the transaction result string. The label is **not** stored in contract state and there is no `get_claim_label()` view.
- Read methods: get_status, get_cycle_id, get_decision, get_package_version, get_reason, get_challenge_deadline, get_challenge_evidence, get_completed_cycles, can_finalize, can_claim.
