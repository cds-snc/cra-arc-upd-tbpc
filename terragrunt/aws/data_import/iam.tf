locals {
  secrets_arns = [for secret in var.container_secrets : secret.valueFrom]
}

data "aws_iam_policy_document" "cra_upd_s3_data_import_readwrite_policy_doc" {
  statement {
    sid    = "AllowDataBucketReadWriteAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:HeadObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListObjects",
      "s3:ListBucket",
    ]
    resources = [
      var.data_bucket_arn,
      "${var.data_bucket_arn}/*"
    ]
  }
}

data "aws_iam_policy_document" "cra_upd_ssm_read_policy_doc" {
  statement {
    sid    = "AllowSSMParameterAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath"
    ]
    resources = local.secrets_arns
  }
}
