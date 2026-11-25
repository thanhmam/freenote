// Content created on first run: a welcome page and a few starter templates.
const p = (text) => ({ type: "paragraph", content: text });
const h = (level, text) => ({ type: "heading", props: { level }, content: text });
const todo = (text) => ({ type: "checkListItem", content: text });
const bullet = (text) => ({ type: "bulletListItem", content: text });

export function seedWelcome(createPage) {
  createPage({
    title: "Chào mừng đến Frnt Notes 👋",
    icon: "📘",
    content: [
      p("Frnt Notes là ứng dụng ghi chú kiểu Notion, mã nguồn mở, chạy hoàn toàn trên máy của bạn. Không giới hạn số trang hay số block."),
      h(2, "Bắt đầu nhanh"),
      todo("Gõ / để chèn block: heading, todo, toggle, bảng, ảnh, code, trang con, database…"),
      todo("Gõ @ để chèn liên kết tới một trang khác"),
      todo("Kéo icon ⋮⋮ bên trái block để sắp xếp lại"),
      todo("Nhấn ⌘K / Ctrl+K để tìm kiếm mọi trang"),
      todo("Di chuột vào trang ở sidebar rồi bấm + để tạo trang con"),
      todo("Mở một template ở mục Mẫu (sidebar), rồi bấm \"Dùng mẫu này\""),
      h(2, "Dữ liệu của bạn"),
      bullet("Mọi thứ được lưu trong một file SQLite trên máy của bạn"),
      bullet("Có sao lưu tự động mỗi ngày (giữ 30 bản). Xem ở Cài đặt & sao lưu"),
      bullet("Mỗi trang đều có Lịch sử phiên bản (menu ⋯ ở góc trên bên phải)"),
      p(""),
    ],
    text: "Bắt đầu nhanh",
  });
}

export function seedTemplates(createPage) {
  const t = (title, icon, content) =>
    createPage({ title, icon, content, is_template: 1, text: title, parent_id: null });

  t("Biên bản họp", "🗓️", [
    p("📅 Ngày: … · 👥 Thành phần: …"),
    h(2, "Mục tiêu"),
    bullet(""),
    h(2, "Nội dung thảo luận"),
    bullet(""),
    h(2, "Quyết định"),
    bullet(""),
    h(2, "Việc cần làm"),
    todo("… — người phụ trách — hạn"),
  ]);
  t("Nhật ký hằng ngày", "📔", [
    h(2, "🌅 Sáng nay"),
    p("Ba việc quan trọng nhất hôm nay:"),
    todo(""),
    todo(""),
    todo(""),
    h(2, "🌙 Cuối ngày"),
    p("Điều mình biết ơn:"),
    bullet(""),
    p("Điều học được:"),
    bullet(""),
  ]);
  t("Kế hoạch dự án", "🚀", [
    h(2, "Tổng quan"),
    p("Vấn đề cần giải quyết, mục tiêu và tiêu chí thành công."),
    h(2, "Phạm vi"),
    bullet("Làm: …"),
    bullet("Không làm: …"),
    h(2, "Mốc thời gian"),
    todo("Mốc 1 — ngày"),
    todo("Mốc 2 — ngày"),
    h(2, "Rủi ro"),
    bullet(""),
  ]);
  t("Ghi chú đọc sách", "📚", [
    p("✍️ Tác giả: … · ⭐ Đánh giá: …/5"),
    h(2, "Tóm tắt trong 3 câu"),
    p(""),
    h(2, "Ý tưởng chính"),
    bullet(""),
    h(2, "Trích dẫn hay"),
    { type: "quote", content: "" },
  ]);
}
