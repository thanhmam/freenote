# Frnt Template Library

Templates in this folder appear in every Frnt app under **📚 Template library**.
Apps download `index.json` (and a template only when someone installs it) from
`https://raw.githubusercontent.com/thanhmam/frnt-notes/main/library`.
So a template becomes available to everyone as soon as it is pushed to `main`, with no app update needed.

## Add or update a template (maintainers)

1. **Build the page in Frnt.** It can contain sub-pages, databases (with views, groups, sample rows) and images.
2. Open the page's **⋯ menu → Export as library template…**, fill in the title, a one-sentence description, a category and a language, then download the `.json` file.
3. Put the file in `library/templates/`. The file name doesn't matter; the template `id` inside does.
   - To **update** a template, export it again with the same title (same id) and replace the file. Apps show it as **New** to users who have seen the old version.
4. Run:
   ```bash
   npm run library:build
   ```
   This validates every template and regenerates `library/index.json`.
5. Commit and push to `main`. Users see it the next time they open the library or click **Check for updates**.

Rules: `id` must be lowercase letters, digits and dashes and unique. Keep templates small (a few MB at most) and don't include personal data.
Categories: `Work`, `Projects`, `Personal`, `Education`, `Other`. Languages: `en`, `vi`; add a translated copy for each language.

## Thêm hoặc cập nhật mẫu (tiếng Việt)

1. Tạo trang mẫu trong Frnt. Trang có thể gồm trang con, database (view, nhóm, hàng mẫu) và ảnh.
2. Mở menu **⋯ → Xuất làm mẫu thư viện…**, điền tiêu đề, mô tả một câu, danh mục và ngôn ngữ, rồi tải file `.json` về.
3. Bỏ file vào `library/templates/`. Muốn **cập nhật** một mẫu thì xuất lại với cùng tiêu đề rồi ghi đè file cũ; người dùng sẽ thấy nhãn **Mới**.
4. Chạy `npm run library:build` để kiểm tra và tạo lại `library/index.json`.
5. Commit và push lên `main`. Người dùng thấy mẫu mới khi mở thư viện hoặc bấm **Kiểm tra cập nhật**.

## Package format (`frnt-template` v1)

```jsonc
{
  "format": "frnt-template", "version": 1,
  "id": "task-tracker", "title": "Task tracker", "description": "…",
  "category": "Projects", "lang": "en", "icon": "✅", "author": "Frnt", "updated": "2026-11-25",
  "pages": [ { "key": "<old id>", "parent": null, "kind": "database", "title": "…", "content": [/* BlockNote blocks */], "db_schema": {…}, "props": {…} } ],
  "assets": { "/uploads/<file>": { "name": "…", "type": "image/png", "data": "<base64>" } }
}
```
On install, every page gets a new id, links between the template's pages are re-pointed, images are copied into the user's `uploads/`, and links are restricted to `http(s)`, `mailto` and internal pages.
