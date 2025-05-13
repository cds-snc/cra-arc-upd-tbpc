include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//s3"
}

inputs = {
  data_bucket_expiration_days     = 7
  data_bucket_noncurrent_versions = 7
  web_resources_build_path        = "${get_parent_terragrunt_dir()}/../../dist/apps/upd"
}