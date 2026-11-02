Option Explicit
Dim files, shell, home, runtime, host, command
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
home = files.GetParentFolderName(WScript.ScriptFullName)
runtime = files.BuildPath(files.BuildPath(home,"runtime"),"node.exe")
host = files.BuildPath(home,"browser-host.mjs")
If Not files.FileExists(runtime) Then
  MsgBox "O Node portatil nao foi encontrado. Baixe a pasta completa do GitHub Actions e extraia todos os arquivos.", vbExclamation, "Metrics Investimentos"
  WScript.Quit 1
End If
If Not files.FileExists(host) Then
  MsgBox "O arquivo browser-host.mjs esta ausente.", vbExclamation, "Metrics Investimentos"
  WScript.Quit 1
End If
command = Chr(34) & runtime & Chr(34) & " " & Chr(34) & host & Chr(34)
shell.CurrentDirectory = home
shell.Run command, 0, False
