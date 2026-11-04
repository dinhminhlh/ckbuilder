# Ghi chép Week 06 — dữ kiện và câu hỏi để tự viết báo cáo

Ngày thực hành: 04/11/2026, giờ Việt Nam/Thái Lan (UTC+7). Đây là hồ sơ kỹ thuật hỗ trợ viết báo cáo, không phải bài kể trải nghiệm được viết thay người học.

## Dữ kiện đã kiểm chứng

- Hai node Fiber Windows v0.9.1 chạy với data directory và key riêng; cùng CKB Testnet genesis.
- Người học nhận faucet; công cụ thực hiện các lệnh mở, thanh toán, đóng và audit.
- Mỗi bên góp 500 CKB; funding output 1.000 CKB.
- Khi ChannelReady, local balance mỗi bên là 401 CKB.
- Payment Alice → Bob 1 CKB: Alice local 401 → 400; Bob local 401 → 402; sender Success, receiver Paid; routing fee 0.
- Channel đóng hợp tác ở cả hai node, close transaction committed và tiêu funding output.
- Close output: Alice 498.99999472 CKB; Bob 501 CKB. Các output này chưa bao gồm change ngoài channel của giao dịch funding.
- Phí funding 0.0000071 CKB; phí close 0.00000528 CKB.
- Bob có thêm funding ngoài channel trong thời gian thực hành; không dùng tổng số dư ví làm bằng chứng duy nhất cho payment.
- Perun fixture chữ ký chính thức: vector đúng pass; sửa bốn trường state đều bị từ chối.
- Bảy automated test cases pass; chưa chạy full Perun Devnet demo hoặc Rust contract tests.

Các hash, thời điểm UTC và số liệu chi tiết có trong evidence/06-final-audit.json và các file theo từng bước. UTC+7 tương ứng thời gian buổi chiều ngày 04/11/2026.

## Khó khăn đã thực sự quan sát

- Windows WSL có executable nhưng chưa có Linux distribution; không thấy Docker hoặc Go.
- Node mặc định 20.18.1 thấp hơn engine >=20.19 của một số dependency đã resolve. Cài mới nên dùng Node đủ phiên bản; package.json và lockfile đã khai báo mức tối thiểu.
- Channel vừa được Bob accept chưa xuất hiện ngay trong query Alice. Poll được sửa để chờ propagation, giữ nguyên channel ID và không mở trùng.
- Funding và cooperative close cần chờ Testnet; hết hạn chờ ở CLI được xử lý bằng recheck, không gửi lại write.
- Chuyển fixture chữ ký sang file riêng có lỗi chép public key; kiểm tra đối chiếu source phát hiện lỗi, sau đó fixture được trích trực tiếp từ source và toàn bộ test pass.
- Một lần lưu peer address thiếu /p2p/PeerID bị node cảnh báo; CLI hiện dùng save=false cho kết nối localhost, và việc kết nối hai node đã được xác minh.

## Phần người học tự điền

1. Tôi đã tự thao tác những bước nào, và phần nào được công cụ hỗ trợ?
2. Tôi giải thích được sự khác biệt giữa funding, channel balance và wallet balance như thế nào?
3. Tôi hiểu vai trò invoice/payment hash/transaction hash ra sao?
4. Tôi đã tự kiểm tra file bằng chứng hoặc RPC nào?
5. Thay đổi state làm chữ ký Perun mất hiệu lực giúp tôi hiểu điều gì?
6. Tôi chưa hiểu/chưa làm được phần nào, và tuần sau sẽ thử gì?
7. Ảnh chụp thực hành cá nhân nằm ở đâu?

Không ghi thay rằng người học đã hiểu hoặc tự thực hiện tất cả các bước. Ghi rõ phần chưa làm: full Perun Devnet, dispute/force-close, multi-hop và cross-chain.

