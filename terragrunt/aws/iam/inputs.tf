variable "web_bucket_arn" {
  description = "The ARN of the S3 bucket containing web assets."
  type        = string
}

variable "data_bucket_arn" {
  description = "The ARN of the S3 bucket containing data assets."
  type        = string
}

variable "repo_name" {
  description = "The name of the GitHub repository (e.g., 'owner/repo') for OIDC configuration."
  type        = string
}