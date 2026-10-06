# CKB Weekly Report - Week 2
**Reporting period:** Week 2
**Publication date:** 06 October 2026

## 📖 1. Week 2 Overview
Mục tiêu của Tuần 2 là tìm hiểu sâu hơn về Common Chain Connector (CCC) và tiến hành tự xây dựng một ứng dụng dApp frontend tùy chỉnh (`ckb-week02`) bằng React/Vite. Thông qua việc tương tác trực tiếp với CCC Playground và lập trình giao diện, tôi đã nắm được cách tích hợp ví, truy xuất dữ liệu on-chain và thực thi các chức năng cốt lõi trên mạng lưới CKB.

**Completed Exercises for Week 2:**
- Tương tác và kiểm thử trên CCC Model Playground.
- Xây dựng dApp `ckb-week02` (Giao diện UI, Kết nối ví, Truy vấn Số dư/Cells/Giao dịch).

## 🚀 2. Exercises Detail

### Exercise 01 - Tương tác với CCC Model Playground
**Objective:** Hiểu và kiểm thử các tính năng kết nối và giao dịch cốt lõi của Common Chain Connector (CCC) thông qua môi trường Playground.
**Procedure & Results:**
- Truy cập và thực hiện các thao tác tương tác trên giao diện CCC Playground.
- Kiểm thử thành công tính năng ký (Test Signer) để xác thực quyền điều khiển.
- Thực hiện lệnh chuyển CKB (Transfer CKB) và xác nhận giao dịch đã được xử lý thành công (Transaction Successful) trên mạng lưới.
- Thử nghiệm các chức năng truy vấn trạng thái, bao gồm truy vấn số dư (Query Balance) và truy vấn dữ liệu của các Cell (Query Cells).

### Exercise 02 - Phát triển Frontend dApp (ckb-week02)
**Objective:** Xây dựng một ứng dụng frontend độc lập sử dụng React và Vite để kết nối ví và hiển thị dữ liệu từ blockchain CKB.
**Procedure & Results:**
- Khởi tạo dự án `ckb-week02` với môi trường React/Vite và thiết lập giao diện người dùng (UI) cơ bản.
- Tích hợp thành công chức năng kết nối ví (Connect Wallet), cho phép người dùng đăng nhập vào dApp.
- Lập trình chức năng truy vấn và hiển thị chính xác số dư tài khoản (Query Balance) trên giao diện.
- Mở rộng chức năng ứng dụng để lấy và hiển thị chi tiết dữ liệu Cells (Query Cells).
- Cấu hình thành công chức năng truy vấn lịch sử giao dịch (Query Transactions) của tài khoản được kết nối.

## 🧠 3. Final Reflection & Next Steps
Tuần 2 đánh dấu bước chuyển mình quan trọng từ việc chạy các ví dụ có sẵn sang tự tay phát triển và cấu hình một giao diện React frontend tùy chỉnh tương tác với mạng CKB. Việc ứng dụng mô hình CCC đã giúp tôi có kinh nghiệm thực tế trong việc tích hợp ví Web3 và truy xuất các dữ liệu on-chain quan trọng một cách liền mạch.

**Goals for Week 3:**
1. Tối ưu hóa mã nguồn (refactor code) của dApp `ckb-week02` và hoàn thiện trải nghiệm người dùng (UX/UI).
2. Tìm hiểu sâu hơn về kiến trúc CKB Script để bắt đầu tự viết các Lock Script hoặc Type Script đơn giản.
3. Tích hợp các Smart Contract/Script tự viết vào dApp để mở rộng khả năng xử lý các loại giao dịch phức tạp hơn.