const express = require('express');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Run a PowerShell script via temp file
function ps(script) {
  const tmp = path.join(os.tmpdir(), `macdeck-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  try {
    fs.writeFileSync(tmp, '﻿' + script, 'utf8'); // BOM for UTF-8
    return execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmp
    ], { encoding: 'utf8', windowsHide: true }).trim();
  } catch { return ''; }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}

// Windows audio COM types (speaker)
const AUDIO_COM = (flow = 0) => `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
  int N1();int N2();int N3();int N4();
  int SetMasterVolumeLevelScalar(float f, System.Guid g);
  int N6();
  int GetMasterVolumeLevelScalar(out float f);
  int N8();int N9();int N10();int N11();int N12();int N13();
  int GetMute(out bool b);
  int SetMute(bool b, System.Guid g);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice { int Activate(ref System.Guid iid, int ctx, System.IntPtr p, out IAudioEndpointVolume pp); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator { int N1(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice d); }
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDEC {}
'@
$enum = [MMDEC] -as [IMMDeviceEnumerator]
$dev = $null; [void]$enum.GetDefaultAudioEndpoint(${flow},1,[ref]$dev)
$iid = [System.Guid]'5CDF2C82-841E-4546-9722-0CF74078229A'
$aev = $null; [void]$dev.Activate([ref]$iid,23,[System.IntPtr]::Zero,[ref]$aev)
`;

// Virtual key press (for media keys)
const VK_PRESS = (vk) => `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class KBD { [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, int flags, int extra); }
'@
[KBD]::keybd_event(${vk},0,0,0); [KBD]::keybd_event(${vk},0,2,0)
`;

// ── Status ────────────────────────────────────────────────────────────────────

app.get('/system/status', (req, res) => {
  const result = ps(`
    ${AUDIO_COM(0)}
    $vol = $null; [void]$aev.GetMasterVolumeLevelScalar([ref]$vol)
    $muted = $null; [void]$aev.GetMute([ref]$muted)

    $battery = $null; $charging = $false
    $b = Get-WmiObject Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($b) { $battery = $b.EstimatedChargeRemaining; $charging = $b.BatteryStatus -eq 2 }

    $dm = (Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name AppsUseLightTheme -ErrorAction SilentlyContinue).AppsUseLightTheme
    $darkMode = ($dm -eq 0)

    Add-Type @'
using System; using System.Runtime.InteropServices;
public class FW { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid); }
'@
    $hwnd = [FW]::GetForegroundWindow(); $pid2 = 0
    [FW]::GetWindowThreadProcessId($hwnd, [ref]$pid2) | Out-Null
    $activeApp = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName

    $runningApps = (Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty ProcessName) -join ','

    $out = @{
      volume = [Math]::Round($vol * 100)
      muted = $muted
      darkMode = $darkMode
      activeApp = $activeApp
      runningApps = if ($runningApps) { $runningApps -split ',' } else { @() }
    }
    if ($battery -ne $null) { $out.battery = [int]$battery; $out.charging = $charging }
    $out | ConvertTo-Json -Compress
  `);

  try { res.json(JSON.parse(result)); }
  catch { res.json({ volume: 50, muted: false }); }
});

// ── Volume ────────────────────────────────────────────────────────────────────

app.post('/volume', (req, res) => {
  const val = Math.max(0, Math.min(100, parseInt(req.body?.value ?? 50))) / 100.0;
  ps(`${AUDIO_COM(0)}\n[void]$aev.SetMasterVolumeLevelScalar(${val},[System.Guid]::Empty)`);
  res.json({ success: true });
});

app.post('/mute', (req, res) => {
  const muted = req.body?.muted ? '$true' : '$false';
  ps(`${AUDIO_COM(0)}\n[void]$aev.SetMute(${muted},[System.Guid]::Empty)`);
  res.json({ success: true });
});

app.post('/mic/mute', (req, res) => {
  const result = ps(`
    ${AUDIO_COM(1)}
    $m = $null; [void]$aev.GetMute([ref]$m)
    [void]$aev.SetMute(-not $m, [System.Guid]::Empty)
    (-not $m).ToString().ToLower()
  `);
  res.json({ success: true, micMuted: result === 'true' });
});

// ── Media keys ────────────────────────────────────────────────────────────────

app.post('/media/play-pause', (req, res) => { ps(VK_PRESS(0xB3)); res.json({ success: true }); });
app.post('/media/next',       (req, res) => { ps(VK_PRESS(0xB0)); res.json({ success: true }); });
app.post('/media/prev',       (req, res) => { ps(VK_PRESS(0xB1)); res.json({ success: true }); });

// ── Launch app ────────────────────────────────────────────────────────────────

app.post('/launch', (req, res) => {
  const name = (req.body?.app ?? '').replace(/'/g, "''");
  ps(`Start-Process '${name}' -ErrorAction SilentlyContinue`);
  res.json({ success: true });
});

// ── Keyboard shortcut ─────────────────────────────────────────────────────────

app.post('/shortcut', (req, res) => {
  const keys = req.body?.keys ?? [];
  const map = { cmd: '^', ctrl: '^', shift: '+', alt: '%', win: '^{ESC}' };
  const combo = keys.map(k => map[k] ?? `{${k.toUpperCase()}}`).join('');
  ps(`(New-Object -ComObject WScript.Shell).SendKeys('${combo}')`);
  res.json({ success: true });
});

// ── System actions ────────────────────────────────────────────────────────────

app.post('/system/lock', (req, res) => {
  ps(`& "$env:SystemRoot\\System32\\rundll32.exe" user32.dll,LockWorkStation`);
  res.json({ success: true });
});

app.post('/system/sleep', (req, res) => {
  ps(`Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend',$false,$false)`);
  res.json({ success: true });
});

