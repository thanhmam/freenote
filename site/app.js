// Freenote landing page: language switch, latest release, OS detection, screenshot swapping.
const REPO = "thanhmam/freenote";
const RELEASES = `https://github.com/${REPO}/releases/latest`;

// ── Vietnamese copy (English lives in the HTML) ──
const VI = {
  "nav.inside": "Có gì bên trong",
  "nav.compare": "So với Notion",
  "nav.move": "Chuyển từ Notion",
  "hero.kicker": 'Mã nguồn mở · dữ liệu trên máy bạn · v<span class="js-ver">0.8</span>',
  "hero.title": "Ghi chú của bạn.<br />Trên máy bạn.<br /><em>Không ràng buộc.</em>",
  "hero.lede": "Freenote là ứng dụng ghi chú miễn phí thay cho Notion, chạy hoàn toàn trên máy tính của bạn. Có trang, database, liên kết giữa các bảng, nhập từ Notion. Không cần tài khoản, không lên đám mây, không giới hạn số trang.",
  "cta.download": "Tải cho",
  "cta.other": "Hệ điều hành khác ↓",
  "hero.note": "Mọi thứ nằm trong <b>một file SQLite</b> trên ổ đĩa của bạn. Sao chép, sao lưu, giữ mãi mãi.",
  "inside.title": "Có gì bên trong",
  "inside.sub": "Những gì bạn dùng hằng ngày ở Notion, bỏ đi phần nằm trên máy chủ của người khác.",
  "f1.t": "Trình soạn thảo khối, gọn và nhanh",
  "f1.d": "Gõ <kbd>/</kbd> để chèn tiêu đề, việc cần làm, khối thu gọn, trích dẫn, code, bảng, ảnh và tệp. Kéo thả khối, lồng trang không giới hạn, liên kết trang bằng <kbd>@</kbd> và xem liên kết ngược.",
  "f2.t": "Database, có nhóm theo cột",
  "f2.d": "Dạng bảng và bảng Kanban, 10 kiểu thuộc tính, bộ lọc, sắp xếp nhiều cấp, phép tính cuối cột (tổng, trung bình, % hoàn thành) và nhiều view được lưu. Mỗi dòng là một trang đầy đủ.",
  "f3.t": "Liên kết (relation) & rollup",
  "f3.d": "Nối Công việc với Dự án theo hai chiều, rồi tổng hợp: đếm, cộng, hay “% việc đã Xong” kèm thanh tiến độ. Nhóm và lọc theo trang được liên kết.",
  "f4.t": "Sáng, tối, và của riêng bạn",
  "f4.d": "Ứng dụng cho macOS, Windows và Linux. Giao diện tiếng Việt và tiếng Anh. Mở cùng dữ liệu trong trình duyệt tại <code>localhost</code> khi app đang chạy.",
  "f5.t": "Không mất chữ nào",
  "f5.d": "Tự động lưu, 100 phiên bản cho mỗi trang và khôi phục một chạm, thùng rác, sao lưu tự động hằng ngày vào thư mục bất kỳ, kể cả iCloud Drive, Google Drive hay Dropbox.",
  "f6.t": "Thư viện mẫu dùng chung",
  "f6.d": "Mẫu soạn sẵn được duy trì công khai trên GitHub, tự đồng bộ vào app mà không cần cập nhật. Kèm danh sách các mẫu Notion nổi bật để bạn mang sang.",
  "bill.title": "Hóa đơn, nói thật",
  "bill.sub": "Freenote không phải Notion. Đây là những gì bạn có, và những gì bạn phải bỏ lại.",
  "r.sub": "một người · trọn đời",
  "r.pages": "Trang & khối",
  "r.upload": "Tải tệp lên",
  "r.upload.v": "tùy ổ đĩa",
  "r.history": "Lịch sử trang",
  "r.history.v": "100 bản",
  "r.backup": "Sao lưu",
  "r.backup.v": "tự động/ngày",
  "r.offline": "Không cần mạng",
  "r.offline.v": "luôn luôn",
  "r.account": "Tài khoản",
  "r.account.v": "không cần",
  "r.source": "Mã nguồn",
  "r.total": "0 đ",
  "r.totalLbl": "TỔNG",
  "r.foot": "CẢM ƠN QUÝ KHÁCH · GIỮ LẠI HÓA ĐƠN<br />(đó cũng là dữ liệu của bạn)",
  "c.data": "Dữ liệu nằm ở đâu",
  "c.data.f": "Máy của bạn",
  "c.data.n": "Máy chủ Notion",
  "c.account": "Cần tài khoản",
  "c.no": "Không",
  "c.yes": "Có",
  "c.offline": "Dùng khi không có mạng",
  "c.offline.f": "Hoàn toàn",
  "c.offline.n": "Một phần",
  "c.upload": "Tải tệp lên",
  "c.upload.f": "Không giới hạn",
  "c.upload.n": "5 MB mỗi tệp",
  "c.history": "Lịch sử trang",
  "c.history.f": "100 phiên bản",
  "c.history.n": "7 ngày",
  "c.db": "Bảng, Kanban, relation, rollup",
  "c.import": "Nhập từ Notion",
  "c.oss": "Mã nguồn mở",
  "c.collab": "Cộng tác thời gian thực, bình luận",
  "c.mobile": "App di động, đồng bộ tự động",
  "c.roadmap": "đang lên kế hoạch",
  "c.views": "Lịch, timeline, công thức",
  "c.integr": "Tích hợp, API, AI",
  "c.fine": "¹ Theo trang giá công khai của Notion, tháng 11/2026. Gói cước có thể thay đổi. <b>Tóm lại:</b> chọn Freenote nếu bạn muốn một cuốn sổ riêng tư, không giới hạn, hoàn toàn thuộc về bạn; chọn Notion nếu bạn cần làm việc nhóm, app di động hoặc tích hợp.",
  "move.title": "Rời Notion chỉ cần bốn bước",
  "move.sub": "Freenote đọc đúng file xuất của Notion, nên không cần mật khẩu, API key hay tiện ích trình duyệt nào.",
  "s1": 'Trong Notion, mở <span class="path mono">Settings → General → Export all workspace content</span>.',
  "s2": 'Chọn <span class="path mono">Markdown &amp; CSV</span> và <span class="path mono">Include subpages</span>.',
  "s3": 'Lưu file <span class="path mono">.zip</span> Notion gửi qua email. Không cần giải nén.',
  "s4": 'Trong Freenote: <span class="path mono">Cài đặt → Nhập → Từ Notion</span>. Xong.',
  "p.export": "file xuất",
  "p.pages": "trang",
  "p.dbs": "database",
  "p.time": "để nhập",
  "move.fine": "Đã thử trên một workspace thật. Database bị Notion xuất thiếu bảng sẽ được dựng lại từ các dòng, và mọi thứ không nhập được đều được liệt kê trong báo cáo nhập, không bao giờ bị bỏ qua âm thầm.",
  "dl.title": "Tải Freenote",
  "dl.latest": "Mới nhất",
  "dl.changes": "có gì mới ↗",
  "dl.arm": "Apple Silicon (M1–M4)",
  "dl.win": "10 / 11, 64-bit",
  "dl.n1": "<b>Không cần cài gì thêm.</b> App đã kèm sẵn môi trường chạy và cơ sở dữ liệu. Chiếm khoảng 300 MB ổ đĩa, 200–300 MB bộ nhớ.",
  "dl.n2": "<b>Lần mở đầu tiên:</b> bản cài chưa được ký số. Trên macOS, chuột phải vào app → <i>Open</i>. Trên Windows, chọn <i>More info → Run anyway</i>. Từ đó về sau Freenote tự cập nhật.",
  "dl.n3": "<b>Bạn là lập trình viên?</b> <code>git clone</code>, <code>npm install</code>, <code>npm start</code>. Chỉ cần Node 22.13 trở lên.",
  "foot.big": "Viết ra.<br /><em>Giữ lấy.</em>",
  "foot.contrib": "Đóng góp",
  "foot.issue": "Báo lỗi",
  "foot.fine": "Notion là thương hiệu của Notion Labs, Inc. Freenote là dự án độc lập, không liên kết với Notion.",
};
const META = {
  en: {
    title: "Freenote — free notes that live on your computer",
    stamp: "FREE FOREVER ✦ MIT LICENSE ✦ WORKS OFFLINE ✦",
    stampC: "$0",
    ticker: "NO ACCOUNT ✕ NO CLOUD ✕ NO TRACKING ✕ NO AI UPSELL ✕ NO PAGE LIMITS ✕ NO 5 MB UPLOAD CAP ✕ NO 7-DAY HISTORY ✕ ",
    your: "your computer",
    figs: { editor: "fig. — the editor", tasks: "fig. — tasks grouped by project", projects: "fig. — projects with a completion rollup", board: "fig. — board view, dark theme" },
    meta: (v, size) => `v${v} · ${size}`,
  },
  vi: {
    title: "Freenote — ghi chú miễn phí, nằm trên máy bạn",
    stamp: "MIỄN PHÍ ✦ GIẤY PHÉP MIT ✦ KHÔNG CẦN MẠNG ✦",
    stampC: "0đ",
    ticker: "KHÔNG TÀI KHOẢN ✕ KHÔNG ĐÁM MÂY ✕ KHÔNG THEO DÕI ✕ KHÔNG ÉP MUA AI ✕ KHÔNG GIỚI HẠN TRANG ✕ KHÔNG GIỚI HẠN 5 MB ✕ KHÔNG CHỈ 7 NGÀY LỊCH SỬ ✕ ",
    your: "máy của bạn",
    figs: { editor: "hình — trình soạn thảo", tasks: "hình — công việc nhóm theo dự án", projects: "hình — dự án với rollup % hoàn thành", board: "hình — dạng bảng Kanban, giao diện tối" },
    meta: (v, size) => `v${v} · ${size}`,
  },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const EN = {};
$$("[data-i18n]").forEach((el) => (EN[el.dataset.i18n] = el.innerHTML));

let lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("lang") || (/^vi\b/i.test(navigator.language) ? "vi" : "en");
let release = null;
let os = detectOS();

function setLang(l) {
  lang = l === "vi" ? "vi" : "en";
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  document.title = META[lang].title;
  $$("[data-i18n]").forEach((el) => {
    const k = el.dataset.i18n;
    el.innerHTML = lang === "vi" && VI[k] != null ? VI[k] : EN[k];
  });
  $$("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $(".js-stamp").textContent = META[lang].stamp;
  $(".stamp-c").textContent = META[lang].stampC;
  $(".js-ticker").textContent = META[lang].ticker.repeat(4);
  $$(".js-shot").forEach((img) => (img.src = `img/${img.dataset.shot}-${lang}.webp`));
  renderRelease();
  setCaption();
}

// ── OS detection ──
function detectOS() {
  const ua = navigator.userAgent, p = navigator.userAgentData?.platform || navigator.platform || "";
  if (/Win/i.test(p) || /Windows/.test(ua)) return "win-x64";
  if (/Mac/i.test(p) || /Mac OS X/.test(ua)) {
    // Intel Macs report no GPU like "Apple M"; WebGL renderer is the most reliable hint
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      const r = gl && gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL || gl.RENDERER);
      if (r && /Intel|AMD|Radeon/i.test(r) && !/Apple/i.test(r)) return "mac-x64";
    } catch {}
    return "mac-arm64";
  }
  if (/Android|iPhone|iPad/i.test(ua)) return null;
  if (/Linux/i.test(p) || /Linux/.test(ua)) return /Ubuntu|Debian/i.test(ua) ? "linux-deb" : "linux-AppImage";
  return null;
}
const OS_LABEL = { "mac-arm64": "macOS", "mac-x64": "macOS (Intel)", "win-x64": "Windows", "linux-AppImage": "Linux", "linux-deb": "Linux (.deb)" };
const assetFor = (key) => {
  if (!release) return null;
  const re = {
    "mac-arm64": /mac-arm64\.dmg$/, "mac-x64": /mac-x64\.dmg$/, "win-x64": /win-x64\.exe$/,
    "linux-AppImage": /\.AppImage$/, "linux-deb": /\.deb$/,
  }[key];
  return release.assets.find((a) => re.test(a.name));
};
const mb = (n) => `${Math.round(n / 1048576)} MB`;

