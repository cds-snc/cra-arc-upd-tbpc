terraform {
  source = "../../../aws//database"
}

dependencies {
  paths = ["../network"]
}

dependency "network" {
  config_path                             = "../network"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    vpc_id                 = ""
    vpc_private_subnet_ids = [""]
    vpc_cidr_block         = ""
  }
}

inputs = {
  vpc_id                 = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block         = dependency.network.outputs.vpc_cidr_block
  docdb_instance_class   = "db.t4g.medium" # start with smallest instance class and scale up as needed
  docdb_instance_count   = 1
  docdb_storage_type     = "iopt1"
  docdb_backup_window    = "02:00-04:00" # Daily time range that backups execute (UTC time)
}

include "root" {
  path = find_in_parent_folders("root.hcl")
}