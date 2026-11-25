import { useEffect, useMemo, useRef } from "react";
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import {
  useCreateBlockNote,
  createReactBlockSpec,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { api } from "./api.js";
import { store, usePages, navigate, pageTitle, extractText } from "./store.js";
import DatabaseView from "./db/DatabaseView.jsx";
import { createDatabase } from "./db/dbUtils.js";

// "Page" block: a live link to another page (shows its current icon + title)
function PageLink({ pageId }) {
  const { byId } = usePages();
  const p = byId[pageId];
  return (
    <div
      className="page-link-block"
      contentEditable={false}
      onClick={() => p && navigate(pageId)}
      title={p ? "Mở trang" : "Trang đã bị xoá"}
    >
      <span>{p ? p.icon || "📄" : "🚫"}</span>
      <span className={p ? "plb-title" : "plb-title muted"}>{p ? pageTitle(p) : "Trang không tồn tại"}</span>
    </div>
  );
}

const PageBlock = createReactBlockSpec(
  { type: "page", propSchema: { pageId: { default: "" } }, content: "none" },
  { render: ({ block }) => <PageLink pageId={block.props.pageId} /> }
);

// Inline database block: renders the full interactive database view inside the page
const DatabaseBlock = createReactBlockSpec(
  { type: "database", propSchema: { dbId: { default: "" } }, content: "none" },
  {
    render: ({ block }) => (
      <div className="db-block" contentEditable={false}>
        <DatabaseView dbId={block.props.dbId} inline />
      </div>
    ),
  }
);

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, page: PageBlock(), database: DatabaseBlock() },
});

export default function Editor({ page, theme, onSaving, onSaved }) {
  const timer = useRef(null);
  const pending = useRef(null);

  const editor = useCreateBlockNote({
    schema,
    initialContent: Array.isArray(page.content) && page.content.length ? page.content : undefined,
    uploadFile: (file) => api.upload(file),
  });

  const flush = async () => {
    clearTimeout(timer.current);
    if (!pending.current) return;
    const doc = pending.current;
    pending.current = null;
    try {
      const r = await api.update(page.id, { content: doc, text: extractText(doc).join(" ") });
      store.patch(page.id, { updated_at: r.updated_at });
      onSaved?.();
    } catch (e) {
      console.error(e);
      onSaving?.("error");
    }
  };

  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush(); // save on page switch
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = () => {
    pending.current = editor.document;
    onSaving?.("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  // Expose editor to parent (focus from title, markdown export)
  useEffect(() => {
    window.__editor = editor;
  }, [editor]);

  const slashItems = useMemo(
    () => (query) =>
      filterSuggestionItems(
        [
          {
            title: "Trang con",
            subtext: "Tạo một trang con lồng bên trong trang này",
            aliases: ["page", "subpage", "trang"],
            group: "Trang",
            icon: <span style={{ fontSize: 16 }}>📄</span>,
            onItemClick: async () => {
              const child = await api.create({ parent_id: page.id });
              store.setPages(await api.list());
              insertOrUpdateBlockForSlashMenu(editor, { type: "page", props: { pageId: child.id } });
              await flush();
              navigate(child.id);
            },
          },
          {
            title: "Database – Inline",
            subtext: "Bảng/Board nhúng ngay trong trang này",
            aliases: ["database", "db", "table", "bang", "board", "kanban"],
            group: "Database",
            icon: <span style={{ fontSize: 16 }}>🗃️</span>,
            onItemClick: async () => {
              const db = await createDatabase(page.id);
              insertOrUpdateBlockForSlashMenu(editor, { type: "database", props: { dbId: db.id } });
              await flush();
            },
          },
          {
            title: "Database – Toàn trang",
            subtext: "Tạo database thành một trang con riêng",
            aliases: ["database", "db", "fullpage"],
            group: "Database",
            icon: <span style={{ fontSize: 16 }}>📊</span>,
            onItemClick: async () => {
              const db = await createDatabase(page.id);
              insertOrUpdateBlockForSlashMenu(editor, { type: "page", props: { pageId: db.id } });
              await flush();
              navigate(db.id);
            },
          },
          ...getDefaultReactSlashMenuItems(editor),
        ],
        query
      ),
    [editor, page.id]
  );

  const mentionItems = (query) =>
    filterSuggestionItems(
      store
        .get()
        .pages.filter((p) => p.id !== page.id)
        .map((p) => ({
          title: pageTitle(p),
          group: "Liên kết tới trang",
          icon: <span>{p.icon || "📄"}</span>,
          onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "page", props: { pageId: p.id } }),
        })),
      query
    ).slice(0, 12);

  return (
    <BlockNoteView editor={editor} theme={theme} onChange={onChange} slashMenu={false}>
      <SuggestionMenuController triggerCharacter="/" getItems={async (q) => slashItems(q)} />
      <SuggestionMenuController triggerCharacter="@" getItems={async (q) => mentionItems(q)} />
    </BlockNoteView>
  );
}
