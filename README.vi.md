<p align="center">
  <img src="build/icon.png" width="96" alt="Freenote icon" />
</p>

<h1 align="center">Freenote</h1>
<p align="center"><i>tên cũ: “Frnt”</i></p>

<p align="center">
  Ứng dụng ghi chú thay thế Notion: <b>miễn phí, mã nguồn mở, dữ liệu nằm trên máy của bạn</b>.<br/>
  Không cần tài khoản, không giới hạn. Toàn bộ ghi chú là một file SQLite trên ổ đĩa của bạn.
</p>

<p align="center">
  <a href="../../releases/latest"><b>⬇ Tải về</b></a> ·
  <a href="#so-sánh-freenote-và-notion">So sánh với Notion</a> ·
  <a href="CHANGELOG.md">Nhật ký thay đổi</a> ·
  <a href="README.md">English</a>
</p>

![Editor](docs/screenshots/editor.png)

## Tính năng chính

| | |
|---|---|
| ✍️ **Editor dạng block** | Gõ `/` để chèn heading, todo, toggle, quote, code, bảng, ảnh/video/file. Kéo thả block, dùng phím tắt Markdown, định dạng bằng toolbar. |
| 📄 **Trang** | Lồng nhau không giới hạn, icon, ảnh bìa, breadcrumb, mục yêu thích, chế độ toàn chiều rộng, kéo thả trong sidebar. |
| 🔗 **Liên kết** | Tạo trang con ngay trong nội dung, gõ `@` để liên kết tới trang khác, mỗi trang hiện **backlinks** (các trang liên kết tới nó). |
| 🗃️ **Database** | View Bảng và Board (Kanban). 10 kiểu thuộc tính, **liên kết giữa các database (relation, hai chiều)** và **rollup**, **nhóm (group by)**, **dòng tính toán** (đếm, tổng, trung bình, nhỏ nhất/lớn nhất, % đã tick…), lọc, sắp xếp nhiều cấp, nhiều view cho mỗi database, nhúng trong trang hoặc mở toàn trang. Mỗi hàng là một trang đầy đủ. |
| 📚 **Thư viện mẫu** | Duyệt và chép các mẫu có sẵn (tài liệu và database) được duy trì trong repo này. Mẫu mới hoặc vừa cập nhật có nhãn **Mới**, không cần cập nhật app. [Cách thêm mẫu](library/README.md). |
| 🔍 **Tìm kiếm** | `⌘K` / `Ctrl+K`, không phân biệt dấu (gõ "chao" vẫn ra "Chào"). |
| 🕘 **Lịch sử phiên bản** | Tự lưu phiên bản cho từng trang, khôi phục bằng một click. |
| 📋 **Template** | Có sẵn 4 mẫu, và có thể lưu bất kỳ trang nào thành mẫu. |
| 📥 **Import** | Từ Notion (file `.zip` Markdown & CSV, gồm trang con, ảnh, database) hoặc file `.md`. |
| 💾 **An toàn dữ liệu** | Tự lưu, thùng rác, sao lưu tự động hằng ngày (giữ 30 bản, chọn được thư mục), xuất/nhập JSON, xuất Markdown/PDF. |
| 🌐 **Ngôn ngữ** | Tiếng Việt và English, đổi ở cuối sidebar. |
| 🌓 **Giao diện** | Sáng và tối, sidebar kéo giãn được. |
| 🖥️ **Desktop + trình duyệt** | App cho macOS, Windows, Linux. Nút **🌐 Mở trong trình duyệt** (ở sidebar) mở cùng dữ liệu trên trình duyệt web tại `http://localhost:37291` khi app đang chạy. |

## Chuyển từ Notion sang

1. Trong Notion, mở **Settings → General → Export all workspace content**. (Nếu chỉ cần một trang: **⋯ → Export**.)
2. Chọn **Export format: Markdown & CSV** và bật **Include subpages**.
3. Notion sẽ gửi link tải qua email. Tải file `.zip` về, **không cần giải nén**.
4. Trong Freenote, mở **Cài đặt → Nhập dữ liệu → Từ Notion (.zip)** rồi chọn file. Nếu Notion chia export thành nhiều phần, chọn tất cả các phần cùng lúc.

