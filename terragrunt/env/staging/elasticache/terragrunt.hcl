include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//elasticache"
}

dependencies {
  paths = ["../network"]
}

dependency "network" {
  config_path                             = "../network"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    vpc_id                 = ""
    vpc_private_subnet_ids = [""]
    vpc_cidr_block         = "10.0.0.0/16"
  }
}

inputs = {
  vpc_id                 = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block         = dependency.network.outputs.vpc_cidr_block
  elasticache_node_type  = "cache.t4g.micro"
}