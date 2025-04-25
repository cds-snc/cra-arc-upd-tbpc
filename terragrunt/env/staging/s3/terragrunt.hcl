include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../aws/s3"
}

inputs = {
  bucket_name = "cra-arc-upd-tbpc-codespaces-data"

  # Required for the S3 module
  billing_tag_value = "cra-arc-upd-tbpc"

  # Tags
  tags = {
    Environment = "staging"
    Project     = "cra-arc-upd-tbpc"
    ManagedBy   = "Terraform"
    Purpose     = "Codespaces Data"
  }
}