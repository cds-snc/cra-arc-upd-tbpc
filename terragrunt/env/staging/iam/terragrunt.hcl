include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../aws/iam" # Point directly to the iam module
}

inputs = {
  # IAM/OIDC Inputs
  repo_name   = "cds-snc/cra-arc-upd-tbpc"         # Provide the GitHub repo name (owner/repo)
  bucket_name = "cra-arc-upd-tbpc-codespaces-data" # Reference the same bucket name

  billing_tag_value = "cra-arc-upd-tbpc"

  # Tags
  tags = {
    Environment = "staging"
    Project     = "cra-arc-upd-tbpc"
    ManagedBy   = "Terraform"
    Purpose     = "Codespaces Data"
  }
}