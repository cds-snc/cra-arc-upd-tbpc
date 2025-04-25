include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../aws" # Pointing to the root 'aws' directory where s3 and iam modules reside
}

inputs = {
  # S3 Bucket Inputs (referencing variables in terragrunt/aws/s3/variables.tf)
  bucket_name = "cra-arc-upd-tbpc-codespaces-data" # The agreed-upon bucket name
  repo_name   = "cds-snc/cra-arc-upd-tbpc"         # Provide the GitHub repo name (owner/repo)

  # Required for the OIDC module
  billing_tag_value = "cra-arc-upd-tbpc"

  # IAM/OIDC Inputs (referencing variables potentially needed by terragrunt/aws/iam/*.tf)
  tags = {
    Environment = "staging"
    Project     = "cra-arc-upd-tbpc"
    ManagedBy   = "Terraform"
    Purpose     = "Codespaces Data"
  }
}
