# Perun — bài chữ ký và bước tiếp theo trên Devnet

## 1. Bài thực hành chạy được ngay trên Windows

~~~powershell
Set-Location 'E:\ckbuilder\Week 06'
npm.cmd run perun:vector
if ($LASTEXITCODE -ne 0) { throw 'Perun signature exercise failed.' }
~~~

Không cần node/faucet cho bài này. Fixture công khai nằm trong reference/perun-signature-fixture.json. Nó được trích từ test_signature của ví dụ chính thức, không tự tạo một chữ ký rồi gọi đó là bằng chứng Perun.

Script dựng lại state Molecule dài 185 byte, tính digest theo hàm Rust và xác minh chữ ký secp256k1. Vector đúng phải hợp lệ; sửa balance, version, channel ID hoặc cờ final đều phải bị từ chối. Kết quả lưu ở evidence/05-perun-signature-vector.json.

Giới hạn: đây là bài kiểm tra mã hóa và chữ ký bằng JavaScript. Chưa chạy Rust contract tests, chưa mở channel Perun thật, chưa thử dispute hay cross-chain.

## 2. Đọc luồng ứng dụng chính thức

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Prepare-Perun.ps1
~~~

Script tải source tại commit 6e975e7d2f61a80d1d13b71330a2415086b82242 vào runtime/perun-source, đối chiếu signature/public key với fixture. Không chạy hoặc reset Devnet.

Trong thư mục payment-channel-ckb của source:

| File | Nội dung cần theo dõi |
|---|---|
| main.go | Tạo Alice/Bob, mở channel, gửi hai payment, settle |
| client/client.go | Allocation ban đầu và NewLedgerChannelProposal |
| client/channel.go | SendPayment, TransferBalance, IsFinal và Settle |
| client/handle.go | Accept proposal/update, kiểm tra balance phía nhận |
| client/client.go: startWatching | Watch adjudicator events |
| devnet/contracts/crates/perun-common/types.mol | Schema state và allocation |
| devnet/contracts/crates/perun-common/src/sig.rs | Hash và xác minh chữ ký |
| devnet/contracts/tests/src/tests.rs | test_signature, funding/dispute/close tests |

Demo đề xuất allocation ban đầu 100 CKB mỗi bên, Alice gửi Bob 10, Bob gửi lại Alice 5. Phép tính kỳ vọng cho allocation là 100/100 → 90/110 → 95/105. Đây là kết quả đọc code và bài tính, **chưa phải kết quả chạy demo trên máy**; phí/capacity ngoài allocation phải kiểm tra riêng.

## 3. Điều kiện trước khi chạy full demo

Máy Windows của phiên này có Rust/Cargo nhưng không có Go, Docker, hoặc bản Linux WSL. Contract vendored còn đặt build target mặc định x86_64-unknown-linux-gnu và dùng toolchain RISC-V/Clang. Vì vậy không chỉ cần thêm Go để chạy toàn bộ demo.

Dùng một Linux VM/WSL riêng, sau đó chuẩn bị theo [README của example](https://github.com/perun-network/perun-examples/tree/6e975e7d2f61a80d1d13b71330a2415086b82242/payment-channel-ckb) và README của contracts nằm trong cùng source. Go module khai báo go 1.23.0, toolchain go1.23.4; cần dùng phiên bản tương thích. Các công cụ được source nhắc tới gồm jq, sed, awk, tmux, tmuxp, expect, make, ckb >=0.201.0, ckb-cli >=1.13.0, Rust, RISC-V compiler/binutils và clang-18.

Không trộn contract/backend mới nhất với example đã chốt. Source tải về đã có bản contracts vendored tại payment-channel-ckb/devnet/contracts.

## 4. Thứ tự chạy khi Linux đã sẵn sàng

Dùng một bản source riêng trong filesystem Linux và một môi trường CKB riêng. Script upstream setup-devnet.sh reset dữ liệu bên trong thư mục devnet của chính nó, tạo accounts và sử dụng port 8114. Không chạy nó trong thư mục OffCKB của các tuần trước; xác nhận port không bị chiếm.

Trong terminal Linux, thay đường dẫn example bằng thư mục đã chuẩn bị:

~~~bash
cd /path/to/perun-examples/payment-channel-ckb/devnet/contracts
make prepare
source ./setup_env.sh build && make build
source ./setup_env.sh test && make test
~~~

Chỉ tiếp tục khi build và contract tests thành công. Mở terminal riêng:

~~~bash
cd /path/to/perun-examples/payment-channel-ckb/devnet
make dev
~~~

Đợi các pane node/miner/deployment hoạt động và deployment thành công. Sau đó ở terminal thứ hai:

~~~bash
cd /path/to/perun-examples/payment-channel-ckb
go run .
~~~

Đây là các bước chuẩn bị để người học chạy khi có môi trường; chúng chưa được thực thi trong phiên này.

## 5. Bằng chứng cần bổ sung cho full demo

- Phiên bản Go, CKB, ckb-cli và toolchain; commit source.
- Build/contracts tests có exit code thành công.
- Deployment scripts và funding đã lên Devnet.
- Channel/allocation trước, sau hai payment và settlement.
- Transaction hash cùng query xác nhận trạng thái on-chain.
- Tình huống lỗi đã thử và điều tự rút ra từ việc debug.

Không ghi full Perun demo hoàn thành chỉ vì bài vector chữ ký đã pass.

