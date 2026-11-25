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

const REPO = "https://github.com/thanhmam/frnt-notes";
/** "Plain **bold** text" → BlockNote inline content with bold runs. */
const rich = (str) =>
  str.split("**").map((text, i) => ({ type: "text", text, styles: i % 2 ? { bold: true } : {} })).filter((r) => r.text);
const P = (str) => ({ type: "paragraph", content: rich(str) });
const B = (str) => ({ type: "bulletListItem", content: rich(str) });
const N = (str) => ({ type: "numberedListItem", content: rich(str) });
const quote = (str) => ({ type: "quote", content: rich(str) });
const toggle = (str, children) => ({ type: "toggleListItem", content: rich(str), children });
const link = (before, label, href, after = "") => ({
  type: "paragraph",
  content: [...rich(before), { type: "link", href, content: [{ type: "text", text: label, styles: {} }] }, ...rich(after)],
});
const table = (rows) => ({
  type: "table",
  content: { type: "tableContent", headerRows: 1, rows: rows.map((cells) => ({ cells: cells.map((c) => ({ type: "tableCell", content: rich(c) })) })) },
});

const WELCOME = {
  en: {
    title: "Welcome to Frnt 👋",
    content: [
      P("**Frnt (Free Notes)** is a free, open-source alternative to Notion. Your notes live on your own computer, and there are no paid plans, ever."),
      quote("No account. No limits. No subscription. Your notes are one file on your own disk."),
      h(2, "Why Frnt?"),
      B("💸 **100% free.** No paid tiers, no ads, no trial. Open source under the MIT license."),
      B("🔒 **Your data stays yours.** Stored on your computer, no sign-up, works completely offline."),
      B("♾️ **No limits.** Unlimited pages, blocks and file uploads."),
      B("🕘 **Nothing gets lost.** Version history for every page, plus automatic daily backups."),
      B("📥 **Easy move from Notion.** Import your whole workspace from Notion's export .zip."),
      h(2, "Frnt vs Notion Free"),
      table([
        ["", "**Frnt**", "**Notion Free**"],
        ["Price", "Free forever", "Free with limits, paid plans"],
        ["Your data", "On your computer", "On Notion's servers"],
        ["Account", "Not needed", "Required"],
        ["File uploads", "Unlimited", "5 MB per file"],
        ["Page history", "No time limit", "7 days"],
        ["Offline", "Always", "Partly"],
        ["Open source", "✅", "❌"],
      ]),
      toggle("What Notion has that Frnt doesn't (yet)", [
        B("Real-time collaboration, comments and sharing (Frnt is single-user)"),
        B("Mobile apps and automatic sync between devices"),
        B("Calendar, gallery and timeline views; formulas and relations"),
        B("AI features and third-party integrations"),
      ]),
      h(2, "Core features"),
      B("**Block editor**: type / for headings, to-dos, toggles, tables, images, code…"),
      B("**Nested pages** with icons, covers, breadcrumbs and favourites"),
      B("**Databases**: table and Kanban board, 10 property types, filters and sorts"),
      B("**Search everything** with ⌘K / Ctrl+K"),
      B("**Templates**, backlinks, English and Tiếng Việt interface, light and dark themes"),
      h(2, "Quick start"),
      todo("Type / to insert a block, @ to link another page"),
      todo("Drag the ⋮⋮ handle on the left of a block to move it"),
      todo("Hover a page in the sidebar and click + to add a sub-page"),
      todo("Drag the sidebar's right edge to resize it"),
      todo("Open a template under Templates in the sidebar, then click “Use this template”"),
      h(2, "Moving from Notion"),
      N("In Notion: **Settings → General → Export all workspace content**"),
      N("Choose **Markdown & CSV** and **Include subpages**, then download the .zip (no need to unzip)"),
      N("In Frnt: **Settings → Import → From Notion (.zip)**"),
      h(2, "Your data"),
      B("Everything is stored in a single SQLite file on your computer"),
      B("Automatic daily backups (30 kept). Point the backup folder to iCloud or Google Drive in **Settings**"),
      B("Desktop app: **🌐 Open in browser** (sidebar) opens the same notes in your web browser"),
      link("Frnt is a community project. Ideas, bug reports and contributions are welcome on ", "GitHub", REPO, "."),
    ],
  },
  vi: {
    title: "Chào mừng đến Frnt 👋",
    content: [
      P("**Frnt (Free Notes)** là ứng dụng ghi chú thay thế Notion: **miễn phí mãi mãi**, mã nguồn mở, và dữ liệu nằm trên chính máy của bạn."),
      quote("Không tài khoản. Không giới hạn. Không trả phí. Ghi chú của bạn là một file nằm trên ổ đĩa của bạn."),
      h(2, "Vì sao chọn Frnt?"),
      B("💸 **Miễn phí 100%.** Không có gói trả phí, không quảng cáo, không dùng thử. Mã nguồn mở theo giấy phép MIT."),
      B("🔒 **Dữ liệu là của bạn.** Lưu trên máy của bạn, không cần đăng ký, dùng offline hoàn toàn."),
      B("♾️ **Không giới hạn.** Không giới hạn số trang, số block hay dung lượng file đính kèm."),
      B("🕘 **Không lo mất dữ liệu.** Mỗi trang có lịch sử phiên bản, kèm sao lưu tự động mỗi ngày."),
      B("📥 **Chuyển từ Notion dễ dàng.** Nhập cả workspace từ file .zip export của Notion."),
      h(2, "Frnt và Notion bản Free"),
      table([
        ["", "**Frnt**", "**Notion Free**"],
        ["Giá", "Miễn phí mãi mãi", "Miễn phí có giới hạn, có gói trả phí"],
        ["Dữ liệu", "Trên máy của bạn", "Trên máy chủ của Notion"],
        ["Tài khoản", "Không cần", "Bắt buộc"],
        ["Upload file", "Không giới hạn", "5 MB mỗi file"],
        ["Lịch sử trang", "Không giới hạn thời gian", "7 ngày"],
        ["Offline", "Luôn luôn", "Một phần"],
        ["Mã nguồn mở", "✅", "❌"],
      ]),
      toggle("Những gì Notion có mà Frnt chưa có", [
        B("Cộng tác thời gian thực, bình luận, chia sẻ (Frnt dành cho một người dùng)"),
        B("App điện thoại và tự đồng bộ giữa nhiều thiết bị"),
        B("View lịch, gallery, timeline; công thức và relation"),
        B("Tính năng AI và tích hợp với dịch vụ khác"),
      ]),
      h(2, "Tính năng chính"),
      B("**Editor dạng block**: gõ / để chèn heading, todo, toggle, bảng, ảnh, code…"),
      B("**Trang lồng nhau** với icon, ảnh bìa, breadcrumb, mục yêu thích"),
      B("**Database**: view Bảng và Board (Kanban), 10 kiểu thuộc tính, lọc và sắp xếp"),
      B("**Tìm kiếm mọi thứ** với ⌘K / Ctrl+K, không phân biệt dấu"),
      B("**Template**, backlinks, giao diện tiếng Việt và English, chế độ sáng/tối"),
      h(2, "Bắt đầu nhanh"),
      todo("Gõ / để chèn block, gõ @ để liên kết tới trang khác"),
      todo("Kéo icon ⋮⋮ bên trái block để sắp xếp lại"),
      todo("Di chuột vào trang ở sidebar rồi bấm + để tạo trang con"),
      todo("Kéo mép phải sidebar để đổi độ rộng"),
      todo("Mở một template ở mục Mẫu (sidebar), rồi bấm “Dùng mẫu này”"),
      h(2, "Chuyển từ Notion sang"),
      N("Trong Notion: **Settings → General → Export all workspace content**"),
      N("Chọn **Markdown & CSV** và bật **Include subpages**, rồi tải file .zip về (không cần giải nén)"),
      N("Trong Frnt: **Cài đặt → Nhập dữ liệu → Từ Notion (.zip)**"),
      h(2, "Dữ liệu của bạn"),
      B("Mọi thứ được lưu trong một file SQLite trên máy của bạn"),
      B("Sao lưu tự động mỗi ngày (giữ 30 bản). Có thể trỏ thư mục sao lưu vào iCloud hoặc Google Drive trong **Cài đặt**"),
      B("Bản desktop: nút **🌐 Mở trong trình duyệt** (ở sidebar) mở cùng dữ liệu này trên trình duyệt web"),
      link("Frnt là dự án cộng đồng. Mọi góp ý, báo lỗi hay đóng góp code đều được chào đón trên ", "GitHub", REPO, "."),
    ],
  },
};

/** Welcome page content for a language (used by the seed and by scripts). */
export const welcomeContent = (lang = "en") => WELCOME[lang] || WELCOME.en;

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
