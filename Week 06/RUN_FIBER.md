# Thực hành Fiber trên Windows

## Trạng thái hiện tại

Lần chạy 04/11/2026 đã mở, thanh toán và đóng thành công. Không chạy open lại để tái tạo bằng chứng cũ. Đọc evidence/ và dùng audit khi node còn chạy.

Hai node nền của phiên đã được dừng sau khi kiểm tra bản backup tự động tạo sau thời điểm đóng channel. Key, database và backup còn trong runtime/. Khởi động lại bằng hai lệnh Start-Fiber ở dưới trước khi query/audit; không tạo data directory mới nếu muốn xem channel cũ.

Node dùng runtime/alice và runtime/bob, tách khỏi keys và Devnet các tuần trước. Đây là CKB Testnet, không phải OffCKB Devnet. [Hướng dẫn nền](https://www.fiber.world/docs/quick-start/basic-transfer).

## 1. Chuẩn bị máy/lần cài mới

~~~powershell
Set-Location 'E:\ckbuilder\Week 06'
node --version
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-Fiber.ps1
if ($LASTEXITCODE -ne 0) { throw 'Fiber setup failed.' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
~~~

Install-Fiber tải release v0.9.1, kiểm tra SHA256 trong reference/fiber-release.json, tạo config và key riêng. Key/config đã có được giữ nguyên.

Khi chạy lần đầu, Start-Fiber tạo password ngẫu nhiên, lưu bằng Windows DPAPI tại runtime/<node>/password.dpapi. DPAPI gắn với tài khoản Windows và máy hiện tại; đây không phải password backup có thể chuyển sang máy khác tùy ý. Toàn bộ runtime được gitignore, cần giữ riêng tư cùng channel database.

## 2. Hai terminal node

Terminal Alice:

~~~powershell
Set-Location 'E:\ckbuilder\Week 06'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Fiber.ps1 -NodeName alice
~~~

Terminal Bob:

~~~powershell
Set-Location 'E:\ckbuilder\Week 06'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Fiber.ps1 -NodeName bob
~~~

Mỗi data directory chỉ được một process dùng. RPC/P2P đều trên localhost: Alice 8227/8228, Bob 8237/8238. Dùng Ctrl+C trong terminal node để dừng sạch; giữ dữ liệu cho lần tiếp theo.

## 3. Faucet và số dư

Terminal thứ ba:

~~~powershell
Set-Location 'E:\ckbuilder\Week 06'
npm.cmd run fiber -- status
~~~

Lấy địa chỉ trong balances.alice.address và balances.bob.address, nhận tiền tại [Testnet faucet](https://faucet.nervos.org). Mục tiêu ít nhất 1.000 CKB mỗi bên. Lệnh open 500 yêu cầu ít nhất 700 plain CKB mỗi bên, dành phần dư cho capacity/fee.

~~~powershell
npm.cmd run fiber -- funds
~~~

Nếu faucet đã trả tx hash, kiểm tra committed trước khi nhận lại. Không dùng khóa Mainnet trong bài.

## 4. Kết nối và mở

~~~powershell
npm.cmd run fiber -- connect
if ($LASTEXITCODE -ne 0) { throw 'Peer connection failed.' }
npm.cmd run fiber -- open 500
~~~

Lệnh open tạo proposal, lưu temporary ID, cho Bob accept cùng số tiền và lưu final ID. Auto-accept được tắt để quan sát bước chấp nhận. Chỉ thành công khi hai bên ChannelReady.

Nếu hết thời gian chờ/mất RPC, dừng chuỗi thao tác và chạy:

~~~powershell
npm.cmd run fiber -- recheck
~~~

Không gửi lại open. Lệnh accept chỉ dành cho proposal đã lưu mà chưa từng gửi accept. Nếu accept đã gửi nhưng response không rõ, dùng recheck và xem cả hai channel lists.

## 5. Gửi một payment

~~~powershell
npm.cmd run fiber -- pay 1
~~~

Tạo invoice ở Bob, lưu payment hash trước khi gửi, thanh toán ở Alice; kiểm tra Success, Paid, balances và hết TLC pending. Mỗi lần pay thành công là payment mới. Dùng recheck để kiểm tra payment cũ.

## 6. Đóng và audit

~~~powershell
npm.cmd run fiber -- close
~~~

Nếu chờ chain, chỉ chạy recheck. Khi cả hai Closed:

~~~powershell
npm.cmd run audit
~~~

Audit query lại funding, close, output đúng lock Alice/Bob, phí và payment/invoice. Không có routing trung gian trong bài này; vẫn có phí chain khi mở/đóng.

## Khôi phục và bằng chứng

- runtime/lab-state.json giữ operation chưa rõ; không xóa để lách kiểm tra gửi trùng.
- runtime/cli.lock chặn hai CLI chạy đồng thời. Sau crash chỉ xóa lock khi chắc chắn CLI cũ đã dừng; giữ nguyên database và lab-state.
- Một lần lab giữ một channel ID. Sau khi đóng, xem lại bằng chứng hoặc dùng bản thư mục lab riêng cho lần mới, không xóa channel đang hoạt động.
- Chụp ảnh lần thực hành thật: funded balances, ChannelReady, Success/Paid và Closed/committed. JSON hiện có là bằng chứng máy đọc được, chưa thay thế ảnh trải nghiệm cá nhân.

Nếu cần dọn hai node nền của chính lab sau khi channel đã Closed, scripts/Stop-Fiber.ps1 kiểm tra tất cả channel, kiểm tra backup rồi dừng đúng process theo đường dẫn executable và data directory. Script từ chối khi còn channel chưa Closed. Với node chạy ở terminal riêng, ưu tiên Ctrl+C.

