param(
  [switch]$RotateToken
)

$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false

function Write-Step($message) {
  Write-Host "[bootstrap-dev] $message"
}

function New-HexSecret([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }
  return ([System.BitConverter]::ToString($buffer).Replace("-", "").ToLower())
}

function New-Password([int]$bytes = 24) {
  $buffer = New-Object byte[] $bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    $rng.Dispose()
  }
  return ([Convert]::ToBase64String($buffer)).TrimEnd("=")
}

function Ensure-FileFromExample($targetPath, $examplePath) {
  if (-not (Test-Path $targetPath)) {
    Copy-Item $examplePath $targetPath
    Write-Step "Created $targetPath from example."
  }
}

function Get-EnvValue($path, $key) {
  if (-not (Test-Path $path)) { return $null }
  $line = Get-Content $path | Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$([regex]::Escape($key))=", "").Trim()
}

function Set-EnvValue($path, $key, $value) {
  $safeValue = [string]$value
  $content = @()
  if (Test-Path $path) {
    $content = Get-Content $path
  }

  $pattern = "^$([regex]::Escape($key))="
  $found = $false
  $updated = foreach ($line in $content) {
    if ($line -match $pattern) {
      $found = $true
      "$key=$safeValue"
    } else {
      $line
    }
  }

  if (-not $found) {
    if ($updated.Count -gt 0 -and $updated[-1] -ne "") {
      $updated += ""
    }
    $updated += "$key=$safeValue"
  }

  Set-Content -Path $path -Value $updated
}

function Is-MissingOrPlaceholder($value, $placeholders) {
  if ([string]::IsNullOrWhiteSpace($value)) { return $true }
  $trimmed = $value.Trim()
  foreach ($candidate in $placeholders) {
    if ($trimmed -ieq $candidate) { return $true }
  }
  return $false
}

function Compose-Args($repoRoot) {
  return @(
    "-f", (Join-Path $repoRoot "ckan-docker/docker-compose.yml"),
    "-f", (Join-Path $repoRoot "ckan-docker/docker-compose.arms.dev.yml")
  )
}

function Invoke-Compose($repoRoot, [string[]]$composeCommandArgs) {
  $composeArgs = Compose-Args $repoRoot
  & docker compose @composeArgs @composeCommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($composeCommandArgs -join ' ')"
  }
}

function Get-ServiceContainerId($repoRoot, $service) {
  $composeArgs = Compose-Args $repoRoot
  $id = & docker compose @composeArgs ps -q $service
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($id)) {
    return $null
  }
  return $id.Trim()
}

function Wait-ForServiceHealthy($repoRoot, $service, [int]$timeoutSeconds = 600) {
  Write-Step "Waiting for '$service' to become healthy..."
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $timeoutSeconds) {
    $containerId = Get-ServiceContainerId $repoRoot $service
    if ($containerId) {
      $status = (& docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $containerId).Trim()
      if ($status -eq "healthy" -or $status -eq "running") {
        Write-Step "'$service' is $status."
        return
      }
    }
    Start-Sleep -Seconds 5
  }
  throw "Timed out waiting for service '$service'."
}

function Invoke-CkanCli($repoRoot, $arguments, [switch]$IgnoreFailure) {
  $composeArgs = Compose-Args $repoRoot
  & docker compose @composeArgs exec -T ckan ckan -c /srv/app/ckan.ini @arguments
  if ($LASTEXITCODE -ne 0 -and -not $IgnoreFailure) {
    throw "CKAN CLI command failed: ckan $($arguments -join ' ')"
  }
  return $LASTEXITCODE
}

function Ensure-CkanUser($repoRoot, $username, $email, $password, $fullName) {
  $composeArgs = Compose-Args $repoRoot
  $showOutput = & docker compose @composeArgs exec -T ckan ckan -c /srv/app/ckan.ini user show $username 2>&1
  $showText = ($showOutput -join "`n")
  if ($LASTEXITCODE -eq 0) {
    if ($showText -match "(?i)User:\s*None" -or $showText -match "(?i)not found") {
      # CKAN CLI can return exit code 0 with "User: None".
      Write-Step "CKAN user '$username' not found (detected from output)."
    } else {
      Write-Step "CKAN user '$username' already exists."
      return
    }
  }

  Write-Step "Creating CKAN user '$username'."
  $createOutput = & docker compose @composeArgs exec -T ckan ckan -c /srv/app/ckan.ini @(
    "user", "add", $username,
    "email=$email",
    "password=$password",
    "fullname=$fullName"
  ) 2>&1

  if ($LASTEXITCODE -eq 0) {
    return
  }

  $createText = ($createOutput -join "`n")
  if (
    $createText -match "(?i)not available" -or
    $createText -match "(?i)already exists" -or
    $createText -match "(?i)already in use"
  ) {
    Write-Step "CKAN user '$username' already exists (detected from create response)."
    return
  }

  throw "Failed to ensure CKAN user '$username'.`n$createText"
}

