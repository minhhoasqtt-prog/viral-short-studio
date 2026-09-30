// 🔔 BÁO LARK KHI XONG VIỆC — gửi 1 tin chữ vào nhóm Lark "TÔM" bằng BOT (không bằng user:
// tin của user bị cầu nối TÔM coi là lệnh). Chữ tiếng Việt đi qua STDIN (--data -) để cmd.exe không làm hỏng mã.
import { run } from "./util.mjs";
import { loadSettings } from "./settings.mjs";

const LARK = process.env.VSS_LARK_CLI || "lark-cli";
// Nhóm nhận tin: settings.local.json → { "notify": { "chatId": "oc_..." } } (hoặc biến VSS_LARK_NOTIFY_CHAT).
const chatId = () => (loadSettings().notify || {}).chatId || process.env.VSS_LARK_NOTIFY_CHAT || "";
const winArg = (s) => (process.platform === "win32" ? '"' + s.replace(/"/g, '\\"') + '"' : s);

export async function sendLarkText(text) {
  const CHAT = chatId();
  if (!CHAT) throw new Error("Chưa khai nhóm Lark nhận thông báo (Cấu hình → chat_id nhóm).");
  const body = JSON.stringify({ receive_id: CHAT, msg_type: "text", content: JSON.stringify({ text }) });
  const { out } = await run(LARK, ["api", "POST", "/open-apis/im/v1/messages",
    "--params", winArg(JSON.stringify({ receive_id_type: "chat_id" })), "--data", "-", "--as", "bot"],
  { input: body, shell: process.platform === "win32" });
  const i = out.indexOf("{");
  const j = i >= 0 ? JSON.parse(out.slice(i)) : null;
  if (!j || j.ok === false || (j.code && j.code !== 0)) throw new Error("Lark từ chối: " + out.slice(0, 300));
  return j;
}
