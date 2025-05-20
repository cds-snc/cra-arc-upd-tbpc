module "github_oidc_role" {
  source = "github.com/cds-snc/terraform-modules//gh_oidc_role?ref=v4.0.0"

  billing_tag_value = var.billing_tag_value

  roles = [
    {
      name      = local.web_readwrite_role_name
      repo_name = var.repo_name
      claim     = "ref:refs/heads/main"
    }
  ]
}

resource "aws_iam_role_policy_attachment" "s3_readwrite_policy_attachment" {
  role       = module.github_oidc_role.roles[local.web_readwrite_role_name].name
  policy_arn = aws_iam_policy.s3_web_readwrite_policy.arn
}