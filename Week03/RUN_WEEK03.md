# Week 03 — bộ làm lại bằng copy–paste

Bộ này dựng lại từ báo cáo, evidence Week03 và API SDK đã đối chiếu. ZIP cũ không chứa mã nguồn Week03, nên đây là mã tương đương viết lại, không phải bản gốc khôi phục nguyên văn.

Phạm vi: CKB transfer; balance/Cells/transaction queries; issue 1.000 xUDT và transfer 100; create/query/transfer Cluster; create/query/transfer/melt một text Spore thuộc Cluster. Có giao diện React cho phần CKB. Giao diện dùng hai tài khoản Devnet giữ key ở backend, không phải kết nối ví extension như giao diện cũ.

Node.js 22.16.0 trở lên; pnpm 12.4.1; OffCKB 0.4.13 với Devnet chuẩn đã cài. Mã pin core 1.23.0 và spore 1.6.15. Đây là Devnet cục bộ. Không cần key cũ, địa chỉ cũ hoặc ID cũ. Không chạy `offckb clean`.

## 0. Giải nén vào thư mục mới

Tải `Week03-Replay.zip` vào Downloads, rồi paste trong PowerShell:

```powershell
$ErrorActionPreference = 'Stop'
$Archive = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter 'Week03-Replay*.zip' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Archive) { throw 'Tải Week03-Replay.zip vào Downloads trước.' }
$Week03Path = 'G:\neon\week3_replay_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
New-Item -ItemType Directory -Path $Week03Path | Out-Null
Expand-Archive -LiteralPath $Archive.FullName -DestinationPath $Week03Path
Set-Content 'G:\neon\week3-replay-path.txt' $Week03Path
Set-Location $Week03Path
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install lỗi: dừng tại đây.' }
pnpm run check
if ($LASTEXITCODE -ne 0) { throw 'TypeScript check lỗi: dừng tại đây.' }
pnpm run build
if ($LASTEXITCODE -ne 0) { throw 'Build lỗi: dừng tại đây.' }
```

Các block dưới có kiểm tra exit code để không tiếp tục giao dịch khi bước trước thất bại. Nếu gặp lỗi, dừng và gửi nguyên output lỗi. Không paste sang bước tiếp theo.

## 1. Khởi động Devnet

Mở terminal riêng. Nếu node đã chạy thì giữ nguyên terminal đó, bỏ qua block khởi động.

```powershell
offckb.cmd --version
offckb.cmd node
```

Để terminal node chạy. Quay lại terminal đã cài project ở bước 0:

```powershell
$Week03Path = Get-Content 'G:\neon\week3-replay-path.txt'
Set-Location $Week03Path
pnpm exec tsx .\lab.ts init
if ($LASTEXITCODE -ne 0) { throw 'Init lỗi: kiểm tra RPC/OffCKB trước.' }
$Wallets = Get-Content .\accounts.json -Raw | ConvertFrom-Json
offckb.cmd deposit $Wallets.a 2000 --network devnet
if ($LASTEXITCODE -ne 0) { throw 'Deposit A lỗi.' }
offckb.cmd deposit $Wallets.b 2000 --network devnet
if ($LASTEXITCODE -ne 0) { throw 'Deposit B lỗi.' }
pnpm exec tsx .\lab.ts balance a
if ($LASTEXITCODE -ne 0) { throw 'Balance A lỗi.' }
pnpm exec tsx .\lab.ts balance b
if ($LASTEXITCODE -ne 0) { throw 'Balance B lỗi.' }
```

`init` tự sinh hai file key Devnet mới, giữ nguyên nếu đã tồn tại; xuất KnownScripts, dò các binary Spore/Cluster trong genesis và lưu dependency của chain hiện tại. Key nằm trong `private/`, không cần mở hoặc chụp key. Nếu `init` báo không thấy binary hỗ trợ, không dùng dependency Testnet thay vào; gửi output lỗi.

**Chụp:** RPC ready, địa chỉ A/B và balance có tiền. Deposit có thể cần chờ xác nhận trước khi query thấy tiền; nếu balance vẫn 0 thì chạy lại hai lệnh balance, không deposit liên tục.

## 2. Chuyển CKB và query

