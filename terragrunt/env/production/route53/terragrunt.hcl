include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//route53"
}

inputs = {
  validate_domain = false
}
