# This main.tf file acts as the root module for Terragrunt configurations
# pointing to this 'aws' directory. It calls the submodules like 's3' and 'iam'.

# Define provider configuration if not handled globally by Terragrunt includes
# Example (adjust as needed for your setup):
# terraform {
#   required_providers {
#     aws = {
#       source  = "hashicorp/aws"
#       version = "~> 5.0" # Specify appropriate version
#     }
#   }
# }
#
# provider "aws" {
#   region = "ca-central-1" # Specify appropriate region
#   # Assume credentials are handled via environment variables or instance profile
# }

# Define common variables used by submodules, passed from Terragrunt inputs
variable "bucket_name" {
  description = "The name for the S3 bucket."
  type        = string
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}

variable "repo_name" {
  description = "The GitHub repository name (e.g., 'owner/repo') for OIDC configuration."
  type        = string
}

# Instantiate the S3 module
module "s3" {
  source = "./s3" # Path relative to this main.tf

  bucket_name = var.bucket_name
  tags        = var.tags
}

# Instantiate the IAM module (assuming it contains oidc.tf)
module "iam" {
  source = "./iam" # Path relative to this main.tf

  # Pass necessary variables to the IAM module
  # We need to ensure variables used in iam/oidc.tf (like 'tags') are declared here
  # or within the iam module itself and passed through.
  tags        = var.tags
  bucket_name = var.bucket_name # Pass bucket_name to IAM module
  repo_name   = var.repo_name   # Pass repo_name to IAM module

  # If iam/oidc.tf needs the bucket name or ARN, pass it from the s3 module output:
  # bucket_arn = module.s3.bucket_arn # Example if needed
}

# Define outputs that aggregate outputs from submodules if needed by Terragrunt
output "s3_bucket_arn" {
  description = "The ARN of the created S3 bucket."
  value       = module.s3.bucket_arn
}

output "s3_bucket_name" {
  description = "The name of the created S3 bucket."
  value       = module.s3.bucket_name
}

output "github_oidc_codespaces_readonly_role_arn" {
  description = "The ARN of the GitHub OIDC role for Codespaces read-only access."
  value       = module.iam.github_oidc_codespaces_readonly_role_arn # Accessing output via iam module instance
}
