locals {
  secrets_arns = [for secret in var.container_secrets : secret.valueFrom]
}

data "aws_iam_policy_document" "cra_upd_s3_data_read_policy_doc" {
  statement {
    sid    = "AllowDataBucketReadAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket"
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
      "ssm:GetParameter*",
    ]
    resources = local.secrets_arns
  }
}