function renderRelease() {
  const v = release?.tag_name?.replace(/^v/, "") || "0.8.0";
  $$(".js-ver").forEach((e) => (e.textContent = v.split(".").slice(0, 2).join(".")));
  $(".js-ver-full").textContent = "v" + v;
  if (release?.published_at)
    $(".js-date").textContent = new Date(release.published_at).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  const primary = $(".js-primary");
  const a = os && assetFor(os);
  $(".js-os").textContent = os ? OS_LABEL[os] : META[lang].your;
  primary.href = a ? a.browser_download_url : RELEASES;
  $(".js-primary-meta").textContent = a ? META[lang].meta(v, mb(a.size)) : "GitHub Releases";
  $$(".js-dl li").forEach((li) => {
    li.classList.toggle("mine", li.dataset.os === os);
    const asset = assetFor(li.dataset.os);
    const link = $("a", li);
    if (asset) link.href = asset.browser_download_url;
    let size = $(".size", li);
    if (asset && !size) { size = document.createElement("span"); size.className = "size mono"; li.insertBefore(size, link); }
    if (size && asset) size.textContent = mb(asset.size);
  });
}

async function loadRelease() {
  const cached = JSON.parse(sessionStorage.getItem("rel") || "null");
  if (cached) { release = cached; return renderRelease(); }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return;
    const j = await r.json();
    release = { tag_name: j.tag_name, published_at: j.published_at, assets: j.assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })) };
    sessionStorage.setItem("rel", JSON.stringify(release));
    renderRelease();
  } catch {}
}

