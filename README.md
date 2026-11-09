# CKBuilder — kế hoạch hoàn thành chương trình

**Ngày bắt đầu thống nhất với Neon:** 22/09/2026.  
**Phạm vi kế hoạch:** Week 07–12, từ 03/11 đến 14/12/2026.  
**Mốc ba tháng theo lịch:** 22/12/2026.  
**Mục tiêu nội bộ:** hoàn thành và bàn giao vào 14/12, dành 15–21/12 cho phản hồi/sửa lỗi. Đây là phần dự phòng trong lịch, không phải một gia hạn đã được Neon xác nhận.

Kế hoạch được điều chỉnh theo yêu cầu của người học ngày 04/11/2026. Nó thay thế các đề xuất học mở rộng trước đây ở cuối báo cáo tuần, nhưng không thay đổi các kết quả đã thực hiện.

## 1. Đầu ra cần đáp ứng

Căn cứ hai PDF do người học cung cấp:

| Đầu ra | Tình trạng bằng chứng hiện có | Việc còn phải làm |
|---|---|---|
| CKB Academy: 8 module | Chưa có bảng theo dõi chứng minh đủ 8 module | Chốt đúng danh mục, học/ôn và ghi nhận từng module |
| Interactive tutorial của Academy | Chưa thấy bằng chứng hoàn thành riêng | Hoàn thành trước cuối Week 09 |
| CCC Playground: thử code và hoàn thành các ví dụ | Week 02 có báo cáo và ảnh Playground | Đối chiếu lại danh sách ví dụ của chương trình, bổ sung chỗ thiếu trước cuối Week 08 |
| CKB node và môi trường phát triển | Có thực hành Devnet các tuần trước; Week 07 có môi trường Linux và CKB node riêng | Giữ bằng chứng phiên bản, cấu hình, query; giải thích được cách chạy |
| Bài cơ bản của Handbook | Week 01–05 có báo cáo/bằng chứng transfer, store data, token, DOB, simple lock | Rà soát bằng chứng; bổ sung nếu một bài chỉ có báo cáo mà thiếu kết quả kiểm chứng |
| Ứng dụng nhỏ trong tháng thứ ba | Week 05 có Hash-lock Lab; chưa chốt bản capstone cuối khóa | Hoàn thiện CKB Cell Studio, kiểm thử, demo và hướng dẫn chạy |
| Báo cáo GitHub mỗi tuần | Các thư mục Week 01–06; Week 07 đã có phần kỹ thuật | Nộp từng tuần thật, không đăng bù nhiều báo cáo cùng lúc |
| Ảnh và ghi chép học tập | Có ảnh các tuần trước; Week 07 đang chờ người học chụp | Mỗi tuần lưu ảnh thật, điều tự hiểu, khó khăn và giới hạn |

Hoàn thành code do công cụ hỗ trợ không tự chứng minh người học đã đọc hoặc hiểu các module. Không đánh dấu Academy hoàn thành chỉ vì một chủ đề tương tự đã xuất hiện trong code.

Trang Academy được liên kết trực tiếp trong cả hai PDF: https://academy.ckb.dev/courses. Trong lần kiểm tra 04/11, trang không cung cấp danh mục có thể đọc bằng công cụ. Vì vậy các số module dưới đây là **vị trí theo checklist 8 module của T&Cs**, không phải tên module được tự đặt. Week 07 phải đối chiếu tên/link thực tế trước khi đánh dấu.

## 2. Lịch Week 07–12

Dự kiến 6–8 giờ/tuần, gồm học, tự chạy và ghi chép. Handbook nêu mức tối thiểu khoảng 4–5 giờ/tuần; đó không phải giới hạn tối đa. Phần kỹ thuật Perun Week 07 đã chạy nên thời gian còn lại của tuần ưu tiên việc học và đối chiếu yêu cầu.

