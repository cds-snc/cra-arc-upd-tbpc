module "cra_upd_vpc" {
  source            = "github.com/cds-snc/terraform-modules//vpc?ref=v10.4.4"
  name              = var.product_name
  billing_tag_value = var.billing_tag_value

  # Enable 2 availability zones for subnets as this is requirement for the DocumentDB database
  availability_zones = 2

  # Enables VPC flow logs and blocks ssh and rdp traffic
  enable_flow_log = true
  block_ssh       = true
  block_rdp       = true

  # uses single nat gateway if not in production 
  single_nat_gateway = var.env != "production"

  # allow HTTPS connections on part 443 out to the internet and allow a response back from the internet
  allow_https_request_out          = true
  allow_https_request_out_response = true

  # needed to allow requests from CloudFront
  allow_https_request_in          = true
  allow_https_request_in_response = true
}