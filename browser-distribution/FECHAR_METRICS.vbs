Option Explicit
Dim files, shell, home, runtime, host
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
home = files.GetParentFolderName(WScript.ScriptFullName)
runtime = files.BuildPath(files.BuildPath(home,"runtime"),"node.exe")
host = files.BuildPath(home,"browser-host.mjs")
If files.FileExists(runtime) And files.FileExists(host) Then
  shell.CurrentDirectory = home
  shell.Run Chr(34) & runtime & Chr(34) & " " & Chr(34) & host & Chr(34) & " --stop", 0, True
End If
