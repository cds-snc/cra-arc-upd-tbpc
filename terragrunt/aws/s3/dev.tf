#
# Holds data to be used in development
#

module "dev_bucket" {
  source            = "github.com/cds-snc/terraform-modules//S3?ref=v10.4.1"
  bucket_name       = local.dev_bucket_name
  billing_tag_value = var.billing_tag_value
}

resource "aws_s3_bucket_policy" "dev_bucket" {
  bucket = module.dev_bucket.s3_bucket_id
  policy = data.aws_iam_policy_document.dev_bucket.json
}

data "aws_iam_policy_document" "dev_bucket" {
  statement {
    sid    = "UPDDevReadOnly"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.gh_readonly_role.arn]
    }
    actions = [
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      module.dev_bucket.s3_bucket_arn,
      "${module.dev_bucket.s3_bucket_arn}/*"
    ]
  }

  depends_on = [module.github_oidc_role]
}