function Ensure-CkanSysadmin($repoRoot, $username) {
  $exitCode = Invoke-CkanCli $repoRoot @("sysadmin", "add", $username) -IgnoreFailure
  if ($exitCode -eq 0) {
    Write-Step "CKAN user '$username' ensured as sysadmin."
  } else {
    Write-Step "CKAN user '$username' already has sysadmin role."
  }
}

function Get-CkanUserId($repoRoot, $username) {
  $composeArgs = Compose-Args $repoRoot
  $output = & docker compose @composeArgs exec -T ckan ckan -c /srv/app/ckan.ini user show $username
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read CKAN user details for '$username'."
  }
  $text = ($output -join "`n")
  $match = [regex]::Match($text, "(?i)\bid\s*=\s*(?<id>[0-9a-f-]{36})\b")
  if (-not $match.Success) {
    throw "Unable to parse CKAN user id for '$username'."
  }
  return $match.Groups["id"].Value.Trim()
}

function Create-CkanUserToken($repoRoot, $username, $tokenName) {
  $composeArgs = Compose-Args $repoRoot
  $command = "ckan -c /srv/app/ckan.ini user token add $username $tokenName 2>/dev/null | tail -n 1 | tr -d '\t\r\n'"
  $tokenOutput = & docker compose @composeArgs exec -T ckan sh -lc $command
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create CKAN token for '$username'."
  }
  $trimmedToken = ($tokenOutput -join "`n").Trim()
  if ([string]::IsNullOrWhiteSpace($trimmedToken)) {
    throw "CKAN token generation returned empty token."
  }
  if ($trimmedToken -notmatch "^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$") {
    throw "CKAN token generation returned unexpected output."
  }
  return $trimmedToken
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

$backendEnvPath = Join-Path $repoRoot "backend/.env"
$backendEnvExamplePath = Join-Path $repoRoot "backend/.env.example"
$ckanEnvPath = Join-Path $repoRoot "ckan-docker/.env"
$ckanEnvExamplePath = Join-Path $repoRoot "ckan-docker/.env.example"

Ensure-FileFromExample $backendEnvPath $backendEnvExamplePath
Ensure-FileFromExample $ckanEnvPath $ckanEnvExamplePath

# Ensure secure backend secrets exist locally.
$jwtSecret = Get-EnvValue $backendEnvPath "ARMS_JWT_SECRET"
if (Is-MissingOrPlaceholder $jwtSecret @("CHANGE_ME", "change-me", "change-me-dev")) {
  $jwtSecret = New-HexSecret 32
  Set-EnvValue $backendEnvPath "ARMS_JWT_SECRET" $jwtSecret
  Write-Step "Generated ARMS_JWT_SECRET."
}

$encryptionKey = Get-EnvValue $backendEnvPath "ARMS_ENCRYPTION_KEY"
if (Is-MissingOrPlaceholder $encryptionKey @("CHANGE_ME", "CHANGE_ME_64_HEX")) {
  $encryptionKey = New-HexSecret 32
  Set-EnvValue $backendEnvPath "ARMS_ENCRYPTION_KEY" $encryptionKey
  Write-Step "Generated ARMS_ENCRYPTION_KEY."
}

$bootstrapAdminEmail = Get-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_EMAIL"
if ([string]::IsNullOrWhiteSpace($bootstrapAdminEmail)) {
  $bootstrapAdminEmail = "arms.super.admin@example.com"
  Set-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_EMAIL" $bootstrapAdminEmail
}

$bootstrapAdminName = Get-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_NAME"
if ([string]::IsNullOrWhiteSpace($bootstrapAdminName)) {
  $bootstrapAdminName = "ARMS Super Admin"
  Set-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_NAME" $bootstrapAdminName
}

$bootstrapAdminPassword = Get-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_PASSWORD"
if (Is-MissingOrPlaceholder $bootstrapAdminPassword @("CHANGE_ME")) {
  $bootstrapAdminPassword = New-Password 24
  Set-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_PASSWORD" $bootstrapAdminPassword
  Write-Step "Generated ARMS_BOOTSTRAP_ADMIN_PASSWORD."
}

# Keep default admin values aligned with bootstrap admin account.
Set-EnvValue $backendEnvPath "ARMS_DEFAULT_ADMIN_EMAIL" $bootstrapAdminEmail
Set-EnvValue $backendEnvPath "ARMS_DEFAULT_ADMIN_PASSWORD" $bootstrapAdminPassword

