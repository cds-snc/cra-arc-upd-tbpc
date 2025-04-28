module "s3_bucket" {
  source = "github.com/cds-snc/terraform-modules//S3?ref=v10.4.1" # Using same version as OIDC module

  billing_tag_value = var.billing_tag_value # Added required argument
  bucket_name       = var.bucket_name
  tags              = var.tags

   versioning = {
    enabled = false # Enable versioning
  }
}
