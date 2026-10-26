Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 1. Klasor ici kisayol
Set lnkLocal = WshShell.CreateShortcut(strDir & "\LexiMind - Kelime Defteri.lnk")
lnkLocal.TargetPath = "wscript.exe"
lnkLocal.Arguments = Chr(34) & strDir & "\Sessiz_Masaustu_Baslat.vbs" & Chr(34)
lnkLocal.WorkingDirectory = strDir
lnkLocal.IconLocation = strDir & "\assets\icon.ico, 0"
lnkLocal.Description = "LexiMind - Akilli Ingilizce Kelime Defteri"
lnkLocal.Save

' 2. Masaustu kisayolu
desktopPath = WshShell.SpecialFolders("Desktop")
Set lnkDesktop = WshShell.CreateShortcut(desktopPath & "\LexiMind - Kelime Defteri.lnk")
lnkDesktop.TargetPath = "wscript.exe"
lnkDesktop.Arguments = Chr(34) & strDir & "\Sessiz_Masaustu_Baslat.vbs" & Chr(34)
lnkDesktop.WorkingDirectory = strDir
lnkDesktop.IconLocation = strDir & "\assets\icon.ico, 0"
lnkDesktop.Description = "LexiMind - Akilli Ingilizce Kelime Defteri"
lnkDesktop.Save

MsgBox "LexiMind simgeli masaustu kisayolu basariyla olusturuldu!", 64, "LexiMind"