// ── ledger: swap the pinned screenshot as rows scroll past ──
let current = "editor", currentIdx = 0;
function setCaption() {
  const cap = $(".js-ledger-cap");
  if (cap) cap.textContent = META[lang].figs[current].replace("—", `0${currentIdx + 1} —`);
}
function showShot(li) {
  const items = $$(".ledger li");
  items.forEach((x) => x.classList.toggle("on", x === li));
  currentIdx = items.indexOf(li);
  const shot = li.dataset.shot;
  setCaption();
  if (shot === current) return;
  current = shot;
  const img = $(".js-ledger-img");
  img.classList.add("swap");
  setTimeout(() => {
    img.dataset.shot = shot;
    img.src = `img/${shot}-${lang}.webp`;
    img.onload = () => img.classList.remove("swap");
    setCaption();
  }, 180);
}
const ledgerIO = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && showShot(e.target)), { rootMargin: "-45% 0px -50% 0px" });
$$(".ledger li").forEach((li) => { ledgerIO.observe(li); li.addEventListener("mouseenter", () => showShot(li)); });

// ── reveal on scroll ──
const revealIO = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), revealIO.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" });
$$(".sec-head, .ledger li, .receipt, .compare-wrap, .steps li, .proof div, .dl-list li").forEach((el) => { el.classList.add("reveal"); revealIO.observe(el); });

addEventListener("scroll", () => $(".bar").classList.toggle("scrolled", scrollY > 10), { passive: true });
$$("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

setLang(lang);
loadRelease();
