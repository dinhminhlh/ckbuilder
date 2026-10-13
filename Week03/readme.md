# CKB Weekly Report - Week 3

**Reporting period:** 13 October 2026  
**Publication date:** 13 October 2026  

---

## 1. Week 3 Overview

Mục tiêu của Tuần 3 là đi sâu vào việc làm quen và thực hành với hai chuẩn tài sản quan trọng trên Nervos CKB: **xUDT** (Extensible User-Defined Token) và **Spore Protocol** (Digital Objects / DOB).

Thông qua việc chạy trực tiếp các ứng dụng ví và công cụ hỗ trợ trên CKB Devnet, tôi đã kiểm thử hoàn chỉnh chu trình vòng đời của Fungible Token (xUDT) và Non-Fungible Digital Objects (Spore) từ khâu khởi tạo, kiểm tra số dư, chuyển giao cho đến hủy tài sản (melt).

**Các bài tập & tính năng đã thực hiện trong Tuần 3:**
- Quản lý & kiểm tra số dư ví CKB và xUDT (Check Balance)
- Chuyển token xUDT tới địa chỉ chỉ định (Transfer xUDT)
- Tạo mới & nhúng dữ liệu Digital Object (Create Spore / DOB)
- Truy vấn thông tin & chuyển giao Spore trên chuỗi (Query & Transfer Spore)
- Đốt/Thu hồi dung lượng lưu trữ của Spore (Melt Spore)

---

## 2. Chi tiết thực thi & Kết quả (Exercises Detail)

### 2.1. Exercise 01 - xUDT (Extensible User-Defined Token)

**Mục tiêu:** Thực hành thao tác với token fungible theo chuẩn xUDT trên môi trường CKB Devnet.

**Các bước thực hiện & Kết quả:**
1. **Kiểm tra ví & Số dư (Check Balance):** Khởi tạo tài khoản kiểm thử và truy vấn chính xác lượng Capacity (CKB) cũng như số dư xUDT đang lưu trữ trên các Live Cells.
2. **Chuyển xUDT (Transfer xUDT):** Thực hiện giao dịch chuyển token xUDT đến địa chỉ nhận. Giao dịch được xác nhận và commit thành công trên Devnet với đầy đủ thông tin Cell Inputs/Outputs.

---

### 2.2. Exercise 02 - Spore Protocol (Digital Objects / DOB)

**Mục tiêu:** Tạo, tương tác và quản lý Digital Objects (DOB/Spore) lưu trữ dữ liệu trực tiếp on-chain trên nền tảng Cell Model.

**Các bước thực hiện & Kết quả:**
1. **Tạo & Khởi tạo Spore (Create Spore):** Nhúng nội dung tệp vào Cell Data và phát hành Spore mới. Giao dịch khởi tạo trả về trạng thái `Committed` thành công.
2. **Truy vấn & Chuyển giao Spore (Query & Transfer):** Kiểm tra nội dung lưu trữ on-chain của Spore Cell qua ID, sau đó thực hiện giao dịch chuyển quyền sở hữu Spore sang địa chỉ ví khác.
3. **Melt Spore:** Thực hiện thao tác hủy Spore Cell để giải phóng dữ liệu và thu hồi lượng CKBytes (Capacity) ban đầu về ví người dùng.

---

## 3. Tổng kết & Định hướng Tuần tiếp theo

Trong Tuần 3, việc trực tiếp tương tác với xUDT và Spore Protocol đã giúp củng cố rõ ràng khái niệm về **Type Script** và cách CKB quản lý trạng thái tài sản trực tiếp trong **Cell Data**.

### Kế hoạch cho Tuần 4:
1. Tìm hiểu kiến trúc phát triển ứng dụng CKB sử dụng **CCC (Common Chain Connector)** SDK.
2. Bắt đầu tiếp cận việc lập trình **CKB Smart Contract (Script Development)** bằng ngôn ngữ **Rust**.
3. Thực hành sử dụng các công cụ hỗ trợ như `ckb-debugger` và `ckb-cli` để kiểm thử script.