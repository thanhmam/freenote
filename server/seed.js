// Content created on first run: a welcome page and a few starter templates, in English or Vietnamese.
const p = (text) => ({ type: "paragraph", content: text });
const h = (level, text) => ({ type: "heading", props: { level }, content: text });
const todo = (text) => ({ type: "checkListItem", content: text });
const bullet = (text) => ({ type: "bulletListItem", content: text });

/** Pick the seed language from FRNT_LANG, or the OS / Electron locale. */
export function detectLang(hint) {
  const l = (process.env.FRNT_LANG || hint || Intl.DateTimeFormat().resolvedOptions().locale || "en").slice(0, 2).toLowerCase();
  return l === "vi" ? "vi" : "en";
}

const WELCOME = {
  en: {
    title: "Welcome to Frnt 👋",
    content: [
      p("Frnt (Free Notes) is a free, open-source, Notion-style workspace that runs entirely on your computer. No limits on pages or blocks."),
      h(2, "Quick start"),
      todo("Type / to insert a block: heading, to-do, toggle, table, image, code, sub-page, database…"),
      todo("Type @ to link to another page"),
      todo("Drag the ⋮⋮ handle on the left of a block to move it"),
      todo("Press ⌘K / Ctrl+K to search every page"),
      todo("Hover a page in the sidebar and click + to add a sub-page"),
      todo("Open a template in the Templates section of the sidebar, then click “Use this template”"),
      h(2, "Your data"),
      bullet("Everything is stored in a single SQLite file on your computer"),
      bullet("Automatic daily backups (30 kept). See Settings"),
      bullet("Every page has a version history (⋯ menu, top right)"),
      bullet("Switch the interface language at the bottom of the sidebar (🌐 EN / VI)"),
      p(""),
    ],
  },
  vi: {
    title: "Chào mừng đến Frnt 👋",
    content: [
      p("Frnt (Free Notes) là ứng dụng ghi chú kiểu Notion, miễn phí, mã nguồn mở, chạy hoàn toàn trên máy của bạn. Không giới hạn số trang hay số block."),
      h(2, "Bắt đầu nhanh"),
      todo("Gõ / để chèn block: heading, todo, toggle, bảng, ảnh, code, trang con, database…"),
      todo("Gõ @ để chèn liên kết tới một trang khác"),
      todo("Kéo icon ⋮⋮ bên trái block để sắp xếp lại"),
      todo("Nhấn ⌘K / Ctrl+K để tìm kiếm mọi trang"),
      todo("Di chuột vào trang ở sidebar rồi bấm + để tạo trang con"),
      todo("Mở một template ở mục Mẫu (sidebar), rồi bấm “Dùng mẫu này”"),
      h(2, "Dữ liệu của bạn"),
      bullet("Mọi thứ được lưu trong một file SQLite trên máy của bạn"),
      bullet("Có sao lưu tự động mỗi ngày (giữ 30 bản). Xem ở Cài đặt"),
      bullet("Mỗi trang đều có Lịch sử phiên bản (menu ⋯ ở góc trên bên phải)"),
      bullet("Đổi ngôn ngữ giao diện ở cuối sidebar (🌐 EN / VI)"),
      p(""),
    ],
  },
};

const TEMPLATES = {
  en: [
    ["Meeting notes", "🗓️", [p("📅 Date: … · 👥 Attendees: …"), h(2, "Goals"), bullet(""), h(2, "Discussion"), bullet(""), h(2, "Decisions"), bullet(""), h(2, "Action items"), todo("… — owner — due date")]],
    ["Daily journal", "📔", [h(2, "🌅 Morning"), p("Three most important things today:"), todo(""), todo(""), todo(""), h(2, "🌙 Evening"), p("Grateful for:"), bullet(""), p("Lessons learned:"), bullet("")]],
    ["Project plan", "🚀", [h(2, "Overview"), p("The problem, the goal, and how we'll measure success."), h(2, "Scope"), bullet("In: …"), bullet("Out: …"), h(2, "Milestones"), todo("Milestone 1 — date"), todo("Milestone 2 — date"), h(2, "Risks"), bullet("")]],
    ["Book notes", "📚", [p("✍️ Author: … · ⭐ Rating: …/5"), h(2, "Summary in 3 sentences"), p(""), h(2, "Key ideas"), bullet(""), h(2, "Favourite quotes"), { type: "quote", content: "" }]],
  ],
  vi: [
    ["Biên bản họp", "🗓️", [p("📅 Ngày: … · 👥 Thành phần: …"), h(2, "Mục tiêu"), bullet(""), h(2, "Nội dung thảo luận"), bullet(""), h(2, "Quyết định"), bullet(""), h(2, "Việc cần làm"), todo("… — người phụ trách — hạn")]],
    ["Nhật ký hằng ngày", "📔", [h(2, "🌅 Sáng nay"), p("Ba việc quan trọng nhất hôm nay:"), todo(""), todo(""), todo(""), h(2, "🌙 Cuối ngày"), p("Điều mình biết ơn:"), bullet(""), p("Điều học được:"), bullet("")]],
    ["Kế hoạch dự án", "🚀", [h(2, "Tổng quan"), p("Vấn đề cần giải quyết, mục tiêu và tiêu chí thành công."), h(2, "Phạm vi"), bullet("Làm: …"), bullet("Không làm: …"), h(2, "Mốc thời gian"), todo("Mốc 1 — ngày"), todo("Mốc 2 — ngày"), h(2, "Rủi ro"), bullet("")]],
    ["Ghi chú đọc sách", "📚", [p("✍️ Tác giả: … · ⭐ Đánh giá: …/5"), h(2, "Tóm tắt trong 3 câu"), p(""), h(2, "Ý tưởng chính"), bullet(""), h(2, "Trích dẫn hay"), { type: "quote", content: "" }]],
  ],
};

export function seedWelcome(createPage, lang = "en") {
  const w = WELCOME[lang] || WELCOME.en;
  createPage({ title: w.title, icon: "📘", content: w.content, text: w.title });
}

export function seedTemplates(createPage, lang = "en") {
  for (const [title, icon, content] of TEMPLATES[lang] || TEMPLATES.en) {
    createPage({ title, icon, content, is_template: 1, text: title, parent_id: null });
  }
}
