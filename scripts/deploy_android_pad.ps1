[CmdletBinding()]
param(
    [string]$Bundletool = 'C:\Program Files\Epic Games\UE_5.8\Engine\Build\Android\Prebuilt\bundletool\bundletool-all-1.18.1.jar',
    [Parameter(Mandatory = $true)] [string]$Device,
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
    $Root = [IO.Path]::GetFullPath($ProjectRoot)
    $Jar = (Resolve-Path -LiteralPath $Bundletool).Path
    if (!(Test-Path -LiteralPath $Jar -PathType Leaf) -or [IO.Path]::GetExtension($Jar) -ne '.jar') {
        throw 'Bundletool must be an existing bundletool JAR file.'
    }
    if ($Device -notmatch '^[A-Za-z0-9_.:-]+$') { throw 'Supply an explicit ADB device serial, not a command or list.' }
    $Java = (Get-Command java.exe -ErrorAction Stop).Source
    $ReceiptPath = Join-Path $Root 'Builds\Android\latest-pad.json'
    if (!(Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
        throw 'No successful PAD build receipt exists. Run build_all.bat Android and resolve its chunk/pack validation errors first.'
    }
    $Receipt = Get-Content -LiteralPath $ReceiptPath -Raw | ConvertFrom-Json
    $Aab = [IO.Path]::GetFullPath([string]$Receipt.aab)
    $ArchiveRoot = [IO.Path]::GetFullPath((Join-Path $Root 'Builds\Android')) + [IO.Path]::DirectorySeparatorChar
    if (!$Aab.StartsWith($ArchiveRoot, [StringComparison]::OrdinalIgnoreCase) -or
        !(Test-Path -LiteralPath $Aab -PathType Leaf) -or [IO.Path]::GetExtension($Aab) -ne '.aab') {
        throw 'The CI receipt does not point to an existing AAB inside this project archive.'
    }
    $SafeSerial = $Device -replace '[^A-Za-z0-9_.-]', '_'
    $Apks = Join-Path (Split-Path -Parent $Aab) ('PRJ381-local-' + $SafeSerial + '.apks')
    Write-Warning 'Local PAD testing is not a Google Play production-delivery test. Application download/mount behavior has not been verified. Remove an older local-test installation manually before reinstalling; this helper never uninstalls or clears application data.'
    & $Java '-jar' $Jar 'build-apks' "--bundle=$Aab" "--output=$Apks" '--connected-device' "--device-id=$Device" '--local-testing' '--overwrite'
    if ($LASTEXITCODE -ne 0) { throw "bundletool build-apks failed with exit code $LASTEXITCODE. Nothing was installed." }
    if (!(Test-Path -LiteralPath $Apks -PathType Leaf)) { throw 'bundletool did not create the requested .apks archive.' }
    & $Java '-jar' $Jar 'install-apks' "--apks=$Apks" "--device-id=$Device"
    if ($LASTEXITCODE -ne 0) { throw "bundletool install-apks failed with exit code $LASTEXITCODE." }
    Write-Host "Installed the local-test APK set on device $Device. Runtime behavior is not verified by installation."
    exit 0
} catch {
    [Console]::Error.WriteLine('DEPLOY FAILED: ' + $_.Exception.Message)
    exit 1
}
