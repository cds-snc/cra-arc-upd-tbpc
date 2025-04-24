module "s3_bucket" {
  source = "github.com/cds-snc/terraform-modules//S3?ref=v1.4.0" # Using a specific version for stability

  bucket_name = var.bucket_name
  tags        = var.tags

  # Add any other required or desired configurations for the S3 module here
  # For a basic bucket, defaults might be sufficient.
  # Refer to https://github.com/cds-snc/terraform-modules/tree/main/S3 for options.
  versioning = {
    enabled = true # Example: Enable versioning
  }
}
