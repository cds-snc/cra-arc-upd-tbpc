include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//s3"
}

inputs = {
  data_bucket_expiration_days     = 7
  data_bucket_noncurrent_versions = 7
}