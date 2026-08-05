import fs from "node:fs";
import { buildSelectPrompt } from "./lib/autoclip.mjs";
import { askClaude } from "./lib/ai.mjs";
const j = JSON.parse(fs.readFileSync("work/out/2026-07-07_092028-dji-20260706120356-0088-d/autoclip-1783390807422-1-transcript.json","utf-8"));
const segs = j.segments || [];
const fmtMS = (s)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const lines = segs.slice(0,60).map(s=>`[${fmtMS(s.start)}] ${s.text}`).join("\n");
console.log("Gửi 60 câu đầu cho Claude...");
try {
  const ans = await askClaude(buildSelectPrompt(lines, "", 50, ""), { onLog:()=>{} });
  console.log("=== CLAUDE TRẢ VỀ (400 ký tự đầu) ===");
  console.log(ans.slice(0,400));
  console.log("...tổng len:", ans.length);
} catch(e){ console.log("askClaude LỖI:", e.message); }
