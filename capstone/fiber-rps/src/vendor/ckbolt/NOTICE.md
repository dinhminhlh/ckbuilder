# Code from CKBolt

The files in this folder come from [CKBolt](https://github.com/Tech-Expansion/CKBolt) by TEX Labs, commit
`e2bba3c886c3787e648fba64e62fb632a8adc620`, folder `ckbolt-hub/src/`. They are used under the Business Source License
1.1 in [LICENSE](LICENSE), whose Additional Use Grant allows use on test networks (CKB Testnet and dev chains). This
game runs on CKB Testnet only and must not be pointed at mainnet funds.

| File | Source | Changed |
|---|---|---|
| `fiber-rpc.client.ts` | `infrastructure/fiber/fiber-rpc.client.ts` | import paths |
| `fiber-rpc.protocol.ts` | `infrastructure/fiber/fiber-rpc.protocol.ts` | import paths |
| `fiber-rpc.schemas.ts` | `infrastructure/fiber/fiber-rpc.schemas.ts` | added `connect_peer`, `accept_channel`, close parameters and channel fields (marked `Fiber RPS:`) |
| `fiber-rpc.constants.ts` | `common/constants/fiber-rpc.constants.ts` | added two method names (marked `Fiber RPS:`) |
| `fiber-rpc.errors.ts` | `infrastructure/fiber/fiber-rpc.errors.ts` | NestJS base class replaced with `Error`; unused invoice errors removed |
| `error.util.ts` | `common/utils/error.util.ts` | none |

Everything outside this folder was written for Fiber RPS.
