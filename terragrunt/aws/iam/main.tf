locals {
  readonly_role_name = "GHOIDCCodespacesReadOnlyRole"
}

module "github_oidc_role" {
  source = "github.com/cds-snc/terraform-modules//gh_oidc_role?ref=v4.0.0"

  billing_tag_value = var.billing_tag_value

  roles = [
    {
      name      = local.readonly_role_name
      repo_name = var.repo_name                               # Use input variable
      claim     = "ref:refs/heads/main" # Use input variable
    }
  ]
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

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "s3_readonly_policy_attachment" {
  role       = module.github_oidc_role.roles[local.readonly_role_name].name
  policy_arn = aws_iam_policy.s3_readonly_policy.arn

  depends_on = [module.github_oidc_role]
}