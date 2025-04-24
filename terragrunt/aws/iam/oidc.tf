locals {
  readonly_role_name = "GHOIDCCodespacesReadOnlyRole"
  # Removed bucket_name and repo_name, will use input variables instead
}

module "github_oidc_role" {
  source = "github.com/cds-snc/terraform-modules//gh_oidc_role?ref=v4.0.0"

  roles = [
    {
      name      = local.readonly_role_name
      repo_name = var.repo_name # Use input variable
      # Assuming access is needed from the main branch, adjust if necessary
      claim = "repo:${var.repo_name}:ref:refs/heads/main" # Use input variable
    }
  ]

  tags = var.tag
}

resource "aws_iam_policy" "s3_readonly_policy" {
  name        = "github-codespaces-s3-readonly-policy"
  description = "Policy allowing GitHub Codespaces read-only access to the specific S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Resource = [
          "arn:aws:s3:::${var.bucket_name}",  # Use input variable
          "arn:aws:s3:::${var.bucket_name}/*" # Use input variable
        ]
      }
    ]
  })

  tags = var.tags # Assuming tags are defined in variables.tf for this module
}

resource "aws_iam_role_policy_attachment" "s3_readonly_policy_attachment" {
  role       = module.github_oidc_role.roles[local.readonly_role_name].name
  policy_arn = aws_iam_policy.s3_readonly_policy.arn

  depends_on = [module.github_oidc_role]
}

output "github_oidc_codespaces_readonly_role_arn" {
  description = "The ARN of the GitHub OIDC role for Codespaces read-only access."
  value = module.github_oidc_role.roles[local.readonly_role_name].arn
}
