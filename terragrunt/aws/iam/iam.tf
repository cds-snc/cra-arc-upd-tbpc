locals {
  web_readwrite_role_name = "S3WebReadWriteRole"
}

data "aws_iam_policy_document" "s3_web_readwrite_policy_doc" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject"
    ]
    resources = [
      var.web_bucket_arn,
      "${var.web_bucket_arn}/*"
    ]
  }
}
resource "aws_iam_policy" "s3_web_readwrite_policy" {
  name        = "s3-web-readwrite-policy"
  description = "Policy giving read-write access to the web resources S3 bucket"

  policy = data.aws_iam_policy_document.s3_web_readwrite_policy_doc.json
}
