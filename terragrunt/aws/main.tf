
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

module "s3" {
  source = "./s3" # Path relative to this main.tf

  bucket_name = var.bucket_name
  tags        = var.tags
}

module "iam" {
  source = "./iam" # Path relative to this main.tf

  tags        = var.tags
  bucket_name = var.bucket_name # Pass bucket_name to IAM module
  repo_name   = var.repo_name   # Pass repo_name to IAM module

}

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
