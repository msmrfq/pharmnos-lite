# Generate a new unique verification environment
$runId = "verify-$(Get-Date -Format 'yyyyMMddHHmmss')"
$port = 55432 + (Get-Random -Minimum 100 -Maximum 999)
$dbName = "pharmnos_verify_$runId"
$bootstrapUser = "pharmnos_e2e"
$bootstrapPass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$runtimeUser = "pharmnos_e2e_runtime"
$runtimePass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$signingSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$composeProject = "pharmnoslite-verify-$(Get-Date -Format 'yyyyMMddHHmmss')"

$testDbUrl = "postgresql://pharmnos_e2e:${bootstrapPass}@127.0.0.1:${port}/${dbName}?application_name=pharmnos-financial-e2e"
$runtimeDbUrl = "postgresql://pharmnos_e2e_runtime:${runtimePass}@127.0.0.1:${port}/${dbName}?application_name=pharmnos-financial-e2e"

$contract = @{
    version = 1
    runId = $runId
    host = "127.0.0.1"
    port = $port
    databaseName = $dbName
    bootstrapRole = "pharmnos_e2e"
    runtimeRole = "pharmnos_e2e_runtime"
    bootstrapCredentialSource = "FINANCIAL_E2E_DB_PASSWORD"
    runtimeCredentialSource = "FINANCIAL_E2E_RUNTIME_DB_PASSWORD"
    contextSecretSource = "DATABASE_AUTH_CONTEXT_SIGNING_SECRET"
    marker = "pharmnos-financial-e2e"
    composeProject = $composeProject
    composeService = "financial-e2e-postgres"
    composeProfile = "financial-e2e"
    schemaArtifact = "prisma/financial-e2e-schema-provisioning.generated.sql"
    schemaArtifactHash = "TBD"
    authorizedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    expiresAt = ([DateTimeOffset]::UtcNow.AddHours(2)).ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress

$binding = "1|$runId|127.0.0.1|$port|$dbName|pharmnos_e2e|pharmnos_e2e_runtime|FINANCIAL_E2E_DB_PASSWORD|FINANCIAL_E2E_RUNTIME_DB_PASSWORD|DATABASE_AUTH_CONTEXT_SIGNING_SECRET|pharmnos-financial-e2e|$composeProject|financial-e2e-postgres|TBD"

$envContent = @"
ALLOW_FINANCIAL_E2E=true
FINANCIAL_E2E_TARGET_APPROVED=true
FINANCIAL_E2E_DB_USER=pharmnos_e2e
FINANCIAL_E2E_DB_PASSWORD=$bootstrapPass
FINANCIAL_E2E_DB_NAME=$dbName
FINANCIAL_E2E_DB_PORT=$port
FINANCIAL_E2E_RUNTIME_DB_USER=pharmnos_e2e_runtime
FINANCIAL_E2E_RUNTIME_DB_PASSWORD=$runtimePass
DATABASE_AUTH_CONTEXT_SIGNING_SECRET=$signingSecret
TEST_DATABASE_URL=$testDbUrl
TEST_DATABASE_NAME=$dbName
TEST_DATABASE_MARKER=pharmnos-financial-e2e
FINANCIAL_E2E_RUNTIME_DATABASE_URL=$runtimeDbUrl
FINANCIAL_E2E_COMPOSE_PROJECT=$composeProject
FINANCIAL_E2E_TARGET_CONTRACT=$contract
FINANCIAL_E2E_RUN_ID=$runId
FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID=$runId-init01
FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING=1|$runId|127.0.0.1|$port|$dbName|pharmnos_e2e|pharmnos_e2e_runtime|FINANCIAL_E2E_DB_PASSWORD|FINANCIAL_E2E_RUNTIME_DB_PASSWORD|DATABASE_AUTH_CONTEXT_SIGNING_SECRET|pharmnos-financial-e2e|$composeProject|financial-e2e-postgres|TBD
FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT=TBD
FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED=true
FINANCIAL_E2E_INITIALIZATION_AUTHORIZED=true
FINANCIAL_E2E_EXECUTION_AUTHORIZED=true
FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED=true
FINANCIAL_E2E_CLEANUP_AUTHORIZED=true
FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL
FINANCIAL_E2E_INITIALIZATION_SCOPE=DATABASE_INITIALIZATION_ONLY
FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD=BOOTSTRAP_CONNECTED_CATALOG_READBACK
FINANCIAL_E2E_ROLE_SETUP_METHOD=PRECREATED_LOCAL_CREDENTIAL_PROCEDURE
FINANCIAL_E2E_BASELINE_PACKAGE=VERSION_PINNED_REVIEW_ARTIFACTS
FINANCIAL_E2E_EVIDENCE_MODE=SANITIZED_APPEND_ONLY_LOCAL
FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS=30
FINANCIAL_E2E_EVIDENCE_PATH_APPROVED=true
FINANCIAL_E2E_RECOVERY_POLICY=UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET
FINANCIAL_E2E_EVIDENCE_PATH_APPROVED=true
FINANCIAL_E2E_SUITE_NAME=runtime-verification
FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-infrastructure-evidence-$runId.json
FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-initialization-evidence-$runId.json
FINANCIAL_E2E_SUITE_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-runtime-verification-$runId.json
FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-cleanup-evidence-$runId.json
FINANCIAL_E2E_AUTHORIZED_AT_ISO=$([DateTimeOffset]::UtcNow.ToString("o"))
FINANCIAL_E2E_EXPIRES_AT_ISO=$([DateTimeOffset]::UtcNow.AddHours(2).ToString("o"))
"@

$envContent | Set-Content -Path "E:\PharmnosLite\.env.financial-e2e-verify" -Encoding UTF8
Write-Host "Generated .env.financial-e2e-verify"
Write-Host "Run ID: $runId"
Write-Host "Port: $port"
Write-Host "DB: $dbName"