app.post('/system/sleep-display', (req, res) => {
  ps(`
    Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class Disp { [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, int m, IntPtr w, IntPtr l); }
'@
    [Disp]::SendMessage([IntPtr](-1), 0x0112, [IntPtr]0xF170, [IntPtr]2) | Out-Null
  `);
  res.json({ success: true });
});

app.post('/system/screenshot', (req, res) => {
  ps(`
    Add-Type -Assembly System.Windows.Forms, System.Drawing
    $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $s.Width,$s.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size)
    $dir = "$env:USERPROFILE\\Pictures\\Screenshots"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $bmp.Save("$dir\\MacDeck_$(Get-Date -f 'yyyyMMdd_HHmmss').png")
    $g.Dispose(); $bmp.Dispose()
  `);
  res.json({ success: true });
});

app.post('/system/dark-mode', (req, res) => {
  const cur = ps(`(Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name AppsUseLightTheme -ErrorAction SilentlyContinue).AppsUseLightTheme`);
  const isDark = cur === '0';
  const next = isDark ? 1 : 0;
  ps(`
    $p = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
    Set-ItemProperty $p AppsUseLightTheme ${next}
    Set-ItemProperty $p SystemUsesLightTheme ${next}
  `);
  res.json({ success: true, darkMode: !isDark });
});

app.post('/system/dnd', (req, res) => {
  const cur = ps(`(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' -Name NOC_GLOBAL_SETTING_TOASTS_ENABLED -ErrorAction SilentlyContinue).NOC_GLOBAL_SETTING_TOASTS_ENABLED`);
  const next = cur === '0' ? 1 : 0;
  ps(`Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' NOC_GLOBAL_SETTING_TOASTS_ENABLED ${next} -Type DWord -Force`);
  res.json({ success: true });
});

app.post('/system/trash', (req, res) => {
  ps(`Clear-RecycleBin -Force -ErrorAction SilentlyContinue`);
  res.json({ success: true });
});

// ── Brightness ────────────────────────────────────────────────────────────────

app.get('/system/brightness', (req, res) => {
  const val = ps(`(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness -ErrorAction SilentlyContinue).CurrentBrightness`);
  res.json({ value: parseInt(val) || 50 });
});

app.post('/system/brightness', (req, res) => {
  const val = Math.max(0, Math.min(100, parseInt(req.body?.value ?? 50)));
  ps(`(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1,${val})`);
  res.json({ success: true });
});

// ── Audio devices ─────────────────────────────────────────────────────────────

app.get('/audio/devices', (req, res) => {
  res.json({ devices: [], current: '' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(3000, '0.0.0.0', () => {
  console.log('MacDeck Windows server running on http://localhost:3000');
  console.log('Open this URL on any device on your network: http://<your-windows-ip>:3000');
});
