' Dọn kho Viral Short Studio — chạy ẩn (không cửa sổ đen) cho Scheduled Task mỗi đêm.
' Gọi scripts/housekeep-cron.mjs (giữ nguồn 3 ngày, xoá nguồn cũ + file thô, ghi work/housekeep.log).
Option Explicit
Dim fso, sh, appDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = appDir
sh.Run "cmd /c node ""scripts\housekeep-cron.mjs""", 0, False