| Tuần | Thời gian | Trọng tâm | Đầu ra cuối tuần |
|---|---|---|---|
| **07** | **03–09/11** | Khép bài Perun đã chạy; rà checklist toàn khóa; Academy vị trí 1–3 | Tên/link đủ 8 module đã đối chiếu; ghi chép 1–3; ảnh Perun; báo cáo Week 07 đúng thực tế |
| **08** | **10–16/11** | Academy vị trí 4–6, gồm phần L1 nếu nằm trong nhóm này; đối chiếu CCC Playground; chốt capstone | Ghi chép 4–6; checklist Playground kèm kết quả; đề cương capstone, luồng người dùng và tiêu chí nghiệm thu; trao đổi đề xuất với Neon |
| **09** | **17–23/11** | Academy vị trí 7–8 và interactive tutorial; dựng capstone MVP | Checklist Academy 8/8 có bằng chứng, tutorial xong; ứng dụng kết nối ví, tạo và đọc Cell trên Devnet |
| **10** | **24–30/11** | Hoàn thiện vòng đời Cell và chuyển luồng capstone sang Testnet | Tạo → đọc → cập nhật → xóa hoạt động; status/receipt đúng; bản Testnet đầu tiên; bù phần lý thuyết còn thiếu nếu phát hiện |
| **11** | **01–07/12** | Kiểm thử, xử lý lỗi và làm bản demo ổn định | Kiểm thử luồng thành công/thất bại; giao dịch thực tế và ảnh; chạy lại từ hướng dẫn; chốt tính năng |
| **12** | **08–14/12** | Bàn giao capstone và rà toàn bộ yêu cầu | README cuối, mã nguồn, demo/video ngắn, bằng chứng; ma trận đủ Academy/CCC/node/basic labs; báo cáo Week 12 và tổng kết |
| Dự phòng | 15–21/12 | Phản hồi từ Neon và sửa lỗi ảnh hưởng kết quả | Bản sửa nếu cần; không tự mở rộng tính năng |

Chọn **thứ Hai cuối mỗi tuần** làm ngày nộp báo cáo trong kế hoạch này: 09/11, 16/11, 23/11, 30/11, 07/12 và 14/12. Nếu Neon đã thống nhất ngày nộp khác, lịch đó được ưu tiên. Ngày xuất bản trong báo cáo phải là ngày đăng thật.

### Phân bổ thời gian

- Week 07: khoảng 3–4 giờ Academy, 1–2 giờ tự chạy/giải thích Perun, 1 giờ rà checklist và báo cáo.
- Week 08: khoảng 4 giờ Academy, 1 giờ CCC, 1–2 giờ đề cương capstone/báo cáo.
- Week 09: khoảng 3 giờ Academy/tutorial, 3–4 giờ MVP, 1 giờ bằng chứng.
- Week 10: khoảng 5 giờ chức năng/Testnet, 1 giờ bù kiến thức nếu cần, 1 giờ bằng chứng.
- Week 11: khoảng 5 giờ kiểm thử/sửa lỗi, 1 giờ chạy lại hướng dẫn, 1 giờ ghi chép.
- Week 12: khoảng 3 giờ bàn giao/demo, 2 giờ rà yêu cầu, 1–2 giờ sửa và tổng kết.

Nếu module L1 dài hơn dự kiến, chia việc đọc trong Week 07–09, dùng tối đa phần dự phòng học của Week 10. Giảm phần mở rộng của ứng dụng trước khi cắt các đầu ra bắt buộc.

## 3. Capstone đã chọn: CKB Cell Studio

**Mục tiêu:** một ứng dụng nhỏ để người dùng kết nối ví CKB Testnet và quản lý các Cell lưu ghi chú công khai của mình.

Chọn bài này vì có thể tái sử dụng kiến thức React/CCC, Cell Model, storage và giao dịch đã học. Không phụ thuộc vào việc vận hành Fiber/Perun trong trình duyệt hoặc tích hợp nhiều mạng cho sản phẩm cuối khóa.

### Phạm vi bắt buộc

1. Kết nối/ngắt ví bằng CCC và hiển thị đúng mạng, địa chỉ, số dư.
2. Tạo Cell chứa ghi chú UTF-8 có định dạng nhận diện của ứng dụng.
3. Truy vấn và hiển thị đúng các Cell thuộc ứng dụng/ví đã kết nối.
4. Cập nhật ghi chú bằng giao dịch tiêu Cell cũ và tạo Cell mới.
5. Xóa ghi chú bằng giao dịch tiêu Cell và trả capacity về ví sau phí.
6. Hiển thị capacity cần dùng, phí dự kiến và nội dung công khai trước khi ký.
7. Theo dõi giao dịch từ lúc gửi đến committed; lưu hash để kiểm tra lại khi kết quả chưa rõ.
8. Kiểm tra Cell đã bị tiêu, sai mạng, không đủ capacity và người dùng hủy ký.
9. Có hướng dẫn chạy, dữ liệu mẫu, kiểm thử phù hợp và một buổi demo có thể tái hiện.

Ghi chú lưu trên chain là công khai. UI cần nói rõ điều này trước khi người dùng gửi dữ liệu. Không đặt mục tiêu lưu dữ liệu cá nhân nhạy cảm trong capstone.

### Giới hạn phạm vi

