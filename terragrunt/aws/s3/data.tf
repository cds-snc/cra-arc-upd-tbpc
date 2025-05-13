module "cra_upd_data_s3_bucket" {
  source = "github.com/cds-snc/terraform-modules//S3?ref=v10.4.4"

  bucket_name       = "${var.product_name_dashed}-data-${var.env}"
  billing_tag_value = var.billing_tag_value
}

resource "aws_s3_bucket_lifecycle_configuration" "cra_upd_data_bucket_lifecycle_rule" {
  bucket = module.cra_upd_data_s3_bucket.s3_bucket_id

  rule {
    id     = "cra-upd-data-bucket-lifecycle-rule"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days           = var.data_bucket_expiration_days
      newer_noncurrent_versions = var.data_bucket_noncurrent_versions
    }
  }
}