$serviceUsername = Get-EnvValue $ckanEnvPath "CKAN_SERVICE_USERNAME"
if ([string]::IsNullOrWhiteSpace($serviceUsername)) {
  $serviceUsername = "arms_service_bot"
  Set-EnvValue $ckanEnvPath "CKAN_SERVICE_USERNAME" $serviceUsername
}
$serviceEmail = Get-EnvValue $ckanEnvPath "CKAN_SERVICE_EMAIL"
if ([string]::IsNullOrWhiteSpace($serviceEmail)) {
  $serviceEmail = "arms.service@example.com"
  Set-EnvValue $ckanEnvPath "CKAN_SERVICE_EMAIL" $serviceEmail
}
$servicePassword = Get-EnvValue $ckanEnvPath "CKAN_SERVICE_PASSWORD"
if (Is-MissingOrPlaceholder $servicePassword @("CHANGE_ME", "CHANGE_ME_STRONG")) {
  $servicePassword = New-Password 24
  Set-EnvValue $ckanEnvPath "CKAN_SERVICE_PASSWORD" $servicePassword
  Write-Step "Generated CKAN_SERVICE_PASSWORD."
}

$ckanAdminUsername = Get-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_USERNAME"
if ([string]::IsNullOrWhiteSpace($ckanAdminUsername)) {
  $ckanAdminUsername = "arms_super_admin"
  Set-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_USERNAME" $ckanAdminUsername
}
$ckanAdminEmail = Get-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_EMAIL"
if ([string]::IsNullOrWhiteSpace($ckanAdminEmail)) {
  $ckanAdminEmail = $bootstrapAdminEmail
  Set-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_EMAIL" $ckanAdminEmail
}
$ckanAdminPassword = Get-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_PASSWORD"
if (Is-MissingOrPlaceholder $ckanAdminPassword @("CHANGE_ME", "CHANGE_ME_STRONG")) {
  $ckanAdminPassword = New-Password 24
  Set-EnvValue $ckanEnvPath "CKAN_BOOTSTRAP_ADMIN_PASSWORD" $ckanAdminPassword
  Write-Step "Generated CKAN_BOOTSTRAP_ADMIN_PASSWORD."
}

Set-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_CKAN_USERNAME" $ckanAdminUsername

Write-Step "Starting Docker compose stack..."
Invoke-Compose $repoRoot @("up", "-d", "--build")

Wait-ForServiceHealthy $repoRoot "ckan"
Wait-ForServiceHealthy $repoRoot "backend"

Ensure-CkanUser $repoRoot $serviceUsername $serviceEmail $servicePassword "ARMS Service Bot"
Ensure-CkanSysadmin $repoRoot $serviceUsername
Ensure-CkanUser $repoRoot $ckanAdminUsername $ckanAdminEmail $ckanAdminPassword $bootstrapAdminName
Ensure-CkanSysadmin $repoRoot $ckanAdminUsername

$currentApiKey = Get-EnvValue $backendEnvPath "CKAN_API_KEY"
if ($RotateToken -or (Is-MissingOrPlaceholder $currentApiKey @("CHANGE_ME"))) {
  $tokenName = "arms-bootstrap-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $ckanApiKey = Create-CkanUserToken $repoRoot $serviceUsername $tokenName
  Set-EnvValue $backendEnvPath "CKAN_API_KEY" $ckanApiKey
  Write-Step "CKAN_API_KEY refreshed from service account token."
} else {
  Write-Step "CKAN_API_KEY already set; skipping token refresh."
}

$ckanAdminUserId = Get-CkanUserId $repoRoot $ckanAdminUsername
Set-EnvValue $backendEnvPath "ARMS_BOOTSTRAP_ADMIN_CKAN_USER_ID" $ckanAdminUserId

$composeArgs = Compose-Args $repoRoot
Write-Step "Running ARMS bootstrap admin script..."
& docker compose @composeArgs exec -T `
  -e "ARMS_BOOTSTRAP_ADMIN_EMAIL=$bootstrapAdminEmail" `
  -e "ARMS_BOOTSTRAP_ADMIN_NAME=$bootstrapAdminName" `
  -e "ARMS_BOOTSTRAP_ADMIN_PASSWORD=$bootstrapAdminPassword" `
  -e "ARMS_BOOTSTRAP_ADMIN_CKAN_USERNAME=$ckanAdminUsername" `
  -e "ARMS_BOOTSTRAP_ADMIN_CKAN_USER_ID=$ckanAdminUserId" `
  backend node scripts/bootstrap-admin.mjs
if ($LASTEXITCODE -ne 0) {
  throw "Failed to run backend bootstrap admin script."
}

Write-Step "Recreating backend to apply latest env values..."
Invoke-Compose $repoRoot @("up", "-d", "--force-recreate", "backend")

Write-Step "Bootstrap complete."
Write-Step "ARMS bootstrap admin email: $bootstrapAdminEmail"
Write-Step "ARMS bootstrap admin password (stored in backend/.env): $bootstrapAdminPassword"
