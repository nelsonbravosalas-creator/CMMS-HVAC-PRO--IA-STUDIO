Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class IdleBlocker {
    [Flags]
    public enum EXECUTION_STATE : uint {
        ES_CONTINUOUS = 0x80000000,
        ES_SYSTEM_REQUIRED = 0x00000001,
        ES_DISPLAY_REQUIRED = 0x00000002
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public MOUSEINPUT mi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("kernel32.dll")]
    public static extern EXECUTION_STATE SetThreadExecutionState(EXECUTION_STATE esFlags);

    public const uint INPUT_MOUSE = 0;
    public const uint MOUSEEVENTF_MOVE = 0x0001;

    public static uint MoveMouse(int dx, int dy) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].mi.dx = dx;
        inputs[0].mi.dy = dy;
        inputs[0].mi.mouseData = 0;
        inputs[0].mi.dwFlags = MOUSEEVENTF_MOVE;
        inputs[0].mi.time = 0;
        inputs[0].mi.dwExtraInfo = IntPtr.Zero;
        return SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static int GetLastError() {
        return Marshal.GetLastWin32Error();
    }
}
"@

$intervalSeconds = 20
$movePixels = 12
$logMoves = $false
$pauseStartBase = "13:30"
$pauseStartJitterMinutes = 5
$pauseEndBase = "14:40"
$pauseEndJitterMinutes = 10
$stopBase = "18:10"
$stopJitterMinutes = 4

function New-DailyPauseWindow {
    param(
        [datetime]$Date
    )

    $pauseStart = $Date.Date.Add([TimeSpan]::Parse($pauseStartBase)).
        AddMinutes((Get-Random -Minimum (-$pauseStartJitterMinutes) -Maximum ($pauseStartJitterMinutes + 1)))
    $pauseEnd = $Date.Date.Add([TimeSpan]::Parse($pauseEndBase)).
        AddMinutes((Get-Random -Minimum (-$pauseEndJitterMinutes) -Maximum ($pauseEndJitterMinutes + 1)))

    if ($pauseEnd -le $pauseStart) {
        $pauseEnd = $pauseEnd.AddDays(1)
    }

    [pscustomobject]@{
        Date = $Date.Date
        Start = $pauseStart
        End = $pauseEnd
    }
}

function New-DailyStopTime {
    param(
        [datetime]$Date
    )

    $Date.Date.Add([TimeSpan]::Parse($stopBase)).
        AddMinutes((Get-Random -Minimum (-$stopJitterMinutes) -Maximum ($stopJitterMinutes + 1)))
}

function Enable-KeepAwake {
    [IdleBlocker]::SetThreadExecutionState(
        [IdleBlocker+EXECUTION_STATE]::ES_CONTINUOUS -bor
        [IdleBlocker+EXECUTION_STATE]::ES_SYSTEM_REQUIRED -bor
        [IdleBlocker+EXECUTION_STATE]::ES_DISPLAY_REQUIRED
    ) | Out-Null
}

function Disable-KeepAwake {
    [IdleBlocker]::SetThreadExecutionState([IdleBlocker+EXECUTION_STATE]::ES_CONTINUOUS) | Out-Null
}

Write-Host "Mouse jiggler activo. Mueve el mouse cada $intervalSeconds segundos."
Write-Host "Movimiento configurado: $movePixels pixeles."
Write-Host "Pausa diaria: $pauseStartBase +/- $pauseStartJitterMinutes min hasta $pauseEndBase +/- $pauseEndJitterMinutes min."
Write-Host "Desactivacion diaria: $stopBase +/- $stopJitterMinutes min."
Write-Host "Presiona Ctrl+C para detener."

try {
    $pauseWindow = New-DailyPauseWindow -Date (Get-Date)
    $stopTime = New-DailyStopTime -Date (Get-Date)
    $keepAwakeEnabled = $false
    $pauseAnnounced = $false

    Write-Host ("Horario de pausa de hoy: {0:HH:mm} a {1:HH:mm}." -f $pauseWindow.Start, $pauseWindow.End)
    Write-Host ("Horario de desactivacion de hoy: {0:HH:mm}." -f $stopTime)

    while ($true) {
        $now = Get-Date

        if ($now.Date -ne $pauseWindow.Date) {
            $pauseWindow = New-DailyPauseWindow -Date $now
            $stopTime = New-DailyStopTime -Date $now
            $pauseAnnounced = $false
            Write-Host ("Horario de pausa de hoy: {0:HH:mm} a {1:HH:mm}." -f $pauseWindow.Start, $pauseWindow.End)
            Write-Host ("Horario de desactivacion de hoy: {0:HH:mm}." -f $stopTime)
        }

        if ($now -ge $stopTime) {
            Write-Host ("Hora de desactivacion alcanzada ({0:HH:mm})." -f $stopTime)
            break
        }

        if (($now -ge $pauseWindow.Start) -and ($now -lt $pauseWindow.End)) {
            if ($keepAwakeEnabled) {
                Disable-KeepAwake
                $keepAwakeEnabled = $false
            }

            if (-not $pauseAnnounced) {
                Write-Host ("Jiggler pausado hasta las {0:HH:mm}." -f $pauseWindow.End)
                $pauseAnnounced = $true
            }

            $secondsUntilResume = [math]::Max(1, [int]($pauseWindow.End - $now).TotalSeconds)
            Start-Sleep -Seconds ([math]::Min($secondsUntilResume, 60))
            continue
        }

        if (-not $keepAwakeEnabled) {
            Enable-KeepAwake
            $keepAwakeEnabled = $true

            if ($pauseAnnounced) {
                Write-Host "Jiggler reanudado."
                $pauseAnnounced = $false
            }
        }

        $moveRightResult = [IdleBlocker]::MoveMouse($movePixels, 0)
        Start-Sleep -Milliseconds 250
        $moveLeftResult = [IdleBlocker]::MoveMouse(-$movePixels, 0)

        if ($logMoves) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            if (($moveRightResult -eq 1) -and ($moveLeftResult -eq 1)) {
                Write-Host "[$timestamp] Mouse movido."
            }
            else {
                $lastError = [IdleBlocker]::GetLastError()
                Write-Warning "[$timestamp] SendInput no confirmo el movimiento. Resultado: $moveRightResult/$moveLeftResult. Error Windows: $lastError."
            }
        }

        Start-Sleep -Seconds $intervalSeconds
    }
}
finally {
    Disable-KeepAwake
    Write-Host "Mouse jiggler detenido."
}
