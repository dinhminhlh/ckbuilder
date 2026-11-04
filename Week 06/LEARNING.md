# Payment channels — nội dung cần hiểu

## Từ hash-lock sang payment channel

Tuần 5 dùng lock script có thể được thỏa mãn bằng secret. Người biết secret có thể tạo giao dịch tiêu Cell; secret trong witness trở thành công khai khi giao dịch được gửi.

Payment channel bổ sung quan hệ giữa nhiều bên: tiền được khóa để bảo đảm cho các cập nhật ngoài chain, có chữ ký và cơ chế quyết toán. Giữ một secret đơn lẻ chưa tạo ra payment channel.

| Lớp | Ví dụ của bài | Kiểm chứng |
|---|---|---|
| CKB chain | Funding Cell, close transaction | get_transaction, input/output và committed |
| Fiber channel | ID, local/remote balance, pending TLC | list_channels ở hai node |
| Fiber payment | Payment hash và invoice | get_payment ở sender, get_invoice ở receiver |

## Đối chiếu

| Khía cạnh | Fiber | Perun trên CKB |
|---|---|---|
| Cách tích hợp đang học | Node FNN và JSON-RPC | go-perun, CKB backend, on-chain scripts |
| Đối tượng quan sát | Peer, channel, invoice, payment | Proposal, allocation, signed state, adjudicator |
| Bài tuần này | Hai node thật, mở/gửi/đóng trên Testnet | Đọc demo, kiểm tra chữ ký fixture thật |
| Chưa thực hành | Multi-hop, swap, force close | Full Devnet demo, dispute, cross-chain |

Fiber là mạng thanh toán; Perun là bộ công cụ state channels có backend CKB. Khả năng kết hợp với Ethereum không có nghĩa là CKB chạy EVM. Nguồn: [FNN README](https://github.com/nervosnetwork/fiber/tree/v0.9.1), [Perun backend](https://github.com/perun-network/perun-ckb-backend).

## Số liệu Fiber thực tế

Mỗi bên góp 500 CKB, funding output là 1.000 CKB. Nhưng local balance ban đầu trong RPC là 401 CKB mỗi bên. Cần phân biệt tổng tiền góp và phần balance sau capacity dự trữ của channel; không mặc định chúng bằng nhau.

| Góc nhìn | Local balance trước | Sau payment 1 CKB |
|---|---:|---:|
| Alice | 401 CKB | 400 CKB |
| Bob | 401 CKB | 402 CKB |

Local balance của Alice khớp remote balance nhìn từ Bob, và ngược lại. Chỉ đối chiếu sau khi hết pending TLC. Trong lần chạy này Bob còn có thêm funding faucet ngoài channel, nên không dùng riêng chênh lệch tổng số dư ví để chứng minh một payment.

Liquidity có hướng: khả năng gửi phụ thuộc balance chi ra theo hướng cần dùng. CKB ngoài channel không tự tăng outbound liquidity của channel đã mở.

## Chữ ký Perun

Fixture test_signature được lấy từ commit 6e975e7d2f61a80d1d13b71330a2415086b82242. Bài offline kiểm tra signed bytes; nó không vận hành cả giao thức Perun.

State gồm channel ID, balances, version và cờ final. Script dựng Molecule bytes, Keccak256 message, thêm Ethereum personal-message prefix cho digest 32 byte rồi Keccak256 lần nữa, theo hàm ethereum_message_hash của Rust. Chữ ký DER secp256k1 được đối chiếu với public key công khai của fixture. [Schema và hàm xác minh](https://github.com/perun-network/perun-examples/tree/6e975e7d2f61a80d1d13b71330a2415086b82242/payment-channel-ckb/devnet/contracts/crates/perun-common).

Chữ ký gốc hợp lệ. Đổi balance, version, channel ID hoặc final flag đều bị từ chối. Điều này chứng minh các trường bị ràng buộc vào chữ ký trong fixture; chưa chứng minh quy tắc chuyển state, dispute hay quyết toán của toàn bộ contract.

## Câu hỏi tự trả lời

1. Channel ID, payment hash và CKB transaction hash khác nhau thế nào?
2. Vì sao payment hash không nhất thiết có trang transaction trên CKB explorer?
3. Vì sao RPC chấp nhận lệnh chưa đủ để kết luận thành công?
4. Vì sao góp 500 CKB nhưng local balance ban đầu là 401 CKB trong cấu hình này?
5. Vì sao phải giữ channel database cùng với private key?
6. Chữ ký hợp lệ có tự chứng minh state là mới nhất không?
7. Nếu peer không hợp tác đóng channel, cần học tiếp phần nào của giao thức?

