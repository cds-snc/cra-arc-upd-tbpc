inputs = {
  account_id         = "480754269604"
  env                = "production"
  product_name       = "cra-upd-dashboard"
  cost_center_code   = "cra-upd-dashboard"
  billing_tag_key    = "CostCentre"
  billing_tag_value  = "CraUpdDashboard"
  domain             = "prod.cra-arc.cdssandbox.xyz" # temporary until we switch the domain
  # domain             = "cra-arc.alpha.canada.ca"
  ecs_instance_count = 1
}
