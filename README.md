# Release Gate — frontend for the GenLayer Dependency Release Gate

Multi-page dApp for the Intelligent Contract at `0xC0CEa82374C4F1bcE296FCDF6818F10A1a20a1aA` on GenLayer Bradbury Testnet.

## What it does
Validators independently fetch npm package metadata, agree on `ELIGIBLE` / `INELIGIBLE`, open a challenge window, and record a one-time public authorization claim that deployment pipelines or DAO grant adapters can read.

## Problem it solves
A single CI script is a single point of failure for release approval. Here the check runs under validator consensus, is open to public challenge, and leaves an auditable on-chain trail.

## Pages
- **Overview** — live gate state read from the contract
- **Gate** — connect wallet, propose, challenge, finalize, claim, owner tools; full transaction lifecycle (sign → submitted → consensus → accepted/failed)
- **How it works** — policy, consensus design, lifecycle, limits
- **Integrate** — genlayer-js snippet and method table
- **Evidence** — verified Bradbury transactions

## Run
```
npm install
npm run dev
npm run build   # static output in dist/
```
Needs MetaMask for writes. Reads work without a wallet.

## Contract source
Copy the exact deployed source into `contract/` (see `contract/README.md`) and keep it in sync with the Bradbury deployment. Original repo: https://github.com/MIKI4222/genlayer-dependency-release-gate

## Deploy
Any static host with a public URL (Cloudflare Pages, Netlify, GitHub Pages). Routing is hash-based, so no rewrite rules are needed.

## Limitations
Metadata attestation only (no tarball verification); `/latest` is mutable, so pin a version URL in production; challenges block but are not adjudicated on-chain.