**Từ link template Notion:** trong Thư viện mẫu (hoặc Cài đặt → Nhập dữ liệu), chọn **🔗 Từ link Notion** rồi dán link. Freenote mở link trong Notion và hướng dẫn từng bước *Duplicate → Export (Markdown & CSV)*; thả file .zip vào là xong, và có thể lưu thẳng vào mục Mẫu. Freenote chỉ dùng chính tính năng Duplicate và Export của Notion, vì Notion không có cách chính thức để tự đọc trang.

**Được chuyển sang:** cây trang, định dạng chữ, todo, toggle, code, quote, ảnh và file đính kèm, liên kết giữa các trang, và database (tự nhận dạng kiểu cột: chọn một, chọn nhiều, ngày, số, URL, checkbox, văn bản). Mỗi hàng database giữ nguyên nội dung trang của nó.

**Chưa hỗ trợ:** bình luận, công thức/rollup (được nhập dưới dạng văn bản), synced block, và các view database ngoài dạng bảng.

Đã thử với một workspace thật: file export 615 MB gồm 5.500 trang, 195 database và 735 ảnh, nhập xong trong khoảng 30 giây. Nếu có phần nào không nhập được, phần còn lại vẫn được nhập bình thường, và trang **⚠️ Báo cáo nhập dữ liệu** sẽ liệt kê từng lỗi kèm tên file.

## So sánh Freenote và Notion

| | **Freenote** | **Notion bản Free** ¹ |
|---|---|---|
| Giá | Miễn phí vĩnh viễn (MIT) | Miễn phí, trả phí để có thêm tính năng |
| Dữ liệu lưu ở đâu | Máy của bạn (một file SQLite) | Máy chủ cloud của Notion |
| Cần tài khoản | Không | Có |
| Dùng offline | Luôn luôn, đầy đủ | Một phần (offline cho các trang được chọn) |
| Số trang & block | Không giới hạn | Không giới hạn khi dùng một mình; bị giới hạn block khi workspace có từ 2 thành viên |
| Upload file | Không giới hạn (tuỳ dung lượng ổ đĩa) | 5 MB mỗi file |
| Lịch sử trang | 100 phiên bản mỗi trang, không giới hạn thời gian | 7 ngày |
| Sao lưu | Tự động hằng ngày, vào thư mục tuỳ chọn | Tự export bằng tay |
| Editor dạng block, trang lồng nhau, menu `/`, liên kết `@` | ✅ | ✅ |
| Database: bảng & board | ✅ | ✅ |
| Database: lịch, gallery, timeline, list | ❌ (có trong roadmap) | ✅ |
| Relation (liên kết) & rollup | ✅ | ✅ |
| Công thức | ❌ (có trong roadmap) | ✅ |
| Template | ✅ | ✅ |
| Import từ Notion | ✅ | — |
| Cộng tác thời gian thực, bình luận, chia sẻ | ❌ (một người dùng) | ✅ |
| Xuất bản trang lên web | ❌ | ✅ |
| App điện thoại | ❌ (có trong roadmap) | ✅ |
| Đồng bộ nhiều thiết bị | Thủ công, qua thư mục sao lưu ² | ✅ tự động |
| Tính năng AI | ❌ (không có kế hoạch) | Dùng thử có giới hạn |
| Tích hợp bên thứ ba / API | ❌ | ✅ |
| Mã nguồn mở, tự host được | ✅ | ❌ |

