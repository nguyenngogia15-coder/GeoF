# HƯỚNG DẪN CẬP NHẬT WEBSITE GEOF

Bạn chỉ cần làm **2 việc**:

1. Bỏ ảnh / sửa vài file chữ trong thư mục `content/`
2. **Nhấp đúp `publish.bat`** → web tự cập nhật sau 1–2 phút

> Chữ hiển thị trên web phải viết **bằng tiếng Anh**. Hướng dẫn này bằng tiếng Việt cho bạn dễ làm.
> Muốn xem thử trước khi đăng: nhấp đúp **`preview.bat`**.

---

## Bản đồ thư mục `content/`

| Muốn sửa gì | Làm ở đâu |
|---|---|
| Mô tả nhóm, 3 ý chính, email, địa chỉ, link Scholar | `content/site.json` |
| Ảnh bìa lớn đầu trang | bỏ file `hero.jpg` vào `content/` (tỉ lệ ngang 21:9) |
| Giới thiệu thầy/cô trưởng nhóm | `content/leader/leader.json` + ảnh `portrait.jpg` cùng thư mục |
| Hướng nghiên cứu (tên, màu) | `content/directions.json` |
| Đề tài | `content/projects/<tên-đề-tài>/` |
| Ảnh Gallery | bỏ ảnh vào `content/gallery/` |
| Thành viên | `content/people/` |
| Bài báo | `content/publications.json` |
| Tin tức | `content/news.json` |
| Cột mốc | `content/milestones.json` |
| Đối tác | `content/partners/` |

Các thư mục/file bắt đầu bằng dấu gạch dưới `_` (ví dụ `_mau`) là **bản mẫu**, không hiện lên web.

---

## 1. Thêm đề tài mới

1. Vào `content/projects/`, **copy** thư mục `_mau`, đổi tên thành tên mới, ví dụ `09-ten-de-tai`
   (số đầu quyết định thứ tự hiển thị; dùng chữ không dấu).
2. Mở `info.json` trong thư mục đó bằng Notepad, sửa các dòng. Mỗi dòng đã có chú thích tiếng Việt.
3. Bỏ ảnh vào cùng thư mục. Ảnh tên **`cover.jpg`** là ảnh bìa đề tài (nếu không có tên này, ảnh đầu tiên sẽ được dùng).
4. Nhấp đúp `publish.bat`.

Ví dụ `info.json`:

```json
{
  "title": "Settlement Monitoring of a Road Embankment",
  "direction": "mon",
  "status": "doing",
  "year": 2026,
  "summary": "Monitoring settlement of a road embankment over two years.",
  "problem": "Embankments keep settling after construction.",
  "method": "Install settlement plates and survey them monthly.",
  "outcome": "A settlement curve for design checks.",
  "members": ["Student A", "Student B"],
  "tags": ["Settlement", "Monitoring"]
}
```

- `direction`: mã hướng nghiên cứu trong `content/directions.json` (`soft`, `num`, `mon`, `lab`).
- `status`: `doing` = đang làm, `done` = đã xong, `plan` = dự kiến.
- Muốn **ẩn** một đề tài: đổi tên thư mục, thêm `_` ở đầu (ví dụ `_09-ten-de-tai`).

## 2. Thêm ảnh Gallery

Bỏ ảnh (jpg/png) vào `content/gallery/`. Xong, nhấp đúp `publish.bat`.

- Ảnh hiện theo thứ tự tên file → đặt `01-...`, `02-...` để sắp xếp. **Ảnh đầu tiên được hiển thị lớn nhất.**
- Chú thích (caption) lấy từ tên file: `Lab testing.jpg` → "Lab testing". Muốn tự viết caption, mở `content/gallery/captions.json`
  và thêm dòng `"ten-file.jpg": "Caption in English"`.
- Khi chưa có ảnh nào, web hiện các khung ảnh mẫu. Có ảnh thật thì khung mẫu tự mất.

## 3. Thêm thành viên

1. Vào `content/people/`, copy `_mau.json` thành `ten-nguoi.json` (ví dụ `nguyen-van-b.json`).
2. Sửa `name`, `role`, `direction`.
3. Muốn có ảnh: bỏ ảnh **cùng tên** vào cùng thư mục (`nguyen-van-b.jpg`), ảnh vuông là đẹp nhất.
4. Muốn xoá thành viên: xoá file `.json` (và ảnh) của người đó.

## 4. Thêm bài báo

Mở `content/publications.json`, thêm một khối vào danh sách (nhớ dấu phẩy giữa các khối):

```json
{
  "year": 2026,
  "title": "Title of the paper",
  "authors": "Nguyen V. A., Student A",
  "venue": "Journal name",
  "doi": "10.1234/abcd.2026.001"
}
```

`doi` chỉ ghi phần sau `doi.org/`; không có thì để `""`.

## 5. Tin tức, cột mốc, đối tác

- `content/news.json`: mỗi tin có `date` (vd `"Nov 2026"`), `title`, `tag`. Tin mới thêm lên đầu danh sách.
- `content/milestones.json`: `year` và `text`.
- `content/partners/partners.json`: ghi `name` và `logo` (tên file logo bỏ trong cùng thư mục).

## 6. Đăng lên web

Nhấp đúp **`publish.bat`**. Nó sẽ tự: kiểm tra nội dung → nén ảnh → tóm tắt thay đổi → lưu → đăng lên GitHub.
Cuối cùng in link web. **Đợi 1–2 phút** rồi bấm Ctrl+F5 để thấy bản mới.

- Nếu báo lỗi chữ đỏ ❌: đọc tên file + dòng bị lỗi, sửa, rồi chạy lại. Web đang chạy **không bị ảnh hưởng**.
- Lỗi hay gặp trong file `.json`: thiếu dấu phẩy `,` giữa hai mục; thiếu dấu ngoặc kép `"`; dùng nháy cong “ ” (copy từ Word) thay vì nháy thẳng `"`.
- Ảnh gốc nặng **ở lại máy bạn**; chỉ ảnh đã nén (trong thư mục `assets/`) được đưa lên GitHub. Đừng xoá thư mục `assets/`.

## 7. Lỡ làm sai, quay lại bản trước

Mọi lần đăng đều được lưu lại. Quay lại bản cũ rất dễ nhất là **nhờ Claude Code**: gõ
"quay lại bản trước" hoặc "huỷ lần đăng gần nhất". Nếu tự làm, mở PowerShell trong thư mục dự án:

```
git log --oneline          (xem danh sách các lần đăng, ghi nhớ mã 7 ký tự đầu dòng)
git revert --no-edit HEAD  (huỷ lần đăng gần nhất, tạo thêm 1 bản "hoàn tác")
git push
```

Hoặc lấy lại một file cũ: `git checkout <mã> -- content/news.json` rồi chạy `publish.bat`.

## 8. Nhờ Claude Code làm hộ

Mở thư mục này trong Claude Code và nói ví dụ: *"thêm đề tài X, hướng Monitoring, đang làm"*,
*"đăng ảnh mới trong gallery"*, *"thêm bài báo ..."*. Claude đã được dặn sẵn quy trình trong `CLAUDE.md`.

## 9. Lần đầu: bật GitHub Pages (chỉ làm 1 lần)

Trên github.com, mở repo → **Settings → Pages → Build and deployment**:
**Source = Deploy from a branch**, **Branch = `main`**, thư mục **`/ (root)`** → **Save**.
Repo phải ở chế độ **Public**. File `.nojekyll` đã có sẵn, không cần làm gì thêm.
