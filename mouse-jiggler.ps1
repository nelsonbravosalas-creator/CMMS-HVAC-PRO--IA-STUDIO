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

    public static void MoveMouse(int dx, int dy) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].mi.dx = dx;
        inputs[0].mi.dy = dy;
        inputs[0].mi.mouseData = 0;
        inputs[0].mi.dwFlags = MOUSEEVENTF_MOVE;
        inputs[0].mi.time = 0;
        inputs[0].mi.dwExtraInfo = IntPtr.Zero;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@

$intervalSeconds = 20

Write-Host "Mouse jiggler activo. Mueve el mouse cada $intervalSeconds segundos."
Write-Host "Presiona Ctrl+C para detener."

try {
    [IdleBlocker]::SetThreadExecutionState(
        [IdleBlocker+EXECUTION_STATE]::ES_CONTINUOUS -bor
        [IdleBlocker+EXECUTION_STATE]::ES_SYSTEM_REQUIRED -bor
        [IdleBlocker+EXECUTION_STATE]::ES_DISPLAY_REQUIRED
    ) | Out-Null

    while ($true) {
        [IdleBlocker]::MoveMouse(3, 0)
        Start-Sleep -Milliseconds 250
        [IdleBlocker]::MoveMouse(-3, 0)
        Start-Sleep -Seconds $intervalSeconds
    }
}
finally {
    [IdleBlocker]::SetThreadExecutionState([IdleBlocker+EXECUTION_STATE]::ES_CONTINUOUS) | Out-Null
    Write-Host "Mouse jiggler detenido."
}