```powershell
pnpm exec tsx .\lab.ts ckb-transfer a 100
if ($LASTEXITCODE -ne 0) { throw 'CKB transfer lỗi; kiểm tra transactions.json trước khi gửi lại.' }
pnpm exec tsx .\lab.ts balance a
if ($LASTEXITCODE -ne 0) { throw 'Balance A lỗi.' }
pnpm exec tsx .\lab.ts balance b
if ($LASTEXITCODE -ne 0) { throw 'Balance B lỗi.' }
pnpm exec tsx .\lab.ts cells a
if ($LASTEXITCODE -ne 0) { throw 'Cells query lỗi.' }
pnpm exec tsx .\lab.ts transactions a
if ($LASTEXITCODE -ne 0) { throw 'Transactions query lỗi.' }
```

**Chụp:** tx hash + committed + Received 100 CKB; balances; Cell listing; transaction listing.

### Giao diện React cho phần CKB

Terminal API mới:

```powershell
Set-Location (Get-Content 'G:\neon\week3-replay-path.txt')
pnpm run api
```

Terminal UI mới:

```powershell
Set-Location (Get-Content 'G:\neon\week3-replay-path.txt')
pnpm run dev
```

Mở `http://127.0.0.1:5173`. Chọn Wallet A → Connect local account → Query balance → Query cells → Query transactions. Để amount 100 rồi Send CKB. Đây là một giao dịch bổ sung 100 CKB, không phải chỉ hiển thị lại giao dịch terminal. Sau khi committed, query balance A/B lại.

**Chụp:** địa chỉ tài khoản, balance, Cells, transactions, và kết quả Send CKB có committed. UI không gửi private key xuống trình duyệt.

## 3. Issue 1.000 xUDT và chuyển 100

Quay lại terminal CLI:

```powershell
Set-Location (Get-Content 'G:\neon\week3-replay-path.txt')
pnpm exec tsx .\lab.ts xudt-issue a 1000
if ($LASTEXITCODE -ne 0) { throw 'Issue lỗi; kiểm tra state.json và transactions.json trước khi mint lại.' }
pnpm exec tsx .\lab.ts xudt-balance a
if ($LASTEXITCODE -ne 0) { throw 'Token balance A lỗi.' }
pnpm exec tsx .\lab.ts xudt-balance b
if ($LASTEXITCODE -ne 0) { throw 'Token balance B lỗi.' }
```

Trên bộ tài khoản mới, balance token kỳ vọng A = 1000, B = 0. Mã phát hành dùng owner mode cơ bản của xUDT: type args là hash lock của ví phát hành; token amount là uint128 little-endian trong 16 byte data. Không đặt decimals hoặc extensions.

**Chụp:** Issue tx committed + Type args + Issued 1000; token balance trước transfer.

```powershell
pnpm exec tsx .\lab.ts xudt-transfer a 100
if ($LASTEXITCODE -ne 0) { throw 'xUDT transfer lỗi; kiểm tra transaction đã gửi trước khi chạy lại.' }
pnpm exec tsx .\lab.ts xudt-balance a
if ($LASTEXITCODE -ne 0) { throw 'Token balance A lỗi.' }
pnpm exec tsx .\lab.ts xudt-balance b
if ($LASTEXITCODE -ne 0) { throw 'Token balance B lỗi.' }
```

Kỳ vọng A = 900, B = 100, cùng Type args. **Chụp cả hai balance sau transfer**, không chỉ tx broadcast. Nếu đã issue/transfer nhiều lần, kết quả sẽ khác; không dùng số kỳ vọng để thay output thực tế.

## 4. Tạo, query và chuyển Cluster

```powershell
pnpm exec tsx .\lab.ts cluster-create a
if ($LASTEXITCODE -ne 0) { throw 'Create Cluster lỗi; kiểm tra state.json trước khi tạo lại.' }
pnpm exec tsx .\lab.ts cluster-query a
if ($LASTEXITCODE -ne 0) { throw 'Query Cluster lỗi.' }
```

**Chụp:** create tx committed, Cluster ID; query tên, owner A và OutPoint.

```powershell
pnpm exec tsx .\lab.ts cluster-transfer a
if ($LASTEXITCODE -ne 0) { throw 'Transfer Cluster lỗi.' }
pnpm exec tsx .\lab.ts cluster-query b
if ($LASTEXITCODE -ne 0) { throw 'Query Cluster sau transfer lỗi.' }
```

**Chụp:** committed + New owner B; query xác nhận owner B và giữ nguyên Cluster ID.

## 5. Tạo Spore thuộc Cluster

Cluster hiện thuộc B, vì vậy tạo Spore bằng **B**:

```powershell
pnpm exec tsx .\lab.ts spore-create b
if ($LASTEXITCODE -ne 0) { throw 'Create Spore lỗi; kiểm tra state.json trước khi tạo lại.' }
pnpm exec tsx .\lab.ts spore-query b
if ($LASTEXITCODE -ne 0) { throw 'Query Spore lỗi.' }
```

