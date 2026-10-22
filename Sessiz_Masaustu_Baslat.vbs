Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

py314 = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python314\pythonw.exe")
py312 = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Programs\Python\Python312\pythonw.exe")

If fso.FileExists(py314) Then
    WshShell.Run Chr(34) & py314 & Chr(34) & " app.py", 0, False
ElseIf fso.FileExists(py312) Then
    WshShell.Run Chr(34) & py312 & Chr(34) & " app.py", 0, False
Else
    WshShell.Run "py app.py", 0, False
End If