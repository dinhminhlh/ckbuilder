# Push các file Week 06 lên GitHub

Chạy ở PowerShell. Các lệnh dưới chỉ stage nội dung của Week 06; không có thao tác reset, xóa dữ liệu hoặc force push.

## 1. Kiểm tra thư mục và nhánh

~~~powershell
Set-Location 'E:\ckbuilder'
git status --short
git branch --show-current
git remote -v
~~~

## 2. Stage đúng các file cần nộp

~~~powershell
git add -- 'Week 06/.gitignore' 'Week 06/package.json' 'Week 06/package-lock.json'
git add -- 'Week 06/README.md' 'Week 06/PROJECT_GUIDE.md'
git add -- 'Week 06/LEARNING.md' 'Week 06/RUN_FIBER.md' 'Week 06/RUN_PERUN.md'
git add -- 'Week 06/PLAN.md' 'Week 06/REPORT_NOTES.md' 'Week 06/PUSH_GITHUB.md'
git add -- 'Week 06/scripts' 'Week 06/tests' 'Week 06/reference' 'Week 06/evidence'
~~~

README là báo cáo chính; không cần tạo thêm week06_report.md với nội dung trùng lặp.

Các file cần nộp gồm báo cáo/hướng dẫn, package manifests, mã lệnh, tests, reference công khai, bằng chứng JSON và chín ảnh. Không cần ảnh explorer 10/11.

## 3. Xem lại trước khi commit

~~~powershell
git diff --cached --name-only
git diff --cached --stat
git diff --cached -- 'Week 06/README.md'
~~~

Kiểm tra không có runtime/, node_modules/, file key, password.dpapi, .env hoặc log thô. Không dùng git add -f. Nếu có file ngoài Week 06 đã được stage từ trước, không tự bỏ stage công việc khác; lệnh commit giới hạn đường dẫn ở bước sau chỉ dành cho Week 06.

## 4. Commit và push

~~~powershell
git commit -m "Add Week 06 Fiber and Perun report, code and evidence" -- 'Week 06'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed; inspect the Git output before pushing.' }
git push
~~~

Nếu Git báo nhánh hiện tại chưa có upstream, và remote origin đã được kiểm tra đúng ở bước 1, dùng:

~~~powershell
git push -u origin HEAD
~~~

Chỉ dùng lệnh này khi cần thiết, không cần chạy cả hai lệnh push nếu lệnh đầu đã thành công.

## 5. Kiểm tra trên GitHub

Mở Week 06/README.md trong repository. Kiểm tra đủ chín ảnh hiển thị, các liên kết JSON mở được và không có thư mục runtime/ hoặc node_modules/.

