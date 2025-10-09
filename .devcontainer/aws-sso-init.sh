#!/bin/bash
# AWS SSO initialization script for Codespaces

determine_role() {
  echo "[aws-sso-init] Checking available roles..."
  
  # Use stored role if valid
  if [[ -f "$CREDENTIALS_FILE" && -n "$stored_role_type" ]]; then
    local role_var="AWS_SSO_${stored_role_type^^}_ROLE"
    if [[ -n "${!role_var}" ]]; then
      echo "[aws-sso-init] Using stored $stored_role_type role: ${!role_var}"
      aws configure set sso_role_name "${!role_var}"
      role_type="$stored_role_type"
      return 0
    fi
  fi

  # Try admin role first, fallback to user
  for role in "ADMIN" "USER"; do
    local role_var="AWS_SSO_${role}_ROLE"
    if [[ -n "${!role_var}" ]]; then
      echo "[aws-sso-init] Testing ${role,,} role: ${!role_var}"
      aws configure set sso_role_name "${!role_var}"
      
      if [[ "$role" == "ADMIN" ]] && aws sso login 2>/dev/null && aws sts get-caller-identity >/dev/null 2>&1; then
        echo "[aws-sso-init] Successfully authenticated with admin role"
        role_type="admin"
        return 2
      elif [[ "$role" == "USER" ]]; then
        role_type="user"
        return 0
      fi
    fi
  done
  
  echo "[aws-sso-init] Error: No valid role found"
  return 1
}

CREDENTIALS_FILE="$HOME/.aws/credentials.json"

# Check existing credentials
if [[ -f "$CREDENTIALS_FILE" ]]; then
  echo "[aws-sso-init] Checking existing credentials..."
  
  aws_credential_expiration=$(jq -r '.aws_credential_expiration // empty' "$CREDENTIALS_FILE")
  stored_role_type=$(jq -r '.role_type // empty' "$CREDENTIALS_FILE")
  
  if [[ -n "$aws_credential_expiration" ]]; then
    expiration_epoch=$(date -d "$aws_credential_expiration" +%s 2>/dev/null)
    current_epoch=$(date -u +%s)
    
    if [[ -n "$expiration_epoch" && "$expiration_epoch" -gt "$current_epoch" ]]; then
      time_remaining=$(((expiration_epoch - current_epoch) / 60))
      echo "[aws-sso-init] Credentials valid until $aws_credential_expiration ($time_remaining minutes remaining)"
      [[ -n "$stored_role_type" ]] && echo "[aws-sso-init] Using stored role: $stored_role_type"
      exit 0
    fi
  fi
  echo "[aws-sso-init] Credentials expired, proceeding with login..."
else
  echo "[aws-sso-init] No existing credentials found, proceeding with login..."
fi

# Configure AWS CLI
echo "[aws-sso-init] Configuring AWS CLI for SSO..."
aws configure set sso_start_url "$AWS_SSO_START_URL"
aws configure set sso_region "ca-central-1"
aws configure set sso_account_id "$AWS_SSO_ACCOUNT_ID"
aws configure set region "ca-central-1"
aws configure set output "json"
aws configure set cli_pager ""

# Determine role and handle authentication
determine_role
role_status=$?

if [[ $role_status -eq 1 ]]; then
  echo "[aws-sso-init] Failed to determine a valid role"
  exit 1
elif [[ $role_status -eq 2 ]]; then
  echo "[aws-sso-init] Already authenticated, skipping login"
  already_logged_in=true
else
  echo "[aws-sso-init] Starting SSO login..."
  aws sso login || { echo "[aws-sso-init] SSO login failed. Retry with: aws sso login --no-browser" && exit 1; }
  already_logged_in=false
fi

# Verify credentials if we just logged in
[[ "$already_logged_in" == false ]] && {
  echo "[aws-sso-init] Verifying credentials..."
  aws sts get-caller-identity >/dev/null 2>&1 || { echo "[aws-sso-init] Unable to verify caller identity" && exit 1; }
}

# Export and save credentials
echo "[aws-sso-init] Exporting credentials..."
eval "$(aws configure export-credentials --format env)"

jq -n \
  --arg access_key "$AWS_ACCESS_KEY_ID" \
  --arg secret_key "$AWS_SECRET_ACCESS_KEY" \
  --arg session_token "$AWS_SESSION_TOKEN" \
  --arg expiration "$AWS_CREDENTIAL_EXPIRATION" \
  --arg role_type "$role_type" \
  '{
    aws_access_key_id: $access_key,
    aws_secret_access_key: $secret_key,
    aws_session_token: $session_token,
    aws_credential_expiration: $expiration,
    role_type: $role_type
  }' > ~/.aws/credentials.json

echo "[aws-sso-init] AWS SSO initialization complete."