param([string]$Version = '', [string]$InstallDir = '', [switch]$NoModifyPath)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -or $env:PROCESSOR_ARCHITEW6432) {
    throw 'Codeboard requires native x64 Windows PowerShell or PowerShell on Windows x64.'
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = 'https://github.com/nonomnonom/codeboard'
if (!$Version) { $Version = (Invoke-RestMethod 'https://api.github.com/repos/nonomnonom/codeboard/releases/latest').tag_name }
$Version = $Version -replace '^v', ''
if ($Version -notmatch '^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$') { throw 'Invalid release number' }
if (!$InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Codeboard' }
$root = [IO.Path]::GetFullPath($InstallDir)
$versions = Join-Path $root 'versions'
$bin = Join-Path $root 'bin'
$target = Join-Path $versions $Version
$launcher = Join-Path $bin 'codeboard.cmd'
New-Item -ItemType Directory -Force -Path $versions, $bin | Out-Null
$installLock = [IO.File]::Open((Join-Path $root '.install-lock'), 'OpenOrCreate', 'ReadWrite', 'None')
try {
if (Test-Path -LiteralPath $launcher) {
    if ((Get-Item -LiteralPath $launcher).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing to replace a symlink: $launcher" }
    if (!(Select-String -LiteralPath $launcher -SimpleMatch 'rem Managed by the Codeboard installer' -Quiet)) { throw "$launcher is not managed by this installer" }
}
$stage = Join-Path $root ('.install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    if (Test-Path -LiteralPath $target) {
        if (!(Test-Path -LiteralPath (Join-Path $target '.codeboard-install'))) { throw "$target already exists and is not an installed release" }
        $installed = & (Join-Path $target 'codeboard.cmd') --version
        if ($LASTEXITCODE -ne 0 -or $installed.Trim() -ne $Version) { throw 'Installed version is damaged; remove that version directory and retry' }
    } else {
        $name = "codeboard-$Version-windows-x64"
        $asset = "$name.zip"
        $archive = Join-Path $stage $asset
        $base = "$repo/releases/download/v$Version"
        Write-Host "Downloading Codeboard $Version for Windows x64..."
        Invoke-WebRequest "$base/$asset" -OutFile $archive -UseBasicParsing
        $checksumFile = Join-Path $stage 'SHA256SUMS'
        Invoke-WebRequest "$base/SHA256SUMS" -OutFile $checksumFile -UseBasicParsing
        $sums = Get-Content -LiteralPath $checksumFile -Raw
        $lines = @($sums -split '\r?\n' | Where-Object { $_ -match ('^([a-fA-F0-9]{64})\s+' + [regex]::Escape($asset) + '$') })
        if ($lines.Count -ne 1) { throw 'Missing or ambiguous checksum' }
        $expected = ($lines[0] -split '\s+')[0]
        $sha = [Security.Cryptography.SHA256]::Create()
        $stream = [IO.File]::OpenRead($archive)
        try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($actual -ne $expected) { throw 'Checksum mismatch. Nothing was installed.' }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [IO.Compression.ZipFile]::OpenRead($archive)
        try {
            foreach ($entry in $zip.Entries) {
                $entryPath = $entry.FullName.Replace('\', '/')
                if (!$entryPath.StartsWith("$name/", [StringComparison]::Ordinal) -or $entryPath -match '(^|/)\.\.(/|$)' -or $entryPath.Contains(':')) { throw 'Invalid archive path' }
            }
        } finally { $zip.Dispose() }
        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $stage)
        $extracted = Join-Path $stage $name
        $installed = & (Join-Path $extracted 'codeboard.cmd') --version
        if ($LASTEXITCODE -ne 0 -or $installed.Trim() -ne $Version) { throw 'The downloaded runtime could not start' }
        Set-Content -LiteralPath (Join-Path $extracted '.codeboard-install') -Value $Version
        if (Test-Path -LiteralPath $target) { throw 'Another installation completed concurrently; retry' }
        Move-Item -LiteralPath $extracted -Destination $target
    }
    $shim = Join-Path $stage 'codeboard.cmd'
    $body = "@echo off`r`nrem Managed by the Codeboard installer`r`ncall `"%~dp0..\versions\$Version\codeboard.cmd`" %*`r`n"
    [IO.File]::WriteAllText($shim, $body, [Text.Encoding]::ASCII)
    if (Test-Path -LiteralPath $launcher) { [IO.File]::Replace($shim, $launcher, (Join-Path $stage 'previous.cmd')) }
    else { [IO.File]::Move($shim, $launcher) }
    if (!$NoModifyPath) {
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if ($bin -notin ($userPath -split ';')) { [Environment]::SetEnvironmentVariable('Path', "$bin;$userPath", 'User') }
        if ($bin -notin ($env:Path -split ';')) { $env:Path = "$bin;$env:Path" }
    }
    Write-Host "Codeboard $Version installed. Run: codeboard init; codeboard run scene.mjs"
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ($resolvedStage.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($stage) -like '.install-*') {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
} finally { $installLock.Dispose() }
