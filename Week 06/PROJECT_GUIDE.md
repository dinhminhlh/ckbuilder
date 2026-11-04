# Week 06 — Fiber và Perun payment channels

Phạm vi đã chọn: học payment channels, thực hành Fiber trên CKB Testnet và tìm hiểu chữ ký channel state của Perun. Tuần này tách riêng với Hash-lock Lab tuần 5.

## Kết quả kiểm chứng ngày 04/11/2026

| Bài | Kết quả | Bằng chứng |
|---|---|---|
| Hai Fiber node Windows v0.9.1 | Alice/Bob cùng Testnet, kết nối được với nhau | evidence/01-node-status.json, 01b-peers-connected.json |
| Mở channel | Hai bên góp 500 CKB; funding Cell 1.000 CKB; cả hai ChannelReady | evidence/02-channel-ready.json |
| Thanh toán Alice → Bob | 1 CKB; sender Success, invoice Paid; balance hai phía khớp | evidence/payment-*.json |
| Đóng hợp tác | Hai node Closed; close transaction committed, tiêu đúng funding Cell | evidence/04-channel-closed.json |
| Kiểm tra độc lập | Query lại chain, recipient outputs, phí, sender và receiver | evidence/06-final-audit.json |
| Perun: mã hóa và chữ ký | Vector chính thức hợp lệ; bốn thay đổi state bị từ chối | evidence/05-perun-signature-vector.json |
| Perun: full Devnet demo | **Chưa chạy**: máy chưa có Go và Linux WSL/Docker | RUN_PERUN.md |

Các thao tác trên được công cụ hỗ trợ thực hiện trong phiên làm việc; người học cung cấp funding qua faucet. Đây là bằng chứng kỹ thuật để kiểm tra và học lại, không thay thế ghi chép trải nghiệm cá nhân.

Hai node nền đã được dừng sau khi kiểm tra backup sau lúc đóng channel; dữ liệu vẫn được giữ. Khởi động lại bằng Start-Fiber.ps1 trước khi chạy lại audit/RPC.

## Tài liệu thực hành

1. [Khái niệm và đối chiếu Fiber/Perun](LEARNING.md).
2. [Thực hành Fiber bằng PowerShell](RUN_FIBER.md).
3. [Bài chữ ký và hướng chạy Perun Devnet](RUN_PERUN.md).
4. [Ghi chép để tự viết báo cáo](REPORT_NOTES.md).

~~~mermaid
sequenceDiagram
    participant A as Alice Fiber
    participant C as CKB Testnet
    participant B as Bob Fiber
    A->>B: Kết nối và thương lượng channel
    A->>C: Funding, cùng Bob ký giao dịch
    C-->>A: Funding committed
    C-->>B: Funding committed
    B->>A: Invoice 1 CKB
    A->>B: Payment và cập nhật channel
    B-->>A: Thanh toán hoàn tất
    A->>B: Yêu cầu đóng hợp tác
    A->>C: Giao dịch đóng đã ký
    C-->>A: Output trả Alice
    C-->>B: Output trả Bob
~~~

## ID và giao dịch

- Channel ID: 0x209c3524a96af28d95e3a6d0d4b186031fed25aa99f0910621fc5c29e8a83407.
- [Funding transaction](https://pudge.explorer.nervos.org/transaction/0xbd34b627a684cc2e77a240cfc4b2b027009e2e4e794fa396dad0232a73522e15).
- Payment hash: 0x5a0c20da45fa674289209075e4372a33de198691b853fdce88cd577b985348a0. Đây là hash của Fiber payment, không phải CKB transaction hash.
- [Cooperative close transaction](https://pudge.explorer.nervos.org/transaction/0x867754b5e202463541debfb7a439744bc6c8a7eb5bd25291eea94a60c1cab996).

Nguồn kiểm chứng chính là RPC và file JSON; đường dẫn explorer chỉ để tra cứu thêm.

## Mã nguồn và dữ liệu

- scripts/fiber.mjs: status, funds, connect, open, accept, pay, recheck, close.
- scripts/audit.mjs: xác minh funding/close trên chain và payment ở cả hai node.
- scripts/perun-vector.mjs: dựng bytes Molecule và xác minh vector Perun bằng JavaScript.
- tests/: 7 test cases; một case Perun gồm chữ ký đúng và bốn phép sửa state.
- reference/: phiên bản, checksum Fiber, commit Perun và fixture công khai.
- runtime/: binary, private keys, password DPAPI, database channel và trạng thái phục hồi; được gitignore.
- evidence/: kết quả công khai, không lưu private keys hoặc payment preimage.

Lần cài mới yêu cầu Node >=20.19.0, khuyến nghị bản LTS đang được hỗ trợ. Máy trong phiên dùng Node 20.18.1: các lệnh đã chạy được nhưng npm cảnh báo engine của dependency Noble. Kết quả này không bảo đảm tương thích cho bản Node thấp hơn khai báo.

## Nguồn chính thức

- [CKB Quick Start](https://docs.nervos.org/docs/getting-started/quick-start).
- [Fiber native node](https://www.fiber.world/docs/quick-start/run-a-node/rust).
- [Fiber basic transfer](https://www.fiber.world/docs/quick-start/basic-transfer).
- [Fiber RPC tại v0.9.1](https://github.com/nervosnetwork/fiber/blob/v0.9.1/crates/fiber-lib/src/rpc/README.md).
- [Perun CKB example tại commit đã chốt](https://github.com/perun-network/perun-examples/tree/6e975e7d2f61a80d1d13b71330a2415086b82242/payment-channel-ckb).
- [Perun CKB backend](https://github.com/perun-network/perun-ckb-backend).

Hai PDF do người học cung cấp không quy định bài riêng cho tuần 6. Đây là phạm vi học tập đã chọn trong phiên; chỉ ghi vào báo cáo những phần thực sự đã kiểm chứng và đã tìm hiểu.