- Một mạng đích: CKB Testnet; Devnet phục vụ phát triển và kiểm thử.
- Một loại dữ liệu: ghi chú văn bản, tối đa 512 byte UTF-8 cho MVP.
- Không cần token riêng, DOB marketplace, cross-chain swap hoặc payment-channel backend.
- Không tự thêm database/backend nếu các chức năng cốt lõi có thể chạy qua ví và RPC.
- Lịch sử nâng cao, tìm kiếm toàn văn và giao diện cầu kỳ chỉ làm khi yêu cầu chính đã ổn định.
- Không bắt buộc hosting công khai nếu chưa được yêu cầu; phải có demo chạy được và hướng dẫn dựng lại.

### Tiêu chí nghiệm thu

- Từ một checkout mới, làm theo README có thể cài và chạy ứng dụng.
- Ví A tạo và quản lý ghi chú của A; giao diện không tự tiêu Cell khác ngoài phạm vi ứng dụng.
- Cell cũ không còn live sau update/delete; output mới/hoàn capacity được xác minh.
- Số tiền dùng số nguyên shannon; capacity tối thiểu và phí không tính bằng số thực thiếu chính xác.
- Các trạng thái rejected, pending và chưa rõ xác nhận được trình bày đúng.
- Không có private key, seed phrase hoặc dữ liệu ví bí mật trong repository, ảnh hay log công khai.
- Có ít nhất một chuỗi create/read/update/delete trên Testnet với transaction hashes và kết quả query.
- Có kiểm thử hữu ích cho dữ liệu, capacity và các lỗi quan trọng; không dùng số lượng test thay cho kiểm chứng luồng thật.

## 4. Checklist học tập để chốt trong Week 07

Với mỗi mục Academy, ghi tên chính xác, link, ngày học, bài tập/quiz nếu có, bằng chứng và ghi chú của người học. Nếu đã học từ trước, dẫn đúng bằng chứng thay vì làm lại không cần thiết.

- [ ] Module 1: tên/link và bằng chứng.
- [ ] Module 2: tên/link và bằng chứng.
- [ ] Module 3: tên/link và bằng chứng.
- [ ] Module 4: tên/link và bằng chứng.
- [ ] Module 5: tên/link và bằng chứng.
- [ ] Module 6: tên/link và bằng chứng.
- [ ] Module 7: tên/link và bằng chứng.
- [ ] Module 8: tên/link và bằng chứng.
- [ ] Interactive tutorial: link, các bước, kết quả.
- [ ] CCC Playground: đối chiếu đầy đủ ví dụ theo danh mục chương trình; ghi kết quả từng mục.
- [ ] Node/môi trường: cấu hình, phiên bản và query node thành công.
- [ ] Basic labs: transfer, store data, fungible token, DOB, simple lock đều có bằng chứng tương ứng.

Nếu trang khóa học hoặc công cụ cũ không hoạt động, ghi URL/lỗi và phần đã làm; dùng công cụ hiện hành để thực hành chủ đề tương đương, nhưng không tự gọi đó là hoàn thành module chính thức khi chưa xác nhận yêu cầu. Handbook cho phép bỏ qua các lab phụ thuộc Lumos/Capsule đã lỗi thời; vẫn cần học phần khái niệm liên quan.

## 5. Nhịp làm việc và mốc kiểm tra

- Đầu tuần: đọc mục tiêu và chọn tiêu chí sẽ chứng minh.
- Trong tuần: người học tự chạy, đọc code quan trọng, lưu ảnh/lệnh/kết quả, ghi điểm chưa hiểu.
- Cuối tuần: rà bằng chứng, viết báo cáo phản ánh đúng việc đã làm, commit và push trong tuần.
- Cuối Week 08: capstone có phạm vi cụ thể để người học trao đổi với Neon; không tự động gửi tin nhắn thay người học.
- Cuối Week 09: chốt phần Academy/tutorial; không mở thêm nhánh học nâng cao nếu phần này chưa đủ.
- Cuối Week 11: chốt chức năng; Week 12 ưu tiên bản có thể bàn giao.
- Cuối Week 12: rà từng đầu ra và chỉ đánh dấu khi có bằng chứng.

## 6. Nội dung chưa đặt thành yêu cầu bắt buộc

Full Perun dispute demo, Fiber multi-hop, SSRI, RGB++, iCKB, DAO chuyên sâu và toàn bộ Intermediate/Advanced của Handbook không được hai PDF quy định là phải hoàn tất hết trong ba tháng. Chúng chỉ được thêm khi không làm trễ Academy, CCC, node, capstone hoặc báo cáo.

Kế hoạch trên hướng đến đáp ứng các đầu ra được nêu trong tài liệu. Việc Neon xác nhận hoàn thành vẫn dựa trên chất lượng học tập, bằng chứng và yêu cầu thực tế của chương trình, không chỉ số thư mục hoặc số commit.

