# GEOF website – quy tắc cho Claude Code

Website tĩnh (HTML/CSS/JS thuần) của nhóm nghiên cứu GEOF (Geo.F), đăng bằng GitHub Pages.

## Quy tắc bắt buộc
1. **Nội dung hiển thị trên web luôn bằng tiếng Anh**, giọng chuyên nghiệp, tối giản kiểu Apple.
2. **Chat với người dùng bằng tiếng Việt**, đơn giản (người dùng không rành lập trình).
3. **Không đổi thiết kế** (CSS/HTML/JS trong `index.html`) khi chỉ cập nhật nội dung. Chỉ sửa `index.html` khi người dùng yêu cầu rõ về giao diện/chức năng.
4. **Luôn chạy `node tools/build.js` và đọc kết quả** trước khi commit/push. Build lỗi thì không push.
5. Không đưa token, mật khẩu, email riêng tư lên repo. Commit dùng email noreply của GitHub.
6. Hỏi người dùng trước khi `git push` nếu họ chưa từng cho phép đăng trong phiên này (hoặc để họ nhấp đúp `publish.bat`).

## Cấu trúc
```
index.html          giao diện (đọc window.SITE_DATA từ data.js)
data.js             TỰ SINH bởi build – không sửa tay
assets/             TỰ SINH: ảnh đã nén (≤1600px, JPEG ~82%), tên không dấu
content/            NGUỒN NỘI DUNG DUY NHẤT
  site.json         mô tả nhóm, pillars, join, contact, scholar, showPreviewRibbon
  hero.jpg          ảnh hero (tuỳ chọn, 21:9)
  directions.json   hướng nghiên cứu [{id,name,color}]
  leader/           leader.json + portrait.jpg
  projects/<NN-ten>/ info.json + cover.jpg (+ ảnh khác); _mau là bản mẫu
  gallery/          thả ảnh vào; captions.json {"file.jpg":"Caption", "placeholders":[...]}
  people/           <ten>.json + <ten>.jpg; _mau.json là mẫu
  publications.json news.json milestones.json
  partners/         partners.json [{name,logo}] + file logo
  places/<ten>/     GeoMap: info.json + ảnh; _mau là bản mẫu (xem README.md)
tools/build.js      quét content → data.js + nén ảnh + kiểm tra lỗi (tiếng Việt)
tools/publish.js    build → tóm tắt → commit → push (được publish.bat gọi)
tools/serve.js      server xem thử cục bộ (node tools/serve.js)
tools/check-places.js  kiểm tra tọa độ các điểm GeoMap nằm trong Việt Nam
tools/geo-prepare.js   (chỉ chạy khi đổi nguồn) tạo geodata/ từ geoBoundaries + Wikidata
geomap.html         trang bản đồ GeoMap (D3, không dùng tile bên thứ ba)
geomap-data.js      TỰ SINH: ranh giới + địa điểm cho geomap.html
geodata/            dữ liệu ranh giới đã đơn giản hóa + nguồn gốc
vendor/             d3.v7.9.0.min.js (nhúng sẵn, không phụ thuộc CDN)
publish.bat  preview.bat  HUONG-DAN.md
```
- File/thư mục bắt đầu bằng `_` bị build bỏ qua. Ảnh gốc trong `content/` bị `.gitignore` (chỉ `assets/` được đưa lên).
- Các file `.json` cho phép chú thích `//` và dấu phẩy thừa.
- id đề tài (số) do build tự gán theo thứ tự tên thư mục.

## Khi người dùng nói…
- **"thêm đề tài X"**: copy `content/projects/_mau` → `content/projects/<NN>-<slug>/`, điền `info.json` bằng tiếng Anh (direction ∈ directions.json, status ∈ doing|done|plan), đặt ảnh nếu có.
- **"đăng ảnh mới" / ảnh trong gallery**: kiểm tra `content/gallery/` (và ảnh người dùng chỉ đường dẫn), thêm caption vào `captions.json` nếu cần.
- **"thêm thành viên"**: tạo `content/people/<slug>.json` (+ ảnh cùng tên).
- **"thêm địa điểm thực địa X"**: copy `content/places/_mau` → `content/places/<slug>/`, điền `info.json` bằng tiếng Anh. TỌA ĐỘ PHẢI TRA TỪ NGUỒN (Nominatim/OSM/Wikidata/GPS của người dùng), ghi `coordinate_source`; KHÔNG đoán. `verified:true` chỉ khi có ≥2 nguồn khớp trong ~3 km. Dữ liệu mẫu có `"demo": true`. Chạy `node tools/check-places.js`.
- **"thêm bài báo / tin / mốc"**: sửa `publications.json` / `news.json` / `milestones.json`.
- **"đăng lên web"**: build → xem tóm tắt → commit message `Update content: +N images, +M projects` → push (hoặc bảo nhấp đúp `publish.bat`).
- **"quay lại bản trước"**: `git revert --no-edit HEAD` rồi push.

## GeoMap – quy tắc riêng
- Không dùng tile bản đồ của bên thứ ba; bản đồ vẽ từ GeoJSON trong `geodata/`.
- Hoàng Sa (Paracel Islands) và Trường Sa (Spratly Islands) chỉ hiển thị bằng CHẤM + TÊN (từ Wikidata), không vẽ vùng/đường bao. Biển ghi "East Sea" (Biển Đông). Không thêm tên gọi khác.
- Ranh giới là bản 2008 (64 tỉnh), ghi chú "Boundaries shown for illustration".

## Kiểm tra
Sau khi build: `node tools/serve.js` rồi mở http://localhost:5173, xác nhận không lỗi console, ảnh hiện, menu hamburger và Research Map hoạt động (desktop + mobile).
