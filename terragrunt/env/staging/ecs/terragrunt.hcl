include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../aws//ecs"
}

dependencies {
  paths = ["../network", "../database", "../ecr", "../elasticache", "../load_balancer", "../ssm", "../s3"]
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

dependency "ecr" {
  config_path                             = "../ecr"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ecr_repository_url = ""
  }
}

dependency "docdb" {
  config_path                             = "../database"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    docdb_endpoint     = ""
    docdb_egress_sg_id = ""
  }
}

dependency "elasticache" {
  config_path                             = "../elasticache"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    elasticache_endpoint     = ""
    elasticache_egress_sg_id = ""
  }
}

dependency "load_balancer" {
  config_path                             = "../load_balancer"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ecs_loadbalancer_sg_id            = ""
    ecs_loadbalancer_egress_sg_id     = ""
    ecs_loadbalancer_arn              = ""
    ecs_loadbalancer_listener_arn     = ""
    ecs_loadbalancer_target_group_arn = ""
  }
}

dependency "s3" {
  config_path                             = "../s3"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    data_bucket_arn  = ""
    data_bucket_name = ""
  }
}

dependency "ssm" {
  config_path                             = "../ssm"
  mock_outputs_allowed_terraform_commands = ["init", "fmt", "validate", "plan", "show", "destroy"]
  mock_outputs_merge_with_state           = true
  mock_outputs = {
    ssm_secret_arns = []
  }
}

inputs = {
  vpc_id                        = dependency.network.outputs.vpc_id
  vpc_private_subnet_ids        = dependency.network.outputs.vpc_private_subnet_ids
  vpc_cidr_block                = dependency.network.outputs.vpc_cidr_block
  ecr_repository_url            = dependency.ecr.outputs.ecr_repository_url
  container_secrets             = dependency.ssm.outputs.ssm_secret_arns
  docdb_endpoint                = dependency.docdb.outputs.docdb_endpoint
  docdb_egress_sg_id            = dependency.docdb.outputs.docdb_egress_sg_id
  elasticache_endpoint          = dependency.elasticache.outputs.elasticache_endpoint
  elasticache_egress_sg_id      = dependency.elasticache.outputs.elasticache_egress_sg_id
  loadbalancer_sg_id            = dependency.load_balancer.outputs.ecs_loadbalancer_sg_id
  loadbalancer_egress_sg_id     = dependency.load_balancer.outputs.ecs_loadbalancer_egress_sg_id
  loadbalancer_target_group_arn = dependency.load_balancer.outputs.ecs_loadbalancer_target_group_arn
  data_bucket_arn               = dependency.s3.outputs.data_bucket_arn
  data_bucket_name              = dependency.s3.outputs.data_bucket_name
  container_secrets             = dependency.ssm.outputs.ssm_secret_arns
  ecs_cpu                       = 512
  ecs_memory                    = 1024
}