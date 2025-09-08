resource "aws_security_group" "cra_upd_loadbalancer_sg" {
  name        = "cra-upd-loadbalancer-sg"
  description = "LoadBalancer Security Group for CRA UPD"
  vpc_id      = var.vpc_id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_vpc_to_lb" {
  type              = "ingress"
  description       = "Allow ingress from VPC on port 80"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr_block]
  security_group_id = aws_security_group.cra_upd_loadbalancer_sg.id
}

# The prefix list for CloudFront origin-facing servers
data "aws_ec2_managed_prefix_list" "cloudfront_prefix_list" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# This rule allows us to use the load balancer as the target for a CloudFront VPC origin
# As described here: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html
resource "aws_security_group_rule" "lb_ingress_cloudfront" {
  type              = "ingress"
  description       = "Allow HTTPS ingress from CloudFront origin-facing servers"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  prefix_list_ids   = [data.aws_ec2_managed_prefix_list.cloudfront_prefix_list.id]
  security_group_id = aws_security_group.cra_upd_loadbalancer_sg.id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_ingress_sg_to_lb" {
  type                     = "ingress"
  description              = "Allow ingress from security group to load balancer on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_loadbalancer_egress_sg.id
}

resource "aws_security_group_rule" "cra_upd_sg_rule_egress_lb_to_sg" {
  type                     = "egress"
  description              = "Allow egress from load balancer to security group on port 9000"
  from_port                = 9000
  to_port                  = 9000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.cra_upd_loadbalancer_sg.id
  source_security_group_id = aws_security_group.cra_upd_loadbalancer_egress_sg.id
}


resource "aws_security_group" "cra_upd_loadbalancer_egress_sg" {
  name        = "cra-upd-loadbalancer-egress-sg"
  description = "Allow egress to the application load balancer"
  vpc_id      = var.vpc_id
}
