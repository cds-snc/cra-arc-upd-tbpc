module "github_oidc_role" {
  source = "github.com/cds-snc/terraform-modules//gh_oidc_role?ref=v4.0.0"
  billing_tag_value = var.billing_code

  roles = [
    {
      name      = local.gh_readonly_role
      repo_name = "cra-arc-upd-tbpc"
      claim     = "ref:refs/heads/main"
    }
  ]
}

resource "aws_iam_policy" "gh_access_policy" {
  name        = "github-codespaces-s3-access-policy"
  description = "Policy allowing GitHub Codespaces to access S3 bucket for development data"
  
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
          "arn:aws:s3:::${local.dev_bucket_name}",
          "arn:aws:s3:::${local.dev_bucket_name}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gh_access_policy_attachment" {
  role       = local.gh_readonly_role
  policy_arn = aws_iam_policy.gh_access_policy.arn
  depends_on = [module.github_oidc_role, aws_iam_policy.gh_access_policy]
}

data "aws_iam_role" "gh_readonly_role" {
  name = local.gh_readonly_role

  depends_on = [module.github_oidc_role]
}

output "github_oidc_role_arn" {
  value = data.aws_iam_role.gh_readonly_role.arn
}