# Fiber RPS

Rock-paper-scissors against a game server, paid over the [Fiber Network](https://github.com/nervosnetwork/fiber) on
**CKB Testnet**. The server commits to its move before the player chooses, and the payments make that commitment
binding.

> **Testnet only, test CKB with no real value.** Part of the code comes from CKBolt under a license that does not
> allow use with mainnet funds.

## How a round works

1. **Commit.** The server picks its move and builds a 32-byte preimage: byte 0 is the move (1 rock, 2 paper,
   3 scissors) and bytes 1-31 are random. It opens a Fiber **hold invoice** for the 1 CKB stake that carries only
   `sha256(preimage)`. The hash reveals nothing about the move.
2. **Stake.** The player pays the invoice. The payment is **held**: it is locked in the channel but has not reached
   the server.
3. **Play.** The player sends one move. The server decides the round against its committed move.
4. **Settle.**

   | Player | Server does | Player's net |
   |---|---|---|
   | loses | settles the hold invoice (reveals the preimage, keeps the stake) | -1 CKB |
   | draws | cancels the hold invoice (stake returned) | 0 |
   | wins | cancels the hold invoice, then pays 1 CKB to the player's invoice | +1 CKB |

5. **Reveal.** The server publishes the preimage. The player checks that its SHA-256 hash equals the invoice's payment
   hash and reads the server's move from byte 0.

Fairness:

- **The server cannot change its move:** the hash was fixed before the player chose.
- **The player cannot see the server's move:** the 31 random bytes hide it.
- **If the server disappears,** it never receives the held stake, and the stake returns to the player when the TLC
  expires.
- **What the player still trusts the server for:** paying the winnings after a loss for the server.

Safety rules in the code:

- **Settling:** the server never settles unless the held TLC is really in the channel. fnn 0.9.1 can report an invoice as
  `Received` after its TLC has timed out.
- **Hold timing:** no move is accepted when less than 3 h 10 min remain before fnn would fail the held stake.
- **Winnings:** they are recorded before they are sent, paid at most once per round, and an unanswered send is only
  re-read with `get_payment`.
- **Settle and refund:** a refund is refused after a settle attempt, and a round that was played cannot be voided.

## Layout

```
src/vendor/ckbolt/   Fiber JSON-RPC client from CKBolt (see NOTICE.md for what was changed)
src/game/rps.ts      moves, outcome, move commitment in the preimage
src/game/arena.ts    the round: stake, play, settle/refund/pay, reveal
src/game/entry.ts    held-stake rules (pure functions)
src/game/lab.ts      node checks, channel open/close; player.ts is the demo player
src/cli.ts           command-line driver
tests/               unit tests with an in-memory Fiber node
runtime/             local state, including unrevealed preimages (git-ignored)
```

## Run

Requirements:

- Node.js 20.18 or later.
- Two fnn **v0.9.1** nodes on CKB Testnet, with RPC on loopback: the game server at `127.0.0.1:8237` and the demo player
  at `127.0.0.1:8227`. This lab reuses the two nodes from `Week 06` (see that week's README for starting them).

```powershell
npm ci
npm run typecheck
npm test

npm run rps -- status
npm run rps -- connect
npm run rps -- channel:open 500     # Testnet transaction: 500 CKB from each side
npm run rps -- round:new
npm run rps -- player:pay
npm run rps -- round:check
npm run rps -- round:play rock      # or paper, scissors, random
npm run rps -- round:resolve
npm run rps -- round:reveal
```

Run `npm run rps` without arguments to list all commands. `--save <file.json>` also writes a command's result as
evidence. `channel:open`, `channel:close`, `player:pay`, `round:resolve` and `round:void` move Testnet funds. If one of
them reports an unclear outcome, run `channel:recheck`, `round:check` or `round:recheck-payout` instead of repeating it.

## Credits

The Fiber RPC client in `src/vendor/ckbolt/` and the notes on hold-invoice behaviour come from
[CKBolt](https://github.com/Tech-Expansion/CKBolt) by TEX Labs (Business Source License 1.1, see
`src/vendor/ckbolt/LICENSE`). Everything else was written for this project.
