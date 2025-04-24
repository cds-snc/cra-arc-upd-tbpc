variable "bucket_name" {
  description = "The name of the S3 bucket that the role needs access to."
  type        = string
}

variable "repo_name" {
  description = "The name of the GitHub repository (e.g., 'owner/repo') for OIDC configuration."
  type        = string
}

variable "tags" {
  description = "A map of tags to assign to IAM resources."
  type        = map(string)
  default     = {}
}
