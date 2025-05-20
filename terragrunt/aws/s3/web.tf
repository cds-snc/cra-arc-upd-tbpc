locals {
  s3_origin_id = "upd-web-${var.env}"
}

resource "aws_s3_bucket" "cra_upd_web_bucket" {
  bucket = local.s3_origin_id
}

resource "aws_s3_bucket_acl" "cra_upd_web_bucket_acl" {
  bucket = aws_s3_bucket.cra_upd_web_bucket.id
  acl    = "private"

  depends_on = [aws_s3_bucket_ownership_controls.cra_upd_web_bucket_ownership_controls]
}

resource "aws_s3_bucket_public_access_block" "cra_upd_web_bucket_access_block" {
  bucket                  = aws_s3_bucket.cra_upd_web_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "cra_upd_web_bucket_ownership_controls" {
  bucket = aws_s3_bucket.cra_upd_web_bucket.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_website_configuration" "cra_upd_web_bucket_website_configuration" {
  bucket = aws_s3_bucket.cra_upd_web_bucket.id

  index_document {
    suffix = "index.html"
  }

  # todo: add error_document
  # error_document {
  #   key = "error.html"
  # }
}

resource "aws_s3_object" "cra_upd_web_resources" {
  for_each = fileset(var.web_resources_build_path, "**")

  bucket = local.s3_origin_id
  key    = each.key
  source = "${var.web_resources_build_path}/${each.value}"
  etag   = filemd5("${var.web_resources_build_path}/${each.value}")

  depends_on = [aws_s3_bucket.cra_upd_web_bucket]
}