¹ Theo trang giá công khai của Notion tại thời điểm tháng 11/2026. Chính sách có thể thay đổi, xem [notion.com/pricing](https://www.notion.com/pricing).
² Trỏ thư mục sao lưu vào iCloud Drive, Google Drive hoặc Dropbox để có bản sao trên cloud. Đồng bộ trực tiếp giữa các thiết bị đang có trong roadmap.

**Tóm lại:** chọn Freenote nếu bạn cần một sổ ghi chú riêng tư, không giới hạn, dùng offline và hoàn toàn thuộc về bạn. Chọn Notion nếu bạn cần làm việc nhóm, app điện thoại hoặc tích hợp với dịch vụ khác.

## Tải về & cài đặt

**Cập nhật:** khi có phiên bản mới, sidebar hiện thông báo. Bấm **Cập nhật ngay**: Freenote tự tải đúng bản cho máy bạn, tự thay bản cũ và khởi động lại. App kiểm tra bản mới trên GitHub mỗi ngày một lần; có thể tắt trong Cài đặt → Phiên bản & cập nhật.


Vào **[Releases](../../releases/latest)** và tải bản phù hợp:

| Hệ điều hành | File |
|---|---|
| macOS chip Apple (M1–M4) | `Freenote-x.y.z-mac-arm64.dmg` |
| macOS chip Intel | `Freenote-x.y.z-mac-x64.dmg` |
| Windows | `Freenote-x.y.z-win-x64.exe` |
| Linux | `.AppImage` hoặc `.deb` |

### Cấu hình tối thiểu

**Không cần cài thêm gì.** Bản cài đã kèm sẵn mọi thứ Freenote cần (runtime và database). Không cần Node.js, không cần máy chủ database, không cần internet.

| | Tối thiểu | Khuyên dùng |
|---|---|---|
| **macOS** | 13 Ventura | 14 Sonoma trở lên |
| **Windows** | Windows 10 bản 64-bit | Windows 11 |
| **Linux** | 64-bit, ví dụ Ubuntu 22.04, Debian 12, Fedora 38 | bản mới hơn |
| **CPU** | 64-bit: x64 hoặc chip Apple (chưa có bản ARM cho Windows/Linux) | |
| **RAM** | 4 GB (bản thân Freenote dùng khoảng 200–300 MB) | 8 GB |
| **Ổ đĩa** | ~300 MB cho app, cộng dung lượng ghi chú và file đính kèm | SSD |

### Mở lần đầu (bản cài chưa ký số)

Bản cài **chưa được ký số** vì chứng chỉ ký có phí, nên lần đầu mở hệ điều hành sẽ cảnh báo:
- **macOS:** mở file `.dmg`, kéo **Freenote** vào Applications, rồi **chuột phải → Open → Open**. Nếu macOS báo "app bị hỏng", mở Terminal và chạy `xattr -cr /Applications/Freenote.app`.
- **Windows:** khi SmartScreen cảnh báo, chọn **More info → Run anyway**.
- **Linux (AppImage):** chạy `chmod +x Freenote-*.AppImage` rồi mở file. Một số bản Linux cần cài thêm `libfuse2` để chạy AppImage.

## Chạy từ mã nguồn

**Cần cài trước:**

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| [Node.js](https://nodejs.org) | **≥ 22.13** (khuyên dùng 24 LTS) | Đã kèm npm. SQLite có sẵn trong Node nên không cần trình biên dịch hay build tools |
| [Git](https://git-scm.com) | bất kỳ | để tải mã nguồn |

```bash
git clone https://github.com/thanhmam/freenote.git
cd freenote
npm install
npm run dev        # chế độ phát triển → http://localhost:3001
npm start          # bản production chạy trên trình duyệt
npm run desktop    # chạy dạng app desktop
npm run dist       # build bản cài cho hệ điều hành đang dùng → ./release
```
> ⚠️ Đừng đặt thư mục project trong iCloud/OneDrive/Dropbox vì chúng làm hỏng `node_modules`.

**Dữ liệu nằm ở:** macOS `~/Library/Application Support/FrntNotes/` · Windows `%APPDATA%\FrntNotes\` · Linux `~/.local/share/frnt-notes/`

## Đóng góp
Mọi đóng góp đều được hoan nghênh: dịch thêm ngôn ngữ, sửa lỗi, tính năng mới. Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép
[MIT](LICENSE): dùng miễn phí cho mọi mục đích. "Notion" là thương hiệu của Notion Labs, Inc. Freenote là dự án độc lập, không liên kết với Notion.