ID lấy tự động từ `state.json`. Proxy output dùng capacity tối thiểu để phần capacity còn lại đủ tài trợ Spore và fee. Không sửa object cấu hình `V2` của SDK. Proof Cluster được đưa vào transaction bằng input lock phù hợp và Cell dependency, không phải bỏ qua kiểm tra của contract.

**Chụp:** committed + Spore ID; query contentType `text/plain`, content, Cluster ID, owner B và OutPoint.

## 6. Chuyển Spore từ B về A

```powershell
pnpm exec tsx .\lab.ts spore-transfer b
if ($LASTEXITCODE -ne 0) { throw 'Transfer Spore lỗi.' }
pnpm exec tsx .\lab.ts spore-query a
if ($LASTEXITCODE -ne 0) { throw 'Query Spore sau transfer lỗi.' }
```

**Chụp:** committed + New owner A; query xác nhận owner A, giữ nguyên Spore ID và Cluster ID. Đây là bước khác với chuyển Cluster.

## 7. Melt bằng chủ hiện tại A

Melt tiêu thụ Spore trong bài thực hành này. Chụp query trước melt ở bước 6 rồi chạy:

```powershell
pnpm exec tsx .\lab.ts balance a
if ($LASTEXITCODE -ne 0) { throw 'Balance trước melt lỗi.' }
pnpm exec tsx .\lab.ts spore-melt a
if ($LASTEXITCODE -ne 0) { throw 'Melt lỗi; kiểm tra transaction đã gửi trước khi chạy lại.' }
pnpm exec tsx .\lab.ts spore-query a
if ($LASTEXITCODE -ne 0) { throw 'Query sau melt lỗi.' }
pnpm exec tsx .\lab.ts balance a
if ($LASTEXITCODE -ne 0) { throw 'Balance sau melt lỗi.' }
```

**Chụp:** committed + Original Cell spent + Live Spore NOT FOUND; query sau melt. Tổng capacity theo lock có thể không tăng sau melt vì query trước melt đã tính cả capacity nằm trong Spore; phần được giải phóng chuyển sang các output CKB thường, trừ fee. Dùng Cell state làm bằng chứng melt.

## 8. Checklist evidence

Tạo thư mục để lưu ảnh mới:

```powershell
New-Item -ItemType Directory -Force .\01_transfer_ckb\evidence, .\02_xDT\Evidence, .\03_Spore\Evidence | Out-Null
```

| Thư mục | Ảnh cần giữ |
| --- | --- |
| 01_transfer_ckb/evidence | Accounts_Balance; Make_Transaction; Transaction_done; Query_Balance; QueryCells; QueryTransactions; Local_Account_Connected nếu chạy UI |
| 02_xDT/Evidence | Issue_xUDT; Balance_Before; Send_xUDT; Balance_A_After; Balance_B_After |
| 03_Spore/Evidence | Create_cluster; Query_Cluster_Before; Transfer_Cluster; Query_Cluster_After; Create_Spore; Query_Spore_Before; Transfer_Spore; Query_Spore_After; Melt; Query_After_Melt |

Không dùng ảnh cũ cho lần làm mới. `state.json` giữ ID, `transactions.json` giữ tx hash và trạng thái, `devnet.json` giữ deployment hiện tại; các file này không chứa private key. Nếu node reset thì không dùng ID cũ. Khởi tạo thư mục replay mới.

## 9. Kết quả và giới hạn kiểm tra

Code đã qua TypeScript check và Vite build trong môi trường tạo bộ này. Chưa có kết quả chạy giao dịch trên Devnet Windows của bạn; chỉ đánh dấu hoàn thành khi các lệnh thực tế committed và query đúng trạng thái. Các con số 1000/900/100 là kết quả kỳ vọng cho lần chạy mới, không phải kết quả đã chạy sẵn.

`Week03-original.md` là bản báo cáo cũ để tham chiếu; không nộp nó như báo cáo lần chạy mới. `COPY_PASTE_SOURCE.md` chứa toàn bộ mã dưới dạng PowerShell here-string nếu muốn tạo file bằng paste thay vì dùng các file đã giải nén.

Tài liệu đối chiếu: https://github.com/ckb-devrel/offckb/tree/v0.4.13 và https://docs.ckbccc.com/en/docs/packages/protocol-sdks/spore . Fiber/Perun là phần carryover sang Week05, không được ghi hoàn thành ở Week03.
