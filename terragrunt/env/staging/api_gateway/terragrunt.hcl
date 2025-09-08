#! Remove related files after resources are destroyed

terraform {
  source = "../../../aws//api_gateway"
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}