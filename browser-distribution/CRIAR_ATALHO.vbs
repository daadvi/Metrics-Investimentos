Option Explicit
Dim fs, sh, root, runtime, host, desktop, shortcut, runner, protocol, answer
Set fs = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fs.GetParentFolderName(WScript.ScriptFullName)
runtime = fs.BuildPath(fs.BuildPath(root,"runtime"),"node.exe")
host = fs.BuildPath(root,"browser-host.mjs")
If Not fs.FileExists(runtime) Or Not fs.FileExists(host) Then
 MsgBox "Esta pasta ainda nao e uma distribuicao completa. Baixe o ZIP gerado pelo GitHub Actions.", vbExclamation, "Metrics Investimentos"
 WScript.Quit 1
End If
desktop = sh.SpecialFolders("Desktop")
runner = fs.BuildPath(sh.ExpandEnvironmentStrings("%WINDIR%"),"System32\wscript.exe")
Set shortcut = sh.CreateShortcut(fs.BuildPath(desktop,"Metrics Investimentos.lnk"))
shortcut.TargetPath = runner
shortcut.Arguments = Chr(34) & fs.BuildPath(root,"INICIAR_METRICS.vbs") & Chr(34)
shortcut.WorkingDirectory = root
shortcut.Description = "Abrir Metrics Investimentos no navegador, sem Prompt de Comando"
If fs.FileExists(fs.BuildPath(root,"Metrics.ico")) Then shortcut.IconLocation = fs.BuildPath(root,"Metrics.ico") & ",0"
shortcut.Save
answer = MsgBox("Atalho criado na area de trabalho!" & vbCrLf & vbCrLf & "Tambem deseja associar o arquivo HTML ao iniciador do Metrics?" & vbCrLf & "Isso registra um protocolo local apenas para sua conta do Windows; o navegador podera pedir confirmacao ao abrir o HTML.", vbYesNo + vbQuestion, "Metrics Investimentos")
If answer = vbYes Then
 On Error Resume Next
 protocol = "HKCU\Software\Classes\metrics-investimentos-local\"
 sh.RegWrite protocol, "URL:Metrics Investimentos local", "REG_SZ"
 sh.RegWrite protocol & "URL Protocol", "", "REG_SZ"
 sh.RegWrite protocol & "DefaultIcon\", fs.BuildPath(root,"Metrics.ico") & ",0", "REG_SZ"
 sh.RegWrite protocol & "shell\open\command\", Chr(34) & runner & Chr(34) & " " & Chr(34) & fs.BuildPath(root,"INICIAR_METRICS.vbs") & Chr(34) & " " & Chr(34) & "%1" & Chr(34), "REG_SZ"
 If Err.Number <> 0 Then MsgBox "Atalho pronto, mas o registro do HTML foi bloqueado pelas configuracoes do Windows.", vbExclamation, "Metrics Investimentos"
 On Error GoTo 0
End If
MsgBox "Tudo pronto. Abra o atalho Metrics Investimentos na area de trabalho. Nao mova a pasta depois de criar o atalho.", vbInformation, "Metrics Investimentos"
